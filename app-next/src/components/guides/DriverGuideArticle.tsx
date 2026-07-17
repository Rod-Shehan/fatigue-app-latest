import Link from "next/link";
import { GuideDiagram } from "@/components/guides/GuideDiagram";
import { Button } from "@/components/ui/button";
import { PRODUCT_RECORD_PROMISE } from "@/lib/product-copy";
import { ROADSIDE_PRODUCE_BUTTON_LABEL } from "@/lib/roadside-pdf";

const sectionClass =
  "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-5";
const h2Class = "text-base font-bold text-slate-800 dark:text-slate-100 mb-2";
const ulClass = "list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300";
const tableClass = "w-full text-sm border-collapse mt-2";
const thClass = "text-left font-semibold text-slate-700 dark:text-slate-200 pb-1 pr-3";
const tdClass = "text-slate-600 dark:text-slate-300 pb-1 align-top";

export function DriverGuideArticle() {
  return (
    <article className="space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
      <p className="text-slate-500 dark:text-slate-400">
        Simple English guide with pictures. Not legal advice.
      </p>

      <section className={sectionClass}>
        <h2 className={h2Class}>What this app does</h2>
        <p>{PRODUCT_RECORD_PROMISE}</p>
        <p className="mt-3">
          Same route every day? The app fills <strong className="text-slate-700 dark:text-slate-200">rego, from, to,</strong>{" "}
          and run plan from your last trip. You always enter <strong className="text-slate-700 dark:text-slate-200">start km</strong>{" "}
          and <strong className="text-slate-700 dark:text-slate-200">end km</strong> yourself.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>1. Sign in</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Open the app.</li>
          <li>Type your email (from your manager).</li>
          <li>Type your password (from your manager).</li>
          <li>Tap Sign in.</li>
        </ol>
        <GuideDiagram title="Sign in screen">
          {`┌─────────────────────────────┐
│  Email:  you@company.com    │
│  Password: ••••••            │
│         [ Sign in ]         │
└─────────────────────────────┘`}
        </GuideDiagram>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>2. Drive home</h2>
        <p>After sign in, tap the green button:</p>
        <GuideDiagram title="Drive home">
          {`┌─────────────────────────────┐
│  ◀  Circadia 24      ⚙      │
│  Hello, [Your name]         │
│  Today: Wednesday           │
│                             │
│  ┌─────────────────────┐    │
│  │ Log more work  ▶ │    │
│  └─────────────────────┘    │
│  [ ${ROADSIDE_PRODUCE_BUTTON_LABEL} ]   │
│  Your weeks              ▶  │
└─────────────────────────────┘`}
        </GuideDiagram>
        <table className={tableClass}>
          <tbody>
            <tr>
              <th className={thClass}>Log more work</th>
              <td className={tdClass}>Open this week and log work</td>
            </tr>
            <tr>
              <th className={thClass}>Your weeks</th>
              <td className={tdClass}>Past weeks and signed records</td>
            </tr>
            <tr>
              <th className={thClass}>{ROADSIDE_PRODUCE_BUTTON_LABEL}</th>
              <td className={tdClass}>One PDF for regulator inspection</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>{ROADSIDE_PRODUCE_BUTTON_LABEL}</h2>
        <p>
          Tap the amber{" "}
          <strong className="text-slate-700 dark:text-slate-200">{ROADSIDE_PRODUCE_BUTTON_LABEL}</strong> button on
          Drive home, on your week sheet, or in Settings (gear). It downloads a PDF of your last 28 calendar days.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>3. Three buttons (log bar)</h2>
        <GuideDiagram title="Log bar">
          {`┌─────────────────────────────┐
│  [ Work ] [ Break ] [ End ] │
│         shift               │
└─────────────────────────────┘`}
        </GuideDiagram>
        <table className={tableClass}>
          <tbody>
            <tr>
              <th className={thClass}>Work / Start shift</th>
              <td className={tdClass}>You start driving or working (needs start km first)</td>
            </tr>
            <tr>
              <th className={thClass}>Break</th>
              <td className={tdClass}>Short rest during work (30 minutes or less)</td>
            </tr>
            <tr>
              <th className={thClass}>End shift</th>
              <td className={tdClass}>You finish work — enter end km when asked</td>
            </tr>
          </tbody>
        </table>
        <GuideDiagram title="Activity flow (read left to right)">
          {`  OFF / Non-work
       │
       ▼ Tap Work (after start km)
     WORK ──────► Tap Break ──► BREAK
       │                           │
       │◄──── Tap Work again ──────┘
       │
       ▼ Tap End shift (+ end km)
  OFF / Non-work`}
        </GuideDiagram>
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">Simple rule:</p>
        <p>Tap the button that matches what you are doing now.</p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>4. Non-work and End shift</h2>
        <ul className={ulClass}>
          <li>If you do not tap Work or Break, time is non-work (off duty).</li>
          <li>Rest longer than 30 minutes is non-work, not Break.</li>
          <li>When you stop working for the day, tap End shift and enter end km if asked.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>5. Today&apos;s card — repeat routes</h2>
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
└─────────────────────────────┘`}
        </GuideDiagram>
        <table className={tableClass}>
          <tbody>
            {[
              ["Rego, From, To, run plan", "Filled from your last trip"],
              ["Start km", "You enter every day — never auto-filled"],
              ["End km", "You enter when you End shift"],
            ].map(([field, note]) => (
              <tr key={field}>
                <th className={thClass}>{field}</th>
                <td className={tdClass}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-slate-500 dark:text-slate-400 leading-snug">
          New route or new truck? Tap <strong className="text-slate-700 dark:text-slate-200">Set up day</strong> once.
          Next days are faster.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>6. Sign your week</h2>
        <GuideDiagram title="Sign">
          {`┌─────────────────────────────┐
│  Sign this week's record    │
│  Review days, then sign.    │
│         [ Sign ]            │
└─────────────────────────────┘`}
        </GuideDiagram>
        <ul className={ulClass}>
          <li>Your signature means the week is true.</li>
          <li>After sign, the week is locked for you.</li>
          <li>If wrong, talk to your manager — you may sign again after a fix.</li>
          <li>Old unsigned weeks do not block logging today.</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>7. Each day checklist</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Sign in (or stay signed in)</li>
          <li>Log more work</li>
          <li>Check rego, from, and to on today&apos;s card</li>
          <li>Enter start km on the card</li>
          <li>Tap Work when you start</li>
          <li>Tap Break for short rest</li>
          <li>Tap End shift when finished — enter end km</li>
          <li>At end of week — Sign</li>
        </ol>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>Words (glossary)</h2>
        <table className={tableClass}>
          <tbody>
            {[
              ["Work", "Driving or on-duty work"],
              ["Break", "Short rest during work"],
              ["Non-work", "Off duty / long rest"],
              ["End shift", "Finished work for this shift"],
              ["From / To", "Start place and destination"],
              ["Start km", "Odometer at start — you type this"],
              ["End km", "Odometer at end shift — you type this"],
              ["Set up day", "Change route or truck details"],
              ["Sign", "You agree the week is correct"],
            ].map(([word, meaning]) => (
              <tr key={word}>
                <th className={thClass}>{word}</th>
                <td className={tdClass}>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
