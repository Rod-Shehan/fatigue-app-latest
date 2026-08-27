import Link from "next/link";
import { GuideDiagram } from "@/components/guides/GuideDiagram";
import { Button } from "@/components/ui/button";
import { ROADSIDE_PRODUCE_BUTTON_LABEL } from "@/lib/roadside-pdf";
import { SETUP_WEEK_RECORD_BUTTON_LABEL } from "@/lib/declared-24h-rests";
import {
  DRIVER_CONTINUE_SHIFT_LABEL,
  DRIVER_START_SHIFT_LABEL,
  DRIVER_START_WORK_LABEL,
  DRIVER_STOP_DRIVING_LABEL,
  DRIVER_START_REST_LABEL,
  DRIVER_START_OTHER_WORK_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_END_SHIFT_LABEL,
  DRIVER_WORK_LABEL,
  DRIVER_REST_LABEL,
  DRIVER_OTHER_WORK_LABEL,
  DRIVER_NAP_QUESTION_LABEL,
  DRIVER_NAP_QUESTION_COMPACT_LABEL,
  DRIVER_ON_NAP_LABEL,
  DRIVER_BREAK_FROM_DRIVING_LABEL,
  DRIVER_PASSENGER_LABEL,
  DRIVER_SLEEPER_BERTH_LABEL,
  DRIVER_LOAD_CHECK_LABEL,
  EDIT_PREVIOUS_WEEK_BUTTON_LABEL,
  DRIVER_REST_WINDOW_HEADLINE,
  formatDriverShiftStillOpen,
} from "@/lib/product-copy";
import { WORKSAFE_TRACK_LABELS } from "@/lib/worksafe-day-sheet";
import {
  CHECKLIST_EMAIL_BUTTON_LABEL,
  CHECKLIST_EMAIL_SETTINGS_LABEL,
  CHECKLIST_PDF_BUTTON_LABEL,
} from "@/lib/checklist";
import { DRIVER_SETTINGS_SECTIONS } from "@/lib/driver-settings-sections";

const sectionClass =
  "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-5";
const h2Class = "text-base font-bold text-slate-800 dark:text-slate-100 mb-2";
const ulClass = "list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300";
const tableClass = "w-full text-sm border-collapse mt-2";
const thClass = "text-left font-semibold text-slate-700 dark:text-slate-200 pb-1 pr-3 align-top";
const tdClass = "text-slate-600 dark:text-slate-300 pb-1 align-top";

function TwoColTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className={tableClass}>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a}>
            <th className={thClass}>{a}</th>
            <td className={tdClass}>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DriverGuideArticle() {
  return (
    <article className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
      <p className="text-slate-500 dark:text-slate-400">
        Simple English guide with pictures. This explains how to use the app — it is not legal advice. Your company
        rules and WA commercial vehicle hours still apply.
      </p>

      <section className={sectionClass}>
        <h2 className={h2Class}>1. What this app does</h2>
        <p>Circadia24 keeps your weekly fatigue record — an electronic work diary (EWD).</p>
        <ul className={`${ulClass} mt-3`}>
          <li>You tap buttons when you work, take a break, or end shift.</li>
          <li>Time you do not log is counted as non-work (rest / off duty) — like blank time on a paper diary.</li>
          <li>
            Same route every day? The app can suggest{" "}
            <strong className="text-slate-700 dark:text-slate-200">rego and run plan</strong> in Set up day from your
            last trip when you start a shift. They appear on that card and the PDF after you{" "}
            <strong className="text-slate-700 dark:text-slate-200">Confirm</strong>. Once the shift is open, later day
            cards show the same truck and run — you do not Confirm again because the clock rolled. Start location and
            destination only appear under{" "}
            <strong className="text-slate-700 dark:text-slate-200">Enter run plan</strong> (blank when you open that
            option), or from a saved run plan you pick. You always type{" "}
            <strong className="text-slate-700 dark:text-slate-200">start km</strong> and{" "}
            <strong className="text-slate-700 dark:text-slate-200">end km</strong> yourself.
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>2. Sign in</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Open the app in your browser (or the installed app).</li>
          <li>Type your email (provided or from your manager).</li>
          <li>Type your password (provided or from your manager).</li>
          <li>Tap Sign in.</li>
          <li>
            Forgot password? Tap Forgot password, enter your email, and use the reset link (or ask your manager for a
            temporary password).
          </li>
        </ol>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          You can change your password later in Settings → Account → Change password.
        </p>
        <GuideDiagram title="Sign in screen">
          {`┌─────────────────────────────┐
│  Email:  you@company.com    │
│  Password: ••••••            │
│         Forgot password?    │
│         [ Sign in ]         │
└─────────────────────────────┘`}
        </GuideDiagram>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>3. Drive home (the first screen)</h2>
        <p>After sign in you see Drive.</p>
        <GuideDiagram title="Drive home">
          {`┌─────────────────────────────┐
│  Hi, [Your name]      ⚙     │
│  This week · [date]         │
│  Today · [date]             │
│                             │
│  ┌─────────────────────┐    │
│  │ Log more work    ▶  │    │
│  └─────────────────────┘    │
│  [ ${ROADSIDE_PRODUCE_BUTTON_LABEL} ]
│  Your weeks              ▶  │
└─────────────────────────────┘`}
        </GuideDiagram>
        <TwoColTable
          rows={[
            ["Hi, [your name]", "You are signed in"],
            ["This week / Today", "Which week and day you are in"],
            ["Status card (Work / Rest / Other work / Off)", "What the app thinks you are doing now"],
            ["Log more work / Open this week", "Open this week to log"],
            [ROADSIDE_PRODUCE_BUTTON_LABEL, "One PDF for a regulator"],
            ["Your weeks", "Past and signed records"],
            ["Gear (top right)", "Settings and tools"],
          ]}
        />
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">
          Tip: Tap Log more work each day when you start.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>4. The log bar (main buttons)</h2>
        <p>The buttons change to match what you are doing:</p>
        <GuideDiagram title="Log bar">
          {`┌─────────────────────────────┐
│ [ ${DRIVER_START_SHIFT_LABEL} ]              │
│ [ ${DRIVER_START_WORK_LABEL} ]               │
│   then split:               │
│ [ ${DRIVER_START_DRIVING_LABEL} ]            │
│ [ ${DRIVER_START_OTHER_WORK_LABEL} ]        │
│ On Other work (three tiles):│
│ [        ${DRIVER_START_DRIVING_LABEL}            ]
│ [ ${DRIVER_START_REST_LABEL} ] [ ${DRIVER_LOAD_CHECK_LABEL} ] │
│ [ ${DRIVER_STOP_DRIVING_LABEL} ]             │
│   then split:               │
│ [ ${DRIVER_START_REST_LABEL} ]              │
│ [ ${DRIVER_START_OTHER_WORK_LABEL} ]        │
│ [ ${DRIVER_NAP_QUESTION_LABEL} ] [ ${DRIVER_END_SHIFT_LABEL} ] │
└─────────────────────────────┘`}
        </GuideDiagram>
        <TwoColTable
          rows={[
            [DRIVER_START_SHIFT_LABEL, "Opens Set up day if details are missing, then Start driving or Start Other Work. Does not log by itself."],
            [DRIVER_START_WORK_LABEL, "On Rest: choose Start driving or Start Other Work (loading). Does not log by itself."],
            [DRIVER_START_DRIVING_LABEL, "Top of Start shift / Start work, or on the Other work hub. Starts driving on the timeline"],
            [DRIVER_STOP_DRIVING_LABEL, "You have stopped driving. Still on shift. Not End shift."],
            [DRIVER_START_REST_LABEL, "Sit still — eat, drink, nap. 31 minutes or more becomes non-work"],
            [DRIVER_NAP_QUESTION_LABEL, `Bottom-left, only on Rest. Not in the hero. Tap once if you are napping — still Rest on the record. Compact: ${DRIVER_NAP_QUESTION_COMPACT_LABEL}. After tap: ${DRIVER_ON_NAP_LABEL} (tap again to clear).`],
            [DRIVER_START_OTHER_WORK_LABEL, "Not driving, still a job — load, forklift, tyre, paperwork, fuel. Then three tiles stay on the ring."],
            [DRIVER_LOAD_CHECK_LABEL, "On Other work, always on the ring. Opens Dimension & Load. You stay on Other work. Tap again for another load. If it is not a load, stay on Other work until you drive or rest."],
            [DRIVER_END_SHIFT_LABEL, "You finish work — enter finish time and end km"],
          ]}
        />
        <GuideDiagram title="Activity flow (read left to right)">
          {`  OFF / Non-work
       │
       ▼ ${DRIVER_START_SHIFT_LABEL} (after start km)
  ${DRIVER_START_DRIVING_LABEL} → WORK
  ${DRIVER_START_OTHER_WORK_LABEL} → Other work
     WORK ──► ${DRIVER_STOP_DRIVING_LABEL} ──► ${DRIVER_START_REST_LABEL} or ${DRIVER_START_OTHER_WORK_LABEL}
       │                           │
       │         Rest ──► ${DRIVER_START_WORK_LABEL} ──► driving or Other work
       │                           │
       │         Other work ──► three tiles (driving, Rest, Load check)
       │                           │
       │◄──── ${DRIVER_START_DRIVING_LABEL} (from Rest or Other work) ──┘
       │
       ▼ Tap ${DRIVER_END_SHIFT_LABEL} (+ end km)
  OFF / Non-work`}
        </GuideDiagram>
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">Simple rule:</p>
        <p>Tap the button that matches what you are doing now.</p>
        <p className="mt-2">
          The timer on the ring shows how long this stretch has been open, with a small note under it for where you are
          now ({DRIVER_WORK_LABEL}, {DRIVER_REST_LABEL}, or {DRIVER_OTHER_WORK_LABEL}) so Start Rest is not confused with
          Other work.
        </p>
        <p className="mt-2">
          While you are on Rest, a corner control asks {DRIVER_NAP_QUESTION_LABEL} It is not in the hero split. Tap
          it only if you are napping — the record stays Rest. It then shows {DRIVER_ON_NAP_LABEL}. Tap again to clear.
        </p>
        <p className="mt-2">
          Then tap again within a few seconds when the button pulses — that second tap is what records the event (
          {DRIVER_START_DRIVING_LABEL}, {DRIVER_START_REST_LABEL},{" "}
          {DRIVER_START_OTHER_WORK_LABEL}, {DRIVER_END_SHIFT_LABEL}). {DRIVER_START_SHIFT_LABEL},{" "}
          {DRIVER_START_WORK_LABEL} and {DRIVER_STOP_DRIVING_LABEL} only open a split — they do not log until you pick
          a kind.
        </p>
        <p className="mt-2">
          When your organisation has the GPS trail addon on and the vehicle is moving, Start shift / Stop Driving / End
          shift stay locked but you still see the usual timer and labels (dimmed), with &quot;Moving · pull over to
          unlock&quot; and a ring that fills while you are stopped. Pull over and wait a few seconds after you stop —
          then tap. If you already tapped once to confirm, the second tap still works. View diary stays available.
        </p>
        <p className="mt-2">You cannot start a shift until start km is on today&apos;s card (see section 7).</p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>5. Non-work time</h2>
        <ul className={ulClass}>
          <li>If you do not tap Start driving, Start Rest, or Other work, the app shows non-work.</li>
          <li>
            Rest only appears when you tap {DRIVER_START_REST_LABEL}. A short logged rest (30 minutes or less) stays
            Rest; longer logged rest (31 minutes or more) becomes non-work. Other work is a break from driving on the
            sheet and never becomes non-work, even if it is long. For the 20 min rest per 5 hours work rule, Rest,
            Other work, and Non-work all count. Other work is still work time for the 168h limit.
          </li>
          <li>The app does not invent Rest from a short gap after End shift or other time off.</li>
          <li>
            When you finish for the day, tap End shift. From that moment, time is non-work until you tap{" "}
            {DRIVER_START_SHIFT_LABEL} again.
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>6. End shift and kilometres (km)</h2>
        <p>
          When you tap <strong className="text-slate-700 dark:text-slate-200">End shift</strong>:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>The app asks when you finished and your end km.</li>
          <li>
            If your last Work / Rest / Other work was on an earlier day (for example you forgot to end last night), choose the finish
            date — from when you started that shift through today — then the finish time. Work that continues onto today
            on the bar without a new tap is still the same shift; it does not lock End shift to today.
          </li>
          <li>Read the odometer and type the end km.</li>
          <li>Confirm.</li>
        </ol>
        <p className="mt-3">
          <strong className="text-slate-700 dark:text-slate-200">Important:</strong> The app never fills in start km or
          end km. You always read the truck and type them.
        </p>
        <p className="mt-3">
          <strong className="text-slate-700 dark:text-slate-200">If your shift runs past midnight:</strong> just keep
          working. Minutes follow the events you tap — there is no day, midnight, or other cut on the timeline. Day
          cards are labels so you can find a date. They do not start a new shift. Rego and route stay with that open
          shift until End shift. Tap End shift only when you actually finish.
        </p>
        <p className="mt-3">
          <strong className="text-slate-700 dark:text-slate-200">If you forget End shift:</strong> after about 7
          hours with the shift still open, the Upcoming notice on the log bar says{" "}
          <strong className="text-slate-700 dark:text-slate-200">{formatDriverShiftStillOpen()}</strong>. Tap End
          shift, pick the date and time you actually finished (not only today&apos;s clock), and enter end km. The
          notice follows the rolling timeline, so it still appears after midnight.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>7. Today&apos;s card — repeat routes</h2>
        <p className="mb-3">
          Set up day can suggest last-trip values when you <strong>start</strong> a shift. After that,{" "}
          <strong className="text-slate-700 dark:text-slate-200">rego and route stay with the open shift</strong>{" "}
          until End shift. Later day cards are labels only — they show the same truck and run. You do not Confirm
          again when the clock rolls.
        </p>
        <GuideDiagram title="Same shift, next day card">
          {`┌─────────────────────────────┐
│  Wednesday (label only)     │
│  Rego / From / To: same as  │
│  the open shift             │
│                             │
│  WorkSafe day sheet         │
│  (minutes from events)      │
└─────────────────────────────┘`}
        </GuideDiagram>
        <TwoColTable
          rows={[
            ["Rego (number plate)", "Stays with the open shift until End shift"],
            ["From / To", "Stays with the open shift until End shift"],
            ["Run plan (name, hours, distance)", "Stays with the open shift until End shift"],
            ["Start km", "Typed when you start the shift — not again at midnight"],
            ["End km", "You type this at End shift"],
          ]}
        />
        <p className="mt-3">
          Under the route fields, the day card shows a WorkSafe WA day sheet: truck reg, odometer and locations on top, then three
          rows ({WORKSAFE_TRACK_LABELS.work}, {WORKSAFE_TRACK_LABELS.break}, {WORKSAFE_TRACK_LABELS.non_work}) with a
          15-minute tick grid (blank first hour, then 1.00–23.00), weekday and date in the corner, and a thin step line
          for what you logged (same rules as section 5). Days with no events show a full non-work line (totals Work 0 /
          Break 0 / Non-work 24) — no blank unfinished rows. On a phone you can scroll the sheet sideways.
        </p>
        <p className="mt-3">
          Normal day: open the week → tap {DRIVER_START_SHIFT_LABEL}. If day details are missing, Set up day opens —
          Confirm then choose {DRIVER_START_DRIVING_LABEL} or {DRIVER_START_OTHER_WORK_LABEL} on the ring. If setup is
          already done, the same split opens (tap again to confirm the kind). After {DRIVER_START_OTHER_WORK_LABEL}{" "}
          is logged, the ring keeps three tiles: {DRIVER_START_DRIVING_LABEL}, {DRIVER_START_REST_LABEL},{" "}
          {DRIVER_LOAD_CHECK_LABEL} — same after a reload. Load check opens Dimension
          & Load; you stay on Other work. Tap {DRIVER_LOAD_CHECK_LABEL} again for another load. If it is not a load, stay
          on Other work until you drive or rest. Daily checks (Fitness for work, Daily vehicle checklist, Dimension & load) stay
          available on the day card for depot / already-loaded work. Forms are optional in trial — do not block Start
          shift.
        </p>
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">Set up day / Edit day</p>
        <p>Use Set up day (or Edit day) when something changes:</p>
        <ul className={`${ulClass} mt-1`}>
          <li>New truck (rego)</li>
          <li>
            New run — a saved run plan, enter run plan (from / to, name, expected hours/km), or no run
            plan
          </li>
          <li>Shift pattern — Day (A) or Night (B)</li>
          <li>Solo or Two-up, and the relief driver&apos;s name</li>
          <li>
            Last 2 or 4 × 24 hour non-work breaks — set the start time for each (week record —
            under crew, above route setup). End fills 24 hours later; change it only if the rest ran
            longer. Shown when the app needs them. The most recent end also
            resets short-horizon rules. Change them until you sign; after sign-off only your manager
            can amend. If you are already on shift, tap{" "}
            <strong>{SETUP_WEEK_RECORD_BUTTON_LABEL}</strong> on the upcoming compliance banner, Work
            warning, or compliance snapshot.
          </li>
          <li>
            Work / break / non-work / End shift time corrections — when the day already has events (Edit
            day), you get the full list. On a new shift with no events yet, Set up day only offers Add
            work, Rest, and Other work. If End shift is on that day after work the same day, end km is required
            on the same card. Overnight finish (End shift only on this card): leave end km blank when
            it is already on the previous day, then enter start km to begin the next shift. Rest only
            during a work bout (not after End shift or in the middle of non-work). Don&apos;t leave Rest
            open — resume work, Other work, non-work, or End shift. Other work can start the next shift
            after End shift (loading) — you do not need Work first. Open work overnight is fine.
          </li>
          <li>
            Sunday / week seam: Saturday is on the previous week sheet. On Sunday&apos;s card, tap{" "}
            <strong>{EDIT_PREVIOUS_WEEK_BUTTON_LABEL}</strong> beside Edit day to open Saturday&apos;s Edit day
            on last week (add non-work or fix times). The timeline is continuous; week labels are only for
            display. If you add End shift on Saturday, any Work/Break left on Sunday from that same open shift
            is removed automatically (with a short note).
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>8. Two-up drivers</h2>
        <ul className={ulClass}>
          <li>Enter the relief driver&apos;s name in Set up day (for context).</li>
          <li>Log only your own times on your sheet. The relief driver keeps their own sheet.</li>
          <li>Two-up does not use {DRIVER_START_REST_LABEL} or {DRIVER_NAP_QUESTION_LABEL}. Sleep on the trip is {DRIVER_SLEEPER_BERTH_LABEL}.</li>
          <li>
            On driving, {DRIVER_STOP_DRIVING_LABEL} opens four choices: {DRIVER_BREAK_FROM_DRIVING_LABEL},{" "}
            {DRIVER_START_OTHER_WORK_LABEL}, {DRIVER_PASSENGER_LABEL}, or {DRIVER_SLEEPER_BERTH_LABEL}.
          </li>
          <li>
            {DRIVER_PASSENGER_LABEL} is still work time — it never becomes non-work. Then tap {DRIVER_CONTINUE_SHIFT_LABEL}{" "}
            to choose {DRIVER_START_DRIVING_LABEL}, {DRIVER_BREAK_FROM_DRIVING_LABEL}, or {DRIVER_SLEEPER_BERTH_LABEL}.
          </li>
          <li>
            {DRIVER_SLEEPER_BERTH_LABEL} is non-work time during the shift (in the vehicle). It is not {DRIVER_END_SHIFT_LABEL}.
            Then tap {DRIVER_START_WORK_LABEL} to choose {DRIVER_START_DRIVING_LABEL}, {DRIVER_START_OTHER_WORK_LABEL}, or{" "}
            {DRIVER_PASSENGER_LABEL}.
          </li>
          <li>
            {DRIVER_END_SHIFT_LABEL} is only when you go home or to a motel. After that, {DRIVER_START_SHIFT_LABEL} starts a new
            working period.
          </li>
          <li>Two-up uses different non-work rules than solo (including rest that may be in a moving vehicle).</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>9. Sign your week</h2>
        <p>
          You can sign your week sheet only after the week has finished — just like handing in a paper sheet at the end
          of the week.
        </p>
        <GuideDiagram title="Sign">
          {`┌─────────────────────────────┐
│  Sign this week's record    │
│  Review days, then sign.    │
│         [ Sign record ]     │
└─────────────────────────────┘`}
        </GuideDiagram>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Open the finished week from Your weeks (or the reminder).</li>
          <li>Check the information on each day. Fix route or times if needed.</li>
          <li>Tap Sign record.</li>
          <li>Your signature means: &quot;This is a true record of my week.&quot;</li>
        </ol>
        <ul className={`${ulClass} mt-3`}>
          <li>After you sign, that week is locked for you.</li>
          <li>If something is wrong, tell your manager. They amend it with a reason, and you sign again.</li>
          <li>Unsigned past weeks show as gentle reminders. They do not block logging on this week.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>10. Why the app works this way</h2>
        <p>Drivers often ask why they can&apos;t do certain things. Here are the reasons:</p>
        <TwoColTable
          rows={[
            [
              "Sign this week early",
              "You sign only after the week ends (from your usual week ending day). It is the same as paper: you hand the sheet in once the week is finished. Signing early would lock the week and stop you logging any more work.",
            ],
            [
              "Log live on a past week",
              "Live buttons work on the current week only. On a past week you can fix route or times, then sign. This keeps \u201cnow\u201d and \u201chistory\u201d separate.",
            ],
            [
              "Edit a week after you sign it",
              "Your signature is the legal record. To change a signed week, your manager amends it (with a reason on file) and you re-sign the corrected version. This protects you and stops silent changes.",
            ],
            [
              "Have the app fill in km",
              "Start km and end km are read from the truck odometer. Only you can see it, so only you type it.",
            ],
            ["\u201cEnd yesterday\u2019s shift\u201d separately", "Open work carries across midnight until you End shift."],
            [
              "Switch Day \u2194 Night freely after a long run",
              "After about five 24-hour stretches on the same pattern (A or B), changing pattern needs enough hours off first. This follows the shift-change rule.",
            ],
          ]}
        />
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>11. Your weeks (list)</h2>
        <TwoColTable
          rows={[
            ["Current week", `Log ${DRIVER_START_SHIFT_LABEL} / ${DRIVER_STOP_DRIVING_LABEL} / ${DRIVER_END_SHIFT_LABEL} here`],
            ["Needs signature", "Finished week — open, check, sign"],
            ["Signed", "Locked — read only for you"],
          ]}
        />
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>12. Roadside PDF (for Main Roads Inspector, Police, etc.)</h2>
        <ul className={ulClass}>
          <li>
            Tap {ROADSIDE_PRODUCE_BUTTON_LABEL} on Drive home, on your week sheet (Day tools → Roadside), or in
            Settings.
          </li>
          <li>
            It builds one PDF of your last 28 calendar days — one Weekly Trip Sheet page per week (week
            ending, operator, driver name with licence number, medical and license expiry, truck reg, fitness/load/vehicle ticks from your day cards, seven WorkSafe day
            sheets with empty days drawn as full non-work, week work-hours total, office-use box, and your
            week signature when signed). OPERATOR is your organisation name, set by the owner — not a field
            on Drive home. No Circadia header, compliance summary, or shift-log appendix.
          </li>
          <li>It works offline from saved weeks. Share or show it on your phone.</li>
        </ul>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          You must keep signed records for at least 3 years — this export is for roadside produce only.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>13. Day tools, compliance, and shift log</h2>
        <ul className={ulClass}>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Day tools</strong> (clipboard icon) — week summary,
            last 24-hour break, Compliance, Roadside, records to sign, and Settings.
          </li>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Compliance</strong> — if a rule is not met, an amber
            banner on the week (and a red/amber notice on the log bar) shows the same wording as the office check, including
            which day and what was short. Tap it for the full snapshot.
          </li>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Upcoming</strong> (above the ring on the live log bar)
            names what to do now: rest due by a time when the 5h window is inside the next 2 hours (or overdue);{" "}
            <strong className="text-slate-700 dark:text-slate-200">{DRIVER_REST_WINDOW_HEADLINE}</strong> after End
            shift until 7 hours (also on Drive home); or {formatDriverShiftStillOpen()}. The countdown on the ring
            still turns amber at 45 minutes and red at 15 minutes.
          </li>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Shift log</strong> — a list of every event on your
            record (in the app). It is not in Export PDF or the 28-day roadside PDF.
          </li>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Export PDF</strong> — this week&apos;s Weekly Trip
            Sheet only (same page as each roadside week). No Circadia header, compliance summary, or shift-log appendix.
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>14. Options (voice &amp; display)</h2>
        <p>Tap the gear on the log bar (full or compact hero) for:</p>
        <ul className={`${ulClass} mt-1`}>
          <li>Compliance — open the compliance snapshot details.</li>
          <li>Voice commands — log by speaking (where supported).</li>
          <li>Voice alerts — spoken reminders while logging.</li>
          <li>Dark mode — easier on the eyes at night.</li>
        </ul>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          You can also set Dark mode and Voice alerts in Settings → {DRIVER_SETTINGS_SECTIONS.device.title}.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>15. Settings</h2>
        <TwoColTable
          rows={[
            [
              DRIVER_SETTINGS_SECTIONS.device.overviewTitle,
              "Dark mode, voice alerts, install the app, backup on this device",
            ],
            [
              DRIVER_SETTINGS_SECTIONS.delivery.overviewTitle,
              `${CHECKLIST_EMAIL_SETTINGS_LABEL} (defaults to sign-in email) and Workshop contact (vehicle faults)`,
            ],
            [
              DRIVER_SETTINGS_SECTIONS.record.overviewTitle,
              "Weeks to sign, This week, Your weeks, Route catalogue, Driver guide, How your record works",
            ],
            [
              DRIVER_SETTINGS_SECTIONS.account.overviewTitle,
              "Messages, Manager sign-in, Change password, Log out",
            ],
          ]}
        />
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>16. Messages</h2>
        <p>Settings → Messages — talk to your manager inside the app.</p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>17. Medical reminder</h2>
        <p>
          If your manager saved a medical expiry date, you may see a yellow or red banner. Book your medical and ask your
          manager to update the date.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>18. Each-day checklist</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Sign in (or stay signed in)</li>
          <li>Log more work</li>
          <li>Check rego and run setup on today&apos;s card</li>
          <li>
            Optionally tick Daily checks, or open signed Fitness for Work / Prestart / Dimension & Load forms (optional
            in trial — do not block Start shift). Daily checks order is Fitness for work, Daily vehicle checklist, then
            Dimension & load. After {DRIVER_START_OTHER_WORK_LABEL} is logged, the ring keeps three tiles including{" "}
            {DRIVER_LOAD_CHECK_LABEL} (same after a reload). Tap {DRIVER_LOAD_CHECK_LABEL}{" "}
            again for another load. After a form is saved, use View to read it, or Redo / Add another for a
            new signed record. {CHECKLIST_PDF_BUTTON_LABEL} (day tools) downloads a week pack per checklist type
            (FFW / Prestart / Load as separate files — not combined; different regs). {CHECKLIST_EMAIL_BUTTON_LABEL}{" "}
            sends those PDFs to your address in Settings → {DRIVER_SETTINGS_SECTIONS.delivery.title} →{" "}
            {CHECKLIST_EMAIL_SETTINGS_LABEL} (defaults to your sign-in email). Two-up drivers who are not responsible for the vehicle prestart can record
            that on the Prestart form instead of inventing answers. Prestart is filed under the vehicle registration.
            Dimension & Load is one form per load (prime + every trailer/dolly on that load); Add another for the next
            load. Loader CoR stays separate (present sign, pending, or photo gap — no proxy).
          </li>
          <li>Tap {DRIVER_START_SHIFT_LABEL} when you begin (Confirm Set up day if prompted, then {DRIVER_START_DRIVING_LABEL} or {DRIVER_START_OTHER_WORK_LABEL})</li>
          <li>Tap {DRIVER_STOP_DRIVING_LABEL}, then {DRIVER_START_REST_LABEL} or {DRIVER_START_OTHER_WORK_LABEL}. From Rest, tap {DRIVER_START_WORK_LABEL} then driving or Other work. On Other work the three tiles stay on the ring: {DRIVER_START_DRIVING_LABEL}, {DRIVER_START_REST_LABEL}, {DRIVER_LOAD_CHECK_LABEL}. Tap {DRIVER_LOAD_CHECK_LABEL} again for another load</li>
          <li>Tap End shift when finished — enter finish time and end km</li>
          <li>When the week has ended — Sign</li>
        </ol>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>19. Glossary</h2>
        <TwoColTable
          rows={[
            ["Work", "Driving, or the main on-duty stretch"],
            [DRIVER_REST_LABEL, "Not driving and not doing a job task (eat, drink, nap). 31+ min becomes non-work"],
            [DRIVER_NAP_QUESTION_LABEL, `Only on Rest, bottom-left. Not a new activity. After tap: ${DRIVER_ON_NAP_LABEL}`],
            [DRIVER_OTHER_WORK_LABEL, "Not driving, still a job (load, forklift, tyre, paperwork, fuel). Break from driving; never non-work"],
            ["Non-work", "Off the job / End shift / sleep"],
            [
              "WorkSafe day sheet",
              `Truck reg / odometer / locations + ${WORKSAFE_TRACK_LABELS.work} / ${WORKSAFE_TRACK_LABELS.break} / ${WORKSAFE_TRACK_LABELS.non_work} as a 15-minute tick grid (day card + PDF); empty days = Work 0 / Break 0 / Non-work 24`,
            ],
            [
              "Weekly Trip Sheet (PDF)",
              "Export PDF and each roadside page: week ending, operator (organisation name set by the owner — not on Drive home), driver name with licence number, driver medical expiry, driver license expiry, truck regs, daily checklist ticks from day cards, seven day sheets, week work-hours total, office use, week signature. No Circadia header, compliance summary, or shift-log appendix",
            ],
            [DRIVER_START_SHIFT_LABEL + " / End shift", "Begin / finish a shift. Start shift opens driving or Other work"],
            [DRIVER_START_WORK_LABEL, "On Rest — choose driving or Other work"],
            [DRIVER_START_DRIVING_LABEL, "After Start shift, Start work, or on the Other work hub — log driving"],
            [DRIVER_CONTINUE_SHIFT_LABEL, "Two-up Passenger — choose driving, break from driving, or sleeper berth"],
            [
              "Fitness for Work",
              "Signed form filed under your name. Optional in trial. Separate PDF from Prestart and Load",
            ],
            [
              "Prestart",
              "Vehicle inspection filed under the truck registration; your name is who inspected. Optional in trial",
            ],
            [
              "Dimension & Load",
              "One signed form per load. Enter prime mover and every trailer/dolly on that load. Open from Load check on the Other work hub, or Daily checks. Add another for the next load. Loader CoR is separate (no proxy)",
            ],
            ["Week", "Sunday–Saturday slice of your record"],
            ["Sign", "You attest the week is correct"],
            ["Rego", "Number plate"],
            ["Start km / End km", "Odometer readings you type"],
            ["Set up day", "Change route, truck, pattern, or crew"],
            [
              EDIT_PREVIOUS_WEEK_BUTTON_LABEL,
              "On Sunday — open Saturday Edit day on the previous week sheet",
            ],
            ["Run plan", "Optional saved route (name, hours, km)"],
            [
              "Roadside PDF",
              "Last 28 days as weekly trip sheets — one week per page",
            ],
          ]}
        />
      </section>

      <div className="flex flex-col gap-2 pt-2">
        <Link href="/driver" className="block">
          <Button className="w-full min-h-[56px] h-14 text-base font-semibold">Open this week</Button>
        </Link>
        <Link href="/driver/help" className="block">
          <Button variant="outline" className="w-full min-h-[56px] h-14 text-base font-semibold">
            Shorter help page
          </Button>
        </Link>
      </div>
    </article>
  );
}
