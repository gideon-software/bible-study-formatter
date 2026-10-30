import { NextResponse } from "next/server";
import { generateGoogleAuthUrl, resolveRedirectUri } from "@/lib/google/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawReturnTo = searchParams.get("returnTo") || "/";
  const returnTo =
    rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/";

  // Check if credentials exist
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local",
      },
      { status: 500 }
    );
  }

  const redirectUri = resolveRedirectUri(request);
  const authUrl = generateGoogleAuthUrl(redirectUri, returnTo);
  return NextResponse.redirect(authUrl);
}
