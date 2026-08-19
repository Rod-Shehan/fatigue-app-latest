# Activity glossary (locked)

**Status:** Locked 19 Aug 2026. Use these words only. Do not add synonyms in driver or office copy.

WorkSafe interchanges **break** and **rest**. We do not. **Rest** is used for one case only: not driving and not doing a job task.

## Driver words (states)

| What the driver is doing | Driver word | How they get there |
|--------------------------|-------------|--------------------|
| Driving, or the main on-duty stretch | **Work** | Start shift / Continue shift |
| Not driving, and not doing a job task — eat, drink, nap, sit still | **Rest** | Stop Driving → Start Rest |
| Not driving, but still doing a job task — load, unload, forklift, tyre, paperwork, fuel | **Other work** | Stop Driving → Start Other Work |
| Off the job / sleep away from work | **Non-work** | End shift |

## WorkSafe sheet row (parent name)

**BREAKS FROM DRIVING** is the WorkSafe row name. It is not a driver button.

**Rest** and **Other work** both sit on **BREAKS FROM DRIVING**. Both are still **work time** for 168h (WorkSafe: a break from driving under 30 minutes is still work; other work is work associated with driving).

| Kind | On BREAKS FROM DRIVING | Still work time (168h) | If it runs 30 minutes or more |
|------|------------------------|------------------------|-------------------------------|
| **Rest** | Yes, while under 30 min | Yes, while under 30 min | Becomes **non-work** |
| **Other work** | Yes, always | Yes | Stays on BREAKS FROM DRIVING — never **non-work** |

## Button phrases (chooser only)

These are taps, not extra states. **Stop Driving** is not stored. The record changes only when they pick a kind.

| Phrase | Role |
|--------|------|
| **Stop Driving** | On Work: one hero tap. Opens the chooser. Not End shift. |
| **Start Rest** | Top half of the split hero. Logs Rest. |
| **Start Other Work** | Bottom half of the split hero. Logs Other work. |
| **Cancel** | Closes the chooser. Still on Work. |

**End shift** stays in the dock, never inside the split. Stop Driving = still on the job, not driving. End shift = off the job.

## Taps (locked)

One target while on Work. The two kinds appear only after Stop Driving.

| Driver is on | Hero | Dock |
|--------------|------|------|
| Idle / after End shift | **Start shift** | — |
| **Work** | **Stop Driving** | **End shift** |
| **Work**, chooser open | Split: **Start Rest** / **Start Other Work** | **End shift** |
| **Rest** | **Continue shift** | **End shift** |
| **Other work** | **Continue shift** | **End shift** |

The split is a chooser, not a log. First tap of Stop Driving opens it (no extra tap-again before the split). Start Rest and Start Other Work keep the usual tap-again confirm.

Do not show Rest and Other work as two always-visible taps on Work. Do not add a button named Break.

### What each tap logs

| Tap | Stored type | Notes |
|-----|-------------|-------|
| Start shift / Continue shift | `work` | Unchanged |
| Start Rest | `break` | Existing 30 min floor: 30 min stays Rest; 31+ becomes **non-work** |
| Start Other Work | `other_work` | Break from driving on the sheet. Never convert to non-work. Counts toward 20 min / 5h. Still work time for 168h. |
| End shift | `stop` | Unchanged — starts **non-work** |
| Stop Driving | *(nothing)* | Chooser only |

### Reminders and voice

The 5h reminder opens the same Stop Driving split. Voice: stop driving, start rest, start other work.

## Do not say

| Do not write | Use instead |
|--------------|-------------|
| Rest for End shift, 7h, 24h, or 72h | **Non-work** |
| Break on a driver button | **Stop Driving** then **Start Rest** or **Start Other Work** |
| Break as a third split option | WorkSafe row **BREAKS FROM DRIVING** only |
| Keep driving (chooser back) | **Cancel** |
| Work (not driving) | **Other work** |

## Constants

Exact strings live in `src/lib/product-copy.ts`. WorkSafe row labels stay in `WORKSAFE_TRACK_LABELS`.
