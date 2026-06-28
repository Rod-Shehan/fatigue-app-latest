import { getSession } from "@/lib/auth/session";
import { canAccessTriage, canManageOperators, type CommandRole } from "@/lib/auth/roles";
import { CommandApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type OperatorAuthRow = {
  operatorId: string;
  username: string | null;
  role: string;
  isActive: boolean;
  passwordHash: string | null;
};

async function loadOperatorAuth(operatorId: string): Promise<OperatorAuthRow | null> {
  return prisma.commandOperator.findUnique({
    where: { operatorId },
    select: {
      operatorId: true,
      username: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
  });
}

function assertActiveWithPassword(operator: OperatorAuthRow | null): CommandRole {
  if (!operator?.isActive) {
    throw new CommandApiError("ERR_SCOPE_VIOLATION", "Operator account is inactive.", 403);
  }
  if (!operator.passwordHash) {
    throw new CommandApiError(
      "ERR_FORBIDDEN",
      "Password is not configured. Contact an owner.",
      403
    );
  }
  const role = operator.role as CommandRole;
  return role;
}

export async function requireOperatorId(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new CommandApiError(
      "ERR_TOKEN_EXPIRED",
      "No operator session. Sign in to continue.",
      401
    );
  }

  const operator = await loadOperatorAuth(session.sub);
  const role = assertActiveWithPassword(operator);
  if (!canAccessTriage(role)) {
    throw new CommandApiError("ERR_SCOPE_VIOLATION", "Triage access denied.", 403);
  }

  return session.sub;
}

export async function requireOwnerId(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new CommandApiError(
      "ERR_TOKEN_EXPIRED",
      "No operator session. Sign in to continue.",
      401
    );
  }

  const operator = await loadOperatorAuth(session.sub);
  const role = assertActiveWithPassword(operator);
  if (!canManageOperators(role)) {
    throw new CommandApiError("ERR_SCOPE_VIOLATION", "Owner access required.", 403);
  }

  return session.sub;
}

export async function requireOperatorSession() {
  const operatorId = await requireOperatorId();
  const session = await getSession();
  return { operatorId, session: session! };
}
