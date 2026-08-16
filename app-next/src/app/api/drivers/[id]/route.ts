import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { syncDriverLoginUser } from "@/lib/account-password-admin";
import { prisma } from "@/lib/prisma";
import { isInvalidCvdMedicalInput, parseCvdMedicalExpiryInput } from "@/lib/cvd-medical";

function mapDriverRecord(
  d: {
    id: string;
    name: string;
    email: string | null;
    licenceNumber: string | null;
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
    cvd_medical_expiry: d.cvdMedicalExpiry ? d.cvdMedicalExpiry.toISOString().slice(0, 10) : null,
    is_active: d.isActive,
    has_password: !!loginUser?.passwordHash,
    password_set_at: loginUser?.passwordSetAt?.toISOString() ?? null,
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    const body = await req.json();
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

    const existing = await prisma.driver.findFirst({
      where: { id, tenantId: manager.user.tenantId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });

    const driver = await prisma.driver.update({
      where: { id },
      data,
    });

    let temporaryPassword: string | undefined;
    if (driver.email) {
      try {
        const synced = await syncDriverLoginUser({
          email: driver.email,
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

    const loginUser = driver.email
      ? await prisma.user.findUnique({
          where: { email: driver.email },
          select: { passwordHash: true, passwordSetAt: true },
        })
      : null;

    return NextResponse.json({
      ...mapDriverRecord(driver, loginUser),
      ...(temporaryPassword ? { temporary_password: temporaryPassword } : null),
    });
  } catch {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Forbidden: manager only" }, { status: 403 });
  try {
    const { id } = await params;
    const existing = await prisma.driver.findFirst({
      where: { id, tenantId: manager.user.tenantId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    await prisma.driver.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }
}
