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
  const defaultTenant = await prisma.tenant.upsert({
    where: { id: "tenant_default" },
    update: {},
    create: {
      id: "tenant_default",
      legalName: process.env.CIRCADIA_DEFAULT_TENANT_LEGAL_NAME || "Default operator",
      slug: "default",
    },
  });
  console.log("Tenant:", defaultTenant.legalName, defaultTenant.id);

  const seedPassRaw = process.env.SEED_USER_PASSWORD || process.env.NEXTAUTH_CREDENTIALS_PASSWORD;
  const seedPass = typeof seedPassRaw === "string" && seedPassRaw.trim().length > 0 ? seedPassRaw.trim() : null;
  const passwordHash = seedPass ? await bcrypt.hash(seedPass, 10) : undefined;

  const weekStarting = getThisWeekSunday();

  // Drivers (for dropdown on sheets — email links roster to login)
  const driver1 = await prisma.driver.upsert({
    where: { id: "seed-driver-1" },
    update: {
      email: "driver@test.local",
      name: "Test Driver",
    },
    create: {
      id: "seed-driver-1",
      name: "Test Driver",
      email: "driver@test.local",
      licenceNumber: "12345678",
      isActive: true,
      tenantId: defaultTenant.id,
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
      tenantId: defaultTenant.id,
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
      tenantId: defaultTenant.id,
    },
  });
  const rego2 = await prisma.truckRego.upsert({
    where: { id: "seed-rego-2" },
    update: {},
    create: {
      id: "seed-rego-2",
      label: "2XYZ 567",
      sortOrder: 1,
      tenantId: defaultTenant.id,
    },
  });
  console.log("Regos:", rego1.label, rego2.label);

  const fleetRoutes = [
    { label: "Perth – Kalgoorlie", startLocation: "Perth", destination: "Kalgoorlie", plannedDistanceKm: 600, plannedOnDutyHours: 10 },
    { label: "Perth – Albany", startLocation: "Perth", destination: "Albany", plannedDistanceKm: 420, plannedOnDutyHours: 9 },
    { label: "Perth – Geraldton", startLocation: "Perth", destination: "Geraldton", plannedDistanceKm: 420, plannedOnDutyHours: 8 },
    { label: "Perth – Bunbury", startLocation: "Perth", destination: "Bunbury", plannedDistanceKm: 180, plannedOnDutyHours: 4 },
  ];
  let routeOrder = await prisma.routePreset.aggregate({ _max: { sortOrder: true } }).then((r) => r._max.sortOrder ?? -1);
  for (const route of fleetRoutes) {
    const existing = await prisma.routePreset.findFirst({
      where: { label: route.label, catalogueSource: "fleet" },
    });
    if (existing) {
      await prisma.routePreset.update({
        where: { id: existing.id },
        data: { ...route, isActive: true },
      });
    } else {
      routeOrder += 1;
      await prisma.routePreset.create({
        data: { ...route, catalogueSource: "fleet", sortOrder: routeOrder, isActive: true, tenantId: defaultTenant.id },
      });
    }
  }
  console.log("Fleet route presets:", fleetRoutes.length);

  const ownerEmail = (process.env.OWNER_SEED_EMAIL || "owner@test.local").trim().toLowerCase();
  const ownerUser = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      role: "owner",
      tenantId: defaultTenant.id,
      platformAdmin: true,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: ownerEmail,
      name: "Organisation Owner",
      role: "owner",
      tenantId: defaultTenant.id,
      platformAdmin: true,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
  await prisma.systemPolicy.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  console.log("Owner:", ownerUser.email);

  // Test users: one manager, one driver
  const managerUser = await prisma.user.upsert({
    where: { email: "manager@test.local" },
    update: {
      role: "manager",
      tenantId: defaultTenant.id,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: "manager@test.local",
      name: "Test Manager",
      role: "manager",
      tenantId: defaultTenant.id,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
  const driverUser = await prisma.user.upsert({
    where: { email: "driver@test.local" },
    update: {
      name: "Test Driver",
      tenantId: defaultTenant.id,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: "driver@test.local",
      name: "Test Driver",
      role: null,
      tenantId: defaultTenant.id,
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
      tenantId: defaultTenant.id,
    },
  });
  console.log("Sheet:", sheet.driverName, "week", sheet.weekStarting, "status", sheet.status);

  console.log("\nSeed done. Sign in as owner@test.local, manager@test.local, or driver@test.local.");
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
