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
    /* */
  }
}

loadEnvFile(".env.local");
const prisma = new PrismaClient();
const rows = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", accepted: true, NOT: { mediaUrl: null } },
  orderBy: { receivedAt: "desc" },
  take: 5,
  select: { vendorAlarmId: true, vehicleRego: true, receivedAt: true, payload: true },
});
for (const r of rows) {
  console.log({
    alarm: r.vendorAlarmId,
    rego: r.vehicleRego,
    receivedUtc: r.receivedAt.toISOString(),
    eventTypes: r.payload?.eventTypes,
    trigger: r.payload?.triggerTime,
  });
}
await prisma.$disconnect();
