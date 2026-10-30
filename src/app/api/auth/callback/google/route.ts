import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  resolveRedirectUri,
  setSessionCookie,
} from "@/lib/google/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state") || "/";
  // Prevent open redirects by only allowing internal relative paths
  const safeState =
    rawState.startsWith("/") && !rawState.startsWith("//") ? rawState : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=no_code", request.url));
  }

  try {
    const redirectUri = resolveRedirectUri(request);
    const { tokens, user } = await exchangeCodeForTokens(code, redirectUri);

    const response = NextResponse.redirect(new URL(safeState, request.url));

    setSessionCookie(response, {
      accessToken: tokens.access_token || undefined,
      refreshToken: tokens.refresh_token || undefined,
      expiryDate: tokens.expiry_date || undefined,
      user,
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
