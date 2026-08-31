# Activity glossary (locked)

**Status:** Locked 19 Aug 2026. Use these words only. Do not add synonyms in driver or office copy.

WorkSafe interchanges **break** and **rest**. We do not. **Rest** is used for one case only: not driving and not doing a job task.

## Driver words (states)

| What the driver is doing | Driver word | How they get there |
|--------------------------|-------------|--------------------|
| Driving | **Work** | Start shift → Start driving, Start work → Start driving, or Other work hub → Start driving |
| Not driving, and not doing a job task — eat, drink, nap, sit still | **Rest** | Stop Driving → Start Rest, or Other work hub → Start Rest |
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
| **Continue shift** | Two-up Passenger only: one hero tap. Opens driving / break / sleeper. Does not log by itself. |
| **Start driving** | Top half of the Start shift / Start work split, or on the Other work hub. Logs Work (driving). |
| **Stop Driving** | On Work: one hero tap. Opens the Rest / Other work chooser. Not End shift. |
| **Start Rest** | Top half of the Stop Driving split, or on the Other work hub. Logs Rest. |
| **Start Other Work** | Bottom half of the Start shift / Start work / Stop Driving split. Logs Other work. Then the three-tile hub. |
| **Load check** | On the Other work hub. Opens Dimension & Load. Timeline stays Other work. Not a new activity. Tap again for another load. If it is not a load, stay on Other work until Start driving or Start Rest. |
| **Cancel** | Closes Start shift / Start work / Stop Driving choosers. Other work hub has no Cancel. |

**End shift** stays in the dock, never inside the split. Stop Driving = still on the job, not driving. End shift = off the job.

## Two-up extras

Two-up keeps the same Work / Other work / End shift words. It does **not** use **Start Rest** or **Taking a nap?**. Extra states:

| What the driver is doing | Driver word | How they get there |
|--------------------------|-------------|--------------------|
| Passenger seat | **Passenger** | Stop Driving → Passenger (unlocked while moving) |
| Sleep in an appropriate sleeper berth | **Sleeper berth** | Stop Driving → Sleeper berth (unlocked while moving). Non-work; shift stays open. Counts for 7h in 24h. Does **not** prove 48h / 7-day stationary rest. |
| Vehicle not moving | **Parked** | Bottom-left dock (or from Passenger / Sleeper berth). GPS required. Non-work; shift stays open. This is the on-shift proof for 184E(3)(b). |

| Phrase | Role |
|--------|------|
| **Parked** | Two-up dock (and Passenger / Sleeper choosers). Logs `stationary_rest` only after a GPS fix while still. Locked while moving — use Sleeper berth then. |

**End shift** with a GPS pin also proves 184E(3)(b) (vehicle stopped at finish). Sleeper berth does not.

## Taps (locked)

Idle Start shift and Rest Start work both open the same Driving / Other work split. Other work keeps three tiles on the ring (driving, Rest, Load check) until they pick driving or Rest — same after a reload. Confirm in Set up day does **not** auto-log driving.

| Driver is on | Hero | Dock |
|--------------|------|------|
| Idle / after End shift | **Start shift** | — |
| Idle, Start shift chooser open | Split: **Start driving** / **Start Other Work** | — |
| **Work** | **Stop Driving** | **End shift** |
| **Work**, chooser open | Split: **Start Rest** / **Start Other Work** | **End shift** |
| **Rest** | **Start work** | **End shift** + **Taking a nap?** (bottom-left; not a fifth activity) |
| **Rest**, chooser open | Split: **Start driving** / **Start Other Work** | **End shift** + **Taking a nap?** |
| **Other work** | Three tiles: **Start driving** / **Start Rest** / **Load check** | **End shift** |

The timer under the ring shows how long this stretch has been open, with a small **(Work)** / **(Rest)** / **(Other work)** note so the split is not mistaken for the current state.

The split is a chooser, not a log. First tap of Start shift, Start work, or Stop Driving only opens it — that tap does not log. Start driving, Start Rest, and Start Other Work keep the usual tap-again confirm. The Other work hub stays on the ring until they pick driving or Rest (Load check does not leave Other work).

Do not show Rest and Other work as two always-visible taps on Work. Do not add a button named Break.

### What each tap logs

| Tap | Stored type | Notes |
|-----|-------------|-------|
| Start shift | *(nothing)* | Chooser only (or Set up day first) |
| Start work | *(nothing)* | Chooser only — from Rest, including when Rest has painted as non-work after 31 min |
| Start driving | `work` | Driving. Same 7h rest gate as Start shift when idle. From Start shift, Start work, or the Other work hub. |
| Continue shift | *(nothing)* | Two-up Passenger opener only. Solo Other work shows the three-tile hub instead. |
| Start Rest | `break` | Existing 30 min floor: 30 min stays Rest; 31+ becomes **non-work**. From Stop Driving or the Other work hub. |
| Taking a nap? | *(qualifier on Rest)* | Rest-only corner. Sets `napFrom` on the open Rest for FRMS. Diary stays Rest. Compact **Nap?**. Active **On nap**. |
| Start Other Work | `other_work` | Break from driving on the sheet. Never convert to non-work. Counts toward 20 min / 5h. Still work time for 168h. From Start shift, Start work, or Stop Driving. Then the three-tile hub: Start driving / Start Rest / Load check (not stored until they pick driving or Rest). |
| Load check | *(nothing)* | Opens Dimension & Load. Timeline stays Other work. Always on the Other work hub — tap again for another load. |
| Add load check | *(nothing)* | Daily checks / forms still offer another Dimension & Load. |
| End shift | `stop` | Unchanged — starts **non-work** |
| Stop Driving | *(nothing)* | Chooser only |

### Reminders and voice

The 5h reminder opens the same Stop Driving split. Voice uses the same button words: start shift, start work, start driving, continue shift, start rest, start other work, stop driving, load check, taking a nap / nap, passenger, sleeper berth, parked, end shift.

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
