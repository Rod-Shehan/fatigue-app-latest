export const COMMAND_ROLES = ["command_owner", "command_operator"] as const;

export type CommandRole = (typeof COMMAND_ROLES)[number];

export function isCommandRole(value: string): value is CommandRole {
  return (COMMAND_ROLES as readonly string[]).includes(value);
}

export function canAccessTriage(role: CommandRole): boolean {
  return role === "command_owner" || role === "command_operator";
}

export function canManageOperators(role: CommandRole): boolean {
  return role === "command_owner";
}

export function roleLabel(role: CommandRole): string {
  return role === "command_owner" ? "Owner" : "Operator";
}
