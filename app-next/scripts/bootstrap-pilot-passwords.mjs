/**
 * One-off: set pilot login passwords on production (or any DATABASE_URL).
 * Usage:
 *   node --env-file=.env.production.local scripts/bootstrap-pilot-passwords.mjs
 *
 * Optional env:
 *   PILOT_OWNER_EMAIL (default rod@), PILOT_DRIVER_EMAIL
 *   PILOT_SHARED_PASSWORD — same password for both when set
 *   PILOT_OWNER_PASSWORD, PILOT_DRIVER_PASSWORD (overrides shared per account)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const ownerEmail = (process.env.PILOT_OWNER_EMAIL || process.env.PILOT_MANAGER_EMAIL || "rod@miocevichtransport.com.au")
  .trim()
  .toLowerCase();
const driverEmail = (process.env.PILOT_DRIVER_EMAIL || "r_shehan@hotmail.com").trim().toLowerCase();
const sharedPassword = process.env.PILOT_SHARED_PASSWORD?.trim() || "";

function accountPassword(label) {
  if (label === "owner") {
    const specific = process.env.PILOT_OWNER_PASSWORD?.trim() || process.env.PILOT_MANAGER_PASSWORD?.trim();
    if (specific) return specific;
  } else {
    const specific = process.env.PILOT_DRIVER_PASSWORD?.trim();
    if (specific) return specific;
  }
  if (sharedPassword) return sharedPassword;
  return `Circadia-${randomBytes(4).toString("hex")}!`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required (e.g. --env-file=.env.production.local)");
  }

  const ownerPassword = accountPassword("owner");
  const driverPassword = accountPassword("driver");
  const ownerHash = await bcrypt.hash(ownerPassword, 10);
  const driverHash = await bcrypt.hash(driverPassword, 10);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    create: {
      email: ownerEmail,
      name: "Rod Shehan",
      role: "owner",
      passwordHash: ownerHash,
    },
    update: {
      role: "owner",
      passwordHash: ownerHash,
      disabledAt: null,
    },
    select: { id: true, email: true, role: true },
  });

  let driverRoster = await prisma.driver.findFirst({
    where: { email: driverEmail },
    select: { id: true, name: true, isActive: true },
  });

  if (!driverRoster) {
    driverRoster = await prisma.driver.create({
      data: {
        name: "Rod Shehan",
        email: driverEmail,
        isActive: true,
      },
      select: { id: true, name: true, isActive: true },
    });
  } else if (!driverRoster.isActive) {
    driverRoster = await prisma.driver.update({
      where: { id: driverRoster.id },
      data: { isActive: true },
      select: { id: true, name: true, isActive: true },
    });
  }

  const driver = await prisma.user.upsert({
    where: { email: driverEmail },
    create: {
      email: driverEmail,
      name: driverRoster.name,
      role: null,
      passwordHash: driverHash,
    },
    update: {
      name: driverRoster.name,
      role: null,
      passwordHash: driverHash,
      disabledAt: null,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        owner: { email: owner.email, role: owner.role, password: ownerPassword },
        driver: {
          email: driver.email,
          role: driver.role ?? "driver",
          rosterActive: driverRoster.isActive,
          password: driverPassword,
        },
        note: "Sign in at https://www.circadia24.com — change passwords after first login.",
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
