import { PrismaClient } from "@prisma/client";

const KEEP_USERNAME = "rod";
const prisma = new PrismaClient();

try {
  const targets = await prisma.commandOperator.findMany({
    where: { NOT: { username: KEEP_USERNAME } },
    select: { operatorId: true, username: true, email: true },
  });

  if (targets.length === 0) {
    console.log("No test accounts to remove.");
  } else {
    console.log("Removing:", targets);

    await prisma.fatigueIncidentLifecycle.updateMany({
      where: { operatorId: { in: targets.map((t) => t.operatorId) } },
      data: { operatorId: null },
    });

    const removed = await prisma.commandOperator.deleteMany({
      where: { operatorId: { in: targets.map((t) => t.operatorId) } },
    });

    console.log(`Removed ${removed.count} account(s).`);
  }

  const remaining = await prisma.commandOperator.findMany({
    select: { username: true, email: true, role: true, isActive: true },
  });
  console.log("Remaining:", remaining);
} finally {
  await prisma.$disconnect();
}
