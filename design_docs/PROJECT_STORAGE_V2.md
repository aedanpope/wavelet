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
- Must **fit on a single page**: shrink the code font as needed, and if it still overflows, **just crop the code** (don't spill to a second page). The full program is always in the `.py` export (§9), so a crop loses nothing important.
- **Rendered canvas image is future work.** Including the student's drawn scene on the sheet is desirable but technically awkward to produce at "generate progress-pack sheets" time (it means running each student's project headless to render the canvas). Deferred, not v1.

Teachers generate **both sets** from the dashboard (the start set up front, the final set at the end).

---

## 5. Student names & PII minimisation

- Names are stored in a **separate table from the project content**, linked by code, so the project bytes are **non-PII by construction**.
- The name field is **optional, editable, and appendable later** (a teacher can pass a class list up front to mint one code per name, and still add or correct names afterward).
- Names **auto-delete 12 months after the project run is marked complete** (`completed_at`). Because the name lives in its own table, deletion is just nulling a field and never touches the work.
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
- **Showcase print is v1**, not a nice-to-have: the **final / progress-pack cover sheet** (§4B) is the showcase, the student's actual code shrunk to fit one page (cropped if it overflows). This is needed for the progress packs going out **next week**, so it has to ship in the first cut. The rendered canvas image on the sheet is **future work** (§4B).

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

**Resolved (locked):**
- **Architecture / hosting:** WA government schools → onshore → **Cloudflare Pages (static) + Supabase Sydney (data tier)**, compliance bar = **parity with Grok Academy** (AWS Sydney + encryption, §12.7). Sovereign-AU hosting not needed; names-on-server acceptable.
- **Schema:** three-tier `classes` → `class_projects` → `projects` (§12.4). One shared `teacher_code_hash` per cohort, no per-teacher revocation in v1.
- **Name retention:** auto-delete **12 months** after `completed_at` (teacher-marked), teacher-extendable (§5).
- **Content blob:** **`.py` only** in v1; self-check/pill state is not persisted (unused feature, OK to lose) (§12.4).
- **Save/snapshot cadence:** one trigger (on Run + ~30s active editing); each save overwrites `current_state` and appends a `snapshot` (Run snapshots = milestones) (§12.2).
- **Codes at rest:** student codes **encrypted at rest, unlocked by the teacher code**, with a separate hash for login lookup (§12.5).
- **Cover-sheet overflow:** crop the code (full code is in the `.py`); rendered canvas image on the sheet is **future work** (§4B, §9).

**Still open (genuinely undecided):**
- **Code scheme (§3.1):** word-list size, check-word vs check-digit, and minimum edit distance to guarantee no single typo is a valid code. Must hold across the **globally unique** code space (login has no class selector), and pairs with **brute-force rate-limiting** on the login lookup.
- **Whether the teacher dashboard folds in the Phase 3 "Assessment" goals** from `ROADMAP.md` (per-problem pass/fail export), since both want a teacher-facing progress surface.

**Action (not a design choice):** confirm the §12.7 Grok-parity page clears the school's online-services assessment.

---

## 12. Architecture & hosting (draft)

### 12.1 Platform: split frontend (Cloudflare) from an onshore (AU) data tier

**Decision driver: the target is WA government schools** (confirmed), which fall under the PRIS Act 2024 / IPP 9 (§12.7). Student data, at rest **and** in processing, should stay **onshore in Australia**. Cloudflare D1 cannot *guarantee* AU residency (no AU jurisdiction; read replicas roam), so **Cloudflare D1 is ruled out for the data tier.** This reverses the earlier "lean D1" call: the residency requirement is exactly what tips the choice to a hosted AU-region database.

Chosen shape:

