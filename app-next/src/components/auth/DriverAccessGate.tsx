"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useDriverAuth } from "@/hooks/use-driver-auth";

type Props = {
  children: React.ReactNode;
  callbackUrl: string;
  /** When true, managers with a live session may access (e.g. sheet detail). */
  allowManager?: boolean;
};

/**
 * Client auth gate for driver routes — allows device offline session without server redirect.
 */
export function DriverAccessGate({ children, callbackUrl, allowManager = false }: Props) {
  const router = useRouter();
  const { user, status, isOfflineSession } = useDriverAuth();
  const [managerBlocked, setManagerBlocked] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !user || isOfflineSession) {
      setManagerBlocked(false);
      return;
    }
    if (allowManager) return;
    if (user.role === "manager") {
      setManagerBlocked(true);
      router.replace("/manager");
    }
  }, [status, user, isOfflineSession, allowManager, router]);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const q = encodeURIComponent(callbackUrl);
    router.replace(`/login?callbackUrl=${q}`);
  }, [status, callbackUrl, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  }

  if (status !== "authenticated" || !user || managerBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  }

  return <>{children}</>;
}
