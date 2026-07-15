"use client";

import { useOfflineSync } from "@/hooks/useOfflineSync";

export function OfflineBar() {
  const { pendingCount, syncError, runSync } = useOfflineSync();

  if (pendingCount === 0 && !syncError) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center justify-center gap-1 bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
      role="status"
      aria-live="polite"
    >
      {pendingCount > 0 ? (
        <span>
          Syncing {pendingCount} change{pendingCount !== 1 ? "s" : ""}…
        </span>
      ) : null}
      {syncError ? (
        <button
          type="button"
          className="text-xs font-normal underline underline-offset-2 opacity-95"
          onClick={() => {
            void runSync();
          }}
        >
          Sync blocked: {syncError}. Tap to retry.
        </button>
      ) : null}
    </div>
  );
}
