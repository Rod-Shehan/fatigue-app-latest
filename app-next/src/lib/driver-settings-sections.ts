/**
 * Driver Settings domains — same idea as Enterprise Driver Overview:
 * numbered jump cards, then framed sections with an eyebrow + blurb.
 * Phone-first. Fleet pack / workshop emails live on Enterprise (Owner console).
 */

export const DRIVER_SETTINGS_PAGE_SUBTITLE =
  "Three areas: this phone, your weeks, and your account.";

export const DRIVER_SETTINGS_SECTIONS = {
  device: {
    id: "this-phone",
    number: "1",
    title: "This phone",
    overviewTitle: "1. This phone",
    eyebrow: "Display and install",
    subtitle: "Dark mode, voice alerts, iPhone and Android install steps, and backup on this device.",
  },
  record: {
    id: "your-record",
    number: "2",
    title: "Your record",
    overviewTitle: "2. Your record",
    eyebrow: "Weeks and help",
    subtitle: "Open a week, sign past weeks, saved runs, and how the record works.",
  },
  account: {
    id: "account",
    number: "3",
    title: "Account",
    overviewTitle: "3. Account",
    eyebrow: "Sign-in and messages",
    subtitle: "Messages, password, manager sign-in, and log out.",
  },
} as const;

export const DRIVER_SETTINGS_SECTION_IDS = [
  DRIVER_SETTINGS_SECTIONS.device.id,
  DRIVER_SETTINGS_SECTIONS.record.id,
  DRIVER_SETTINGS_SECTIONS.account.id,
] as const;

export type DriverSettingsSectionId = (typeof DRIVER_SETTINGS_SECTION_IDS)[number];