- **Frontend stays on Cloudflare Pages** (`wavelet-e8x`): static assets carry no personal information, so the existing deploy and per-branch previews are unaffected.
- **Data tier in an AU region.** Recommended: a **Supabase project in Sydney (`ap-southeast-2`)** for Postgres + Supabase Storage (blobs) + `pg_cron` (scheduled jobs) + PostgREST/RPC (in-region API so *processing* stays onshore, not just storage). The browser calls the in-region Supabase endpoint directly (CORS), with the code-as-capability model enforced by `SECURITY DEFINER` RPC functions + Row Level Security. This also hands us the **owner data-control GUI** (§8) for free via Supabase Studio.

This is a deliberate move off "one platform": we accept a second vendor and cross-origin calls (standard CORS) in exchange for an onshore data tier. The lower-ops parts of Cloudflare (static hosting, previews) stay.

**Alternatives for the AU data tier:** any AU-region Postgres works (AWS `ap-southeast-2`/`ap-southeast-4` directly, Azure Australia East, GCP Sydney, Neon AU, Fly.io `syd`). Supabase is recommended for the managed Postgres + Storage + cron + admin GUI in one, at this scale. The compliance bar is **parity with Grok Academy** (AWS Sydney + encryption), which Supabase-on-AWS-Sydney meets directly, so an Australian-owned "sovereign" provider is **not** required (§12.7).

**Non-government / independent schools** (federal APP 8 only) could instead use the simpler **Cloudflare-only stack** (Pages Functions + D1 + R2 + Cron Triggers, same-origin, no CORS) described in the earlier draft of this section; it is retained as a variant in §12.9 should the deployment target ever broaden.

**Rejected — VPS / self-hosted Postgres / Node server:** too much ops for a solo maintainer; a managed AU-region Postgres covers it.

Durable Objects / real-time-collab machinery are **not needed**: the versioning model below is append-only, so we get no-clobber recovery without locks or coordination.

### 12.2 Two-tier write model (core mechanic)

There is **one save trigger** (the autosave event): on each **Run**, and after **~30s of active editing** (debounced). Every save event does **both** writes together:

- **`current_state`** — one row per project, **overwritten** with the latest content on each save. This is what **resume** reads (a single-row fetch, fast on slow laptops).
- **`snapshots`** — an **append** of the same content on each save (a Run-triggered snapshot is flagged `is_milestone`). **Nothing is ever destroyed**, so a last-write-wins clobber on `current_state` is always recoverable here. This is what the student's history browser (§6) reads.

So current_state and snapshots share the **same cadence** (one save = one current_state overwrite + one snapshot append); there is no separate throttle. Post-completion compaction (§6) later prunes the non-milestone snapshots.

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

### 12.4 Data model (sketch; Postgres, see §12.1)

Three tiers, so that a class running a **second project later** is just a new `class_projects` row, and the cohort + teacher code persist across projects:

