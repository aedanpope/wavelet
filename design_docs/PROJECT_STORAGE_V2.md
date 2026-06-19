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

- **Architecture / hosting** is deliberately *not* decided here. The brainstorm settled UX requirements first. The friction table in `ROADMAP.md` already floated candidates (Cloudflare Workers, serverless, Supabase); pick when we move from requirements to build.
- Exact **code scheme** (word list size, check-word vs. check-digit, minimum edit distance) to be specified when we build §3.1.
- Retention window length for §5 (how many months after completion).
- Whether the teacher dashboard's progress view should fold in the broader **Phase 3 "Assessment"** goals from `ROADMAP.md` (per-problem pass/fail export), since both want a teacher-facing progress surface.
