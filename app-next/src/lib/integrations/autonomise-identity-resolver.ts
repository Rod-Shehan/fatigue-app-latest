import type { PrismaClient } from "@prisma/client";
import { fetchAutonomiseEventIdentity, isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";

const MAX_IDENTITY_FETCH_PER_REQUEST = 3;

export async function resolveAndPersistAutonomiseIdentity(
  prisma: PrismaClient,
  args: { ingestId: string; payload?: unknown }
): Promise<{ vehicleRego: string | null; driverName: string | null; fetched: boolean } | null> {
  if (!isAutonomiseApiConfigured()) return null;

  const fields = extractAutonomiseFields(args.payload, "event");
  const identity = await fetchAutonomiseEventIdentity({
    vendorVehicleId: fields.vendorVehicleId,
    deviceHardwareId: fields.deviceHardwareId,
  });

  if (!identity.vehicleRego && !identity.driverName) {
    return { vehicleRego: null, driverName: null, fetched: true };
  }

  const patch: { vehicleRego?: string; driverName?: string } = {};
  if (identity.vehicleRego) patch.vehicleRego = identity.vehicleRego;
  if (identity.driverName) patch.driverName = identity.driverName;

  await prisma.autonomiseWebhookIngest.update({
    where: { id: args.ingestId },
    data: patch,
  });

  return {
    vehicleRego: identity.vehicleRego || null,
    driverName: identity.driverName || null,
    fetched: true,
  };
}

/** Backfill VRN + driver when webhooks only carried vehicle/device ids. */
export async function backfillMissingAutonomiseIdentity(
  prisma: PrismaClient,
  events: Array<{
    id: string;
    vehicleRego: string | null;
    driverName: string | null;
    accepted?: boolean;
    payload?: unknown;
  }>
): Promise<number> {
  if (!isAutonomiseApiConfigured()) return 0;

  let fetches = 0;
  for (const event of events) {
    if (fetches >= MAX_IDENTITY_FETCH_PER_REQUEST) break;
    if (!event.accepted) continue;
    if (event.vehicleRego && event.driverName) continue;

    const fields = extractAutonomiseFields(event.payload, "event");
    if (!fields.vendorVehicleId && !fields.deviceHardwareId) continue;

    fetches += 1;
    try {
      const result = await resolveAndPersistAutonomiseIdentity(prisma, {
        ingestId: event.id,
        payload: event.payload,
      });
      if (result?.vehicleRego && !event.vehicleRego) event.vehicleRego = result.vehicleRego;
      if (result?.driverName && !event.driverName) event.driverName = result.driverName;
    } catch (e) {
      console.warn(
        "[autonomise-identity] backfill failed",
        event.id,
        e instanceof Error ? e.message : e
      );
    }
  }
  return fetches;
}
