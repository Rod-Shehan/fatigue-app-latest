import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getManagerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        is_active: d.isActive,
      }))
    );
  } catch (e) {
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
    const { name, email, licence_number, is_active } = body;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const normalizedEmail = normalizeEmail(email);
    if (email != null && normalizedEmail == null) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    const driver = await prisma.driver.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        licenceNumber: licence_number?.trim() ?? null,
        isActive: is_active ?? true,
      },
    });

    // If an email was supplied, create/update the login user record so the driver can sign in immediately.
    if (normalizedEmail) {
      await prisma.user.upsert({
        where: { email: normalizedEmail },
        create: { email: normalizedEmail, name: driver.name },
        update: { name: driver.name },
      });
    }

    return NextResponse.json({
      id: driver.id,
      name: driver.name,
      email: driver.email,
      licence_number: driver.licenceNumber,
      is_active: driver.isActive,
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
