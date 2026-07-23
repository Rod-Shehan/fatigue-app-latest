/**
 * AMI compliance engine flag — **default ON** for WA via `runWaComplianceChecks`.
 * Kill-switch: AMI_COMPLIANCE_ENGINE_ENABLED=false or NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED=false.
 * NHVR provisional engine is unaffected (still uses legacy WA checks underneath).
 */

export function isAmiComplianceEngineEnabled(): boolean {
  if (typeof process === "undefined") return true;
  const server = process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
  const pub = process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;
  if (server === "false" || pub === "false") return false;
  return true;
}
