# Project scope: Two-up EWD rollout feedback (iPhone + 24h break + compliance chip)

**Status:** Items 1, 2, 3 D+E+F, and 4 **implemented** 2026-09-22.  
**Surface:** Circadia24 **EWD** (`app-next`) — driver PWA on phone.  
**Source:** Four field items from the two-up driver rollout.

**Do not** change AMI / Reg 184E / rolling timeline / coverage engines in this project unless the owner **explicitly approves** a rule change in the same chat. Item 3 is diagnose-first for that reason.

**Related**

| Doc / code | Role |
|------------|------|
| [driver-ui-guide-esl.md](../user-guides/driver-ui-guide-esl.md) | Driver manual — Set up day, Day tools, install |
| `DriverGuideArticle.tsx` | In-app guide — must match the app after any UI change |
| `DeviceSetupDialog.tsx` / `InstallAndSetupCard.tsx` / `DriverDeviceSetupPanel.tsx` | Install + device setup |
| `declared-24h-rests.ts` / `Declared24hRestsField.tsx` / `DayCardDetailsDialog.tsx` | Last 24h break fields |
| `UpcomingComplianceChip.tsx` / `LogBar.tsx` | Compliance warning chip |

---

## Goal

Close the four rollout defects so two-up drivers on iPhone can **install the EWD**, **find last 24 hour break fields**, and **use the compliance warning chip**. Manuals and in-app guides update in the same change as any user-visible copy or location change.

---

## Work items

| # | Item | Priority | Type | Status |
|---|------|----------|------|--------|
| **1** | Install prompt does not appear on iPhone | P0 | PWA / iOS | Done — iPhone steps visible on Drive / Settings (Safari never fires a banner) |
| **2** | iPhone install description needed next to the Android one | P0 | Copy / setup UI | Done — both recipes on the same card; this phone highlighted |
| **3** | Last 24 hour break fields cannot be found | P0 | Findability (rule-gated) | Done — D+E+F (two-up 7h + 24h declarations) |
| **4** | Compliance warning chip does not work on iPhone | P0 | Touch / iOS | Done — flattened chip; Details is a sibling control |

---

### 1. Install prompt does not appear for iPhone

**Feedback:** The install prompt does not appear on iPhone.

**What the app does today (implemented)**

- Android Chrome can fire `beforeinstallprompt` and show a native **Install app** button.
- **iOS Safari never fires that event.** The Drive / Settings card **is** the iPhone prompt: Share → **Add to Home Screen** steps are already visible.
- `EwdInstallRecipes` + `ewd-install.ts` copy. `DeviceSetupDialog` keeps storage protection after the recipes.

**Proposed (UI only — no rule change)**

1. On iPhone/iPad (Safari or Chrome-on-iOS), always show a visible install path — do not wait for a browser prompt that will never come.
2. Use the same Share → Add to Home Screen steps Command already documents (`circadia-command` `/install` / `InstallCommandApp`).
3. Keep the existing **Set up this device** storage-protection flow; install steps must be obvious before that checkbox.
4. Verify: iPhone Safari (not installed) sees the steps; already-installed standalone hides them.

**Success:** A two-up driver on iPhone, first open, can install to the home screen without being told “wait for a prompt.”

---

### 2. iPhone install description next to the Android one

**Feedback:** iPhone install description is needed next to the Android one.

**What the app does today (implemented)**

`EwdInstallRecipes` always shows **iPhone / iPad** and **Android** steps side by side (stacked on a narrow phone). The matching phone gets a **This phone** badge. Same recipes on Drive, Settings → This phone, and the setup dialog.

**Proposed (UI + guides)**

1. Show **Android** and **iPhone** install steps **together** (side by side on wide, stacked on phone).
2. Highlight the row that matches this device; never hide the other.
3. Same copy in driver Settings → This phone, home **How to install**, the in-app guide, and `driver-ui-guide-esl.md`.

**Success:** Both install recipes are visible on the same screen as each other.

---

### 3. Last 24 hour break fields cannot be found

**Feedback:** The last 24 hour break fields cannot be found.

**What the app does today (diagnose — do not “fix” until owner picks a path)**

- Solo declared 24h rests live in **Set up day / Edit day** as **Last 2 × 24 hour non-work breaks** (`Declared24hRestsField`), only when the app decides they are required (or already saved).
- Day tools shows a **Soft reset** date and a “Set in day setup” link — it is **not** the editor.
- For **two-up**, `getDeclared24hRestRequirement` returns `fieldCount: 0`. The editor is **not rendered**. Two-up rest is logged as Parked / End shift / sleeper on the timeline (7h in 48h **or** 48h in 7 days including one 24h block) — not the solo 2×24h declaration block.
- A two-up driver looking for “last 24 hour break” therefore finds nothing in Set up day.

**Owner decision required before implementation**

