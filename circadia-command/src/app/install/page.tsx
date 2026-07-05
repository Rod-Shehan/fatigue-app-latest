import Link from "next/link";
import { Shield } from "lucide-react";
import { CommandPageHeader } from "@/components/command/CommandPageHeader";
import { CommandShell } from "@/components/command/CommandShell";
import { InstallCommandApp } from "@/components/pwa/InstallCommandApp";
import { commandCard, commandPrimaryButton } from "@/components/command/command-styles";

export default function InstallPage() {
  return (
    <CommandShell>
      <CommandPageHeader
        title="Install Circadia Command"
        subtitle="Add the operator triage app to your phone, tablet, or desktop"
        icon={<Shield className="h-5 w-5" strokeWidth={2} aria-hidden />}
      />

      <div className="mx-auto max-w-lg space-y-6">
        <InstallCommandApp />

        <section className={`${commandCard} space-y-3 p-6 text-sm text-slate-400`}>
          <h2 className="font-semibold text-slate-100">After installing</h2>
          <p>
            Open the app from your home screen or app launcher, sign in with your operator account,
            and open <strong className="text-slate-300">Triage</strong> for the live queue.
          </p>
          <p>
            Live updates require an internet connection. Triage uses server push (SSE) when
            connected.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/login" className={commandPrimaryButton}>
            Sign in on the web
          </Link>
        </div>
      </div>
    </CommandShell>
  );
}
