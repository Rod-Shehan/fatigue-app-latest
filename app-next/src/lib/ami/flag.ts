/**
 * Phase 3 — AMI compliance engine flag (default OFF).
 * Enable with AMI_COMPLIANCE_ENGINE_ENABLED=true or NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED=true.
 * NHVR provisional engine is unaffected (still uses legacy WA checks underneath).
 */

export function isAmiComplianceEngineEnabled(): boolean {
  if (typeof process === "undefined") return false;
  return (
    process.env.AMI_COMPLIANCE_ENGINE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED === "true"
  );
}