```sql
-- Durable cohort: a class of students with a teacher. Persists across projects.
classes (
  id               TEXT PRIMARY KEY,
  school           TEXT,            -- which school this cohort belongs to
  name             TEXT,            -- e.g. 'Year 5 Blue'
  teacher_code_hash TEXT NOT NULL,  -- stable across the cohort's projects; hashed (§12.5)
  created_at       TIMESTAMP
)

-- One row per project the class runs. A 2nd project = a 2nd row here.
-- This is the unit the dashboard view and name-retention attach to.
class_projects (
  id               TEXT PRIMARY KEY,
  class_id         TEXT REFERENCES classes(id),
  project_slug     TEXT,            -- the project DEFINITION ('pixel-game' ->
                                    -- projects/pixel-game.json). NOT a FK to projects(id).
  name_clear_after DATE,            -- when student names auto-delete, per project run (§5)
  created_at       TIMESTAMP
)

-- Identity row = one student's project INSTANCE for one project run (code = one project, §3.2).
-- Distinct from class_projects.project_slug, which names the shared definition this instances.
-- Name lives here, separate from project content, so deletion just nulls it (§5).
projects (
  id               TEXT PRIMARY KEY,     -- the instance id; current_state/snapshots FK to this
  class_project_id TEXT REFERENCES class_projects(id),
  student_code_hash TEXT UNIQUE NOT NULL,-- login lookup; globally unique (§12.5)
  student_code_enc TEXT NOT NULL,        -- code encrypted at rest, unlocked by teacher code (§12.5)
  display_name     TEXT,                 -- nullable; auto-cleared 12mo after completed_at (§5)
  current_version  INTEGER NOT NULL DEFAULT 0,
  last_writer      TEXT,                 -- session token of last writer
  last_saved_at    TIMESTAMP,
  completed_at     TIMESTAMP             -- set when TEACHER marks the run complete; starts the
                                         -- 12mo name-retention clock and triggers compaction
)

-- Latest content, overwritten each save. No PII (FK only).
current_state (
  project_id      TEXT PRIMARY KEY REFERENCES projects(id),
  content         TEXT NOT NULL,         -- the assembled .py ONLY (v1). Self-check/pill
                                         -- state is NOT persisted in v1 (unused feature).
  version         INTEGER NOT NULL,
  updated_at      TIMESTAMP
)

-- Append-only history. No PII (FK only). Compacted to milestones after completion.
snapshots (
  id              BIGSERIAL PRIMARY KEY,
  project_id      TEXT REFERENCES projects(id),
  version         INTEGER NOT NULL,
  content         TEXT NOT NULL,
  writer_session  TEXT,                  -- to surface cross-laptop divergence
  is_milestone    BOOLEAN DEFAULT FALSE, -- survives compaction
  created_at      TIMESTAMP
)
```

Naming note: the table that couples a class to one project is `class_projects` (a *project run*), not `classes`. `classes` is the durable cohort (school, roster, teacher code); `class_projects` is "this cohort doing pixel-game this term"; `projects` is one student's instance within that run.

### 12.5 Auth at rest

Student codes serve two jobs that pull in opposite directions: **login lookup** (no teacher present) and **reprinting** (teacher present). So each student code is stored **twice**:

- `student_code_hash` — for **login**: the server hashes the typed code and finds the project row. No teacher code needed. This is also the column the brute-force rate-limit (§11) protects.
- `student_code_enc` — for **reprinting**: the code **encrypted at rest**, decryptable only when the **teacher code unlocks it**. The decryption key is derived from the teacher code at request time (KDF) and never stored, so a database dump alone does not reveal student codes, only a teacher presenting their cohort's code can decrypt them for a reprint. (Simpler fallback if key-derivation is fiddly: encrypt with a server secret and gate the reprint endpoint behind teacher-code auth; weaker, but still "encrypted at rest, unlocked by the teacher code" in spirit.)
- **Teacher codes** are stored **hashed** (`teacher_code_hash`), one shared hash per cohort, never reprinted by the system (the owner mints and hands them out). Many-to-many access is by sharing the code (§3.4). **No per-teacher revocation in v1** (confirmed); rotating a leaked code means re-minting and re-wrapping the cohort's `student_code_enc`.

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

- **Cost:** trivial at this scale (2 classes, ~56 students). Peak write load ~56 kids × a save every ~10-30s ≈ low tens of thousands of writes per session; storage is tens of MB before compaction. Throttling snapshots (§12.2) keeps both in check. Comfortably inside a managed Postgres free/hobby tier (e.g. Supabase free tier).

**Compliance target: parity with Grok Academy.** WA schools already use Grok Academy for student flows, so the pragmatic bar is to match its security posture rather than reason from first principles or chase a higher one. Grok's published posture (verified June 2026, [groklearning.com/policies/security](https://groklearning.com/policies/security/)):

- **All Grok platform data is stored in Australia, in the Sydney AWS region.**
- **Encrypted at rest and in transit.**
- Hosted on **AWS**; where PII sits in third-party services, those are **Australian data centres, encrypted at rest and in transit**.

