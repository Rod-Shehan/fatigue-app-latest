import { NextResponse } from "next/server";
import { getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateRoutePresetCreateInput } from "@/lib/route-preset";
import { serializeRoutePreset } from "@/lib/route-preset-db";

async function canMutatePreset(
  access: NonNullable<Awaited<ReturnType<typeof getSessionForSheetAccess>>>,
  presetId: string
): Promise<{ ok: true; preset: { id: string; catalogueSource: string; createdById: string | null } } | { ok: false; status: number; error: string }> {
  const preset = await prisma.routePreset.findUnique({
    where: { id: presetId },
    select: { id: true, catalogueSource: true, createdById: true },
  });
  if (!preset) return { ok: false, status: 404, error: "Not found" };
  if (access.isManager) return { ok: true, preset };
  if (preset.catalogueSource === "driver" && preset.createdById === access.userId) {
    return { ok: true, preset };
  }
  return { ok: false, status: 403, error: "Forbidden" };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const allowed = await canMutatePreset(access, id);
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

    const body = await req.json();
    const data: {
      label?: string;
      startLocation?: string | null;
      destination?: string | null;
      plannedDistanceKm?: number | null;
      plannedOnDutyHours?: number | null;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (typeof body.label === "string" && body.label.trim()) {
      const err = validateRoutePresetCreateInput({
        label: body.label,
        planned_distance_km: body.planned_distance_km,
        planned_on_duty_hours: body.planned_on_duty_hours,
      });
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      data.label = body.label.trim();
    }
    if (body.start_location !== undefined) {
      data.startLocation =
        typeof body.start_location === "string" && body.start_location.trim()
          ? body.start_location.trim()
          : null;
    }
    if (body.destination !== undefined) {
      data.destination =
        typeof body.destination === "string" && body.destination.trim()
          ? body.destination.trim()
          : null;
    }
    if (body.planned_distance_km !== undefined) {
      data.plannedDistanceKm =
        body.planned_distance_km == null || Number.isNaN(Number(body.planned_distance_km))
          ? null
          : Number(body.planned_distance_km);
    }
    if (body.planned_on_duty_hours !== undefined) {
      data.plannedOnDutyHours =
        body.planned_on_duty_hours == null || Number.isNaN(Number(body.planned_on_duty_hours))
          ? null
          : Number(body.planned_on_duty_hours);
    }
    if (typeof body.sort_order === "number") data.sortOrder = body.sort_order;
    if (typeof body.is_active === "boolean") data.isActive = body.is_active;

    const row = await prisma.routePreset.update({
      where: { id },
      data,
      include: { createdBy: { select: { name: true } } },
    });
    return NextResponse.json(serializeRoutePreset(row));
  } catch {
    return NextResponse.json({ error: "Failed to update route preset" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const allowed = await canMutatePreset(access, id);
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
    await prisma.routePreset.update({
      where: { id },
      data: { isActive: false },
    });
    return new NextResponse(undefined, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete route preset" }, { status: 500 });
  }
}
