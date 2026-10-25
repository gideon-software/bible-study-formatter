import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "/";

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=no_code", request.url));
  }

  try {
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${protocol}://${host}/api/auth/callback/google`;

    const { tokens, user } = await exchangeCodeForTokens(code, redirectUri);

    const sessionPayload = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      user,
    };

    const response = NextResponse.redirect(new URL(state, request.url));

    // Store auth session in secure HTTP-only cookie
    response.cookies.set("bsf_session", JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: unknown) {
    console.error("[Auth] Google callback error:", error);
    const message = error instanceof Error ? error.message : "auth_failed";
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
