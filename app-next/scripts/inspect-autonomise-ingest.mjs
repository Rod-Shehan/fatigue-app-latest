import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.production.local");
loadEnvFile(
  `${process.env.USERPROFILE ?? ""}/OneDrive/Documents/autonomise-fleet-alerts/backend/.env`
);

const prisma = new PrismaClient();

const rows = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event" },
  orderBy: { receivedAt: "desc" },
  take: 50,
  select: {
    vendorAlarmId: true,
    accepted: true,
    rejectReason: true,
    payload: true,
    receivedAt: true,
  },
});

for (const r of rows) {
  const p = r.payload;
  const et = p?.eventTypes ?? p?.event?.eventTypes;
  console.log(
    JSON.stringify({
      at: r.receivedAt,
      alarm: r.vendorAlarmId,
      accepted: r.accepted,
      reason: r.rejectReason,
      eventTypes: et,
      type: p?.type ?? p?.event?.type,
      classification: p?.classification,
    })
  );
}

await prisma.$disconnect();
