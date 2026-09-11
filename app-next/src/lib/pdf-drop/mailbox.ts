/** Circadia-owned Gmail that holds the PDF drop folders in My Drive. */
export const CIRCADIA_DRIVE_GMAIL = "circadia24@gmail.com";

export function googleDriveMailbox(
  raw = process.env.GOOGLE_DRIVE_USER_EMAIL
): string {
  const email = (raw ?? CIRCADIA_DRIVE_GMAIL).trim().toLowerCase();
  return email || CIRCADIA_DRIVE_GMAIL;
}
