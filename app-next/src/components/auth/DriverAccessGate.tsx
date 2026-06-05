"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useDriverAuth } from "@/hooks/use-driver-auth";

type Props = {
  children: React.ReactNode;
  callbackUrl: string;
};

/**
 * Client auth gate for driver routes — allows any signed-in account (managers often drive too).
 * Device offline session works without server redirect.
 */
export function DriverAccessGate({ children, callbackUrl }: Props) {
  const router = useRouter();
  const { user, status } = useDriverAuth();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const q = encodeURIComponent(callbackUrl);
    router.replace(`/?branch=driver&callbackUrl=${q}`);
  }, [status, callbackUrl, router]);

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

  return <>{children}</>;
}
