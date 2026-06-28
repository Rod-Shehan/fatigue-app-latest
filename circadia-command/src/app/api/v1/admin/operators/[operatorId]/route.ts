import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { isCommandRole, roleLabel } from "@/lib/auth/roles";
import { hashOperatorPassword, parsePasswordInput } from "@/lib/auth/password";
import { parseUsernameInput } from "@/lib/auth/username";
import { requireOwnerId } from "@/lib/operator-context";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ operatorId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ownerId = await requireOwnerId();
    const { operatorId } = await params;
    const body = (await request.json()) as {
      full_name?: string;
      password?: string;
      role?: string;
      is_active?: boolean;
    };

    const target = await prisma.commandOperator.findUnique({
      where: { operatorId },
    });
    if (!target) {
      throw new CommandApiError("ERR_NOT_FOUND", "User not found.", 404);
    }

    const data: {
      fullName?: string;
      role?: string;
      isActive?: boolean;
      passwordHash?: string;
      passwordSetAt?: Date;
    } = {};

    if (body.full_name !== undefined) {
      const fullName = body.full_name.trim();
      if (!fullName) {
        throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Display name cannot be empty.", 400);
      }
      data.fullName = fullName;
    }

    if (body.role !== undefined) {
      if (!isCommandRole(body.role)) {
        throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Invalid role.", 400);
      }
      if (target.operatorId === ownerId && body.role !== "command_owner") {
        throw new CommandApiError(
          "ERR_SCOPE_VIOLATION",
          "You cannot remove your own owner role.",
          403
        );
      }
      data.role = body.role;
    }

    if (body.is_active !== undefined) {
      if (target.operatorId === ownerId && body.is_active === false) {
        throw new CommandApiError(
          "ERR_SCOPE_VIOLATION",
          "You cannot deactivate your own account.",
          403
        );
      }
      data.isActive = body.is_active;
    }

    if (body.password !== undefined) {
      const passwordParsed = parsePasswordInput(body.password);
      if (!passwordParsed.ok) {
        throw new CommandApiError("ERR_MALFORMED_PAYLOAD", passwordParsed.error, 400);
      }
      data.passwordHash = await hashOperatorPassword(passwordParsed.value);
      data.passwordSetAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "No changes provided.", 400);
    }

    const operator = await prisma.commandOperator.update({
      where: { operatorId },
      data,
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

    return Response.json({
      operator: {
        operator_id: operator.operatorId,
        username: operator.username,
        full_name: operator.fullName,
        role: operator.role,
        role_label: isCommandRole(operator.role) ? roleLabel(operator.role) : operator.role,
        is_active: operator.isActive,
        created_at: operator.createdAt.toISOString(),
        password_set_at: operator.passwordSetAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
