type Props = {
  activePending: number;
  visibleCount: number;
  browseHours: number | null;
  triageFilter: "pending" | "all" | "decided";
};

export function TriageQueueBanner({
  activePending,
  visibleCount,
  browseHours,
  triageFilter,
}: Props) {
  const isActiveView = triageFilter === "pending";

  return (
    <div className="mb-4 rounded-lg border border-teal-600/30 bg-teal-950/10 px-3 py-2.5 text-sm text-slate-700 dark:border-teal-700/50 dark:bg-teal-950/25 dark:text-slate-300">
      <p className="font-medium text-slate-900 dark:text-teal-100">
        {activePending} active on triage desk
        <span className="font-normal text-slate-600 dark:text-slate-400">
          {" "}
          · shared with Command Live triage
        </span>
      </p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
        {isActiveView ? (
          <>
            Showing all {visibleCount} need-review event{visibleCount === 1 ? "" : "s"} (no time
            limit).
          </>
        ) : (
          <>
            Browsing last {browseHours ?? 168}h history — {visibleCount} shown
            {activePending > visibleCount
              ? ` · ${activePending} still active on triage desk`
              : ""}
            . Switch to <strong>Need review</strong> for the full active queue.
          </>
        )}
      </p>
    </div>
  );
}
