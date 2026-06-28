import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { isCommandRole, roleLabel } from "@/lib/auth/roles";
import { parsePasswordInput, hashOperatorPassword } from "@/lib/auth/password";
import { parseUsernameInput } from "@/lib/auth/username";
import { requireOwnerId } from "@/lib/operator-context";
import { prisma } from "@/lib/prisma";

function serializeOperator(row: {
  operatorId: string;
  username: string | null;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  passwordSetAt: Date | null;
}) {
  return {
    operator_id: row.operatorId,
    username: row.username,
    full_name: row.fullName,
    role: row.role,
    role_label: isCommandRole(row.role) ? roleLabel(row.role) : row.role,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    password_set_at: row.passwordSetAt?.toISOString() ?? null,
  };
}

export async function GET() {
  try {
    await requireOwnerId();
    const operators = await prisma.commandOperator.findMany({
      orderBy: [{ role: "asc" }, { username: "asc" }],
      select: {
        operatorId: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        passwordSetAt: true,
      },
    });
    return Response.json({ operators: operators.map(serializeOperator) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwnerId();
    const body = (await request.json()) as {
      username?: string;
      full_name?: string;
      password?: string;
      role?: string;
    };

    const usernameParsed = parseUsernameInput(body.username);
    if (!usernameParsed.ok) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", usernameParsed.error, 400);
    }

    const passwordParsed = parsePasswordInput(body.password);
    if (!passwordParsed.ok) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", passwordParsed.error, 400);
    }

    const fullName = body.full_name?.trim();
    if (!fullName) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Display name is required.", 400);
    }

    const role = body.role ?? "command_operator";
    if (!isCommandRole(role)) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Invalid role.", 400);
    }

    const existing = await prisma.commandOperator.findUnique({
      where: { username: usernameParsed.value },
    });
    if (existing) {
      throw new CommandApiError("ERR_CONFLICT", "Username is already taken.", 409);
    }

    const operator = await prisma.commandOperator.create({
      data: {
        username: usernameParsed.value,
        fullName,
        role,
        isActive: true,
        passwordHash: await hashOperatorPassword(passwordParsed.value),
        passwordSetAt: new Date(),
      },
      select: {
        operatorId: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        passwordSetAt: true,
      },
    });

    return Response.json({ operator: serializeOperator(operator) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
