/**
 * Upsert common fleet run plans into the route catalogue.
 *
 * Usage (from app-next):
 *   npx tsx scripts/seed-fleet-routes.ts
 *
 * Requires DATABASE_URL in .env.local and schema pushed (npx prisma db push).
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

{
  const shellKeys = new Set(Object.keys(process.env));
  const fromFile = new Set<string>();
  for (const file of [".env.local", ".env"]) {
    const p = join(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      if (shellKeys.has(key) || fromFile.has(key)) continue;
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
      fromFile.add(key);
    }
  }
}

const FLEET_ROUTES = [
  {
    label: "Perth – Kalgoorlie",
    start_location: "Perth",
    destination: "Kalgoorlie",
    planned_distance_km: 600,
    planned_on_duty_hours: 10,
  },
  {
    label: "Perth – Albany",
    start_location: "Perth",
    destination: "Albany",
    planned_distance_km: 420,
    planned_on_duty_hours: 9,
  },
  {
    label: "Perth – Geraldton",
    start_location: "Perth",
    destination: "Geraldton",
    planned_distance_km: 420,
    planned_on_duty_hours: 8,
  },
  {
    label: "Perth – Bunbury",
    start_location: "Perth",
    destination: "Bunbury",
    planned_distance_km: 180,
    planned_on_duty_hours: 4,
  },
  {
    label: "Perth – Esperance",
    start_location: "Perth",
    destination: "Esperance",
    planned_distance_km: 720,
    planned_on_duty_hours: 11,
  },
] as const;

async function main() {
  const prisma = new PrismaClient();
  try {
    let order = await prisma.routePreset
      .aggregate({ _max: { sortOrder: true } })
      .then((r) => r._max.sortOrder ?? -1);

    for (const route of FLEET_ROUTES) {
      const existing = await prisma.routePreset.findFirst({
        where: { label: route.label, catalogueSource: "fleet" },
      });
      if (existing) {
        await prisma.routePreset.update({
          where: { id: existing.id },
          data: {
            startLocation: route.start_location,
            destination: route.destination,
            plannedDistanceKm: route.planned_distance_km,
            plannedOnDutyHours: route.planned_on_duty_hours,
            isActive: true,
          },
        });
        console.log("Updated:", route.label);
      } else {
        order += 1;
        await prisma.routePreset.create({
          data: {
            label: route.label,
            startLocation: route.start_location,
            destination: route.destination,
            plannedDistanceKm: route.planned_distance_km,
            plannedOnDutyHours: route.planned_on_duty_hours,
            catalogueSource: "fleet",
            sortOrder: order,
            isActive: true,
          },
        });
        console.log("Created:", route.label);
      }
    }
    const count = await prisma.routePreset.count({ where: { isActive: true, catalogueSource: "fleet" } });
    console.log(`\nFleet catalogue: ${count} active route(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
