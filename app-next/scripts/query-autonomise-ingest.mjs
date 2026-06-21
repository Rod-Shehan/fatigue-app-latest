import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env.production.local");

const prisma = new PrismaClient();

try {
  const byKind = await prisma.autonomiseWebhookIngest.groupBy({
    by: ["kind", "accepted"],
    _count: true,
  });
  console.log("summary", JSON.stringify(byKind, null, 2));

  const rows = await prisma.autonomiseWebhookIngest.findMany({
    orderBy: { receivedAt: "desc" },
    take: 20,
    select: {
      id: true,
      kind: true,
      accepted: true,
      rejectReason: true,
      vendorAlarmId: true,
      vendorEventId: true,
      vehicleRego: true,
      driverName: true,
      linkedEventId: true,
      receivedAt: true,
      payload: true,
    },
  });

  for (const r of rows) {
    console.log("---");
    console.log(
      JSON.stringify(
        {
          ...r,
          receivedAt: r.receivedAt.toISOString(),
          payloadPreview: JSON.stringify(r.payload).slice(0, 800),
        },
        null,
        2
      )
    );
  }
  console.log("total_recent", rows.length);
} finally {
  await prisma.$disconnect();
}
