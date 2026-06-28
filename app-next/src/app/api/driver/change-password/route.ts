import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadAuthUser } from "@/lib/auth";
import { isDriverFieldRole } from "@/lib/roles";
import {
  buildUserPasswordWriteFields,
  parseRequiredPasswordInput,
  verifyUserPassword,
} from "@/lib/user-password";

export async function POST(req: Request) {
  const loaded = await loadAuthUser();
  if (!loaded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDriverFieldRole(loaded.user.role)) {
    return NextResponse.json({ error: "Driver account required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentParsed = parseRequiredPasswordInput(
    body && typeof body === "object" && "currentPassword" in body
      ? (body as { currentPassword?: unknown }).currentPassword
      : undefined
  );
  if (!currentParsed.ok) {
    return NextResponse.json({ error: "Current password is required" }, { status: 400 });
  }

  const nextParsed = parseRequiredPasswordInput(
    body && typeof body === "object" && "newPassword" in body
      ? (body as { newPassword?: unknown }).newPassword
      : undefined
  );
  if (!nextParsed.ok) {
    return NextResponse.json({ error: nextParsed.error }, { status: 400 });
  }

  if (currentParsed.value === nextParsed.value) {
    return NextResponse.json({ error: "New password must be different" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: loaded.user.id },
    select: { id: true, passwordHash: true },
  });
  if (!dbUser?.passwordHash) {
    return NextResponse.json(
      { error: "No password is set yet. Ask your manager to set one on Approved Drivers." },
      { status: 400 }
    );
  }

  const currentOk = await verifyUserPassword(currentParsed.value, dbUser.passwordHash);
  if (!currentOk) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordFields = await buildUserPasswordWriteFields(nextParsed.value, loaded.user.id);
  await prisma.user.update({
    where: { id: loaded.user.id },
    data: passwordFields,
  });

  return NextResponse.json({ ok: true });
}
