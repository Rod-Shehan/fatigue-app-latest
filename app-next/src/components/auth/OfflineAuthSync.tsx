"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { saveOfflineAuth } from "@/lib/offline-auth";

/** Persist driver identity on device after each successful online session. */
export function OfflineAuthSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    const u = session.user as { id?: string; email?: string | null; name?: string | null; role?: string | null };
    if (!u.id || !u.email) return;
    if (u.role === "manager") return;
    saveOfflineAuth({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    });
  }, [session, status]);

  return null;
}
