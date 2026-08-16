import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { updateManagerAccount } from "@/lib/account-password-admin";
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

  const { id } = await params;
  if (id === owner.user.id) {
    return NextResponse.json({ error: "Use driver settings or a separate flow for your own password" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { name, password } = body as { name?: unknown; password?: unknown };

    let result;
    try {
      result = await updateManagerAccount({
        userId: id,
        name: typeof name === "string" ? name : undefined,
        password,
        setByUserId: owner.user.id,
        tenantId: owner.user.tenantId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      const status = message === "Manager not found" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
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
    if (!user) return NextResponse.json({ error: "Manager not found" }, { status: 404 });

    return NextResponse.json({
      ...mapManager(user),
      ...(result.temporaryPassword ? { temporary_password: result.temporaryPassword } : null),
    });
  } catch {
    return NextResponse.json({ error: "Failed to update manager" }, { status: 500 });
  }
}
