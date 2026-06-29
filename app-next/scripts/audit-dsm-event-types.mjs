import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) continue;
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
const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

for (const code of [18, 20, 21, 28]) {
  const rows = await prisma.autonomiseWebhookIngest.findMany({
    where: {
      kind: "event",
      receivedAt: { gte: since },
      payload: { path: ["eventTypes"], array_contains: code },
    },
    select: {
      vendorAlarmId: true,
      accepted: true,
      mediaUrl: true,
      vehicleRego: true,
      receivedAt: true,
    },
    orderBy: { receivedAt: "desc" },
    take: 5,
  });
  console.log(`\nEvent type ${code}: ${rows.length} in sample`);
  for (const r of rows) {
    console.log({
      alarm: r.vendorAlarmId?.replace("VT3600AI_ALARM_", ""),
      accepted: r.accepted,
      media: r.mediaUrl ? "YES" : "no",
      rego: r.vehicleRego,
      at: r.receivedAt.toISOString().slice(0, 16),
    });
  }
}

await prisma.$disconnect();
