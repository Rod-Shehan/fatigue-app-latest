import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const all = await prisma.commandOperator.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      operatorId: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      fullName: true,
    },
  });
  console.log(JSON.stringify(all, null, 2));
} finally {
  await prisma.$disconnect();
}
