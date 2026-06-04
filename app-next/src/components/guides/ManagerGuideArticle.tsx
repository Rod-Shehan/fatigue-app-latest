import Link from "next/link";
import { GuideDiagram } from "@/components/guides/GuideDiagram";
import { Button } from "@/components/ui/button";
import { MANAGER_EXPERIENCE } from "@/lib/manager-experience";
import { SHEET_ATTESTATION_WORKFLOW } from "@/lib/product-copy";

const sectionClass =
  "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-5";
const h2Class = "text-base font-bold text-slate-800 dark:text-slate-100 mb-2";
const ulClass = "list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300";

export function ManagerGuideArticle() {
  return (
    <article className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
      <p>{MANAGER_EXPERIENCE.PAGE_SUBTITLE}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{MANAGER_EXPERIENCE.HERO_DISCLAIMER}</p>

      <section className={sectionClass}>
        <h2 className={h2Class}>Navigation</h2>
        <GuideDiagram title="Manager menu">
          {`  Risk brief ── Movement map ── Conversations
        │
        ├── Drivers (roster)
        ├── Managers (accounts)
        └── Rego (vehicles)`}
        </GuideDiagram>
        <ul className={ulClass}>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Risk brief</strong> — weekly fleet
            view, tiers, register, sheet workbench
          </li>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Drivers</strong> — roster, medical
            expiry, passwords
          </li>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Conversations</strong> — message
            drivers
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>Exposure tiers</h2>
        <p>{MANAGER_EXPERIENCE.HERO_WEEK_INTRO}</p>
        <ul className={ulClass}>
          <li>
            <strong>{MANAGER_EXPERIENCE.TIER_ATTENTION}</strong> — {MANAGER_EXPERIENCE.TIER_ATTENTION_HINT}
          </li>
          <li>
            <strong>{MANAGER_EXPERIENCE.TIER_ELEVATED}</strong> — {MANAGER_EXPERIENCE.TIER_ELEVATED_HINT}
          </li>
          <li>
            <strong>{MANAGER_EXPERIENCE.TIER_MONITOR}</strong> — {MANAGER_EXPERIENCE.TIER_MONITOR_HINT}
          </li>
          <li>
            <strong>{MANAGER_EXPERIENCE.TIER_CLEAR}</strong> — {MANAGER_EXPERIENCE.TIER_CLEAR_HINT}
          </li>
        </ul>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Tier is a composite glance — use it to prioritise supportive check-ins, not automatic
          discipline.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>{MANAGER_EXPERIENCE.REGISTER_TITLE}</h2>
        <p>{MANAGER_EXPERIENCE.REGISTER_SUBTITLE}</p>
        <p className="mt-2">{MANAGER_EXPERIENCE.TAB_IDENTIFY_HELP}</p>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          On the risk brief page, open section <strong>{MANAGER_EXPERIENCE.SECTION_RISK_TITLE}</strong>{" "}
          for timeline charts and live exposure — separate from{" "}
          <strong>{MANAGER_EXPERIENCE.SECTION_COMPLIANCE_TITLE}</strong>.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>{MANAGER_EXPERIENCE.SECTION_COMPLIANCE_TITLE}</h2>
        <p>{MANAGER_EXPERIENCE.TAB_RECORDS_HELP}</p>
        <p className="mt-3">{SHEET_ATTESTATION_WORKFLOW.MANAGER_AMEND_UNTIL_AGREED}</p>
        <p className="mt-2 font-medium text-slate-700 dark:text-slate-200">
          {SHEET_ATTESTATION_WORKFLOW.MANAGER_SEND_FOR_DRIVER_SIGN}
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>Reference libraries</h2>
        <p>
          On the risk brief, open <strong>{MANAGER_EXPERIENCE.REFERENCE_TITLE}</strong> and{" "}
          <strong>Prospective risk reference (ISO 31000 / IEC 31010)</strong> for coaching context.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>What drivers see (repeat routes)</h2>
        <p>
          The driver app autofills rego, from, to, and run plan from their last trip. They always enter start km and
          end km on the odometer. Coaching: check the card matches the real run, then start km, then Work.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>Suggested weekly workflow</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Open Risk brief for the current work week.</li>
          <li>Review tier counts and assurance signals.</li>
          <li>Work the driver register — Needs attention and Elevated first.</li>
          <li>Amend sheets only with a clear reason; ask drivers to sign when agreed.</li>
          <li>Keep Drivers roster current (medical expiry, active flag).</li>
          <li>Use Conversations to close the loop.</li>
        </ol>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end pt-2">
        <Link href="/manager">
          <Button className="w-full sm:w-auto">Open risk brief</Button>
        </Link>
        <Link href="/drivers">
          <Button variant="outline" className="w-full sm:w-auto">
            Approved Drivers
          </Button>
        </Link>
      </div>
    </article>
  );
}
