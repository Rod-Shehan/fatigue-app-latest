type Props = {
  activePending: number;
  visibleCount: number;
};

export function TriageQueueBanner({ activePending, visibleCount }: Props) {
  return (
    <div className="border-b border-teal-200 bg-teal-50 px-4 py-2 text-xs text-slate-600 dark:border-teal-800/40 dark:bg-teal-950/20 dark:text-slate-400">
      <p>
        <span className="font-medium text-teal-800 dark:text-teal-200">{activePending} active on triage desk</span>
        <span className="text-slate-500"> · shared with manager Live alerts</span>
        {visibleCount < activePending ? (
          <span className="text-slate-500"> · showing {visibleCount} in this view</span>
        ) : null}
      </p>
    </div>
  );
}
