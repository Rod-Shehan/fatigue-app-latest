import { prisma } from "@/lib/prisma";
import { buildUserPasswordWriteFields, parseOptionalPasswordInput } from "@/lib/user-password";

export type SyncDriverLoginUserResult = {
  temporaryPassword?: string;
};

/** Upsert login User for a roster driver; optionally set password with admin metadata. */
export async function syncDriverLoginUser(args: {
  email: string;
  name: string;
  password: unknown;
  setByUserId: string;
}): Promise<SyncDriverLoginUserResult> {
  const parsed = parseOptionalPasswordInput(args.password);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  let temporaryPassword: string | undefined;
  let passwordData: Awaited<ReturnType<typeof buildUserPasswordWriteFields>> | undefined;
  if (parsed.value) {
    temporaryPassword = parsed.value;
    passwordData = await buildUserPasswordWriteFields(parsed.value, args.setByUserId);
  }

  await prisma.user.upsert({
    where: { email: args.email },
    create: {
      email: args.email,
      name: args.name,
      ...(passwordData ?? null),
    },
    update: {
      name: args.name,
      ...(passwordData ?? null),
    },
  });

  return temporaryPassword ? { temporaryPassword } : {};
}

export type ManagerAccountWriteResult = {
  id: string;
  email: string | null;
  name: string | null;
  temporaryPassword?: string;
};

export async function upsertManagerAccount(args: {
  email: string;
  name: string;
  password: unknown;
  setByUserId: string;
}): Promise<ManagerAccountWriteResult> {
  const parsed = parseOptionalPasswordInput(args.password);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  let temporaryPassword: string | undefined;
  let passwordData: Awaited<ReturnType<typeof buildUserPasswordWriteFields>> | undefined;
  if (parsed.value) {
    temporaryPassword = parsed.value;
    passwordData = await buildUserPasswordWriteFields(parsed.value, args.setByUserId);
  }

  const existing = await prisma.user.findUnique({ where: { email: args.email } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "manager",
        name: args.name,
        ...(passwordData ?? null),
      },
      select: { id: true, email: true, name: true },
    });
    return { ...updated, temporaryPassword };
  }

  const created = await prisma.user.create({
    data: {
      email: args.email,
      name: args.name,
      role: "manager",
      ...(passwordData ?? null),
    },
    select: { id: true, email: true, name: true },
  });
  return { ...created, temporaryPassword };
}

export async function updateManagerAccount(args: {
  userId: string;
  name?: string;
  password: unknown;
  setByUserId: string;
}): Promise<ManagerAccountWriteResult> {
  const parsed = parseOptionalPasswordInput(args.password);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const target = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!target || target.role !== "manager") {
    throw new Error("Manager not found");
  }

  let temporaryPassword: string | undefined;
  let passwordData: Awaited<ReturnType<typeof buildUserPasswordWriteFields>> | undefined;
  if (parsed.value) {
    temporaryPassword = parsed.value;
    passwordData = await buildUserPasswordWriteFields(parsed.value, args.setByUserId);
  }

  const updated = await prisma.user.update({
    where: { id: args.userId },
    data: {
      ...(typeof args.name === "string" && args.name.trim() ? { name: args.name.trim() } : null),
      ...(passwordData ?? null),
    },
    select: { id: true, email: true, name: true },
  });

  return { ...updated, temporaryPassword };
}
