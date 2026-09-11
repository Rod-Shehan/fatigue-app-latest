import { pdfDropStatus, parsePdfDropProvider } from "@/lib/pdf-drop/config";
import { clientDropFolderPath } from "@/lib/pdf-drop/filename";
import { createGoogleDriveAdapter } from "@/lib/pdf-drop/google-drive";
import type { PdfDropAdapter, PdfDropClient, PdfDropFile } from "@/lib/pdf-drop/types";

export { clientDropFolderPath, weekTripSheetDropPath } from "@/lib/pdf-drop/filename";
export { parsePdfDropProvider, pdfDropStatus } from "@/lib/pdf-drop/config";
export type { PdfDropClient, PdfDropFile, PdfDropProvider, PdfDropStatus } from "@/lib/pdf-drop/types";

export function getPdfDropAdapter(): PdfDropAdapter {
  const provider = parsePdfDropProvider();
  if (provider === "google") return createGoogleDriveAdapter();
  if (provider === "dropbox") {
    throw new Error("Dropbox drop is not wired yet. Use Google Drive for now.");
  }
  if (provider === "onedrive") {
    throw new Error("OneDrive drop is parked. Set PDF_DROP_PROVIDER=google.");
  }
  throw new Error("PDF drop is off. Set PDF_DROP_PROVIDER=google.");
}

export function dropStatusForClient(client: Pick<PdfDropClient, "legalName" | "slug" | "shareEmail">) {
  return pdfDropStatus({
    legalName: client.legalName,
    slug: client.slug,
    shareEmail: client.shareEmail,
  });
}

export async function inviteClientToDrop(client: PdfDropClient) {
  const status = dropStatusForClient(client);
  if (!status.configured) {
    throw new Error(`PDF drop is not ready. ${status.missing.join(", ")}`);
  }
  if (!client.shareEmail) {
    throw new Error("Set the filing inbox email on this client first.");
  }
  const adapter = getPdfDropAdapter();
  return adapter.inviteEmail(clientDropFolderPath(client.legalName, client.slug), client.shareEmail);
}

export async function putClientDropFile(client: PdfDropClient, file: PdfDropFile) {
  const status = dropStatusForClient(client);
  if (!status.configured) {
    throw new Error(`PDF drop is not ready. ${status.missing.join(", ")}`);
  }
  return getPdfDropAdapter().putFile(file);
}
