import type { Session } from "next-auth";

/** Separator between role label and display name in header pills (Driver · Name). */
export const ROLE_BADGE_NAME_SEPARATOR = " · ";

/**
 * Display name for the logged-in user: prefers profile name, then email local-part.
 * Matches behaviour used when creating a new sheet (`new-sheet-redirect`).
 */
export function getDisplayNameFromSession(session: Session | null): string {
  const raw =
    (typeof session?.user?.name === "string" && session.user.name.trim()) ||
    (typeof session?.user?.email === "string" && session.user.email.trim()) ||
    "";
  if (!raw) return "";
  if (raw.includes("@")) return raw.split("@")[0] || "";
  return raw;
}

/**
 * Standard role pill: "Driver · Jane Smith" / "Manager · Alex Lee".
 * If no display name, returns just the role label.
 */
export function formatRoleBadge(role: "Driver" | "Manager", displayName: string): string {
  const n = displayName.trim();
  if (!n) return role;
  return `${role}${ROLE_BADGE_NAME_SEPARATOR}${n}`;
}
