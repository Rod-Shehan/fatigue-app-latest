"use client";

import { usePathname } from "next/navigation";
import { FlaskConical, LogOut, Map, Radio, Users } from "lucide-react";
import { CommandNavLink } from "@/components/command/CommandNavLink";
import { commandOutlineButton } from "@/components/command/command-styles";
import { commandNavIdFromPath } from "@/lib/command-nav";

type Props = {
  onSignOut: () => void;
  showUsersLink?: boolean;
  showTestDeskLink?: boolean;
  triageHref?: string;
};

export function CommandHeaderActions({
  onSignOut,
  showUsersLink = false,
  showTestDeskLink = false,
  triageHref = "/triage",
}: Props) {
  const current = commandNavIdFromPath(usePathname());

  return (
    <>
      <CommandNavLink href={triageHref} active={current === "triage"}>
        <Radio className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Triage
      </CommandNavLink>
      <CommandNavLink href="/tracking" active={current === "tracking"}>
        <Map className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Event Tracker
      </CommandNavLink>
      {showUsersLink ? (
        <CommandNavLink href="/admin/users" active={current === "users"}>
          <Users className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Users
        </CommandNavLink>
      ) : null}
      {showTestDeskLink ? (
        <CommandNavLink href="/admin/test-desk" active={current === "test-desk"}>
          <FlaskConical className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Test desk
        </CommandNavLink>
      ) : null}
      <button type="button" onClick={onSignOut} className={commandOutlineButton}>
        <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Sign out
      </button>
    </>
  );
}
