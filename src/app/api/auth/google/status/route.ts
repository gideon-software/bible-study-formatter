import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("bsf_session");

  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin =
      session.user?.email &&
      adminEmails.includes(session.user.email.toLowerCase());

    return NextResponse.json({
      authenticated: true,
      user: session.user,
      isAdmin,
    });
  } catch (e) {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
