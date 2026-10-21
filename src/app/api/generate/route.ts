import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getBookById,
  getDocTitle,
  FormatOptions,
  ParsedChapter,
} from "@/lib/bible/books";
import { fetchEsvChapter } from "@/lib/bible/providers/esv";
import { createGoogleDocWithAuth } from "@/lib/google/docs";
import { db } from "@/lib/db";
import { executions, bibleCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendAlert } from "@/lib/alerts/notify";

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      bookId,
      chapterStart,
      chapterEnd,
      version = "ESV",
      options,
    }: {
      bookId: string;
      chapterStart: number;
      chapterEnd: number;
      version?: string;
      options: FormatOptions;
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

    // 1. Check user authentication
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("bsf_session");
    if (!sessionCookie) {
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

    const session = JSON.parse(sessionCookie.value);
    const accessToken = session.accessToken;
    const userEmail = session.user?.email || "anonymous";

    if (!accessToken) {
      return NextResponse.json(
        { error: "Invalid session", needsAuth: true },
        { status: 401 }
      );
    }

    // 2. Fetch and parse each chapter (using Neon cache if available)
    const chapters: ParsedChapter[] = [];

    for (let ch = chapterStart; ch <= chapterEnd; ch++) {
      const cacheKey = `${version}/${bookId}/${ch}`;
      let parsedCh: ParsedChapter | null = null;

      // Try reading from Neon DB cache
      if (db) {
        try {
          const cached = await db
            .select()
            .from(bibleCache)
            .where(eq(bibleCache.passageKey, cacheKey))
            .limit(1);

          if (cached.length > 0 && cached[0].contentJson) {
            parsedCh = cached[0].contentJson as ParsedChapter;
          }
        } catch (cacheErr) {
          console.warn("[Cache] Read error:", cacheErr);
        }
      }

      // If not cached, fetch from Crossway ESV API
      if (!parsedCh) {
        parsedCh = await fetchEsvChapter(bookId, ch, options);

        // Store into Neon DB cache
        if (db && parsedCh) {
          try {
            await db
              .insert(bibleCache)
              .values({
                passageKey: cacheKey,
                contentJson: parsedCh,
              })
              .onConflictDoNothing();
          } catch (cacheWriteErr) {
            console.warn("[Cache] Write error:", cacheWriteErr);
          }
        }
      }

      chapters.push(parsedCh);
    }

    // 3. Build document title and create Google Doc
    const docTitle = getDocTitle(bookId, chapterStart, chapterEnd, version);
    const docResult = await createGoogleDocWithAuth(
      accessToken,
      docTitle,
      chapters,
      options,
      version
    );

    const durationMs = Date.now() - startTime;

    // 4. Log execution to Neon DB
    if (db) {
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

    return NextResponse.json({
      success: true,
      docId: docResult.docId,
      docUrl: docResult.docUrl,
      docName: docResult.docName,
      durationMs,
    });
  } catch (error: any) {
    console.error("[Generate] Doc generation failure:", error);

    // Send immediate failure alert
    await sendAlert({
      type: "api_error",
      title: "Document Generation Failed",
      details: error.message || String(error),
    });

    return NextResponse.json(
      {
        error: "Generation Failed",
        message: error.message || "An unexpected error occurred while creating your document.",
      },
      { status: 500 }
    );
  }
}
