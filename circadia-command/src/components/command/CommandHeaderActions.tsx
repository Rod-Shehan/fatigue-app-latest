"use client";

import Link from "next/link";
import { LogOut, Radio, Users } from "lucide-react";
import {
  commandNavLinkActive,
  commandNavLinkGhost,
  commandOutlineButton,
} from "@/components/command/command-styles";

type Props = {
  onSignOut: () => void;
  showUsersLink?: boolean;
  triageHref?: string;
  triageActive?: boolean;
};

export function CommandHeaderActions({
  onSignOut,
  showUsersLink = false,
  triageHref = "/triage",
  triageActive = false,
}: Props) {
  return (
    <>
      {triageActive ? (
        <span className={commandNavLinkActive} aria-current="page">
          <Radio className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Triage
        </span>
      ) : (
        <Link href={triageHref} className={commandNavLinkActive}>
          <Radio className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Triage
        </Link>
      )}
      {showUsersLink && (
        <Link href="/admin/users" className={commandNavLinkGhost}>
          <Users className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Users
        </Link>
      )}
      <button type="button" onClick={onSignOut} className={commandOutlineButton}>
        <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Sign out
      </button>
    </>
  );
}
