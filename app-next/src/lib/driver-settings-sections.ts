/**
 * Driver Settings domains — same idea as Enterprise Driver Overview:
 * numbered jump cards, then framed sections with an eyebrow + blurb.
 * Phone-first; four areas instead of three legal domains.
 */

export const DRIVER_SETTINGS_PAGE_SUBTITLE =
  "Four areas: this phone, where emails go, your weeks, and your account.";

export const DRIVER_SETTINGS_SECTIONS = {
  device: {
    id: "this-phone",
    number: "1",
    title: "This phone",
    overviewTitle: "1. This phone",
    eyebrow: "Display and install",
    subtitle: "Dark mode, voice alerts, installing the app, and backup on this device.",
  },
  delivery: {
    id: "emails-workshop",
    number: "2",
    title: "Emails & workshop",
    overviewTitle: "2. Emails & workshop",
    eyebrow: "Where things are sent",
    subtitle:
      "Checklist PDFs go to your address. Workshop contact is for vehicle faults only — not the same inbox.",
  },
  record: {
    id: "your-record",
    number: "3",
    title: "Your record",
    overviewTitle: "3. Your record",
    eyebrow: "Weeks and help",
    subtitle: "Open a week, sign past weeks, saved runs, and how the record works.",
  },
  account: {
    id: "account",
    number: "4",
    title: "Account",
    overviewTitle: "4. Account",
    eyebrow: "Sign-in and messages",
    subtitle: "Messages, password, manager sign-in, and log out.",
  },
} as const;

export const DRIVER_SETTINGS_SECTION_IDS = [
  DRIVER_SETTINGS_SECTIONS.device.id,
  DRIVER_SETTINGS_SECTIONS.delivery.id,
  DRIVER_SETTINGS_SECTIONS.record.id,
  DRIVER_SETTINGS_SECTIONS.account.id,
] as const;

export type DriverSettingsSectionId = (typeof DRIVER_SETTINGS_SECTION_IDS)[number];
