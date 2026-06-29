import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.local");
const prisma = new PrismaClient();

const rows = await prisma.autonomiseWebhookIngest.findMany({
  where: {
    kind: "event",
    accepted: true,
    vendorAlarmId: "VT3600AI_ALARM_DSM_Fatigue",
    receivedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
  },
  orderBy: { receivedAt: "desc" },
  take: 12,
  select: { vendorEventId: true, receivedAt: true, payload: true, vehicleRego: true },
});

console.log("triggerTime → receivedAt lag (fatigue, last 48h)\n");
for (const r of rows) {
  const trigger = r.payload?.triggerTime ? new Date(r.payload.triggerTime) : null;
  const lagMin = trigger ? Math.round((r.receivedAt.getTime() - trigger.getTime()) / 60_000) : null;
  console.log({
    rego: r.vehicleRego,
    triggerUtc: trigger?.toISOString().slice(0, 16) ?? "?",
    webhookUtc: r.receivedAt.toISOString().slice(0, 16),
    lagMinutes: lagMin,
  });
}

await prisma.$disconnect();
