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
- A teacher may belong to more than one class / term.

---

## 4. The cover sheet / progress-pack front page

One printable page per student, doubling as the physical anchor of the whole project:

- Student name + friendly project title ("Sam's Pixel Game").
- The **word-based code**.
- A **QR code** that, when scanned (parent's phone, iPad, any camera device), opens the **running game in a mobile web view** so the student can show family at home.
- A **short typeable URL directly below the QR** for loading the project on a laptop, since scanning a screen QR at a Windows laptop is awkward and most classroom laptops have no easy scanner. **Typed code/URL is the in-class path; QR is the take-home / touch-device path.**
- A small **milestone checklist** the teacher can tick by hand.

Whole-class print is a **single PDF**.

---

## 5. Student names & PII minimisation

- Names are stored in a **separate table from the project content**, linked by code, so the project bytes are **non-PII by construction**.
- The name field is **optional, editable, and appendable later** (a teacher can pass a class list up front to mint one code per name, and still add or correct names afterward).
- Names **auto-delete on a schedule** some months after the project is complete. Because the name lives in its own table, deletion is just nulling a field and never touches the work.
- The schedule is **visible to the teacher** ("names for this class auto-clear on 2026-12-01") with a one-click **extend**.

---

## 6. Versioning & concurrent writes

- Every **debounced autosave** (after a few seconds of inactivity, not per keystroke) writes a new **version**. The full history is browsable: "restore this version."
- This **dissolves the concurrent-write problem**: if the same code is open on two laptops, a later write never silently clobbers an earlier one, because both are versions and either is recoverable. Surface it as "this project was also edited on another laptop, keep both?" rather than a silent loss.
- After a project is marked complete, history is **compacted to milestones** to control disk bloat.
- Opportunity (would-be-nice, not v1): a **"watch your project grow" replay** at the end of the unit, reusing the version timeline and the existing trace player from `scratchpad.js` for a delightful showcase moment.

---

## 7. Teacher dashboard

- **"Is everyone saving?"** — show last-saved time per student so the teacher can spot the one laptop that is silently failing to save **before** work is lost. Highest-value teacher view, and cheap once versions exist.
- **Reprint a lost card** in seconds: search by name, reprint one cover sheet. Cards will get lost; recovery has to be trivial.
- **Bulk actions**: generate-class-from-list, print-all-cards (one PDF), export-all-work, end-of-term cleanup.
- **Browse / restore versions** for a student (recovery, and handling the concurrent-edit "keep both" case).

---

## 8. Owner-level data controls

Since we now hold a database:

- **Delete this student** and **export this student** paths, so a parent or school request can be answered cleanly.
- Visibility into retention (when names auto-clear) and the ability to act on it.

---

## 9. Take-home & artifacts

- Keep the existing **`.py` export** so a kid can show parents or open the file in IDLE. The take-home story no longer *depends* on the file (the QR + code do that), but the file stays as a nice artifact.
- **Showcase print** (would-be-nice): a "print my finished project" sheet with the rendered canvas image plus the code, for the progress pack or the fridge.

---

## 10. v1 cut vs. later

**v1 (in-class survival):**
- Per-student word-based, typo-safe codes + name confirmation on entry.
- Cover-sheet print (name, title, code, QR to mobile game view, short typeable laptop URL, milestone checklist); whole-class PDF.
- Server as hard source of truth; **no offline mode** (block rather than risk loss).
- Continuous autosave with full version history; restore.
- Teacher dashboard: last-saved times, reprint a card, generate class from list, browse/restore versions.
- Names in a separate table with scheduled auto-delete + teacher-visible date and extend.
- Teacher code minted by owner; no teacher login.
- Owner data controls: delete / export a student.
- `.py` export retained.

**Later (nice-to-have):**
- "Watch your project grow" replay (reuse version timeline + trace player).
- Showcase print (canvas image + code).
- Concurrent-edit "keep both" branch UI beyond basic version recovery.

---

## 11. Open / deferred

- **Architecture / hosting** is deliberately *not* decided here. The brainstorm settled UX requirements first. The friction table in `ROADMAP.md` already floated candidates (Cloudflare Workers, serverless, Supabase); pick when we move from requirements to build.
- Exact **code scheme** (word list size, check-word vs. check-digit, minimum edit distance) to be specified when we build §3.1.
- Retention window length for §5 (how many months after completion).
- Whether the teacher dashboard's progress view should fold in the broader **Phase 3 "Assessment"** goals from `ROADMAP.md` (per-problem pass/fail export), since both want a teacher-facing progress surface.
