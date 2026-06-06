import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const sheets = await prisma.fatigueSheet.count();
  const drivers = await prisma.fatigueSheet.findMany({
    select: { driverName: true, weekStarting: true },
    orderBy: { weekStarting: "desc" },
    take: 8,
  });
  const distinctDrivers = [...new Set(drivers.map((d) => d.driverName))].slice(0, 5);

  let frmsRuns = null;
  let frmsSnapshots = null;
  let latestRun = null;
  try {
    frmsRuns = await prisma.frmsProfileRun.count();
    frmsSnapshots = await prisma.frmsRiskSnapshot.count();
    latestRun = await prisma.frmsProfileRun.findFirst({
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        driverName: true,
        status: true,
        engineVersion: true,
        errorMessage: true,
        completedAt: true,
      },
    });
  } catch (e) {
    frmsRuns = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  console.log(
    JSON.stringify(
      {
        env: {
          FRMS_ENGINE: process.env.FRMS_ENGINE ?? "(unset → legacy)",
          FRMS_PYTHON_URL: process.env.FRMS_PYTHON_URL ? "set" : "unset",
          FRMS_PYTHON_API_KEY: process.env.FRMS_PYTHON_API_KEY ? "set" : "unset",
          FRMS_INTERNAL_SECRET: process.env.FRMS_INTERNAL_SECRET ? "set" : "unset",
        },
        db: {
          sheetCount: sheets,
          sampleDrivers: distinctDrivers,
          sampleSheets: drivers,
          frmsRunCount: frmsRuns,
          frmsSnapshotCount: frmsSnapshots,
          latestFrmsRun: latestRun,
        },
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
