import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  isAdminEmail,
  parseSessionCookie,
} from "@/lib/google/auth";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = parseSessionCookie(sessionCookie?.value);

  if (!session || !session.user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    isAdmin: isAdminEmail(session.user.email),
  });
}
