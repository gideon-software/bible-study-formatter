import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  exchangeCodeForTokens,
  hasRequiredDriveScope,
  resolveRedirectUri,
  setSessionCookie,
} from "@/lib/google/auth";

function buildAuthErrorRedirect(
  requestUrl: string,
  safeState: string,
  authError: string
): NextResponse {
  const redirectUrl = new URL(safeState, requestUrl);
  redirectUrl.searchParams.set("auth_error", authError);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const rawState = searchParams.get("state") || "/";
  // Prevent open redirects by only allowing internal relative paths
  const safeState =
    rawState.startsWith("/") && !rawState.startsWith("//") ? rawState : "/";

  if (!code) {
    return buildAuthErrorRedirect(
      request.url,
      safeState,
      oauthError || "no_code"
    );
  }

  try {
    const redirectUri = resolveRedirectUri(request);
    const { tokens, user } = await exchangeCodeForTokens(code, redirectUri);

    // Google's granular OAuth consent lets users uncheck Drive access while still signing in.
    // Require the drive.file scope up front so users aren't left in a broken half-authenticated state.
    if (!hasRequiredDriveScope(tokens.scope)) {
      const response = buildAuthErrorRedirect(
        request.url,
        safeState,
        "missing_drive_scope"
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

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
    return buildAuthErrorRedirect(request.url, safeState, message);
  }
}
