import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions, getManagerSession } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PRODUCT_NAME, TAGLINE_DRIVER } from "@/lib/branding";
import {
  DRIVER_HELP_RECORDS_SIGNING_BULLETS,
  OPENING_DISCLAIMER_COMPACT,
  PRODUCT_RECORD_PROMISE,
  SHEET_ATTESTATION_WORKFLOW,
  SHEET_RECORD_CONTRACT,
  UNSIGNED_WEEKS_GATE_HINT,
  USER_VISIBLE_SHEET_STATE_BULLETS,
} from "@/lib/product-copy";
import {
  SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS,
  SHIFT_CHANGE_MIN_GAP_HOURS,
  SHIFT_PATTERN_FIELD_HELP,
} from "@/lib/shift-change";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export default async function DriverHelpPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=%2Fdriver%2Fhelp");
  const manager = await getManagerSession();
  if (manager) redirect("/manager");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-10">
        <PageHeader
          backHref="/driver/settings"
          backLabel="Settings"
          title={PRODUCT_NAME}
          subtitle={TAGLINE_DRIVER}
          icon={<BookOpen className="w-5 h-5" />}
        />

        <article className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
              How your record works
            </h2>
            <p>{PRODUCT_RECORD_PROMISE}</p>
            <p className="mt-3 text-slate-500 dark:text-slate-400">{OPENING_DISCLAIMER_COMPACT}</p>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">Your weeks</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              {USER_VISIBLE_SHEET_STATE_BULLETS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-3 text-slate-500 dark:text-slate-400">{UNSIGNED_WEEKS_GATE_HINT}</p>
          </section>

          <section className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
              Records &amp; signing
            </h2>
            <p className="text-slate-600 dark:text-slate-300">{SHEET_RECORD_CONTRACT}</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-3">
              {DRIVER_HELP_RECORDS_SIGNING_BULLETS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-4 space-y-3 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 bg-white/60 dark:bg-slate-900/40 p-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                  {SHEET_ATTESTATION_WORKFLOW.SIGN_ARCHIVED_WEEK_TITLE}
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-400 text-sm">
                  {SHEET_ATTESTATION_WORKFLOW.SIGN_ARCHIVED_WEEK_BODY}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                  {SHEET_ATTESTATION_WORKFLOW.RESIGN_AFTER_AMENDMENT_TITLE}
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-400 text-sm">
                  {SHEET_ATTESTATION_WORKFLOW.RESIGN_AFTER_AMENDMENT_BODY}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
              Logging work (quick guide)
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-slate-700 dark:text-slate-200">Start shift / Work / Break / End shift</strong>{" "}
                — tap when your activity changes. These buttons log your day.
              </li>
              <li>
                <strong className="text-slate-700 dark:text-slate-200">Break</strong> — short rest (≤30 min between work)
                counts toward your 20 min per 5 hours work.
              </li>
              <li>
                <strong className="text-slate-700 dark:text-slate-200">Non-work time</strong> — longer breaks and time off;
                any break over 30 minutes counts here.
              </li>
              <li>
                <strong className="text-slate-700 dark:text-slate-200">Shift pattern (A/B)</strong> on the day card —{" "}
                {SHIFT_PATTERN_FIELD_HELP}
              </li>
              <li>
                After <strong>{SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS}+ days of work</strong>, changing day ↔ night (A↔B)
                needs at least <strong>{SHIFT_CHANGE_MIN_GAP_HOURS} hours</strong> off between End shift and your next
                Work.
              </li>
            </ul>
          </section>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            This is guidance to help you use the app — not legal advice. WA commercial vehicle hours rules apply to your
            operation.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/driver">
              <Button>Open this week</Button>
            </Link>
            <Link href="/sheets">
              <Button variant="outline">Your weeks</Button>
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
