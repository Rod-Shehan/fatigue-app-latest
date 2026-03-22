import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getManagerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isInvalidCvdMedicalInput, parseCvdMedicalExpiryInput } from "@/lib/cvd-medical";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(
      drivers.map((d) => ({
        id: d.id,
        name: d.name,
        email: d.email,
        licence_number: d.licenceNumber,
        cvd_medical_expiry: d.cvdMedicalExpiry ? d.cvdMedicalExpiry.toISOString().slice(0, 10) : null,
        is_active: d.isActive,
      }))
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  // Basic sanity check; avoid over-rejecting valid addresses.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const body = await req.json();
    const { name, email, licence_number, is_active, password, cvd_medical_expiry } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const normalizedEmail = normalizeEmail(email);
    if (email != null && normalizedEmail == null) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    const passwordStr = typeof password === "string" ? password : "";
    if (password !== undefined && passwordStr.trim().length > 0 && passwordStr.trim().length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    if (isInvalidCvdMedicalInput(cvd_medical_expiry)) {
      return NextResponse.json({ error: "cvd_medical_expiry must be YYYY-MM-DD or empty" }, { status: 400 });
    }
    const cvd = parseCvdMedicalExpiryInput(cvd_medical_expiry);

    const driver = await prisma.driver.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        licenceNumber: licence_number?.trim() ?? null,
        cvdMedicalExpiry: cvd ?? null,
        isActive: is_active ?? true,
      },
    });

    // If an email was supplied, create/update the login user record so the driver can sign in immediately.
    if (normalizedEmail) {
      const passwordHash =
        passwordStr.trim().length > 0 ? await bcrypt.hash(passwordStr.trim(), 10) : undefined;
      await prisma.user.upsert({
        where: { email: normalizedEmail },
        create: { email: normalizedEmail, name: driver.name, ...(passwordHash ? { passwordHash } : null) },
        update: { name: driver.name, ...(passwordHash ? { passwordHash } : null) },
      });
    }

    return NextResponse.json({
      id: driver.id,
      name: driver.name,
      email: driver.email,
      licence_number: driver.licenceNumber,
      cvd_medical_expiry: driver.cvdMedicalExpiry ? driver.cvdMedicalExpiry.toISOString().slice(0, 10) : null,
      is_active: driver.isActive,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
