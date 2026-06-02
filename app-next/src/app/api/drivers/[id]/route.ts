import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getManagerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isInvalidCvdMedicalInput, parseCvdMedicalExpiryInput } from "@/lib/cvd-medical";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    const body = await _req.json();
    const { is_active, email, name, licence_number, password, cvd_medical_expiry } = body;

    const normalizedEmail =
      email === undefined
        ? undefined
        : typeof email === "string"
          ? email.trim().toLowerCase() || null
          : null;
    if (email !== undefined) {
      if (normalizedEmail === null) {
        return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      }
      if (typeof normalizedEmail === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      }
    }
    const trimmedName = typeof name === "string" ? name.trim() : undefined;
    if (name !== undefined && (!trimmedName || trimmedName.length < 2)) {
      return NextResponse.json({ error: "Valid name required" }, { status: 400 });
    }
    const normalizedLicence =
      licence_number === undefined
        ? undefined
        : typeof licence_number === "string"
          ? licence_number.trim() || null
          : null;
    if (licence_number !== undefined && normalizedLicence === null) {
      return NextResponse.json({ error: "Valid licence number required" }, { status: 400 });
    }
    const passwordStr = typeof password === "string" ? password : "";
    if (password !== undefined && passwordStr.trim().length > 0 && passwordStr.trim().length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    if (cvd_medical_expiry !== undefined) {
      if (isInvalidCvdMedicalInput(cvd_medical_expiry)) {
        return NextResponse.json({ error: "cvd_medical_expiry must be YYYY-MM-DD or empty" }, { status: 400 });
      }
    }
    const cvdParsed = parseCvdMedicalExpiryInput(cvd_medical_expiry);

    const data: Parameters<typeof prisma.driver.update>[0]["data"] = {
      ...(is_active !== undefined ? { isActive: is_active } : null),
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : null),
      ...(trimmedName !== undefined ? { name: trimmedName } : null),
      ...(normalizedLicence !== undefined ? { licenceNumber: normalizedLicence } : null),
      ...(cvd_medical_expiry !== undefined ? { cvdMedicalExpiry: cvdParsed ?? null } : null),
    } as Parameters<typeof prisma.driver.update>[0]["data"];

    const driver = await prisma.driver.update({
      where: { id },
      data,
    });

    // Keep the login user record in sync when the roster email/name changes.
    if (driver.email) {
      const passwordHash =
        passwordStr.trim().length > 0 ? await bcrypt.hash(passwordStr.trim(), 10) : undefined;
      await prisma.user.upsert({
        where: { email: driver.email },
        create: { email: driver.email, name: driver.name, ...(passwordHash ? { passwordHash } : null) },
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
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    await prisma.driver.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }
}
