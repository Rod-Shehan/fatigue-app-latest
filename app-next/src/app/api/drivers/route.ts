import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { syncDriverLoginUser } from "@/lib/account-password-admin";
import { prisma } from "@/lib/prisma";
import { parseRequiredYmdDate, dateToYmd } from "@/lib/cvd-medical";

function mapDriverRecord(
  d: {
    id: string;
    name: string;
    email: string | null;
    licenceNumber: string | null;
    licenceExpiry: Date | null;
    cvdMedicalExpiry: Date | null;
    isActive: boolean;
  },
  loginUser?: { passwordHash: string | null; passwordSetAt: Date | null } | null
) {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    licence_number: d.licenceNumber,
    licence_expiry: dateToYmd(d.licenceExpiry),
    cvd_medical_expiry: dateToYmd(d.cvdMedicalExpiry),
    is_active: d.isActive,
    has_password: !!loginUser?.passwordHash,
    password_set_at: loginUser?.passwordSetAt?.toISOString() ?? null,
  };
}

export async function GET() {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const drivers = await prisma.driver.findMany({
      where: { tenantId: manager.user.tenantId },
      orderBy: { name: "asc" },
    });
    const emails = drivers.map((d) => d.email).filter((email): email is string => !!email);
    const loginUsers =
      emails.length > 0
        ? await prisma.user.findMany({
            where: { email: { in: emails } },
            select: { email: true, passwordHash: true, passwordSetAt: true },
          })
        : [];
    const loginByEmail = new Map(loginUsers.map((u) => [u.email, u]));

    return NextResponse.json(
      drivers.map((d) => mapDriverRecord(d, d.email ? loginByEmail.get(d.email) : null))
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const body = await req.json();
    const { name, email, licence_number, licence_expiry, is_active, password, cvd_medical_expiry } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const normalizedEmail = normalizeEmail(email);
    if (email != null && normalizedEmail == null) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    const licence = typeof licence_number === "string" ? licence_number.trim() : "";
    if (!licence) {
      return NextResponse.json({ error: "Licence number is required" }, { status: 400 });
    }
    const cvd = parseRequiredYmdDate(cvd_medical_expiry);
    if (!cvd) {
      return NextResponse.json({ error: "Driver medical expiry is required (YYYY-MM-DD)" }, { status: 400 });
    }
    const licenceExpiry = parseRequiredYmdDate(licence_expiry);
    if (!licenceExpiry) {
      return NextResponse.json({ error: "Driver licence expiry is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const driver = await prisma.driver.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        licenceNumber: licence,
        licenceExpiry,
        cvdMedicalExpiry: cvd,
        isActive: is_active ?? true,
        tenantId: manager.user.tenantId,
      },
    });

    let temporaryPassword: string | undefined;
    if (normalizedEmail) {
      try {
        const synced = await syncDriverLoginUser({
          email: normalizedEmail,
          name: driver.name,
          password,
          setByUserId: manager.user.id,
          tenantId: manager.user.tenantId,
        });
        temporaryPassword = synced.temporaryPassword;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid password";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const loginUser = normalizedEmail
      ? await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { passwordHash: true, passwordSetAt: true },
        })
      : null;

    return NextResponse.json({
      ...mapDriverRecord(driver, loginUser),
      ...(temporaryPassword ? { temporary_password: temporaryPassword } : null),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
