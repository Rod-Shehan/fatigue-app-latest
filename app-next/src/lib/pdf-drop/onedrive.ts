import { readOnedriveConfig } from "@/lib/pdf-drop/config";
import type { PdfDropAdapter, PdfDropFile } from "@/lib/pdf-drop/types";

const GRAPH = "https://graph.microsoft.com/v1.0";
const INVITE_MESSAGE =
  "Circadia PDF drop — take these files and file them in your own system. This folder is a transfer dock, not your archive.";

type TokenCache = { accessToken: string; expiresAtMs: number };

let tokenCache: TokenCache | null = null;

async function graphToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }
  const cfg = readOnedriveConfig();
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || "OneDrive token request failed.");
  }
  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + Math.max(60, Number(json.expires_in) || 3600) * 1000,
  };
  return tokenCache.accessToken;
}

function encodeDrivePath(relativePath: string): string {
  return relativePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function graphJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T }> {
  const token = await graphToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await res.text();
  let json = {} as T;
  if (text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = { message: text } as T;
    }
  }
  return { ok: res.ok, status: res.status, json };
}

function driveRoot(user: string): string {
  return `/users/${encodeURIComponent(user)}/drive/root`;
}

export function createOnedriveAdapter(): PdfDropAdapter {
  return {
    provider: "onedrive",

    async ensureFolder(folderPath: string) {
      const { driveUser } = readOnedriveConfig();
      const encoded = encodeDrivePath(folderPath);
      const existing = await graphJson<{ id?: string; webUrl?: string; error?: { message?: string } }>(
        `${driveRoot(driveUser)}:/${encoded}`
      );
      if (existing.ok && existing.json.id) {
        return { itemId: existing.json.id, webUrl: existing.json.webUrl ?? null };
      }
      if (existing.status !== 404) {
        throw new Error(existing.json.error?.message || "Could not read the OneDrive drop folder.");
      }

      const parts = folderPath.split("/").filter(Boolean);
      let cursor = "";
      let lastId = "";
      let lastUrl: string | null = null;
      for (const part of parts) {
        cursor = cursor ? `${cursor}/${part}` : part;
        const look = await graphJson<{ id?: string; webUrl?: string }>(
          `${driveRoot(driveUser)}:/${encodeDrivePath(cursor)}`
        );
        if (look.ok && look.json.id) {
          lastId = look.json.id;
          lastUrl = look.json.webUrl ?? null;
          continue;
        }
        const parentPath = cursor.includes("/") ? cursor.slice(0, cursor.lastIndexOf("/")) : "";
        const createPath = parentPath
          ? `${driveRoot(driveUser)}:/${encodeDrivePath(parentPath)}:/children`
          : `${driveRoot(driveUser)}/children`;
        const created = await graphJson<{ id?: string; webUrl?: string; error?: { message?: string } }>(createPath, {
          method: "POST",
          body: JSON.stringify({ name: part, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
        });
        if (!created.ok || !created.json.id) {
          const retry = await graphJson<{ id?: string; webUrl?: string }>(
            `${driveRoot(driveUser)}:/${encodeDrivePath(cursor)}`
          );
          if (!retry.ok || !retry.json.id) {
            throw new Error(created.json.error?.message || `Could not create OneDrive folder ${cursor}.`);
          }
          lastId = retry.json.id;
          lastUrl = retry.json.webUrl ?? null;
          continue;
        }
        lastId = created.json.id;
        lastUrl = created.json.webUrl ?? null;
      }
      if (!lastId) throw new Error("Could not create the OneDrive drop folder.");
      return { itemId: lastId, webUrl: lastUrl };
    },

    async putFile(file: PdfDropFile) {
      const { driveUser } = readOnedriveConfig();
      const token = await graphToken();
      const slash = file.relativePath.lastIndexOf("/");
      if (slash > 0) {
        await this.ensureFolder(file.relativePath.slice(0, slash));
      }
      const res = await fetch(`${GRAPH}${driveRoot(driveUser)}:/${encodeDrivePath(file.relativePath)}:/content`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.contentType,
        },
        body: Buffer.from(file.bytes),
      });
      const json = (await res.json()) as { webUrl?: string; error?: { message?: string } };
      if (!res.ok) {
        throw new Error(json.error?.message || "OneDrive upload failed.");
      }
      return { webUrl: json.webUrl ?? null };
    },

    async inviteEmail(folderPath: string, email: string) {
      const folder = await this.ensureFolder(folderPath);
      const { driveUser } = readOnedriveConfig();
      const invited = await graphJson<{
        value?: unknown[];
        error?: { message?: string; code?: string };
      }>(`/users/${encodeURIComponent(driveUser)}/drive/items/${folder.itemId}/invite`, {
        method: "POST",
        body: JSON.stringify({
          requireSignIn: true,
          sendInvitation: true,
          roles: ["read"],
          recipients: [{ email }],
          message: INVITE_MESSAGE,
        }),
      });
      if (invited.ok) {
        return { invited: true, detail: `Shared ${folderPath} with ${email}.` };
      }
      const message = invited.json.error?.message || "OneDrive share failed.";
      if (/already|exists|granted/i.test(message)) {
        return { invited: false, detail: `${email} already has access.` };
      }
      throw new Error(message);
    },
  };
}
