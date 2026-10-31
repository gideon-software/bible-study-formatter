import { NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/google/auth";
import {
  DEFAULT_FORMAT_OPTIONS,
  DEFAULT_VERSION,
  sanitizeFormatOptions,
} from "@/lib/bible/books";

export async function GET() {
  await connection();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = parseSessionCookie(sessionCookie?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false, preferences: null });
  }

  try {
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
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = parseSessionCookie(sessionCookie?.value);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
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
    const now = new Date();

    const sanitizedOptions =
      body.defaultOptionsJson !== undefined
        ? sanitizeFormatOptions(body.defaultOptionsJson)
        : undefined;

    const updateSet: Partial<typeof userPreferences.$inferInsert> = {
      updatedAt: now,
    };
    if (body.defaultVersion !== undefined) updateSet.defaultVersion = body.defaultVersion;
    if (sanitizedOptions !== undefined) updateSet.defaultOptionsJson = sanitizedOptions;
    if (body.lastBookId !== undefined) updateSet.lastBookId = body.lastBookId;
    if (body.lastChapterStart !== undefined) updateSet.lastChapterStart = body.lastChapterStart;
    if (body.lastChapterEnd !== undefined) updateSet.lastChapterEnd = body.lastChapterEnd;

    await db
      .insert(userPreferences)
      .values({
        userEmail: normalizedEmail,
        defaultVersion: body.defaultVersion ?? DEFAULT_VERSION,
        defaultOptionsJson: sanitizedOptions ?? DEFAULT_FORMAT_OPTIONS,
        lastBookId: body.lastBookId,
        lastChapterStart: body.lastChapterStart,
        lastChapterEnd: body.lastChapterEnd,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userPreferences.userEmail,
        set: updateSet,
      });

    return NextResponse.json({ success: true, dbSaved: true });
  } catch (err) {
    console.error("Failed to save user preferences:", err);
    return NextResponse.json(
      { error: "Failed to save user preferences" },
      { status: 500 }
    );
  }
}
