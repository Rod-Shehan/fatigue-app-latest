"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandHeaderActions } from "@/components/command/CommandHeaderActions";
import { CommandPageHeader } from "@/components/command/CommandPageHeader";
import { CommandShell } from "@/components/command/CommandShell";
import { ActionRecordsPublishPanel } from "@/components/records/ActionRecordsPublishPanel";
import { ACTION_RECORD_PAGE_TITLE } from "@/lib/action-records-publish";

export default function ActionRecordsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const body = (await res.json()) as { role?: string };
      if (!cancelled) {
        setIsOwner(body.role === "command_owner");
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
  };

  if (!ready) {
    return (
      <CommandShell>
        <p className="animate-pulse text-center text-slate-400">Loading action records…</p>
      </CommandShell>
    );
  }

  return (
    <CommandShell>
      <CommandPageHeader
        title={ACTION_RECORD_PAGE_TITLE}
        subtitle="Publish actioned events for the last 24 hours, week, or month"
        backHref="/triage"
        backText="Triage"
        actions={
          <CommandHeaderActions
            onSignOut={() => void signOut()}
            showUsersLink={isOwner}
            showTestDeskLink={isOwner}
          />
        }
      />
      <ActionRecordsPublishPanel />
    </CommandShell>
  );
}
