import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    readFileSync(path, "utf8").split("\n").forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) return;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    });
  } catch {
    /* */
  }
}

loadEnvFile(".env.local");
const prisma = new PrismaClient();
const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

const settings = await prisma.cameraAlertEventSettings.findUnique({ where: { id: "default" } });
const enabled = new Set(settings?.enabledAlarmIds ?? []);

const events = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", receivedAt: { gte: since }, mediaUrl: { not: null } },
  orderBy: { receivedAt: "desc" },
  take: 15,
  select: { vendorAlarmId: true, vehicleRego: true, receivedAt: true, mediaUrl: true },
});

let visible = 0;
for (const e of events) {
  const ok = e.vendorAlarmId && enabled.has(e.vendorAlarmId);
  if (ok) visible++;
  console.log({
    alarm: e.vendorAlarmId?.replace("VT3600AI_ALARM_", ""),
    enabled: ok,
    rego: e.vehicleRego,
    at: e.receivedAt.toISOString().slice(0, 16),
  });
}
console.log(`\n${visible}/${events.length} clipped events now match enabled types`);
await prisma.$disconnect();
