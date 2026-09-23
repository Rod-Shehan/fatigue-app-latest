export type CommandNavId = "triage" | "tracking" | "users" | "test-desk";

export function commandNavIdFromPath(pathname: string | null | undefined): CommandNavId | null {
  const path = pathname?.split("?")[0] ?? "";
  if (path === "/triage" || path.startsWith("/triage/")) return "triage";
  if (path === "/tracking" || path.startsWith("/tracking/")) return "tracking";
  if (path === "/admin/test-desk" || path.startsWith("/admin/test-desk/")) return "test-desk";
  if (path === "/admin/users" || path.startsWith("/admin/users/")) return "users";
  return null;
}
