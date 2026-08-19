# Activity glossary (locked)

**Status:** Locked 19 Aug 2026. Use these words only. Do not add synonyms in driver or office copy.

WorkSafe interchanges **break** and **rest**. We do not. **Rest** is used for one case only: not driving and not doing a job task.

## Driver words (states)

| What the driver is doing | Driver word | How they get there |
|--------------------------|-------------|--------------------|
| Driving | **Work** | Start shift → Start driving, Start work → Start driving, or Continue shift |
| Not driving, and not doing a job task — eat, drink, nap, sit still | **Rest** | Stop Driving → Start Rest |
| Not driving, but still doing a job task — load, unload, forklift, tyre, paperwork, fuel | **Other work** | Start shift → Start Other Work, Stop Driving → Start Other Work, or Start work → Start Other Work |
| Off the job / sleep away from work | **Non-work** | End shift |

## WorkSafe sheet row (parent name)

**BREAKS FROM DRIVING** is the WorkSafe row name. It is not a driver button.

**Rest** and **Other work** both sit on **BREAKS FROM DRIVING**. Both are still **work time** for 168h (WorkSafe: a break from driving under 30 minutes is still work; other work is work associated with driving).

| Kind | On BREAKS FROM DRIVING | Still work time (168h) | If it runs 30 minutes or more |
|------|------------------------|------------------------|-------------------------------|
| **Rest** | Yes, while under 30 min | Yes, while under 30 min | Becomes **non-work** |
| **Other work** | Yes, always | Yes | Stays on BREAKS FROM DRIVING — never **non-work** |

## Button phrases (chooser only)

These are taps, not extra states. **Stop Driving**, **Start shift**, and **Start work** are not stored as those names. The record changes only when they pick a kind.

| Phrase | Role |
|--------|------|
| **Start shift** | Idle: one hero tap. Opens Set up day if needed, else the Driving / Other work chooser. Does not log by itself. |
| **Start work** | On Rest: one hero tap. Opens the Driving / Other work chooser. Does not log by itself. |
| **Start driving** | Top half of the Start shift / Start work split. Logs Work (driving). |
| **Stop Driving** | On Work: one hero tap. Opens the Rest / Other work chooser. Not End shift. |
| **Start Rest** | Top half of the Stop Driving split. Logs Rest. |
| **Start Other Work** | Bottom half of either kind of split. Logs Other work (break from driving — load, unload). |
| **Cancel** | Closes the chooser. Idle stays idle; Rest stays Rest; Work stays on Work. |

**End shift** stays in the dock, never inside the split. Stop Driving = still on the job, not driving. End shift = off the job.

## Taps (locked)

Idle Start shift and Rest Start work both open the same Driving / Other work split. Confirm in Set up day does **not** auto-log driving. The two kinds after Stop Driving are unchanged.

| Driver is on | Hero | Dock |
|--------------|------|------|
| Idle / after End shift | **Start shift** | — |
| Idle, Start shift chooser open | Split: **Start driving** / **Start Other Work** | — |
| **Work** | **Stop Driving** | **End shift** |
| **Work**, chooser open | Split: **Start Rest** / **Start Other Work** | **End shift** |
| **Rest** | **Start work** | **End shift** |
| **Rest**, chooser open | Split: **Start driving** / **Start Other Work** | **End shift** |
| **Other work** | **Continue shift** | **End shift** |

The split is a chooser, not a log. First tap of Start shift, Start work, or Stop Driving opens it (no extra tap-again before the split). Start driving, Start Rest, and Start Other Work keep the usual tap-again confirm.

Do not show Rest and Other work as two always-visible taps on Work. Do not add a button named Break.

### What each tap logs

| Tap | Stored type | Notes |
|-----|-------------|-------|
| Start shift | *(nothing)* | Chooser only (or Set up day first) |
| Start work | *(nothing)* | Chooser only — from Rest, including when Rest has painted as non-work after 31 min |
| Start driving | `work` | Driving. Same 7h rest gate as Start shift when idle. |
| Continue shift | `work` | Back to driving after Other work |
| Start Rest | `break` | Existing 30 min floor: 30 min stays Rest; 31+ becomes **non-work** |
| Start Other Work | `other_work` | Break from driving on the sheet. Never convert to non-work. Counts toward 20 min / 5h. Still work time for 168h. From Start shift, Start work, or Stop Driving. |
| End shift | `stop` | Unchanged — starts **non-work** |
| Stop Driving | *(nothing)* | Chooser only |

### Reminders and voice

The 5h reminder opens the same Stop Driving split. Voice: start shift (opens Driving / Other work chooser), start work (from Rest, same split), start driving, stop driving, start rest, start other work.

## Do not say

| Do not write | Use instead |
|--------------|-------------|
| Rest for End shift, 7h, 24h, or 72h | **Non-work** |
| Break on a driver button | **Stop Driving** then **Start Rest** or **Start Other Work** (or **Start shift** / **Start work** then **Start Other Work**) |
| Break as a third split option | WorkSafe row **BREAKS FROM DRIVING** only |
| Keep driving (chooser back) | **Cancel** |
| Work (not driving) | **Other work** |

## Constants

Exact strings live in `src/lib/product-copy.ts`. WorkSafe row labels stay in `WORKSAFE_TRACK_LABELS`.
