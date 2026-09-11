import type { PdfDropProvider } from "@/lib/pdf-drop/types";
import { PDF_DROP_PROVIDERS } from "@/lib/pdf-drop/types";
import { clientDropFolderPath } from "@/lib/pdf-drop/filename";
import { googleDriveMailbox } from "@/lib/pdf-drop/mailbox";

export function parsePdfDropProvider(raw = process.env.PDF_DROP_PROVIDER): PdfDropProvider {
  const value = (raw ?? "off").trim().toLowerCase();
  if ((PDF_DROP_PROVIDERS as readonly string[]).includes(value)) {
    return value as PdfDropProvider;
  }
  return "off";
}

export function googleDriveEnvMissing(): string[] {
  const keys = ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "GOOGLE_DRIVE_REFRESH_TOKEN"] as const;
  return keys.filter((key) => !process.env[key]?.trim());
}

export function onedriveEnvMissing(): string[] {
  const keys = [
    "ONEDRIVE_TENANT_ID",
    "ONEDRIVE_CLIENT_ID",
    "ONEDRIVE_CLIENT_SECRET",
    "ONEDRIVE_DRIVE_USER",
  ] as const;
  return keys.filter((key) => !process.env[key]?.trim());
}

export function pdfDropStatus(opts: { legalName: string; slug: string; shareEmail: string | null }): {
  provider: PdfDropProvider;
  configured: boolean;
  folderPath: string;
  shareEmail: string | null;
  mailbox: string;
  missing: string[];
} {
  const provider = parsePdfDropProvider();
  const folderPath = clientDropFolderPath(opts.legalName, opts.slug);
  const mailbox = googleDriveMailbox();
  if (provider === "off") {
    return {
      provider,
      configured: false,
      folderPath,
      shareEmail: opts.shareEmail,
      mailbox,
      missing: ["PDF_DROP_PROVIDER"],
    };
  }
  if (provider === "dropbox") {
    return {
      provider,
      configured: false,
      folderPath,
      shareEmail: opts.shareEmail,
      mailbox,
      missing: ["Dropbox is not wired yet"],
    };
  }
  if (provider === "onedrive") {
    return {
      provider,
      configured: false,
      folderPath,
      shareEmail: opts.shareEmail,
      mailbox,
      missing: ["OneDrive is parked — use Google Drive"],
    };
  }
  const missing = googleDriveEnvMissing();
  return {
    provider,
    configured: missing.length === 0,
    folderPath,
    shareEmail: opts.shareEmail,
    mailbox,
    missing,
  };
}

export function readOnedriveConfig(): {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  driveUser: string;
} {
  const missing = onedriveEnvMissing();
  if (missing.length > 0) {
    throw new Error(`OneDrive drop is not configured. Missing ${missing.join(", ")}.`);
  }
  return {
    tenantId: process.env.ONEDRIVE_TENANT_ID!.trim(),
    clientId: process.env.ONEDRIVE_CLIENT_ID!.trim(),
    clientSecret: process.env.ONEDRIVE_CLIENT_SECRET!.trim(),
    driveUser: process.env.ONEDRIVE_DRIVE_USER!.trim(),
  };
}