This settles two things from the earlier draft:

- **AU region + encryption is the bar; full "Australian-owned sovereignty" is not required.** Grok runs on AWS (a US-owned cloud) in the Sydney region, the exact "AU residency, not AU-owned" posture WA schools have already accepted. The US CLOUD Act nuance is therefore **moot for our purposes**: the approved incumbent runs on the same footing. The "Australian-owned provider" tier is dropped.
- **Supabase Sydney reaches parity directly, because Supabase runs on AWS.** Choosing `ap-southeast-2` puts us on the same infrastructure footing as Grok.

**Parity checklist (design requirements):**

1. **All student data in the AWS Sydney region** (`ap-southeast-2`). Matches Grok. (§12.1)
2. **Encrypted in transit** (TLS to the Supabase endpoint) **and at rest** (Supabase/AWS default AES-256). Make this an explicit requirement, not an assumption.
3. **Any sub-processor that touches student data is Australian-hosted and encrypted.** Keep the sub-processor list short; if email/PDF/etc. services are added, choose AU-hosted ones. We have no analogue to Grok's Microsoft Dynamics educator-PII sync, so the sub-processor surface is smaller.
4. **Publish a short security/privacy page** mirroring Grok's (where data lives, encryption, retention, deletion) for the school's online-services assessment.

Because parity allows AU-hosted encrypted student PII, **storing `display_name` in the AU-region DB is acceptable** (Grok stores student PII in AWS Sydney too). Keeping names off the server entirely (§4/§5) becomes an *optional* extra-minimisation, not a requirement. Name retention auto-delete (§5) still applies as good practice.

- **Action before build:** hand the school's privacy/ICT contact the §12.7 parity page and confirm "matches Grok's posture" clears their online-services assessment.

### 12.8 Deploy & local dev

- **Frontend:** unchanged. Static `npm run build` → Cloudflare Pages, with existing per-branch previews.
- **Data tier:** a Supabase project (Sydney region). Schema as plain SQL migrations (`supabase/migrations/*.sql`) applied via the Supabase CLI; local dev runs the Supabase stack in Docker. Scheduled jobs via `pg_cron`.
- Two origins now, so the frontend calls the Supabase endpoint over CORS (standard) instead of same-origin `/api`.

### 12.9 Storage primitives: the onshore (Supabase) stack, with the Cloudflare variant

**Chosen (WA government / onshore):** Postgres + Supabase Storage + `pg_cron` + PostgREST/RPC, all in **Sydney (`ap-southeast-2`)**.

| Need | Onshore (chosen) | Cloudflare-only variant (non-gov schools) |
|---|---|---|
| Relational system of record (roster, last-saved times, codes, version pointers) and the snapshot/current content as TEXT | **Postgres** (Supabase, Sydney) | D1 (serverless SQLite, `--location=oc`) |
| Blob outputs: cover-sheet PDFs (§4), `.py` exports (§9), canvas PNGs | **Supabase Storage** (in-region) | R2 (`oc` hint) |
| Scheduled jobs: name auto-deletion (§5), compaction (§6) | **`pg_cron`** | Cron Triggers |
| In-region API / auth | **PostgREST + `SECURITY DEFINER` RPC + RLS** (code-as-capability); browser calls Sydney endpoint over CORS | Pages Functions (same-origin), code in URL path |
| Real-time multi-device sync | Not needed v1; append-only model suffices (Postgres serializes same-row writes) | Not needed v1; Durable Objects would be the upgrade path |

**Content placement decision for v1 (unchanged):** keep snapshot/current content as **TEXT in Postgres**, not object storage. Splitting content into Storage makes a save two non-atomic writes (object PUT + row pointer), which complicates the single-confirm durability contract for no benefit at this scale. Object storage is for file-like outputs only; "snapshots → object storage" is a documented migration path, not v1.
