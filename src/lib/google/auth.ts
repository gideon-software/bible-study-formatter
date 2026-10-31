import { createHmac, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "bsf_session";
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  email?: string | null;
  name?: string | null;
  picture?: string | null;
}

export interface SessionTokens {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
}

export interface SessionData extends SessionTokens {
  user?: SessionUser;
}

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.CRON_SECRET ||
    "bsf-local-dev-secret-key"
  );
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest("base64url");
}

/**
 * Serializes and HMAC-SHA256 signs session data for the HTTP-only cookie.
 */
export function serializeSessionCookie(session: SessionData): string {
  const payloadB64 = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url"
  );
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and parses the session cookie value.
 * Supports signed `payload.signature` tokens, with a legacy migration path
 * for active pre-upgrade JSON cookies that contain OAuth credentials.
 */
export function parseSessionCookie(rawValue?: string | null): SessionData | null {
  if (!rawValue) return null;

  try {
    // 1. Signed format: <base64url-payload>.<base64url-hmac>
    if (!rawValue.startsWith("{") && rawValue.includes(".")) {
      const dotIdx = rawValue.lastIndexOf(".");
      const payloadB64 = rawValue.slice(0, dotIdx);
      const signature = rawValue.slice(dotIdx + 1);
      const expectedSig = signPayload(payloadB64);

      const sigBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expectedSig);
      if (
        sigBuf.length !== expectedBuf.length ||
        !timingSafeEqual(sigBuf, expectedBuf)
      ) {
        return null;
      }

      const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
      return JSON.parse(jsonStr) as SessionData;
    }

    // 2. Legacy transition fallback: only accept if OAuth tokens are present
    const parsed = JSON.parse(rawValue) as SessionData;
    if (parsed && (parsed.accessToken || parsed.refreshToken)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Writes the signed session cookie onto a NextResponse with standard security flags.
 */
export function setSessionCookie(
  response: NextResponse,
  session: SessionData
): void {
  response.cookies.set(SESSION_COOKIE_NAME, serializeSessionCookie(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

/**
 * Returns the normalized list of administrator email addresses from ADMIN_EMAILS.
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks whether the given email belongs to a configured administrator.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function resolveRedirectUri(request: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  return `${protocol}://${host}/api/auth/callback/google`;
}

export function getOAuth2Client(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl =
    redirectUri ||
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/auth/callback/google";

  return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
}

export function generateGoogleAuthUrl(redirectUri?: string, state?: string): string {
  const oauth2Client = getOAuth2Client(redirectUri);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    prompt: "consent",
    state: state || "bsf_auth",
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri?: string) {
  const oauth2Client = getOAuth2Client(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return {
    tokens,
    user: {
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture,
    },
  };
}

export async function getAuthenticatedClient(tokens: SessionTokens): Promise<{
  client: InstanceType<typeof google.auth.OAuth2>;
  refreshedTokens?: SessionTokens;
}> {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
  });

  let refreshedTokens: SessionTokens | undefined;

  client.on("tokens", (newTokens) => {
    refreshedTokens = {
      accessToken: newTokens.access_token || tokens.accessToken,
      refreshToken: newTokens.refresh_token || tokens.refreshToken,
      expiryDate: newTokens.expiry_date || tokens.expiryDate,
    };
  });

  // If expiryDate has passed or is within 60s, proactively refresh
  const isExpiringSoon =
    tokens.expiryDate ? Date.now() >= tokens.expiryDate - 60_000 : false;

  if (tokens.refreshToken && (isExpiringSoon || !tokens.accessToken)) {
    try {
      const response = await client.getAccessToken();
      if (response?.token) {
        refreshedTokens = {
          accessToken: response.token,
          refreshToken: client.credentials.refresh_token || tokens.refreshToken,
          expiryDate: client.credentials.expiry_date || tokens.expiryDate,
        };
      }
    } catch (err) {
      console.warn("[Auth] Proactive token refresh error:", err);
    }
  }

  return { client, refreshedTokens };
}
