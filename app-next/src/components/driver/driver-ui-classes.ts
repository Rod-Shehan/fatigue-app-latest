/**
 * Driver design tokens — mobile-first touch targets, shared radii, cards, chips, CTAs.
 *
 * Radius scale: xl = cards / drawers / primary actions; lg = rows / inner panels / chips.
 */

import { cn } from "@/lib/utils";

export const driverSectionLabel =
  "text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-0.5";

export const driverRadiusCard = "rounded-xl";
export const driverRadiusRow = "rounded-lg";

/** Full-width tappable row (gear drawer, standalone links). */
export const driverDrawerRow =
  "flex w-full min-h-[56px] items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3 text-base font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:bg-slate-200/80 dark:active:bg-slate-800 transition-colors";

/** Row inside a grouped settings card (parent supplies outer border). */
export const driverListRow =
  "flex w-full min-h-[56px] items-center gap-3 px-4 py-3 text-left text-base font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60 dark:active:bg-slate-800 transition-colors";

/** Thin status strip (compliance, records). */
export const driverStatusStrip =
  "mb-2 flex w-full items-center gap-2 rounded-xl border px-4 py-3 min-h-[56px] text-left transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-950";

export const driverStatusStripLabel =
  "text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0";

export const driverStatusStripDetail =
  "flex-1 text-sm text-slate-600 dark:text-slate-400 truncate";

/** Section card (sheet header block, signature, help pages). */
export const driverSectionCard =
  "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-3 md:p-4";

/** Expanded day / section card base (add today/default tone separately). */
export const driverCard =
  "rounded-xl border-2 shadow-sm p-3 md:p-4 transition-colors";

export const driverCardToday =
  "bg-amber-50 dark:bg-slate-800/95 border-amber-400 dark:border-amber-500 ring-2 ring-amber-200/80 dark:ring-amber-500/40";

export const driverCardDefault =
  "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700";

/** Collapsed day / week summary row. */
export const driverCollapsedRow =
  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 min-h-[44px] text-left";

/** Inner panel on a day card (route block, warnings). */
export const driverPanel =
  "mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-950/50 px-3 py-3";

/** Compliance chip / status pill (LogBar, upcoming issues). */
export const driverChipShell =
  "w-full max-w-md rounded-xl border px-3 py-2.5 shadow-sm transition-colors";

/** Full-width compliance / info banner. */
export const driverAlertBar =
  "mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-950";

/** Header date / regulatory chip. */
export const driverDateChip =
  "inline-flex items-center gap-1.5 h-10 min-h-10 px-2.5 rounded-lg border text-sm font-medium shrink min-w-0 max-w-[11rem] sm:max-w-none";

/** Primary stacked action button in drawer / forms. */
export const driverActionBtn =
  "w-full h-14 min-h-[56px] gap-3 justify-start px-4 text-base font-semibold rounded-xl";

/** Segmented control segment (Solo/Two-Up, driver toggle). */
export const driverSegmentBtn =
  "min-h-[44px] sm:min-h-[48px] px-4 py-2.5 text-sm sm:text-base font-semibold transition-colors";

/** Solo / two-up toggle track. */
export const driverToggleTrack =
  "flex rounded-xl border border-slate-200 overflow-hidden shrink-0 dark:border-slate-500 dark:bg-slate-950 dark:p-0.5 dark:gap-0.5";

export function driverToggleSegment(active: boolean, readOnly = false): string {
  return cn(
    "px-3 py-1.5 text-sm font-semibold min-h-[44px] min-w-[4.25rem] transition-colors",
    readOnly
      ? active
        ? "bg-slate-200 text-slate-800 dark:bg-slate-800/80 dark:text-slate-100 cursor-not-allowed"
        : "bg-slate-100 text-slate-400 dark:bg-slate-900/40 dark:text-slate-500 cursor-not-allowed"
      : active
        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:shadow-md dark:ring-1 dark:ring-white/30"
        : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
  );
}

/** Standard card / day action button. */
export const driverCardBtn =
  "min-h-[48px] sm:min-h-[44px] gap-2 text-sm sm:text-base font-semibold rounded-xl";

/** Minimum touch target for icon-only controls. */
export const driverIconBtn = "h-11 w-11 min-h-[44px] min-w-[44px] shrink-0";

/** Icon-only control with border (gear, day tools, settings). */
export const driverIconBtnBordered = cn(
  driverIconBtn,
  "flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-colors"
);

/** LogBar / header icon control — xl radius at all breakpoints. */
export const driverTouchIconBtn =
  "flex shrink-0 items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl";

/** Inline toolbar button (manager sheet actions, compliance link). */
export const driverToolbarBtn =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] h-11 px-3 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1";

/** Raised cab confirm — add a colour class (`driver-puck-amber` / `driver-puck-emerald`). */
export const driverPuckBtn =
  "driver-puck inline-flex items-center justify-center gap-2 min-h-[44px] h-11 w-full rounded-xl text-white font-semibold disabled:opacity-60 disabled:pointer-events-none";

/** Primary warning / confirm CTA (amber machined puck). */
export const driverAmberBtn = `${driverPuckBtn} driver-puck-amber`;

/** Dialog / modal action buttons (full width on mobile). */
export const driverDialogBtn =
  "min-h-[48px] h-12 text-base font-semibold w-full sm:w-auto rounded-xl";

/** Secondary modal / dismiss button. */
export const driverMutedBtn =
  "min-h-[48px] px-4 py-3 rounded-xl text-base font-semibold bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500";

/** Floating sheet utility control (voice, theme in LogBar). */
export const driverSheetUtilityBtn =
  "flex items-center justify-center h-14 w-14 min-h-[56px] min-w-[56px] rounded-2xl";
