import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const run = await prisma.frmsProfileRun.findFirst({ orderBy: { requestedAt: "desc" } });
    console.log(JSON.stringify(run, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
