/**
 * Deep-link into the Logbook map with the risk card's current scope.
 * `dayIndex` is not used by the map itself — it rides along so the map's
 * "← Overview" link can restore the exact day the manager was looking at.
 */
export function managerMapHref(params: {
  weekStarting?: string;
  driverName?: string;
  dayIndex?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.weekStarting) sp.set("week", params.weekStarting);
  if (params.dayIndex != null) sp.set("day", String(params.dayIndex));
  if (params.driverName) sp.set("driver", params.driverName);
  const q = sp.toString();
  return `/manager/map${q ? `?${q}` : ""}`;
}
