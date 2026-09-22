"use client";

import { Last24hBreakField } from "@/components/fatigue/Last24hBreakField";
import { TWO_UP_DECLARED_REST_COPY } from "@/lib/two-up-stationary";
import type { Last24hBreakRange } from "@/lib/last-24h-break-range";
import { cn } from "@/lib/utils";

export function TwoUpStationaryRestFields({
  last7h,
  last24h,
  on7hChange,
  on24hChange,
  readOnly = false,
  allowAmend = false,
}: {
  last7h?: Last24hBreakRange | null;
  last24h?: Last24hBreakRange | null;
  on7hChange: (range: Last24hBreakRange | null) => void;
  on24hChange: (range: Last24hBreakRange | null) => void;
  readOnly?: boolean;
  allowAmend?: boolean;
}) {
  const anySet = !!(last7h?.startIso && last7h?.endIso) || !!(last24h?.startIso && last24h?.endIso);
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 space-y-3",
        anySet
          ? "border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-2 border-amber-300 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-950/30"
      )}
    >
      <div>
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
          {TWO_UP_DECLARED_REST_COPY.TITLE}
        </p>
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-1 leading-snug">
          {TWO_UP_DECLARED_REST_COPY.WHY}
        </p>
      </div>
      <Last24hBreakField
        value={last7h}
        onChange={on7hChange}
        readOnly={readOnly}
        allowAmend={allowAmend}
        label={TWO_UP_DECLARED_REST_COPY.LABEL_7H}
        minHours={7}
        unsetHint={TWO_UP_DECLARED_REST_COPY.HINT_7H}
        setHint={TWO_UP_DECLARED_REST_COPY.HINT_7H}
        lockedHint={TWO_UP_DECLARED_REST_COPY.LOCKED_HINT}
        inputId="two-up-7h"
      />
      <Last24hBreakField
        value={last24h}
        onChange={on24hChange}
        readOnly={readOnly}
        allowAmend={allowAmend}
        label={TWO_UP_DECLARED_REST_COPY.LABEL_24H}
        minHours={24}
        unsetHint={TWO_UP_DECLARED_REST_COPY.HINT_24H}
        setHint={TWO_UP_DECLARED_REST_COPY.HINT_24H}
        lockedHint={TWO_UP_DECLARED_REST_COPY.LOCKED_HINT}
        inputId="two-up-24h"
      />
    </div>
  );
}
