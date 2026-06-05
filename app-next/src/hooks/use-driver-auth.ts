"use client";

import { useSession } from "next-auth/react";
import {
  getOfflineAuth,
  isDriverOfflineSnapshot,
  isOfflineSessionActive,
  type OfflineAuthSnapshot,
} from "@/lib/offline-auth";

export type DriverAuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
};

export function useDriverAuth(): {
  user: DriverAuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  isOfflineSession: boolean;
  offlineSnapshot: OfflineAuthSnapshot | null;
} {
  const { data: session, status } = useSession();
  const offlineSnapshot = getOfflineAuth();
  const offlineActive = isOfflineSessionActive();

  const su = session?.user as
    | { id?: string; email?: string | null; name?: string | null; role?: string | null }
    | undefined;
  if (su?.id && su.email) {
    return {
      user: {
        id: su.id,
        email: su.email,
        name: su.name ?? null,
        role: su.role ?? null,
      },
      status: status === "loading" ? "loading" : "authenticated",
      isOfflineSession: false,
      offlineSnapshot,
    };
  }

  if (offlineActive && isDriverOfflineSnapshot(offlineSnapshot)) {
    return {
      user: {
        id: offlineSnapshot!.userId,
        email: offlineSnapshot!.email,
        name: offlineSnapshot!.name,
        role: offlineSnapshot!.role,
      },
      status: "authenticated",
      isOfflineSession: true,
      offlineSnapshot,
    };
  }

  return {
    user: null,
    status: status === "loading" ? "loading" : "unauthenticated",
    isOfflineSession: false,
    offlineSnapshot,
  };
}
