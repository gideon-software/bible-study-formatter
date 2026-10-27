import { google } from "googleapis";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

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

export interface SessionTokens {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
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
