import {
  formatAssuranceLookbackFootnote,
  formatComplianceLookbackFootnote,
} from "@/lib/record-retention";

export function CompliancePolicyFootnote({
  variant = "driver",
  className = "text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed",
}: {
  variant?: "driver" | "manager";
  className?: string;
}) {
  const text =
    variant === "manager" ? formatAssuranceLookbackFootnote() : formatComplianceLookbackFootnote();
  return <p className={className}>{text}</p>;
}
