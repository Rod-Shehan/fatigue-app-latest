import { api } from "@/lib/api";
import { downloadRoadsidePdfBlob } from "@/lib/roadside-produce-download";
import { isOnline } from "@/lib/offline-api";

async function probeReachable(): Promise<boolean> {
  if (!isOnline()) return false;
  try {
    const res = await fetch("/api/ping", { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Produce 28-day roadside PDF: device cache when offline; server when online (authoritative DB).
 */
/** Prefer name on cached sheets when session display name differs. */
export function resolveRoadsideDriverName(
  sessionName: string,
  sheets: { driver_name?: string }[]
): string {
  const trimmed = sessionName.trim();
  if (!trimmed) return "";
  const names = [...new Set(sheets.map((s) => s.driver_name?.trim()).filter(Boolean) as string[])];
  if (names.length === 1) return names[0]!;
  const exact = names.find((n) => n === trimmed);
  if (exact) return exact;
  const partial = names.find((n) => n.startsWith(trimmed) || trimmed.startsWith(n));
  return partial ?? trimmed;
}

async function produceFromDeviceCache(driverName: string): Promise<{ error?: string }> {
  const { buildRoadsideProducePdfFromCache } = await import("@/lib/roadside-produce-client");
  const result = await buildRoadsideProducePdfFromCache(driverName);
  if (!result.ok) return { error: result.error };
  downloadRoadsidePdfBlob(result.blob, result.filename);
  return {};
}

export async function produceRoadsidePdf(driverName: string): Promise<{ error?: string }> {
  const online = await probeReachable();

  if (!online) {
    return produceFromDeviceCache(driverName);
  }

  try {
    const res = await fetch(api.driver.roadsideProducePdfUrl(), { credentials: "include" });
    if (res.ok) {
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = disp?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "roadside-produce.pdf";
      downloadRoadsidePdfBlob(blob, filename);
      return {};
    }
  } catch {
    /* fall through to cache */
  }

  return produceFromDeviceCache(driverName);
}
