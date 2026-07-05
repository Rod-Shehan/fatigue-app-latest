"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandHeaderActions } from "@/components/command/CommandHeaderActions";
import { CommandPageHeader } from "@/components/command/CommandPageHeader";
import { CommandShell } from "@/components/command/CommandShell";
import { CommandTestDeskPanel } from "@/components/admin/CommandTestDeskPanel";

export default function AdminTestDeskPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const body = await res.json();
      if (!cancelled) {
        if (body.role !== "command_owner") {
          router.replace("/triage");
          return;
        }
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
        <p className="animate-pulse text-center text-slate-400">Loading test desk…</p>
      </CommandShell>
    );
  }

  return (
    <CommandShell wide>
      <CommandPageHeader
        title="Test desk"
        subtitle="Live drill — Manager + Command"
        actions={
          <CommandHeaderActions
            onSignOut={() => void signOut()}
            showUsersLink
            showTestDeskLink
            testDeskActive
          />
        }
      />
      <CommandTestDeskPanel />
    </CommandShell>
  );
}
