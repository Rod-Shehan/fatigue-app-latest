# Activity glossary (locked)

**Status:** Locked 19 Aug 2026. Use these words only. Do not add synonyms in driver or office copy.

WorkSafe interchanges **break** and **rest**. We do not. **Rest** is used for one case only: not driving and not doing a job task.

## Driver words (states)

| What the driver is doing | Driver word | How they get there |
|--------------------------|-------------|--------------------|
| Driving | **Work** | Start shift → Start driving, Start work → Start driving, or Continue shift → Start driving |
| Not driving, and not doing a job task — eat, drink, nap, sit still | **Rest** | Stop Driving → Start Rest, or Continue shift → Start Rest |
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

These are taps, not extra states. **Stop Driving**, **Start shift**, **Start work**, and **Continue shift** are not stored as those names. The record changes only when they pick a kind.

| Phrase | Role |
|--------|------|
| **Start shift** | Idle: one hero tap. Opens Set up day if needed, else the Driving / Other work chooser. Does not log by itself. |
| **Start work** | On Rest: one hero tap. Opens the Driving / Other work chooser. Does not log by itself. |
| **Continue shift** | On Other work: one hero tap. Opens the Driving / Rest chooser. Does not log by itself. |
| **Start driving** | Top half of the Start shift / Start work / Continue shift split. Logs Work (driving). |
| **Stop Driving** | On Work: one hero tap. Opens the Rest / Other work chooser. Not End shift. |
| **Start Rest** | Top half of the Stop Driving split, or bottom of the Continue shift split. Logs Rest. |
| **Start Other Work** | Bottom half of the Start shift / Start work / Stop Driving split. Logs Other work (break from driving — load, unload). After tap-again: **Load check** or **Not a load**. |
| **Load check** | After Other work is logged. Opens Dimension & Load. Timeline stays Other work. Not a new activity. |
| **Not a load** | After Other work is logged. Skips the form (tyre, fuel, paperwork). Timeline stays Other work. |
| **Add load check** | Under the ring while still on Other work. Another Dimension & Load record for this day. |
| **Cancel** | Closes the chooser. Idle stays idle; Rest stays Rest; Work stays on Work; Other work stays Other work. |

**End shift** stays in the dock, never inside the split. Stop Driving = still on the job, not driving. End shift = off the job.

## Taps (locked)

Idle Start shift and Rest Start work both open the same Driving / Other work split. Other work Continue shift opens Driving / Rest. Confirm in Set up day does **not** auto-log driving.

| Driver is on | Hero | Dock |
|--------------|------|------|
| Idle / after End shift | **Start shift** | — |
| Idle, Start shift chooser open | Split: **Start driving** / **Start Other Work** | — |
| **Work** | **Stop Driving** | **End shift** |
| **Work**, chooser open | Split: **Start Rest** / **Start Other Work** | **End shift** |
| **Rest** | **Start work** | **End shift** + **Taking a nap?** (bottom-left; not a fifth activity) |
| **Rest**, chooser open | Split: **Start driving** / **Start Other Work** | **End shift** + **Taking a nap?** |
| **Other work** | **Continue shift** | **End shift** |
| **Other work**, just logged | Split: **Load check** / **Not a load** | **End shift** |
| **Other work**, chooser open | Split: **Start driving** / **Start Rest** | **End shift** |

The timer under the ring shows how long this stretch has been open, with a small **(Work)** / **(Rest)** / **(Other work)** note so the split is not mistaken for the current state.

The split is a chooser, not a log. First tap of Start shift, Start work, Continue shift, or Stop Driving only opens it — that tap does not log. Start driving, Start Rest, and Start Other Work keep the usual tap-again confirm. The chosen half is what is recorded, never the opener.

Do not show Rest and Other work as two always-visible taps on Work. Do not add a button named Break.

### What each tap logs

| Tap | Stored type | Notes |
|-----|-------------|-------|
| Start shift | *(nothing)* | Chooser only (or Set up day first) |
| Start work | *(nothing)* | Chooser only — from Rest, including when Rest has painted as non-work after 31 min |
| Start driving | `work` | Driving. Same 7h rest gate as Start shift when idle. From Start shift, Start work, or Continue shift. |
| Continue shift | *(nothing)* | Chooser only — from Other work |
| Start Rest | `break` | Existing 30 min floor: 30 min stays Rest; 31+ becomes **non-work**. From Stop Driving or Continue shift. |
| Taking a nap? | *(qualifier on Rest)* | Rest-only corner. Sets `napFrom` on the open Rest for FRMS. Diary stays Rest. Compact **Nap?**. Active **On nap**. |
| Start Other Work | `other_work` | Break from driving on the sheet. Never convert to non-work. Counts toward 20 min / 5h. Still work time for 168h. From Start shift, Start work, or Stop Driving. After confirm: Load check / Not a load (not stored). |
| Load check | *(nothing)* | Opens Dimension & Load. Timeline stays Other work. |
| Not a load | *(nothing)* | Skips the form. Timeline stays Other work. |
| Add load check | *(nothing)* | Another Dimension & Load while still on Other work. |
| End shift | `stop` | Unchanged — starts **non-work** |
| Stop Driving | *(nothing)* | Chooser only |

### Reminders and voice

The 5h reminder opens the same Stop Driving split. Voice: start shift (opens Driving / Other work chooser), start work (from Rest, same split), continue shift (from Other work, Driving / Rest split), start driving, stop driving, start rest, start other work.

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
