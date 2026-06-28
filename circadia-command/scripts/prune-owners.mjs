import { PrismaClient } from "@prisma/client";

const KEEP_USERNAME = "rod";
const prisma = new PrismaClient();

try {
  const owners = await prisma.commandOperator.findMany({
    where: { role: "command_owner" },
    select: { operatorId: true, username: true, email: true, isActive: true },
  });

  console.log("Owners before:", owners);

  const removed = await prisma.commandOperator.deleteMany({
    where: {
      role: "command_owner",
      NOT: { username: KEEP_USERNAME },
    },
  });

  const rod = await prisma.commandOperator.findUnique({
    where: { username: KEEP_USERNAME },
    select: { operatorId: true, username: true, email: true, role: true, isActive: true },
  });

  console.log(`Removed ${removed.count} other owner account(s).`);
  console.log("Remaining owner:", rod);
} finally {
  await prisma.$disconnect();
}
