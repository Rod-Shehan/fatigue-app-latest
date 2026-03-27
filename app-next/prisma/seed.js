/**
 * Seed script for user testing: creates sample drivers, regos, users, and a fatigue sheet.
 * Run: npx prisma db seed
 * Requires: database migrated (npx prisma db push) and .env.local with DATABASE_URL (and optionally NEXTAUTH_SECRET).
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

function getThisWeekSunday() {
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const d = String(sunday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSheetDayDate(weekStarting, dayIndex) {
  const [y, m, day] = weekStarting.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  date.setDate(date.getDate() + dayIndex);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function main() {
  const seedPassRaw = process.env.SEED_USER_PASSWORD || process.env.NEXTAUTH_CREDENTIALS_PASSWORD;
  const seedPass = typeof seedPassRaw === "string" && seedPassRaw.trim().length > 0 ? seedPassRaw.trim() : null;
  const passwordHash = seedPass ? await bcrypt.hash(seedPass, 10) : undefined;

  const weekStarting = getThisWeekSunday();

  // Drivers (for dropdown on sheets)
  const driver1 = await prisma.driver.upsert({
    where: { id: "seed-driver-1" },
    update: {},
    create: {
      id: "seed-driver-1",
      name: "Sample Driver",
      licenceNumber: "12345678",
      isActive: true,
    },
  });
  const driver2 = await prisma.driver.upsert({
    where: { id: "seed-driver-2" },
    update: {},
    create: {
      id: "seed-driver-2",
      name: "Second Driver",
      licenceNumber: null,
      isActive: true,
    },
  });
  console.log("Drivers:", driver1.name, driver2.name);

  // Regos (for truck dropdown on day cards)
  const rego1 = await prisma.truckRego.upsert({
    where: { id: "seed-rego-1" },
    update: {},
    create: {
      id: "seed-rego-1",
      label: "1ABC 234",
      sortOrder: 0,
    },
  });
  const rego2 = await prisma.truckRego.upsert({
    where: { id: "seed-rego-2" },
    update: {},
    create: {
      id: "seed-rego-2",
      label: "2XYZ 567",
      sortOrder: 1,
    },
  });
  console.log("Regos:", rego1.label, rego2.label);

  // Test users: one manager, one driver
  const managerUser = await prisma.user.upsert({
    where: { email: "manager@test.local" },
    update: {
      role: "manager",
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: "manager@test.local",
      name: "Test Manager",
      role: "manager",
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
  const driverUser = await prisma.user.upsert({
    where: { email: "driver@test.local" },
    update: {
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: "driver@test.local",
      name: "Test Driver",
      role: null,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
  console.log("Users:", managerUser.email, "(manager),", driverUser.email, "(driver)");

  // One fatigue sheet for this week (minimal 7-day structure; day 0 has a short work segment so compliance has something to show)
  const todayStr = new Date().toISOString().slice(0, 10);
  const day0Date = getSheetDayDate(weekStarting, 0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = getSheetDayDate(weekStarting, i);
    const isToday = dateStr === todayStr;
    const day = {
      date: dateStr,
      truck_rego: i === 0 ? rego1.label : undefined,
      destination: i === 0 ? "Perth Depot" : undefined,
      start_kms: i === 0 ? 1000 : undefined,
      end_kms: i === 0 ? 1050 : undefined,
      events:
        i === 0
          ? [
              { time: `${day0Date}T08:00:00.000Z`, type: "work" },
              { time: `${day0Date}T12:00:00.000Z`, type: "break" },
              { time: `${day0Date}T12:30:00.000Z`, type: "work" },
              { time: `${day0Date}T17:00:00.000Z`, type: "stop" },
            ]
          : [],
    };
    days.push(day);
  }

  const sheet = await prisma.fatigueSheet.upsert({
    where: { id: "seed-sheet-1" },
    update: { days: JSON.stringify(days) },
    create: {
      id: "seed-sheet-1",
      driverName: driver1.name,
      secondDriver: null,
      driverType: "solo",
      destination: "Perth Depot",
      last24hBreak: null,
      weekStarting,
      days: JSON.stringify(days),
      status: "draft",
      signature: null,
      signedAt: null,
      createdById: driverUser.id,
    },
  });
  console.log("Sheet:", sheet.driverName, "week", sheet.weekStarting, "status", sheet.status);

  console.log("\nSeed done. Sign in as manager@test.local or driver@test.local.");
  if (passwordHash) {
    console.log(
      "Password: same as SEED_USER_PASSWORD or NEXTAUTH_CREDENTIALS_PASSWORD when this seed ran (stored as bcrypt hash)."
    );
  } else {
    console.log(
      "No password hash stored — in production set NEXTAUTH_CREDENTIALS_PASSWORD on the server and use that at login, or re-seed with SEED_USER_PASSWORD set."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
