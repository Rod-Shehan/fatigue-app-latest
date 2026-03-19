import type { Driver } from "@/lib/api";

type Sender = { name: string | null; email: string | null };

/**
 * Prefer the name from Approved Drivers (matched by login email), then session name for the same user,
 * then non-generic sender.name, then a readable email local-part.
 */
export function resolveDriverBubbleName(
  drivers: Pick<Driver, "name" | "email">[],
  sender: Sender,
  sessionUser?: { name?: string | null; email?: string | null } | null
): string {
  const senderEmail = (sender.email || "").trim().toLowerCase();
  const fromRoster = senderEmail
    ? drivers.find((d) => (d.email || "").trim().toLowerCase() === senderEmail)
    : undefined;
  if (fromRoster?.name?.trim()) return fromRoster.name.trim();

  const sessionEmail = (sessionUser?.email || "").trim().toLowerCase();
  const isSelf = !!senderEmail && senderEmail === sessionEmail;
  if (isSelf && sessionUser?.name?.trim()) {
    const sn = sessionUser.name.trim();
    if (sn.toLowerCase() !== "driver") return sn;
  }

  const n = sender.name?.trim();
  if (n && n.toLowerCase() !== "driver") return n;

  if (isSelf && sessionUser?.name?.trim()) return sessionUser.name.trim();

  const local = sender.email?.split("@")[0]?.trim();
  if (local && local.toLowerCase() !== "driver") {
    return local
      .replace(/[._-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return n || sessionUser?.name?.trim() || sender.email || "Driver";
}
