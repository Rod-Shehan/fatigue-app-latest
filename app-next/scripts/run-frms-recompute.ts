/**
 * Populate Neon FrmsProfileRun via Railway Python (run locally against prod DB).
 *
 * Usage (PowerShell):
 *   cd app-next
 *   $env:FRMS_ENGINE="hybrid"
 *   $env:FRMS_PYTHON_URL="https://fatigue-app-latest-production.up.railway.app"
 *   $env:FRMS_PYTHON_API_KEY="your-railway-key"
 *   npx tsx scripts/run-frms-recompute.ts Rod Shehan 2026-05-31
 */
import { PrismaClient } from "@prisma/client";
import { loadDriverWeekMap, runFrmsAndPersist } from "../src/lib/frms/orchestrator";

const driverName = process.argv[2]?.trim() ?? "Rod Shehan";
const weekStarting = process.argv[3]?.trim() ?? "2026-05-31";

async function main() {
  if ((process.env.FRMS_ENGINE ?? "legacy") === "legacy") {
    console.error("Set FRMS_ENGINE=hybrid");
    process.exit(1);
  }
  if (!process.env.FRMS_PYTHON_URL || !process.env.FRMS_PYTHON_API_KEY) {
    console.error("Set FRMS_PYTHON_URL and FRMS_PYTHON_API_KEY");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Set DATABASE_URL (from .env.local)");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const weekMap = await loadDriverWeekMap(prisma, driverName);
    const focus = await prisma.fatigueSheet.findFirst({
      where: { driverName, weekStarting },
      select: { jurisdictionCode: true, driverType: true },
    });
    if (!focus) {
      console.error(`No sheet for ${driverName} week ${weekStarting}`);
      process.exit(1);
    }

    console.log(`Recomputing FRMS for ${driverName} (${weekStarting})…`);
    const result = await runFrmsAndPersist(prisma, {
      driverName,
      weekStarting,
      weekMap,
      jurisdictionCode: focus.jurisdictionCode,
      driverType: focus.driverType ?? "solo",
    });
    console.log(result);

    const runs = await prisma.frmsProfileRun.count();
    const snaps = await prisma.frmsRiskSnapshot.count();
    console.log(`Neon: ${runs} runs, ${snaps} snapshots`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
