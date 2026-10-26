import { NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  await connection();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("bsf_session");
  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false, preferences: null });
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    const userEmail = session.user?.email;
    if (!userEmail) {
      return NextResponse.json({ authenticated: false, preferences: null });
    }

    if (!db) {
      return NextResponse.json({ authenticated: true, preferences: null });
    }

    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userEmail, userEmail.toLowerCase()))
      .limit(1);

    return NextResponse.json({
      authenticated: true,
      preferences: rows[0] || null,
    });
  } catch (err) {
    console.error("Failed to fetch user preferences:", err);
    return NextResponse.json({ authenticated: false, preferences: null });
  }
}

export async function POST(req: Request) {
  await connection();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("bsf_session");
  if (!sessionCookie) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    const userEmail = session.user?.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: "Invalid user session" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!db) {
      return NextResponse.json({ success: true, dbSaved: false });
    }

    const normalizedEmail = userEmail.toLowerCase();

    // Check if record exists
    const existing = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(eq(userPreferences.userEmail, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      const updateData: Partial<typeof userPreferences.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.defaultVersion !== undefined) updateData.defaultVersion = body.defaultVersion;
      if (body.defaultOptionsJson !== undefined) updateData.defaultOptionsJson = body.defaultOptionsJson;
      if (body.lastBookId !== undefined) updateData.lastBookId = body.lastBookId;
      if (body.lastChapterStart !== undefined) updateData.lastChapterStart = body.lastChapterStart;
      if (body.lastChapterEnd !== undefined) updateData.lastChapterEnd = body.lastChapterEnd;

      await db
        .update(userPreferences)
        .set(updateData)
        .where(eq(userPreferences.userEmail, normalizedEmail));
    } else {
      await db.insert(userPreferences).values({
        userEmail: normalizedEmail,
        defaultVersion: body.defaultVersion ?? "ESV",
        defaultOptionsJson: body.defaultOptionsJson ?? {
          chapterHeaders: true,
          chapterPageBreaks: true,
          verseNumbers: true,
          titlePage: false,
          fontName: "Arial",
          fontSize: 11,
          lineSpacing: 2,
        },
        lastBookId: body.lastBookId,
        lastChapterStart: body.lastChapterStart,
        lastChapterEnd: body.lastChapterEnd,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, dbSaved: true });
  } catch (err) {
    console.error("Failed to save user preferences:", err);
    return NextResponse.json(
      { error: "Failed to save user preferences" },
      { status: 500 }
    );
  }
}
