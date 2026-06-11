/** Deep-link into the Movement map with the risk card's current scope. */
export function managerMapHref(params: {
  weekStarting?: string;
  driverName?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.weekStarting) sp.set("week", params.weekStarting);
  if (params.driverName) sp.set("driver", params.driverName);
  const q = sp.toString();
  return `/manager/map${q ? `?${q}` : ""}`;
}
