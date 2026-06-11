"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useDriverAuth } from "@/hooks/use-driver-auth";
import { isDriverFieldRole } from "@/lib/roles";

type Props = {
  children: React.ReactNode;
  callbackUrl: string;
  /**
   * When true (driver home, messages, etc.), managers/owners are turned away at the lobby.
   * Sheet routes leave this false so fleet managers can still open a driver's record.
   */
  fieldDriverOnly?: boolean;
};

/**
 * Client auth gate for driver-facing routes.
 * Sheet pages allow managers; /driver/* requires a field-driver account.
 */
export function DriverAccessGate({ children, callbackUrl, fieldDriverOnly = false }: Props) {
  const router = useRouter();
  const { user, status } = useDriverAuth();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      const q = encodeURIComponent(callbackUrl);
      router.replace(`/?branch=driver&callbackUrl=${q}`);
      return;
    }
    if (fieldDriverOnly && user && !isDriverFieldRole(user.role)) {
      const q = encodeURIComponent(callbackUrl);
      router.replace(`/?branch=driver&callbackUrl=${q}&error=driver_role_required`);
    }
  }, [status, user, callbackUrl, router, fieldDriverOnly]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  }

  if (status !== "authenticated" || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  }

  if (fieldDriverOnly && !isDriverFieldRole(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  }

  return <>{children}</>;
}
