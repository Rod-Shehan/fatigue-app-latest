/**
 * Bootstrap the first command owner (username + password).
 *
 *   OPERATOR_USERNAME=rod OPERATOR_EMAIL=you@company.com OPERATOR_PASSWORD='secret' npm run bootstrap:owner
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const username = process.env.OPERATOR_USERNAME?.trim().toLowerCase();
const email = process.env.OPERATOR_EMAIL?.trim().toLowerCase() || null;
const password = process.env.OPERATOR_PASSWORD;
const fullName = process.env.OPERATOR_FULL_NAME?.trim() || "Command Owner";
const role = process.env.OPERATOR_ROLE?.trim() || "command_owner";
const MIN_PASSWORD = 6;

if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error("Set OPERATOR_USERNAME (3–32 chars: letters, numbers, . _ -).");
  process.exit(1);
}
if (!password || password.length < MIN_PASSWORD) {
  console.error(`Set OPERATOR_PASSWORD (min ${MIN_PASSWORD} characters).`);
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const operator = await prisma.commandOperator.upsert({
    where: { username },
    create: {
      username,
      email,
      fullName,
      role,
      isActive: true,
      passwordHash,
      passwordSetAt: new Date(),
    },
    update: {
      email,
      fullName,
      role,
      isActive: true,
      passwordHash,
      passwordSetAt: new Date(),
    },
  });
  console.log(
    `Owner ready: ${operator.username} (${operator.email ?? "no email"}) role=${operator.role}`
  );
} finally {
  await prisma.$disconnect();
}
