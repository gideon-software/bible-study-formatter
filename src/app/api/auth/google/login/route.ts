import { NextResponse } from "next/server";
import { generateGoogleAuthUrl } from "@/lib/google/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") || "/";

  // Check if credentials exist
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error: "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local",
      },
      { status: 500 }
    );
  }

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${protocol}://${host}/api/auth/callback/google`;

  const authUrl = generateGoogleAuthUrl(redirectUri, returnTo);
  return NextResponse.redirect(authUrl);
}
