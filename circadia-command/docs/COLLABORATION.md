# How to collaborate on the Circadia Command spec

You should **not** need to copy specs between Gemini and Cursor by hand. Use one of these workflows.

---

## Option A — Repo file + Cursor (recommended)

Everything lives in `circadia-command/docs/`.

| File | Purpose |
|------|---------|
| [MASTER_SPEC.md](./MASTER_SPEC.md) | Living spec — read this for current truth |
| [inbox/GEMINI_PASTE_HERE.md](./inbox/GEMINI_PASTE_HERE.md) | Paste Gemini output here (no formatting) |

### Your steps

1. Open `inbox/GEMINI_PASTE_HERE.md` in Cursor (or any editor).
2. Paste Gemini’s full response below the paste line.
3. Save the file.
4. In Cursor chat: **“Process the Gemini inbox”**

Cursor will merge sections into `MASTER_SPEC.md`, update SQL/Prisma if needed, and clear or archive the inbox.

### Share with others

- **Same machine:** point them at `circadia-command/docs/MASTER_SPEC.md`.
- **GitHub:** push the repo; share the file URL on GitHub (e.g. `…/blob/main/circadia-command/docs/MASTER_SPEC.md`). Teammates edit on GitHub or clone.
- **No extra accounts** required if the repo is already on GitHub.

---

## Option B — Google Docs (if you prefer a browser doc)

Cursor cannot edit Google Docs directly. Use Docs as the **human** draft; sync via the inbox file.

### One-time setup

1. Create a Google Doc: **“Circadia Command — Master Spec”**.
2. Copy the contents of [MASTER_SPEC.md](./MASTER_SPEC.md) into the doc.
3. Share the doc with **Edit** access for your team.
4. Pin the doc link in your team chat.

### Ongoing workflow

| Where | Who | Action |
|-------|-----|--------|
| Google Doc | You + Gemini | Paste Gemini replies into the doc under Section 4, 5, etc. |
| `inbox/GEMINI_PASTE_HERE.md` | You | Copy the **new** Gemini section(s) from the doc into the inbox file |
| Cursor | You | Say **“Process the Gemini inbox”** |

Optional: after Cursor merges, copy updated sections back to the Google Doc so it stays in sync.

### Import MASTER_SPEC into Google Docs

1. Open [MASTER_SPEC.md](./MASTER_SPEC.md) on GitHub or in Cursor.
2. Select all → copy → paste into a new Google Doc.
3. Or: File → Import → Upload → select `MASTER_SPEC.md`.

---

## Option C — GitHub web editor only

No Google Docs, no local editor:

1. Open the repo on GitHub.
2. Navigate to `circadia-command/docs/inbox/GEMINI_PASTE_HERE.md`.
3. Click **Edit** (pencil) → paste Gemini → **Commit**.
4. Open Cursor locally, pull, and say **“Process the Gemini inbox”**.

Or edit `MASTER_SPEC.md` directly on GitHub if you are only fixing typos.

---

## What Cursor does when you say “Process the Gemini inbox”

1. Read `inbox/GEMINI_PASTE_HERE.md`.
2. Merge new sections into `MASTER_SPEC.md` (status dashboard, Section 4–11 stubs).
3. Update `prisma/sql/` and `schema.prisma` if the paste includes DDL.
4. Update README / status tables.
5. Tell you what is still missing and the next Gemini prompt.

You do **not** need to paste the spec into chat.

---

## Gemini prompt location

The current continuation prompt is at the bottom of [MASTER_SPEC.md](./MASTER_SPEC.md). After each merge, that prompt is updated to ask only for sections not yet done.

---

## Quick reference

```
Gemini  →  inbox/GEMINI_PASTE_HERE.md  →  Cursor: "Process the Gemini inbox"
                ↓
         MASTER_SPEC.md  (+ prisma if needed)
```
