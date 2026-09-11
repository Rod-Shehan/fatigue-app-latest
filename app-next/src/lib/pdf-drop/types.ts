export const PDF_DROP_PROVIDERS = ["google", "dropbox", "onedrive", "off"] as const;
export type PdfDropProvider = (typeof PDF_DROP_PROVIDERS)[number];

export type PdfDropFile = {
  /** Path under the Circadia drive root, posix, no leading slash. */
  relativePath: string;
  bytes: Uint8Array;
  contentType: string;
};

export type PdfDropClient = {
  tenantId: string;
  slug: string;
  legalName: string;
  shareEmail: string | null;
};

export type PdfDropStatus = {
  provider: PdfDropProvider;
  configured: boolean;
  folderPath: string;
  shareEmail: string | null;
  mailbox: string;
  missing: string[];
};

export interface PdfDropAdapter {
  readonly provider: Exclude<PdfDropProvider, "off">;
  putFile(file: PdfDropFile): Promise<{ webUrl: string | null }>;
  ensureFolder(folderPath: string): Promise<{ itemId: string; webUrl: string | null }>;
  inviteEmail(folderPath: string, email: string): Promise<{ invited: boolean; detail: string }>;
}
