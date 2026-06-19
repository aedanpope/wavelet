# Project Storage v2 — Design

> Status: **draft v1** — requirements brainstorm captured, architecture deliberately deferred.
> Scope: replace the OneDrive / OS-native file-picker storage for the Pixel Game project (and future multi-session projects) with a small backend that owns both student identity and durable storage.
> Supersedes: the OneDrive-related parts of `ROADMAP.md` Phase 4 ("Scratchpad file save/open" and the login-friction table). The `.py` export stays; OneDrive as the save target is dropped.

---

## 0. Why we are doing this

The shipped solution saved student work as a `.py` file through the OS-native file picker, which on Windows routes to OneDrive with no OAuth. In a real classroom this failed badly:

- The school's laptops were slow to load OneDrive even after a student signed in.
- Some laptops would not sign into OneDrive without a full reset.
- Students saved into local Documents instead of OneDrive (an easy mistake given the Windows folder UX), so work stayed stranded on one machine.
- Students lost work.

Every one of these is the same root cause: the design fused two hard problems and outsourced both to Microsoft's account + sync layer, which is exactly the flaky part of the school's stack.

1. **Identity** — which student is this, across sessions and across a hodgepodge of roaming laptops?
2. **Durable storage** — where do the bytes live so nothing is lost?

v2 owns both, and crucially **decouples identity from any Windows / Microsoft / school account**. We accept that Wavelet now has a backend and a database. We give up being fully clientside and stateless for project work.

---

## 1. Success criteria (what "reliable" has to mean)

- A student sits at *any* laptop in the room and is into their own project in **under ~30 seconds**, with no Windows / Microsoft sign-in.
- Work is **never silently lost**. A crash, tab close, dead battery, or a different laptop next week all recover cleanly.
- A teacher can **recover any student's work** without IT, passwords, or knowing which laptop they used.
- It works on the **slowest laptop in the room**.
- **Zero dependency** on the school's accounts, OneDrive, domain login, or per-device state.
- **Paper is in the mix**, because paper is the most reliable thing in the school environment.

---

## 2. The model in one paragraph

Each student gets a **printed cover sheet** (the front page of their progress pack) carrying their project: a friendly title, their name, a **word-based code**, a **QR code**, and a **short typeable URL**. In class on a laptop, the student types the short URL or the code and is straight into their own project, no account. Work **autosaves continuously to the server**, which is the single source of truth and keeps a **full version history**. At home, scanning the QR opens the running game in a mobile web view to show parents. Teachers manage their class from a dashboard reached with their own **teacher code** (minted by the owner; no teacher login for now).

---

## 3. Identity & access

### 3.1 Codes are word-based and typo-safe

- Codes are **word-based** (for example `brave-otter-42`) because they are far easier for primary-age kids to type than random strings.
- **Hard requirement: no single typo can land a student in another student's project.** The valid-code space must be error-detecting, so any single-character (or single-word) mistake yields an *invalid* code, not a *different valid* code. Concretely this means the set of issued codes is kept sparse / checksummed (for example a check word or check digit, and a minimum edit distance between any two live codes) so a one-off slip fails closed.
- Beyond the code maths, gate entry with a **name confirmation** before any edit: "This is Mia's Pixel Game, is that you?" This is the in-session reason the name field exists, not just admin.
- Ergonomics: case-insensitive, auto-insert the dashes, tolerate trailing spaces, avoid ambiguous glyphs.

### 3.2 Code = one project, one term

A code identifies **one project instance for one term**, not a global student account. A student doing a new project next term gets a new card. This keeps the privacy story clean and avoids building an "account" with all its baggage (multi-year identity, password reset, account merging).

### 3.3 No offline fallback by design

The server is the **hard source of truth**. If a write cannot be confirmed by the server, the student is **blocked from editing** rather than allowed to keep working against a local buffer that might never sync. The owner's explicit preference: a student blocked for a moment is acceptable; a student doing work that silently ends up unsaved is not. There is therefore **no "work offline and sync later" mode** in v1. (A short-lived in-tab buffer purely to survive a flaky few seconds before a confirmed save is fine, as long as the UI never tells the student they are saved when the server has not confirmed it.)

