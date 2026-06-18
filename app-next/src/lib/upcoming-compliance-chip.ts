import type { ComplianceCheckResult } from "@/lib/compliance";
import type { Rolling168hMetrics } from "@/lib/rolling-168h-metrics";
import { MAX_WORK_HOURS_14D } from "@/lib/rolling-168h-metrics";

export type UpcomingComplianceTone = "clear" | "caution" | "attention";

export type UpcomingComplianceChipModel = {
  tone: UpcomingComplianceTone;
  /** One or two short lines for the chip body (no title). */
  lines: string[];
};

const MAX_LINES = 2;

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= MAX_LINES) break;
  }
  return out;
}

function formatRestRemaining(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

/** Map a compliance engine message to a short chip label. */
export function briefLabelFromComplianceMessage(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("exceeds 168") || (m.includes("168") && m.includes("14-day"))) {
    return "Over 168h in a rolling 14-day window";
  }
  if (m.includes("approaching 168") || m.includes("approaching 168h")) {
    return message.replace(/\s*—.*$/, "").trim();
  }
  if (m.includes("72hr") || m.includes("72h") || m.includes("rolling 72")) {
    return "72h window needs attention";
  }
  if (m.includes("17h") && m.includes("non-work")) {
    return "17h between rest blocks at risk";
  }
  if (m.includes("less than 7 hours non-work") || m.includes("7h non-work in any rolling 24")) {
    return "7h rest not met if you start work";
  }
  if (m.includes("2×24h") || m.includes("2x24h") || m.includes("28-day alternative")) {
    return "14-day rest blocks needed";
  }
  if (m.includes("48 hrs") || m.includes("48hrs") || m.includes("rolling 48")) {
    return "48h stationary rest needed";
  }
  if (m.includes("20 min rest") || m.includes("5h work")) {
    return "20 min break required for 5h work";
  }
  if (m.includes("rolling 14-day non-work gap")) {
    return "Check 14-day rest blocks";
  }
  if (m.length <= 72) return message;
  return `${message.slice(0, 69)}…`;
}

function labelsFromMessages(messages: string[]): string[] {
  const out: string[] = [];
  for (const msg of messages) {
    const label = briefLabelFromComplianceMessage(msg);
    if (label) out.push(label);
  }
  return out;
}

function lineFrom168h(metrics: Rolling168hMetrics): string | null {
  if (metrics.wouldExceed168) {
    return "Over 168h in a rolling 14-day window";
  }
  if (metrics.inWarningBand) {
    return `Approaching 168h — ~${metrics.headroomHours}h left`;
  }
  if (metrics.headroomHours > 0 && metrics.headroomHours <= 36) {
    return `~${metrics.headroomHours}h under 168h (14-day rolling)`;
  }
  return null;
}

/**
 * Summarise what the driver should know before starting / continuing work.
 * Uses prospective work warnings, record issues, and 168h headroom — not rule logic changes.
 */
export function resolveUpcomingComplianceChip(input: {
  prospectiveWorkWarnings: string[];
  prospectiveRouteHint?: string | null;
  complianceResults: ComplianceCheckResult[];
  rolling168h?: Rolling168hMetrics | null;
  idleRestBlocked?: boolean;
  idleRestRemainingMinutes?: number | null;
  /** When on work, break countdown is on the hero — omit duplicate break-only cues unless critical. */
  onWorkSegment?: boolean;
}): UpcomingComplianceChipModel {
  const lines: string[] = [];
  let tone: UpcomingComplianceTone = "clear";

  const violations = input.complianceResults.filter((r) => r.type === "violation");
  const warnings = input.complianceResults.filter((r) => r.type === "warning");
  const workRelevantWarnings = warnings.filter((r) =>
    /non-work|7h|17h|72|48|168|14-day|5h work|20 min/i.test(r.message)
  );

  if (input.idleRestBlocked && input.idleRestRemainingMinutes != null) {
    lines.push(`Rest required before work — ${formatRestRemaining(input.idleRestRemainingMinutes)} left`);
    tone = "attention";
  }

  if (violations.length > 0) {
    lines.push(
      violations.length === 1
        ? "Record has a compliance issue — review first"
        : `Record has ${violations.length} compliance issues — review first`
    );
    tone = "attention";
  }

  lines.push(...labelsFromMessages(input.prospectiveWorkWarnings));

  if (!violations.length) {
    lines.push(...labelsFromMessages(workRelevantWarnings.map((w) => w.message)));
  }

  if (input.rolling168h) {
    const h168 = lineFrom168h(input.rolling168h);
    if (h168) {
      lines.push(h168);
      if (input.rolling168h.wouldExceed168) tone = "attention";
      else if (input.rolling168h.inWarningBand && tone === "clear") tone = "caution";
      else if (input.rolling168h.headroomHours <= 36 && tone === "clear") tone = "caution";
    }
  }

  if (input.prospectiveRouteHint) {
    const hint = input.prospectiveRouteHint.length <= 72
      ? input.prospectiveRouteHint
      : `${input.prospectiveRouteHint.slice(0, 69)}…`;
    lines.push(hint);
    if (tone === "clear") tone = "caution";
  }

  const deduped = uniqueLines(lines);

  if (deduped.length === 0) {
    if (input.onWorkSegment) {
      return { tone: "clear", lines: ["All clear on weekly limits"] };
    }
    return {
      tone: "clear",
      lines: [`All clear — within ${MAX_WORK_HOURS_14D}h and rest rules`],
    };
  }

  return {
    tone,
    lines: deduped,
  };
}

/** Idle: always show. On shift: only when not all-clear (reduces clutter). */
export function shouldShowUpcomingComplianceChip(input: {
  isLiveNow: boolean;
  shiftIdle: boolean;
  chip: UpcomingComplianceChipModel;
}): boolean {
  if (!input.isLiveNow) return false;
  if (input.shiftIdle) return true;
  return input.chip.tone !== "clear";
}
