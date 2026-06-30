type Props = {
  activePending: number;
  visibleCount: number;
};

export function TriageQueueBanner({ activePending, visibleCount }: Props) {
  return (
    <div className="border-b border-teal-800/40 bg-teal-950/20 px-4 py-2 text-xs text-slate-400">
      <p>
        <span className="font-medium text-teal-200">{activePending} active on triage desk</span>
        <span className="text-slate-500"> · shared with manager Live alerts</span>
        {visibleCount < activePending ? (
          <span className="text-slate-500"> · showing {visibleCount} in this view</span>
        ) : null}
      </p>
    </div>
  );
}
