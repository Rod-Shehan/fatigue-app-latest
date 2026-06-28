import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { upsertManagerAccount } from "@/lib/account-password-admin";
import { prisma } from "@/lib/prisma";

function mapManager(user: {
  id: string;
  email: string | null;
  name: string | null;
  passwordHash: string | null;
  passwordSetAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    has_password: !!user.passwordHash,
    password_set_at: user.passwordSetAt?.toISOString() ?? null,
  };
}

/** List manager accounts (owner-only — identity admin). */
export async function GET() {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const managers = await prisma.user.findMany({
    where: { role: "manager" },
    orderBy: [{ email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      passwordSetAt: true,
    },
  });
  return NextResponse.json({ managers: managers.map(mapManager) });
}

export async function POST(req: Request) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  try {
    const body = await req.json();
    const { email, name, password } = body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const trimmedEmail = email.trim().toLowerCase();
    const displayName =
      typeof name === "string" && name.trim() ? name.trim() : trimmedEmail.split("@")[0];

    let result;
    try {
      result = await upsertManagerAccount({
        email: trimmedEmail,
        name: displayName,
        password,
        setByUserId: owner.user.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid password";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: result.id },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        passwordSetAt: true,
      },
    });
    if (!user) return NextResponse.json({ error: "Failed to create user" }, { status: 500 });

    return NextResponse.json({
      ...mapManager(user),
      ...(result.temporaryPassword ? { temporary_password: result.temporaryPassword } : null),
    });
  } catch {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
