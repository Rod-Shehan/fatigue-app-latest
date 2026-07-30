import Link from "next/link";
import { GuideDiagram } from "@/components/guides/GuideDiagram";
import { Button } from "@/components/ui/button";
import { ROADSIDE_PRODUCE_BUTTON_LABEL } from "@/lib/roadside-pdf";
import { SETUP_WEEK_RECORD_BUTTON_LABEL } from "@/lib/declared-24h-rests";
import { WORKSAFE_TRACK_LABELS } from "@/lib/worksafe-day-sheet";

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
            Same route every day? The app fills{" "}
            <strong className="text-slate-700 dark:text-slate-200">rego, from, to,</strong> and run plan from your last
            trip. You always type <strong className="text-slate-700 dark:text-slate-200">start km</strong> and{" "}
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
        </ol>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          You can change your password later in Settings → Account → Change password.
        </p>
        <GuideDiagram title="Sign in screen">
          {`┌─────────────────────────────┐
│  Email:  you@company.com    │
│  Password: ••••••            │
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
            ["Status card (Work / Break / Off)", "What the app thinks you are doing now"],
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
│ [ Start shift ] [ Break ]   │
│           [ End shift ]     │
└─────────────────────────────┘`}
        </GuideDiagram>
        <TwoColTable
          rows={[
            ["Start shift", "First work of a shift (needs start km first)"],
            ["Start Work / Work", "Begin or resume driving / on-duty work"],
            ["Break", "Short rest during work (30 minutes or less)"],
            ["Resume shift", "Continue the same shift after a short stop (when offered)"],
            ["End shift", "You finish work — enter finish time and end km"],
          ]}
        />
        <GuideDiagram title="Activity flow (read left to right)">
          {`  OFF / Non-work
       │
       ▼ Start shift (after start km)
     WORK ──────► Tap Break ──► BREAK
       │                           │
       │◄──── Tap Work again ──────┘
       │
       ▼ Tap End shift (+ end km)
  OFF / Non-work`}
        </GuideDiagram>
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">Simple rule:</p>
        <p>Tap the button that matches what you are doing now.</p>
        <p className="mt-2">
          Then tap again within a few seconds when the button pulses — that second tap is what records the event (Start
          shift, Work, Break, End shift).
        </p>
        <p className="mt-2">
          When your organisation has the GPS trail addon on and the vehicle is moving, Work / Break / End shift stay
          locked but you still see the usual timer and labels (dimmed), with &quot;Moving · pull over to unlock&quot; and a ring
          that fills while you are stopped. Pull over and wait a few seconds after you stop — then tap. If you already
          tapped once to confirm, the second tap still works. View diary stays available.
        </p>
        <p className="mt-2">You cannot start Work until start km is on today&apos;s card (see section 7).</p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>5. Non-work time</h2>
        <ul className={ulClass}>
          <li>If you do not tap Work or Break, the app shows non-work.</li>
          <li>
            Break only appears when you tap Break. A short logged break (30 minutes or less) stays Break; longer logged
            breaks become non-work.
          </li>
          <li>The app does not invent Break from a short gap after End shift or other time off.</li>
          <li>When you finish for the day, tap End shift. From that moment, time is non-work until you tap Work again.</li>
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
            If your last Work/Break was on an earlier day (for example you forgot to end last night), choose the finish
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
          working. Your open work continues across midnight on the same timeline. There is no separate &quot;end
          yesterday&quot; step while you are still working — tap End shift only when you actually finish. Day cards are
          just labels; they do not end your shift.
        </p>
        <p className="mt-3">
          <strong className="text-slate-700 dark:text-slate-200">If you forget End shift:</strong> the app may show a
          reminder (for example after a long stretch with no new log). Use the red End shift button, pick the date and
          time you actually finished (not only today&apos;s clock), and enter end km.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>7. Today&apos;s card — repeat routes</h2>
        <p className="mb-3">Most days you only check the route and type start km.</p>
        <GuideDiagram title="Today with autofill">
          {`┌─────────────────────────────┐
│  Wednesday                  │
│  From: Perth depot          │
│  To:   Kalgoorlie           │
│  Rego: 1ABC123              │
│                             │
│  Start km (required):       │
│  [ _________ ]  ← you type  │
│                             │
│  WorkSafe day sheet         │
│  (15-min tick grid)         │
└─────────────────────────────┘`}
        </GuideDiagram>
        <TwoColTable
          rows={[
            ["Rego (number plate)", "Filled from last trip or earlier this week"],
            ["From / To", "Filled from your last trip"],
            ["Run plan (name, hours, distance)", "Filled if you used it before"],
            ["Start km", "You type this every day — never auto-filled"],
            ["End km", "You type this at End shift"],
          ]}
        />
        <p className="mt-3">
          Under the route fields, the day card shows a WorkSafe WA day sheet: truck reg, odometer and locations on top, then three
          rows ({WORKSAFE_TRACK_LABELS.work}, {WORKSAFE_TRACK_LABELS.break}, {WORKSAFE_TRACK_LABELS.non_work}) with a
          15-minute tick grid (blank first hour, then 1.00–23.00), weekday and date in the corner, and a thin step line
          for what you logged (same rules as section 5). On a
          phone you can scroll the sheet sideways.
        </p>
        <p className="mt-3">
          Normal day: open the week → check From / To / Rego → tick Daily checks when done → type start km → tap Start
          shift.
        </p>
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">Set up day / Edit day</p>
        <p>Use Set up day (or Edit day) when something changes:</p>
        <ul className={`${ulClass} mt-1`}>
          <li>New truck (rego)</li>
          <li>New run (from / to)</li>
          <li>A saved run plan, a custom trip, or no run plan</li>
          <li>Shift pattern — Day (A) or Night (B)</li>
          <li>Solo or Two-up, and the relief driver&apos;s name</li>
          <li>
            Last 2 or 4 × 24 hour non-work breaks — each with start and end times (week record —
            under crew, above route setup). Shown when the app needs them. The most recent end also
            resets short-horizon rules. Change them until you sign; after sign-off only your manager
            can amend. If you are already on shift, tap{" "}
            <strong>{SETUP_WEEK_RECORD_BUTTON_LABEL}</strong> on the upcoming compliance banner, Work
            warning, or compliance snapshot.
          </li>
          <li>
            Work / break / non-work / End shift time corrections — if End shift is on that day after work the same day,
            end km is required on the same card. Overnight finish (End shift only on this card): leave end km blank when
            it is already on the previous day, then enter start km to begin the next shift. Break only during a work
            bout (not in the middle of non-work). Don&apos;t leave a break open — resume work, go to non-work, or End
            shift. Open work overnight is fine.
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>8. Two-up drivers</h2>
        <ul className={ulClass}>
          <li>Enter the relief driver&apos;s name in Set up day (for context).</li>
          <li>Log only your own work, break, and end-shift times on your sheet.</li>
          <li>The relief driver keeps their own sheet.</li>
          <li>Two-up uses different rest rules than solo.</li>
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
              "Log live Work / Break on a past week",
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
            ["Current week", "Log Work / Break / End shift here"],
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
            It builds one PDF of your last 28 calendar days — for each week: compliance summary, a Weekly Trip Sheet
            frame (week ending, driver, truck reg, fitness/load/vehicle ticks from your day cards, seven WorkSafe day
            sheets, week work-hours total, office-use box, and your week signature when signed), then the shift log
            appendix with event detail.
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
            <strong className="text-slate-700 dark:text-slate-200">Compliance</strong> — shows if your week meets the
            rest / hours rules, with plain-language notes.
          </li>
          <li>
            <strong className="text-slate-700 dark:text-slate-200">Shift log</strong> — a list of every event on your
            record.
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>14. Voice &amp; display</h2>
        <p>Tap Voice &amp; display on the log bar for:</p>
        <ul className={`${ulClass} mt-1`}>
          <li>Voice commands — log by speaking (where supported).</li>
          <li>Voice alerts — spoken reminders while logging.</li>
          <li>Dark mode — easier on the eyes at night.</li>
        </ul>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          You can also set Dark mode and Voice alerts in Settings → Options.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>15. Settings</h2>
        <TwoColTable
          rows={[
            ["Options", "Dark mode, Voice alerts"],
            ["Device", "Install the app, back up / restore on this device"],
            ["Records", "Past weeks that need your signature"],
            ["Drive", "This week, Your weeks, Driver guide, How your record works, Route catalogue"],
            ["Connect", "Messages, Manager sign-in"],
            ["Account", "Change password, Sign out"],
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
          <li>Check rego, from, and to on today&apos;s card</li>
          <li>Tick Daily checks when done (fitness, load, vehicle)</li>
          <li>Type start km</li>
          <li>Tap Start shift when you begin</li>
          <li>Tap Break for short rest</li>
          <li>Tap End shift when finished — enter finish time and end km</li>
          <li>When the week has ended — Sign</li>
        </ol>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>19. Glossary</h2>
        <TwoColTable
          rows={[
            ["Work", "Solo means driving or working. Two-up means driving."],
            ["Break", "Short rest (\u226430 min) during work"],
            ["Non-work", "Off duty / long rest / sleep / in sleeper cab for two-up"],
            [
              "WorkSafe day sheet",
              `Truck reg / odometer / locations + ${WORKSAFE_TRACK_LABELS.work} / ${WORKSAFE_TRACK_LABELS.break} / ${WORKSAFE_TRACK_LABELS.non_work} as a 15-minute tick grid (day card + PDF)`,
            ],
            [
              "Weekly Trip Sheet (PDF)",
              "Week ending, driver, truck regs, daily checklist ticks from day cards, seven day sheets, week work-hours total, office use, week signature",
            ],
            ["Start shift / End shift", "Begin / finish work for a shift"],
            ["Resume shift", "Continue the same shift — not the same as start / finish break"],
            ["Week", "Sunday–Saturday slice of your record"],
            ["Sign", "You attest the week is correct"],
            ["Rego", "Number plate"],
            ["Start km / End km", "Odometer readings you type"],
            ["Set up day", "Change route, truck, pattern, or crew"],
            ["Run plan", "Optional saved route (name, hours, km)"],
            ["Roadside PDF", "28-day record for a regulator"],
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