### 3.4 Teachers

- A teacher manages their class from a **dashboard reached with a teacher code**, minted by the owner. **No teacher login for now.**
- The teacher code scopes a **class / roster** and can see every student's work, so it is more guarded than a student code: longer, **never printed on student cards**, and rotatable if it leaks.
- **Many-to-many is fine, via shared codes.** Multiple teachers can manage the same class by **sharing its one class code**, and a teacher can hold codes for more than one class. This is the live case right now: 2 classes across 2 teachers running simultaneously, with both teachers dipping into both classes. No per-teacher accounts or access lists in v1; sharing the code is the mechanism.

---

## 4. Cover sheets (two versions)

There are **two** printable cover sheets, both generated from the dashboard, both whole-class as a **single PDF**, both **one page per student**. They share the identity block but serve different moments.

**Shared identity block (on both):**

- Student name + friendly project title ("Sam's Pixel Game").
- The **word-based code**.
- A **QR code** that, when scanned (parent's phone, iPad, any camera device), opens the **running game in a mobile web view** so the student can show family at home.
- A **short typeable URL directly below the QR** for loading the project on a laptop, since scanning a screen QR at a Windows laptop is awkward and most classroom laptops have no easy scanner. **Typed code/URL is the in-class path; QR is the take-home / touch-device path.**

**A. Start sheet** (handed out at the start of the project):

- The identity block plus **front-matter prose**: what the project is, that **"this is assessed,"** and any getting-started notes.
- A **milestone checklist** the teacher can tick by hand.

**B. Final / progress-pack sheet** (printed at the end, goes in the progress pack):

- The identity block plus **the student's actual finished code**.
- Must **fit on a single page**: shrink the code font as needed so the whole program fits. (This sheet absorbs the "showcase print" idea: it is the tangible artifact of the finished work. See §9.)

Teachers generate **both sets** from the dashboard (the start set up front, the final set at the end).

---

## 5. Student names & PII minimisation

- Names are stored in a **separate table from the project content**, linked by code, so the project bytes are **non-PII by construction**.
- The name field is **optional, editable, and appendable later** (a teacher can pass a class list up front to mint one code per name, and still add or correct names afterward).
- Names **auto-delete on a schedule** some months after the project is complete. Because the name lives in its own table, deletion is just nulling a field and never touches the work.
- The schedule is **visible to the teacher** ("names for this class auto-clear on 2026-12-01") with a one-click **extend**.

---

## 6. Versioning & concurrent writes

- Every **debounced autosave** (after a few seconds of inactivity, not per keystroke) writes a new **version**.
- **Students browse their own edit history** in the student view to go back to an earlier version. This is the only "restore" UX we build, and it is student-facing. (Acknowledged it is a bit tricky to get right; still v1.)
- This **dissolves the concurrent-write problem**, but **do not frame it as "keep both"** (it is unclear what merging would even mean to a child). Instead: if the same code was edited on two laptops, give the student an **easy way to see the two separate code files and pick which one to continue with**. In practice this is the same edit-history browser: both edit streams are just versions in the timeline, and the student scrolls to the one they want and continues from it. No merge, no special diverged-state UI in v1.
- **No separate teacher-facing version UI.** A teacher who needs to recover or inspect a student's history just **uses the student's code to load the student view** and picks the version there. This avoids building a second restore UX.
- After a project is marked complete, history is **compacted to milestones** to control disk bloat.
- Opportunity (would-be-nice, not v1): a **"watch your project grow" replay** at the end of the unit, reusing the version timeline and the existing trace player from `scratchpad.js` for a delightful showcase moment.

---

## 7. Teacher dashboard

- **"Is everyone saving?"** — show last-saved time per student so the teacher can spot the one laptop that is silently failing to save **before** work is lost. Highest-value teacher view, and cheap once versions exist.
- **Projection-safe by default.** The dashboard may be shown to the whole class on a projector, so **student codes are hidden until clicked / moused over** (a code is effectively the key to that student's project). Names can show; the codes reveal on demand.
- **Append a new student** to the class at any time (late enrolment, a kid who was missed in the initial class-list import). Mints a code (and a card to print).
- **Reprint a lost card** in seconds: search by name, reprint one cover sheet. Cards will get lost; recovery has to be trivial.
- **Generate both cover-sheet sets** (§4): the start set up front, the final progress-pack set at the end.
- **Bulk actions**: generate-class-from-list, print-all-cards (one PDF), export-all-work, end-of-term cleanup.
- **No teacher-facing version browser** (see §6): to inspect or recover a student's history, the teacher loads the **student view with that student's code**.

---

## 8. Owner-level data controls

Since we now hold a database:

- **Delete this student** and **export this student** paths, so a parent or school request can be answered cleanly.
- Visibility into retention (when names auto-clear) and the ability to act on it.

---

## 9. Take-home & artifacts

- Keep the existing **`.py` export** so a kid can show parents or open the file in IDLE. The take-home story no longer *depends* on the file (the QR + code do that), but the file stays as a nice artifact.
- **Showcase print is v1**, not a nice-to-have: the **final / progress-pack cover sheet** (§4B) is the showcase, the student's actual code shrunk to fit one page, optionally with the rendered canvas image. This is needed for the progress packs going out **next week**, so it has to ship in the first cut.

---

## 10. v1 cut vs. later

**v1 (in-class survival):**
- Per-student word-based, typo-safe codes + name confirmation on entry.
- **Two cover sheets** (§4): start sheet (assessed notes + milestone checklist) and final progress-pack sheet (actual code shrunk to one page). Shared identity block: name, title, code, QR to mobile game view, short typeable laptop URL. Whole-class PDF, both sets generated from the dashboard.
- Server as hard source of truth; **no offline mode** (block rather than risk loss).
- Continuous autosave with full version history; **student-facing** history browse / restore (also covers the concurrent-edit "pick which file to continue" case).
- Teacher dashboard: last-saved times, **codes hidden until hovered** (projection-safe), append a student, reprint a card, generate class from list, generate both cover-sheet sets. (No teacher version browser; teachers use the student code to load the student view.)
- Names in a separate table with scheduled auto-delete + teacher-visible date and extend.
- Teacher code minted by owner; no teacher login; **shared codes for many-to-many teacher/class access**.
- Owner data controls: delete / export a student.
- `.py` export retained.

**Later (nice-to-have):**
- "Watch your project grow" replay (reuse version timeline + trace player).

---

## 11. Open / deferred

- **Architecture / hosting** is now drafted in §12 (recommendation: Cloudflare Pages Functions + D1). The one fork still to confirm is **D1 vs Supabase**.
- Exact **code scheme** (word list size, check-word vs. check-digit, minimum edit distance) to be specified when we build §3.1.
- Retention window length for §5 (how many months after completion).
- Whether the teacher dashboard's progress view should fold in the broader **Phase 3 "Assessment"** goals from `ROADMAP.md` (per-problem pass/fail export), since both want a teacher-facing progress surface.

---

## 12. Architecture & hosting (draft)

### 12.1 Platform: stay entirely on Cloudflare

The app is fully static today and already deploys to **Cloudflare Pages** (`wavelet-e8x`). The scale is tiny (2 classes, ~56 students). So the lowest-ops choice is to add a backend **on the same platform**:

- **Cloudflare Pages Functions** (Workers under the hood) for the API, served same-origin at `wavelet.zone/api/*`. One repo, one deploy, **no CORS**, and the existing per-branch preview deployments cover the backend too.
- **Cloudflare D1** (serverless SQLite) for storage.

**Alternative considered — Supabase** (hosted Postgres): gives a free admin table-editor GUI out of the box (could stand in for some owner-facing data controls in §8), at the cost of a second vendor and losing same-origin simplicity. **Lean: D1**, because the scale is trivial, the data model is plain relational (identical either way), and a solo maintainer benefits from not splitting platforms. Revisit if a ready-made admin GUI becomes worth more than the simplicity.

**Rejected — VPS / self-hosted Postgres / Node server:** too much ops for a solo maintainer; nothing here needs it.

Durable Objects / real-time-collab machinery are **not needed**: the versioning model below is append-only, so we get no-clobber recovery without locks or coordination.

### 12.2 Two-tier write model (core mechanic)

- **`current_state`** — one row per project, holds the latest content. Overwritten on every autosave. This is what **resume** reads (a single-row fetch, fast on slow laptops).
- **`snapshots`** — append-only history. A new immutable row on a throttled cadence (at most one per ~30s of active editing, plus on each run / milestone). **Nothing is ever destroyed**, so a last-write-wins clobber on `current_state` is always recoverable here. This is what the student's history browser (§6) reads.

**Optimistic concurrency:** the client sends the version number it loaded. If the server's has advanced from a *different* session token, the response flags "also edited on another laptop," and the student resolves it via the history browser. No merge.

**Save triggers:**
1. **Periodic confirmed autosave** — the throttled cadence above (every ~30s of active editing + on each run / milestone). This is the *only* save that counts toward durability (see §12.3).
2. **Best-effort close-time flush** — captures the last debounce-window of keystrokes that periodic autosave has not yet persisted. See §12.3a.

### 12.3 Hard-source-of-truth contract (implements §3.3)

The client treats a save as durable **only** on a `2xx` confirming the row committed. UI shows "saving…" until then; on failure it shows a **blocked** state and never claims the work is saved. D1 writes are durable on commit. There is no local "work offline and sync later" path.

### 12.3a Close-time flush (best-effort only)

It is possible to push a final save as the tab closes, but **only as a best-effort flush that cannot be confirmed**, so it never participates in the durability contract above.

- **Trigger:** hook the page-lifecycle event `visibilitychange` → `document.visibilityState === 'hidden'` (and/or `pagehide`). Do **not** try to intercept `ctrl+w`/the keystroke, and do **not** rely on `unload`/`beforeunload` for the save: they can't run async work reliably, `unload` is deprecated, breaks the back/forward cache, and often never fires on mobile. `visibilitychange→hidden` is the last reliable moment and also covers mobile backgrounding.
- **Mechanism:** `navigator.sendBeacon()` (or `fetch(url, {keepalive: true})`). The browser sends the POST after the page is gone, fire-and-forget. Code goes in the URL path (`/api/p/:code/save`) because a beacon can't set auth headers. Payload cap is ~64KB (our content is a few KB).
- **Why it can't be the guarantee:** the beacon returns **no response**, so the client can never confirm the row committed. It therefore **must stay invisible**: it never updates the "✓ saved" indicator and never tells the student they are safe. If it silently fails, the student loses only the last debounce-window of edits, which is the risk already accepted in §3.3.
- **Net effect:** shrinks worst-case loss from "everything since the last ~30s save" to "usually nothing," without weakening the contract. The server treats the beacon as an ordinary append/overwrite (idempotent with the periodic path).

### 12.4 Data model (sketch, identical on SQLite or Postgres)

```sql
-- A class / term, managed by a shared teacher code.
classes (
  id              TEXT PRIMARY KEY,
  school          TEXT,            -- which school this class belongs to
  name            TEXT,
  project_slug    TEXT,            -- which project DEFINITION the class is assigned,
                                   -- a slug into the static repo (e.g. 'pixel-game' ->
                                   -- projects/pixel-game.json). NOT a FK to projects(id).
  teacher_code_hash TEXT NOT NULL, -- teacher codes stored hashed (§12.5)
  name_clear_after DATE,           -- when student names auto-delete (§5)
  created_at      TIMESTAMP
)

-- Identity row = one student's project INSTANCE for one term (code = one project, §3.2).
-- Distinct from classes.project_slug, which names the shared definition this is an
-- instance of. Name lives here, separate from project content, so deletion just nulls it (§5).
projects (
  id              TEXT PRIMARY KEY,      -- the instance id; current_state/snapshots FK to this
  class_id        TEXT REFERENCES classes(id),
  student_code    TEXT UNIQUE NOT NULL,  -- capability, reprintable (§12.5)
  display_name    TEXT,                  -- nullable; auto-cleared per class_id
  current_version INTEGER NOT NULL DEFAULT 0,
  last_writer     TEXT,                  -- session token of last writer
  last_saved_at   TIMESTAMP,
  completed_at    TIMESTAMP              -- set on completion; triggers compaction
)

-- Latest content, overwritten each save. No PII (FK only).
current_state (
  project_id      TEXT PRIMARY KEY REFERENCES projects(id),
  content         TEXT NOT NULL,         -- the assembled .py / structured JSON
  version         INTEGER NOT NULL,
  updated_at      TIMESTAMP
)

-- Append-only history. No PII (FK only). Compacted to milestones after completion.
snapshots (
  id              INTEGER PRIMARY KEY,
  project_id      TEXT REFERENCES projects(id),
  version         INTEGER NOT NULL,
  content         TEXT NOT NULL,
  writer_session  TEXT,                  -- to surface cross-laptop divergence
  is_milestone    BOOLEAN DEFAULT 0,     -- survives compaction
  created_at      TIMESTAMP
)
```

Content is stored as **full snapshots** (a few KB each), not diffs: simpler, and trivial at this scale. Post-completion compaction keeps milestone snapshots and prunes the rest.

### 12.5 Auth at rest

- **Student codes** are capabilities (knowing the code = access to that one term's project) and must be **reprintable** from the dashboard, so they are stored **recoverably** (plaintext, or encrypted with a Worker secret). Low stakes: term-scoped, rotated each term, names auto-deleted. *Open: plaintext vs encrypted-at-rest.*
- **Teacher codes** are higher-value and never reprinted by the system (the owner mints and hands them out), so they are stored **hashed** and verified per request. Shared between teachers for many-to-many access (§3.4).

### 12.6 API surface (sketch)

Student (auth = student code in path/header):
- `GET  /api/p/:code` — load `current_state` (resume).
- `POST /api/p/:code/save` — append/overwrite a version; returns `{version, saved_at}` or a concurrency flag. The only durability signal the client trusts.
- `GET  /api/p/:code/history` — list snapshots for the history browser.
- `GET  /api/p/:code/history/:version` — fetch one snapshot.
- `GET  /api/p/:code/export.py` — `.py` download (§9).

Teacher (auth = teacher code):
- `GET  /api/class/:teacherCode` — roster + last-saved times (codes hidden client-side until hovered, §7).
- `POST /api/class/:teacherCode/students` — append a student, mint code.
- `GET  /api/class/:teacherCode/cards?set=start|final` — cover-sheet data / PDF inputs (§4).
- `POST /api/class/:teacherCode/retention/extend` — push back name auto-delete (§5).

Owner (auth = owner secret):
- `POST /api/admin/class` — mint a class + teacher code.
- `GET/DELETE /api/admin/student/:id` — export / delete a student (§8).

### 12.7 Scale, cost, residency

- **Cost:** comfortably inside D1's **free tier**. Peak write load ~56 kids × a save every ~10-30s ≈ low tens of thousands of writes per session, under the free daily budget; storage is tens of MB before compaction. Throttling snapshots (§12.2) keeps both in check.
- **Data residency (verified June 2026):** students are AU primary kids. Cloudflare lets you **hint** the primary location to Oceania for both D1 and R2 via the `oc` location hint (`wrangler d1 create <name> --location=oc`; R2 buckets take the same hint). This is **best-effort, not a guarantee**, and D1 auto-creates **read replicas in other regions** based on traffic, so copies can exist outside Oceania. The only **hard** residency control is "Jurisdictions," and the only jurisdictions offered are `eu` and `fedramp`: **there is no Australia / Oceania jurisdiction**, so a guaranteed "data stays in AU" lock is not available on Cloudflare today.
  - **Plan:** create the D1 DB and R2 buckets with `--location=oc` (also a minor latency win on slow school laptops). This is almost certainly sufficient given the data is already PII-minimised (term-scoped non-account codes, names auto-deleted, content non-PII).
  - **Legal context (researched June 2026; general info, not legal advice):**
    - **Federal baseline (Privacy Act 1988, APP 8):** no data-localization rule. Offshore storage of personal information is permitted under an *accountability* model (you stay accountable and take reasonable steps to ensure the overseas recipient complies with the APPs). Most non-government / independent schools sit here (and are "APP entities" regardless of turnover because they handle health info). Under this regime, Cloudflare-only with `--location=oc` is fine.
    - **WA government schools are stricter (PRIS Act 2024):** WA public entities, including the Department of Education and WA government schools, are now "IPP entities" (Royal Assent Dec 2024, obligations phasing in ~2026-2027). **IPP 9 (Disclosures outside Australia) restricts overseas disclosure and explicitly extends to *de-identified* information**, not just personal information. So this design's PII-minimisation does **not** cleanly sidestep the rule under WA law the way it would federally. IPP 9 is a restriction with conditions, not an absolute ban, but the simplest way for a WA government school to satisfy it (and the likely outcome of their "Online Services Acceptable Use" vetting) is to **require onshore hosting**.
  - **Implication:** because Cloudflare cannot *guarantee* AU residency (no AU jurisdiction; D1 read replicas roam), Cloudflare-only is a **real compliance gap for WA government-school deployments**, not just a hypothetical contractual clause. Mitigations: (a) host **only this database** in an AU region (e.g. Supabase Sydney or any AU-region Postgres) while keeping the static site + Pages Functions on Cloudflare; or (b) push minimisation so far that **student names never reach the server** (names live only on the teacher's paper roster / client-side-generated cards), leaving the server holding opaque codes + creative code, though that may still be "de-identified info" under IPP 9, so onshore remains safest for WA government schools.
  - **Key unknown to resolve before build:** are the target schools **WA government** (PRIS / IPP 9 → storage tier should be onshore) or **non-government / independent** (federal APP 8 → Cloudflare-only with `--location=oc` is acceptable)? Confirm with the school's privacy/ICT contact and their online-services assessment.

### 12.8 Deploy & local dev

- Add a `wrangler.toml` and a `functions/` (or `/api`) directory to the existing repo; `wrangler` provides a local D1 for dev. The static `npm run build` flow is unchanged; Pages builds the Functions alongside it.
- Migrations as plain SQL files applied via `wrangler d1 migrations`.

### 12.9 Which Cloudflare storage primitive for what

All on one platform. The stack is **Pages Functions + D1 + R2 + Cron Triggers**.

| Primitive | Role here | Verdict |
|---|---|---|
| **D1** (serverless SQLite) | System of record: relational, *queried* data (roster, last-saved times, codes, retention dates, version pointers) and, in v1, the snapshot/current content as TEXT. | **Primary store.** Only D1 can answer "list this class with each student's last save." |
| **R2** (S3-compatible objects) | Blob-shaped *outputs*: generated cover-sheet PDFs (§4), exported `.py` (§9), canvas snapshot PNGs. Migration target for snapshot history if it ever outgrows D1. | **Add, for files only.** Strong read-after-write, zero egress, ~10GB free. |
| **Cron Triggers** (scheduled Worker) | The scheduled jobs: name auto-deletion (§5) and post-completion compaction (§6). | **Add.** Native fit for both; fills a real gap. |
| **KV** (global key-value) | Eventually consistent (writes propagate over up to ~a minute). | **Reject as system of record.** Conflicts with "resume on another laptop and see your last save" and the hard-source-of-truth contract (§12.3). |
| **Durable Objects** | Strict per-entity single-writer serialization; foundation for real-time collaboration. | **Not v1.** We don't need collab; append-only + optimistic concurrency (§12.2) already prevents loss, and D1 serializes same-row writes. **Upgrade path** if we ever want live multi-device sync. |
| **Queues** | Async job pipeline. | **Not v1.** At ~56 students, generate PDFs synchronously and compact on a Cron Trigger. |

**Content placement decision for v1:** keep snapshot/current content as **TEXT in D1**, not R2. Splitting content into R2 makes a save two non-atomic writes (R2 PUT + D1 pointer), which complicates the single-confirm durability contract for no benefit at this scale. R2 is for file-like outputs only; "snapshots → R2" is a documented migration path, not v1.
