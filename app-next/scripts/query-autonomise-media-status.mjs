import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnvFile(".env.production.local");

const prisma = new PrismaClient();
const eventId = process.argv[2] ?? "6b52fb2f-7b45-47e6-8429-013f8d2706d2";

try {
  const rows = await prisma.autonomiseWebhookIngest.findMany({
    where: {
      OR: [{ vendorEventId: eventId }, { linkedEventId: eventId }],
    },
    orderBy: { receivedAt: "desc" },
    select: {
      kind: true,
      accepted: true,
      vendorEventId: true,
      mediaUrl: true,
      receivedAt: true,
    },
  });
  console.log("eventId", eventId);
  for (const r of rows) {
    console.log(
      JSON.stringify({
        ...r,
        receivedAt: r.receivedAt.toISOString(),
        hasMediaUrl: Boolean(r.mediaUrl),
        mediaUrlPrefix: r.mediaUrl ? r.mediaUrl.slice(0, 100) : null,
      })
    );
  }
} finally {
  await prisma.$disconnect();
}
