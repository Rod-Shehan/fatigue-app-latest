import { googleDriveMailbox } from "@/lib/pdf-drop/mailbox";

export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

let tokenCache: { accessToken: string; expiresAtMs: number } | null = null;
let verifiedMailbox: string | null = null;

export function readGoogleOAuthClient(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET.");
  }
  return { clientId, clientSecret };
}

export function readGoogleRefreshToken(): string {
  const token = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();
  if (!token) {
    throw new Error("Set GOOGLE_DRIVE_REFRESH_TOKEN after connecting circadia24@gmail.com.");
  }
  return token;
}

export async function exchangeGoogleAuthCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<{ refreshToken: string; accessToken: string; email: string }> {
  const { clientId, clientSecret } = readGoogleOAuthClient();
  const body = new URLSearchParams({
    code: opts.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || "Google authorization code exchange failed.");
  }
  if (!json.refresh_token) {
    throw new Error("Google did not return a refresh token. Use prompt=consent and try again.");
  }
  const email = await googleAccountEmail(json.access_token);
  assertCircadiaDriveMailbox(email);
  return { refreshToken: json.refresh_token, accessToken: json.access_token, email };
}

export function assertCircadiaDriveMailbox(email: string): void {
  const expected = googleDriveMailbox();
  if (email.trim().toLowerCase() !== expected) {
    throw new Error(`Connect ${expected} only. Google signed in as ${email}.`);
  }
}

export async function googleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { email?: string; error?: { message?: string } };
  if (!res.ok || !json.email) {
    throw new Error(json.error?.message || "Could not read the Google account email.");
  }
  return json.email.trim().toLowerCase();
}

export function googleAuthorizeUrl(redirectUri: string): string {
  const { clientId } = readGoogleOAuthClient();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_DRIVE_SCOPES.join(" "),
    login_hint: googleDriveMailbox(),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function googleDriveAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }
  const { clientId, clientSecret } = readGoogleOAuthClient();
  const refreshToken = readGoogleRefreshToken();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || "Google Drive token refresh failed.");
  }
  if (!verifiedMailbox) {
    const email = await googleAccountEmail(json.access_token);
    assertCircadiaDriveMailbox(email);
    verifiedMailbox = email;
  }
  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + Math.max(60, Number(json.expires_in) || 3600) * 1000,
  };
  return tokenCache.accessToken;
}
