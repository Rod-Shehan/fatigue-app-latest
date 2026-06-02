/** Shared mobile-first sizing for driver UI (56px rows, readable text-base actions). */

export const driverSectionLabel =
  "text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-0.5";

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

/** Primary stacked action button in drawer / forms. */
export const driverActionBtn =
  "w-full h-14 min-h-[56px] gap-3 justify-start px-4 text-base font-semibold rounded-xl";

/** Segmented control segment (Solo/Two-Up, driver toggle). */
export const driverSegmentBtn =
  "min-h-[44px] sm:min-h-[48px] px-4 py-2.5 text-sm sm:text-base font-semibold transition-colors";

/** Standard card / day action button. */
export const driverCardBtn =
  "min-h-[48px] sm:min-h-[44px] gap-2 text-sm sm:text-base font-semibold";

/** Minimum touch target for icon-only controls. */
export const driverIconBtn = "h-11 w-11 min-h-[44px] min-w-[44px] shrink-0";

/** Dialog / modal action buttons (full width on mobile). */
export const driverDialogBtn =
  "min-h-[48px] h-12 text-base font-semibold w-full sm:w-auto";
