/**
 * Feature flags for optional / provisional rule packs (S5).
 * Use NEXT_PUBLIC_* for values needed in client components (sheet header).
 */

export function isNhvrProvisionalEnabled(): boolean {
  if (typeof process === "undefined") return false;
  return (
    process.env.NHVR_PROVISIONAL_RULES_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_NHVR_PROVISIONAL_RULES_ENABLED === "true"
  );
}