| Path | Meaning | Approval needed |
|------|---------|-----------------|
| **A — Findability only** | Keep two-up declarations hidden. Make Day tools + Set up day + chip say where a 24h rest is recorded for two-up (Parked / End shift on the timeline), and point solo fields only when they actually show. | UI/copy only |
| **B — Show last 24h editor for two-up** | Always show last-24h start/end (or the 2×24h block) on two-up Set up day so drivers can find and fill it. | **UI yes**; wiring that declaration into two-up **compliance / reset** is **rule IP** — do not do that unless approved |
| **C — Change two-up rule use of declared 24h** | Declaration affects two-up checks or resets the same way as solo. | **Rule IP — stop and get explicit approval** |

**Default until the owner answers:** Path A for copy/location; do not land B or C.

**Success (after the chosen path):** A two-up driver can find the 24h rest control the product intends them to use, without hunting a solo-only block that is hidden on purpose.

### 3b. Why first-use two-up shows a compliance warning (diagnosed 2026-09-22)

Two-up scoring is two limbs. Neither uses the solo declaration fields.

| Limb | Statute | What counts | First-use sheet |
|------|---------|-------------|-----------------|
| **7h in 24h** | 184E(3)(a) | Any non-work, including sleeper berth and **unlogged** time | Usually **passes** unless they already worked 17h+ in a 24h window. Skips windows with no work. |
| **48h or 7-day stationary** | 184E(3)(b) | **Only GPS Parked or GPS End shift**. Sleeper berth, unlogged time, and End shift without a pin do **not** count | **Fails immediately.** No Circadia GPS rest → both options fail. No “window not complete” skip. Fires even before the first Start shift. |

`scoreTwoUp184E3b` is OK only if `7-day structure` **or** `7h GPS block in 48h`. The fail copy is `TWO_UP_184E3B_FAIL_MESSAGE`. The chip shows that as a violation. The fix route is **Review details** (not Set up week record) because two-up has no declaration editor.

That is why rollout looked like “missing 24h fields” plus “chip on first use.”

**Fix paths (owner pick — (3)(b) apply/skip is rule IP)**

| Path | Change | Effect |
|------|--------|--------|
| **D — Work-enliven (3)(b)** | Do not fail (3)(b) until there is work/break on the tape (same idea as (3)(a) / solo 72h) | Empty first-open two-up sheet goes clear. **Start driving still fails** until GPS rest or path E/F. |
| **E — Mature 48h window** | Do not fail (3)(b) until Circadia has ≥48h of two-up record, unless a 7h GPS Parked/End shift already passes | First ~48h after first log is not a false fail. After 48h, GPS 7h or 7-day package required. |
| **F — Two-up declaration** | Set up day: last 7h and/or 24h stationary rest; count as proven stationary for (3)(b) | Matches what drivers looked for; clears paper history. **Rule IP.** |
| **G — Copy only** | Chip / Day tools explain Parked + GPS / End shift + GPS | Does not stop the first-use red chip. |

**Implemented 2026-09-22 (owner approved D+E+F):** work-enliven; no (3)(b) fail until 48h after first duty unless GPS/declared 7h already passes; Set up day two-up 7h + 24h declaration fields counted as proven stationary.

---

### 4. Compliance warning chip does not work on iPhone

**Feedback:** The compliance warning chip does not work on iPhone.

**What the app does today (implemented)**

- `UpcomingComplianceChip` sits on the LogBar (often over the dimmed session overlay).
- One tap target for the labelled action. **Details** is a sibling button (no nested `<button>`).
- `pointer-events-auto`, `min-h-[44px]`, and `touch-manipulation` on both controls.

**Proposed (UI only — chip still routes to the same existing fix actions; no new rule thresholds)**

1. Diagnose on a real iPhone: tap does nothing vs tap does the wrong thing vs chip not shown.
2. Flatten the chip: one tap target (no nested button). Put **Details** beside it or as a second sibling control.
3. Keep `pointer-events-auto` above the dim overlay; enlarge the iPhone hit area.
4. Confirm two-up idle + in-shift + “Set up week record” routes still open Set up day / compliance.

**Success:** Tap the chip on iPhone → the labelled action runs (or Details opens). Same on Android.

---

## Out of scope

- Command / Enterprise install (except reuse of iPhone step copy).
- Changing two-up rest **thresholds** or evaluation order (item 3 path C only if later approved).
- Driver Start / End shift behaviour.
- Production env / Neon / Vercel unless a later message asks to deploy.

---

## Verify

- iPhone Safari: first-run install steps visible; both Android and iPhone recipes on one screen.
- Two-up EWD: last 24h path matches the owner’s chosen item-3 path.
- iPhone: compliance chip tap works idle and in-shift.
- Driver manual + `DriverGuideArticle` match the shipped UI.

---

## Changelog

| Date | Note |
|------|------|
| 2026-09-22 | Project opened from two-up EWD rollout: iPhone install prompt, iPhone install copy beside Android, last 24h fields not found, compliance chip dead on iPhone |
| 2026-09-22 | Item 3 D+E+F implemented (two-up 7h + 24h declarations; work-enliven; 48h mature window) |
| 2026-09-22 | Items 1, 2, 4 implemented: visible iPhone install steps, both recipes on one card, flattened compliance chip |
