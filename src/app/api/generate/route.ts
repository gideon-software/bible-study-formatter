import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getBookById,
  getDocTitle,
  FormatOptions,
  ParsedChapter,
  SUPPORTED_VERSIONS,
  validateEsvPassageRange,
  applyOptionsToChapter,
} from "@/lib/bible/books";
import { fetchEsvChapter } from "@/lib/bible/providers/esv";
import { fetchApiBibleChapter } from "@/lib/bible/providers/apibible";
import { fetchNetChapter } from "@/lib/bible/providers/net";
import {
  createGoogleDocWithAuth,
  formatDriveTimestampSuffix,
  renameGoogleDriveFile,
} from "@/lib/google/docs";
import {
  getAuthenticatedClient,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "@/lib/google/auth";
import { db } from "@/lib/db";
import { executions, bibleCache } from "@/lib/db/schema";
import { eq, desc, sql, inArray, and, ilike, isNotNull } from "drizzle-orm";
import { sendAlert } from "@/lib/alerts/notify";
import {
  checkRateLimit,
  releaseInFlightLock,
  recordRateLimitEvents,
} from "@/lib/bible/rateLimit";

export async function POST(request: Request) {
  const startTime = Date.now();
  let lockAcquired = false;
  let userEmailForLock: string | null = null;

  try {
    const body = await request.json();
    const {
      bookId,
      chapterStart,
      chapterEnd,
      version = "ESV",
      options,
      timeZone,
    }: {
      bookId: string;
      chapterStart: number;
      chapterEnd: number;
      version?: string;
      options: FormatOptions;
      timeZone?: string;
    } = body;

    const book = getBookById(bookId);
    if (!book) {
      return NextResponse.json({ error: `Invalid book: ${bookId}` }, { status: 400 });
    }

    if (chapterStart < 1 || chapterEnd > book.numChapters || chapterStart > chapterEnd) {
      return NextResponse.json(
        { error: `Invalid chapter range: ${chapterStart}-${chapterEnd}` },
        { status: 400 }
      );
    }

    // Validate Crossway ESV API guidelines (max 500 verses / half a book)
    // See ESV_POLICY_LIMITS in src/lib/bible/books.ts to adjust if exemption is granted
    if (version === "ESV") {
      const policyCheck = validateEsvPassageRange(bookId, chapterStart, chapterEnd);
      if (!policyCheck.allowed) {
        return NextResponse.json(
          {
            error: "Passage Range Exceeds Crossway ESV Policy",
            message: policyCheck.reason,
          },
          { status: 400 }
        );
      }
    }

    // 1. Check user authentication
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    const session = parseSessionCookie(sessionCookie?.value);
    if (!session) {
      return NextResponse.json(
        {
          error: "Authentication required",
          message:
            "Please sign in with Google so we can create the document directly in your Google Drive.",
          needsAuth: true,
        },
        { status: 401 }
      );
    }

    const userEmail = session.user?.email || "anonymous";
    userEmailForLock = userEmail;

    if (!session.accessToken && !session.refreshToken) {
      return NextResponse.json(
        { error: "Invalid session", needsAuth: true },
        { status: 401 }
      );
    }

    // 2. Batch-load any cached chapters in a single DB round-trip
    const cachedChapterMap = new Map<string, ParsedChapter>();
    let estimatedUncached = chapterEnd - chapterStart + 1;
    if (db) {
      try {
        const neededKeys: string[] = [];
        for (let ch = chapterStart; ch <= chapterEnd; ch++) {
          neededKeys.push(`${version}/${bookId}/${ch}`);
        }
        if (neededKeys.length > 0) {
          const existing = await db
            .select({
              key: bibleCache.passageKey,
              contentJson: bibleCache.contentJson,
            })
            .from(bibleCache)
            .where(inArray(bibleCache.passageKey, neededKeys));
          for (const row of existing) {
            if (row.contentJson) {
              cachedChapterMap.set(row.key, row.contentJson as ParsedChapter);
            }
          }
          estimatedUncached = Math.max(
            0,
            neededKeys.length - cachedChapterMap.size
          );
        }
      } catch (cacheCheckErr) {
        console.warn("[RateLimit] Cache check error:", cacheCheckErr);
      }
    }

    // 3. Check rate limits
    const rateCheck = await checkRateLimit({
      userEmail,
      requestedUncachedCount: estimatedUncached,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.error || "Rate Limit Exceeded",
          message: rateCheck.message,
          details: rateCheck.details,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }
    lockAcquired = true;

    // 4. Fetch and parse each chapter (using batch-loaded cache Map first)
    const chapters: ParsedChapter[] = [];
    let uncachedDownloadedCount = 0;

    for (let ch = chapterStart; ch <= chapterEnd; ch++) {
      const cacheKey = `${version}/${bookId}/${ch}`;
      let parsedCh: ParsedChapter | null =
        cachedChapterMap.get(cacheKey) || null;

      // If not cached, fetch from provider with full structural options so cache is reusable
      if (!parsedCh) {
        uncachedDownloadedCount++;
        const selectedVer = SUPPORTED_VERSIONS.find(
          (v) => String(v.id).toUpperCase() === version.toUpperCase()
        );

        const fullCacheOptions: FormatOptions = {
          ...options,
          chapterHeaders: true,
          sectionHeadings: true,
          verseNumbers: true,
        };

        if (selectedVer?.provider === "net") {
          parsedCh = await fetchNetChapter(bookId, ch, fullCacheOptions);
        } else if (selectedVer?.provider === "apibible") {
          parsedCh = await fetchApiBibleChapter(bookId, ch, version, fullCacheOptions);
        } else {
          parsedCh = await fetchEsvChapter(bookId, ch, fullCacheOptions);
        }

        // Store into Neon DB cache
        // Crossway policy: "You may not locally store more than 500 verses... You can cache up to 500 verses"
        // We enforce a rolling cache of max 10 chapters for ESV to guarantee compliance.
        if (db && parsedCh) {
          try {
            await db
              .insert(bibleCache)
              .values({
                passageKey: cacheKey,
                contentJson: parsedCh,
              })
              .onConflictDoNothing();

            // Rolling cache pruning for ESV (single batched DELETE)
            if (version === "ESV") {
              const esvEntries = await db
                .select({ id: bibleCache.id })
                .from(bibleCache)
                .where(sql`${bibleCache.passageKey} LIKE 'ESV/%'`)
                .orderBy(desc(bibleCache.createdAt));

              if (esvEntries.length > 10) {
                const idsToPrune = esvEntries.slice(10).map((e) => e.id);
                await db
                  .delete(bibleCache)
                  .where(inArray(bibleCache.id, idsToPrune));
              }
            }
          } catch (cacheWriteErr) {
            console.warn("[Cache] Write error:", cacheWriteErr);
          }
        }
      }

      chapters.push(applyOptionsToChapter(parsedCh, options));
    }

    // 5. Build document title and create Google Doc
    const docTitle = getDocTitle(bookId, chapterStart, chapterEnd, version);
    const { client: authClient, refreshedTokens } = await getAuthenticatedClient({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiryDate: session.expiryDate,
    });

    const docResult = await createGoogleDocWithAuth(
      authClient,
      docTitle,
      chapters,
      options,
      version
    );

    const durationMs = Date.now() - startTime;

    // 6. Disambiguate any previous doc for the same passage/version in Google Drive, then log execution
    if (db) {
      if (userEmail) {
        try {
          const prevDocs = await db
            .select({
              docId: executions.docId,
              createdAt: executions.createdAt,
            })
            .from(executions)
            .where(
              and(
                ilike(executions.userEmail, userEmail.trim()),
                eq(executions.versionAbbr, version),
                eq(executions.bookId, bookId),
                eq(executions.chapterStart, chapterStart),
                eq(executions.chapterEnd, chapterEnd),
                isNotNull(executions.docUrl),
                isNotNull(executions.docId)
              )
            )
            .orderBy(desc(executions.createdAt))
            .limit(1);

          if (prevDocs.length > 0 && prevDocs[0].docId) {
            const suffix = formatDriveTimestampSuffix(
              new Date(prevDocs[0].createdAt),
              timeZone
            );
            const renamedTitle = `${docTitle} ${suffix}`;
            await renameGoogleDriveFile(
              authClient,
              prevDocs[0].docId,
              renamedTitle
            );
          }
        } catch (renameErr) {
          console.warn(
            "[Drive] Non-fatal error renaming previous duplicate doc:",
            renameErr
          );
        }
      }

      try {
        await db.insert(executions).values({
          userEmail,
          versionAbbr: version,
          bookId,
          bookName: book.name,
          chapterStart,
          chapterEnd,
          docId: docResult.docId,
          docUrl: docResult.docUrl,
          optionsJson: options,
          durationMs,
        });
      } catch (logErr) {
        console.error("[DB] Execution log error:", logErr);
      }
    }

    // Record rate limit events (doc generation + any uncached chapters downloaded)
    await recordRateLimitEvents({
      userEmail,
      uncachedChaptersCount: uncachedDownloadedCount,
    });

    const response = NextResponse.json({
      success: true,
      docId: docResult.docId,
      docUrl: docResult.docUrl,
      docName: docResult.docName,
      durationMs,
    });

    // If Google OAuth tokens were refreshed, update signed session cookie
    if (refreshedTokens) {
      setSessionCookie(response, {
        ...session,
        accessToken: refreshedTokens.accessToken || session.accessToken,
        refreshToken: refreshedTokens.refreshToken || session.refreshToken,
        expiryDate: refreshedTokens.expiryDate || session.expiryDate,
      });
    }

    return response;
  } catch (error: unknown) {
    console.error("[Generate] Doc generation failure:", error);
    const details = error instanceof Error ? error.message : String(error);

    // Check if error is due to expired Google credentials
    const isAuthError =
      details.includes("invalid authentication credentials") ||
      details.includes("invalid_grant") ||
      details.includes("Invalid Credentials") ||
      details.includes("Unauthorized") ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: unknown }).code === 401);

    if (isAuthError) {
      return NextResponse.json(
        {
          error: "Authentication required",
          message: "Your Google session has expired. Please sign in again.",
          needsAuth: true,
        },
        { status: 401 }
      );
    }

    // Send immediate failure alert
    await sendAlert({
      type: "api_error",
      title: "Document Generation Failed",
      details,
    });

    return NextResponse.json(
      {
        error: "Generation Failed",
        message: details || "An unexpected error occurred while creating your document.",
      },
      { status: 500 }
    );
  } finally {
    if (lockAcquired && userEmailForLock) {
      releaseInFlightLock(userEmailForLock);
    }
  }
}
