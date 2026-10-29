import { NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { executions } from "@/lib/db/schema";
import { desc, ilike, isNotNull, and, inArray, eq } from "drizzle-orm";
import { getDocTitle } from "@/lib/bible/books";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { trashGoogleDriveFile, renameGoogleDriveFile } from "@/lib/google/docs";

export async function GET() {
  await connection();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("bsf_session");
  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false, history: [] });
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    const userEmail = session.user?.email;
    if (!userEmail) {
      return NextResponse.json({ authenticated: false, history: [] });
    }

    if (!db) {
      return NextResponse.json({ authenticated: true, history: [] });
    }

    const rows = await db
      .select()
      .from(executions)
      .where(
        and(
          ilike(executions.userEmail, userEmail.trim()),
          isNotNull(executions.docUrl)
        )
      )
      .orderBy(desc(executions.createdAt))
      .limit(100);

    const history = rows.map((row) => ({
      id: row.id,
      docId: row.docId,
      docUrl: row.docUrl,
      docName: getDocTitle(
        row.bookId,
        row.chapterStart,
        row.chapterEnd,
        row.versionAbbr
      ),
      versionAbbr: row.versionAbbr,
      bookId: row.bookId,
      bookName: row.bookName,
      chapterStart: row.chapterStart,
      chapterEnd: row.chapterEnd,
      options: row.optionsJson,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({
      authenticated: true,
      history,
    });
  } catch (err) {
    console.error("Failed to fetch user document history:", err);
    return NextResponse.json({ authenticated: false, history: [] });
  }
}

/**
 * Moves one or more BSF-created Google Docs to the user's Google Drive Trash
 * and hides them from the user's history list (while keeping execution records for analytics).
 */
export async function DELETE(request: Request) {
  await connection();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("bsf_session");
  if (!sessionCookie) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    const userEmail = session.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await request.json();
    const docIds: string[] = Array.isArray(body?.docIds)
      ? body.docIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : typeof body?.docId === "string" && body.docId.length > 0
      ? [body.docId]
      : [];

    if (docIds.length === 0) {
      return NextResponse.json({ error: "No document IDs provided" }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ success: true, trashedIds: docIds });
    }

    // Verify ownership of these docIds before calling Drive API
    const ownedRows = await db
      .select({
        id: executions.id,
        docId: executions.docId,
        versionAbbr: executions.versionAbbr,
        bookId: executions.bookId,
        chapterStart: executions.chapterStart,
        chapterEnd: executions.chapterEnd,
      })
      .from(executions)
      .where(
        and(
          ilike(executions.userEmail, userEmail.trim()),
          inArray(executions.docId, docIds)
        )
      );

    const ownedDocIds = Array.from(
      new Set(
        ownedRows
          .map((r) => r.docId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    if (ownedDocIds.length === 0) {
      return NextResponse.json({ error: "No matching documents found" }, { status: 404 });
    }

    const { client: authClient } = await getAuthenticatedClient({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiryDate: session.expiryDate,
    });

    // Move each owned doc to Google Drive Trash (ignore 404 if user already deleted it in Drive)
    await Promise.all(
      ownedDocIds.map(async (fileId) => {
        try {
          await trashGoogleDriveFile(authClient, fileId);
        } catch (driveErr) {
          console.warn(`[Drive] Could not trash file ${fileId}:`, driveErr);
        }
      })
    );

    // Clear docUrl so GET /api/user/history hides it without deleting admin analytics
    await db
      .update(executions)
      .set({ docUrl: null })
      .where(
        and(
          ilike(executions.userEmail, userEmail.trim()),
          inArray(executions.docId, ownedDocIds)
        )
      );

    // If the latest doc for a passage was trashed and an earlier run remains,
    // restore the clean base title on the promoted runner-up in Google Drive
    const affectedPassages = new Map<
      string,
      {
        versionAbbr: string;
        bookId: string;
        chapterStart: number;
        chapterEnd: number;
      }
    >();
    for (const row of ownedRows) {
      const pKey = `${row.bookId}:${row.chapterStart}-${row.chapterEnd}:${row.versionAbbr}`;
      if (!affectedPassages.has(pKey)) {
        affectedPassages.set(pKey, {
          versionAbbr: row.versionAbbr,
          bookId: row.bookId,
          chapterStart: row.chapterStart,
          chapterEnd: row.chapterEnd,
        });
      }
    }

    await Promise.all(
      Array.from(affectedPassages.values()).map(async (p) => {
        try {
          const remaining = await db!
            .select({ docId: executions.docId })
            .from(executions)
            .where(
              and(
                ilike(executions.userEmail, userEmail.trim()),
                eq(executions.versionAbbr, p.versionAbbr),
                eq(executions.bookId, p.bookId),
                eq(executions.chapterStart, p.chapterStart),
                eq(executions.chapterEnd, p.chapterEnd),
                isNotNull(executions.docUrl),
                isNotNull(executions.docId)
              )
            )
            .orderBy(desc(executions.createdAt))
            .limit(1);

          if (remaining.length > 0 && remaining[0].docId) {
            const cleanTitle = getDocTitle(
              p.bookId,
              p.chapterStart,
              p.chapterEnd,
              p.versionAbbr
            );
            await renameGoogleDriveFile(
              authClient,
              remaining[0].docId,
              cleanTitle
            );
          }
        } catch (promoteErr) {
          console.warn(
            "[Drive] Non-fatal error restoring clean title on promoted doc:",
            promoteErr
          );
        }
      })
    );

    return NextResponse.json({
      success: true,
      trashedIds: ownedDocIds,
    });
  } catch (err) {
    console.error("Failed to trash documents:", err);
    return NextResponse.json(
      { error: "Failed to move documents to Google Drive trash" },
      { status: 500 }
    );
  }
}

