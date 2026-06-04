import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  catalogueSourceForSession,
  validateRoutePresetCreateInput,
  type CatalogueSource,
  type RoutePresetCreateInput,
} from "@/lib/route-preset";
import { serializeRoutePreset } from "@/lib/route-preset-db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const list = await prisma.routePreset.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      include: { createdBy: { select: { name: true } } },
    });
    return NextResponse.json(list.map(serializeRoutePreset));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as RoutePresetCreateInput;
    const err = validateRoutePresetCreateInput(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    let catalogueSource: CatalogueSource =
      body.catalogue_source === "driver" || body.catalogue_source === "fleet"
        ? body.catalogue_source
        : catalogueSourceForSession(access.isManager);
    if (!access.isManager && catalogueSource === "fleet") {
      catalogueSource = "driver";
    }

    const maxOrder = await prisma.routePreset
      .aggregate({ _max: { sortOrder: true } })
      .then((r) => r._max.sortOrder ?? -1);

    const row = await prisma.routePreset.create({
      data: {
        label: body.label.trim(),
        plannedDistanceKm:
          body.planned_distance_km != null && !Number.isNaN(Number(body.planned_distance_km))
            ? Number(body.planned_distance_km)
            : null,
        plannedOnDutyHours:
          body.planned_on_duty_hours != null && !Number.isNaN(Number(body.planned_on_duty_hours))
            ? Number(body.planned_on_duty_hours)
            : null,
        catalogueSource,
        sortOrder: typeof body.sort_order === "number" ? body.sort_order : maxOrder + 1,
        createdById: access.userId,
      },
      include: { createdBy: { select: { name: true } } },
    });
    return NextResponse.json(serializeRoutePreset(row));
  } catch {
    return NextResponse.json({ error: "Failed to create route preset" }, { status: 500 });
  }
}
