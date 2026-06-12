import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

function loadEnvFile() {
  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();
const prisma = new PrismaClient();

async function main() {
  const event = await prisma.edgeFatigueEvent.create({
    data: {
      tenantIdUuid: process.env.COMMAND_PILOT_TENANT_ID_UUID ?? randomUUID(),
      driverIdUuid: randomUUID(),
      vehicleRegistration: `SIM${Date.now().toString().slice(-4)}`,
      hardwareTimestamp: new Date(),
      speedKmh: 78,
      headingDegrees: 90,
      laneDeviationIndex: 0.38,
      aiModelVersion: "yolov8n-circadia-dev",
      fatigueMetricType: "MICROSLEEP",
      confidenceScore: 0.91,
      videoSnippetUrl: "https://media.circadia24.com/clips/sim-dev.mp4",
    },
    include: { lifecycle: true },
  });

  console.log(JSON.stringify({ event_id: event.eventId, lifecycle_id: event.lifecycle?.lifecycleId }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
