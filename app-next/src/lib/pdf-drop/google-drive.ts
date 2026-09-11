import { googleDriveAccessToken } from "@/lib/pdf-drop/google-auth";
import type { PdfDropAdapter, PdfDropFile } from "@/lib/pdf-drop/types";

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveFile = { id?: string; webViewLink?: string; error?: { message?: string } };

function quoteQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T }> {
  const token = await googleDriveAccessToken();
  const res = await fetch(`${DRIVE}${path}`, {
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

async function findChild(parentId: string, name: string, folder: boolean): Promise<DriveFile | null> {
  const mime = folder ? ` and mimeType = '${FOLDER_MIME}'` : ` and mimeType != '${FOLDER_MIME}'`;
  const q = `'${parentId}' in parents and name = '${quoteQuery(name)}' and trashed = false${mime}`;
  const res = await driveJson<{ files?: DriveFile[]; error?: { message?: string } }>(
    `/files?q=${encodeURIComponent(q)}&fields=files(id,webViewLink)&pageSize=1`
  );
  if (!res.ok) {
    throw new Error(res.json.error?.message || "Google Drive search failed.");
  }
  return res.json.files?.[0] ?? null;
}

async function createFolder(parentId: string, name: string): Promise<DriveFile> {
  const res = await driveJson<DriveFile>("/files?fields=id,webViewLink", {
    method: "POST",
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!res.ok || !res.json.id) {
    throw new Error(res.json.error?.message || `Could not create Google Drive folder ${name}.`);
  }
  return res.json;
}

async function ensureNamedFolder(parentId: string, name: string): Promise<{ itemId: string; webUrl: string | null }> {
  const existing = await findChild(parentId, name, true);
  if (existing?.id) {
    return { itemId: existing.id, webUrl: existing.webViewLink ?? null };
  }
  const created = await createFolder(parentId, name);
  return { itemId: created.id!, webUrl: created.webViewLink ?? null };
}

async function uploadOrReplace(parentId: string, name: string, file: PdfDropFile): Promise<{ webUrl: string | null }> {
  const existing = await findChild(parentId, name, false);
  const token = await googleDriveAccessToken();
  if (existing?.id) {
    const res = await fetch(`${UPLOAD}/files/${existing.id}?uploadType=media&fields=id,webViewLink`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.contentType,
      },
      body: Buffer.from(file.bytes),
    });
    const json = (await res.json()) as DriveFile;
    if (!res.ok) throw new Error(json.error?.message || "Google Drive replace failed.");
    return { webUrl: json.webViewLink ?? null };
  }

  const boundary = `circadia_drop_${Date.now()}`;
  const meta = JSON.stringify({ name, parents: [parentId] });
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.contentType}\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--`);
  const res = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: Buffer.concat([prefix, Buffer.from(file.bytes), suffix]),
  });
  const json = (await res.json()) as DriveFile;
  if (!res.ok) throw new Error(json.error?.message || "Google Drive upload failed.");
  return { webUrl: json.webViewLink ?? null };
}

async function shareWithEmail(fileId: string, email: string, role: "reader" | "writer") {
  const res = await driveJson<{ error?: { message?: string; errors?: { reason?: string }[] } }>(
    `/files/${fileId}/permissions?sendNotificationEmail=true`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "user",
        role,
        emailAddress: email,
      }),
    }
  );
  if (res.ok) return { invited: true, detail: `Shared with ${email}.` };
  const message = res.json.error?.message || "Google Drive share failed.";
  if (/already|exists|duplicate/i.test(message)) {
    return { invited: false, detail: `${email} already has access.` };
  }
  throw new Error(message);
}

export function createGoogleDriveAdapter(): PdfDropAdapter {
  return {
    provider: "google",

    async ensureFolder(folderPath: string) {
      const parts = folderPath.split("/").filter(Boolean);
      let parentId = "root";
      let last = { itemId: "root", webUrl: null as string | null };
      for (const part of parts) {
        last = await ensureNamedFolder(parentId, part);
        parentId = last.itemId;
      }
      return last;
    },

    async putFile(file: PdfDropFile) {
      const parts = file.relativePath.split("/").filter(Boolean);
      const name = parts.pop();
      if (!name) throw new Error("Drop file path is missing a file name.");
      const folder = await this.ensureFolder(parts.join("/"));
      return uploadOrReplace(folder.itemId, name, file);
    },

    async inviteEmail(folderPath: string, email: string) {
      const folder = await this.ensureFolder(folderPath);
      return shareWithEmail(folder.itemId, email, "reader");
    },
  };
}
