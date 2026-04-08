# Wavelet Zone — Roadmap

> Rough planning document. Phases are loosely sequential but not strictly gated.

---

## Current State (as of Apr 2026)

- 6 worksheets (arithmetic → variables → loops → conditionals → strings → drawing)
- In-browser Python via Pyodide, no accounts/server
- Worksheet validation system, execution trace in scratchpad
- localStorage progress, version-stamped cache clearing

---

## Phase 1 — Content Completion (near-term)

Goal: get to a complete, teachable course before adding infrastructure.

**Worksheets 7–10+ (topics TBD, possible order):**
- Lists & indexing
- Functions & reuse
- Dictionaries / data structures
- Mini-project worksheet (open-ended, ties concepts together)

**Teacher support materials** (alongside each worksheet):
- Worksheet guide: learning objectives, common mistakes, teaching notes
- Answer key with explanation of each validation rule
- Printable PDF versions of worksheets for offline use or assessment
- Format TBD — could be markdown + print stylesheet, or a separate `/teacher` route behind a simple passphrase

---

## Phase 2 — Graphics & Games

Goal: let students build things that look like real programs.

**Canvas-based graphics** (most viable path):
- Expose a `draw_*` API (`draw_rect`, `draw_circle`, `draw_line`, `fill`, `clear`) that maps to an HTML `<canvas>` element alongside the code editor
- Avoid pygame — it requires SDL via Emscripten and is very heavy. Pyodide has no native pygame support. Better: a thin Python shim that calls JS canvas via `pyodide.globals`
- Alternatively: look at `p5.py` or a custom turtle-style API

**Game loop support:**
- Requires async/requestAnimationFrame integration with Pyodide — non-trivial
- Likely needs a dedicated "game mode" worksheet type with its own runner
- Keyboard input needs special handling (block browser shortcuts, capture events)

**Key decision:** scoped graphics API students learn vs. free-form canvas. Scoped is safer for primary students and easier to validate.

---

## Phase 3 — Assessment

Goal: give teachers a way to see how students are doing without a backend.

**Option A — Export/share (no backend):**
- "Download progress report" button → generates a JSON or PDF summary of completed problems + student code
- Teacher collects files (e.g. via Google Classroom assignment submission)
- Simple, zero infrastructure

**Option B — Shareable result link:**
- Encode completed state + code snippets into a URL (base64/compressed)
- Student shares link with teacher
- Works up to ~2–4KB of code before URLs get unwieldy

**Option C — Lightweight backend:**
- Simple POST endpoint stores a submission keyed by student name + worksheet
- Teacher dashboard reads submissions
- Adds deployment complexity but enables real-time visibility
- Could use a free tier (Cloudflare Workers, Vercel serverless, Supabase)

**Recommendation:** start with Option A, add Option C when teacher demand is clear.

**Grading features:**
- Per-problem pass/fail is already tracked — expose this in the export
- Rubric notes field per problem (teacher-facing, in the worksheet JSON)
- Auto-grade vs. manual review flag per problem

---

## Phase 4 — Persistent Projects

Goal: let students build something over multiple sessions.

**The login friction problem:**
- Full auth (Google, etc.) is the smoothest UX but adds significant complexity and privacy considerations (primary school students)
- Options ranked by friction:

| Approach | Friction | Complexity |
|---|---|---|
| localStorage only (current) | Zero | Zero — but lost on device change |
| Download/upload save file | Low | Low — student saves a `.wavelet` file, uploads to resume |
| Device-local key (crypto) | Low | Medium — generate a UUID stored in localStorage, use as a "save code" students write down |
| Teacher-managed class codes | Medium | Medium — teacher creates a class, students enter a code, backend stores progress |
| OAuth (Google/Microsoft) | Low for students, high setup | High — needs backend, privacy policy, school IT approval |

**Recommendation:** download/upload save file first — it's offline-friendly, no accounts, no server, and familiar to students who've used Scratch or similar. A "save code" approach (short alphanumeric key students copy) is a good second step if teacher feedback shows file management is a problem.

**Project worksheet type:**
- New `"type": "project"` block in worksheet JSON
- Persistent canvas state + code across sessions
- Milestone checkpoints (structured like problems but less prescriptive)

---

## Key Technical Decisions to Revisit

| Decision | Options | Notes |
|---|---|---|
| Graphics API | Custom canvas shim, turtle, p5.py | Evaluate pygame-web / pygbag as an option for game mode |
| Assessment storage | File export, URL encoding, backend | Defer backend until there's a clear use case |
| Auth/persistence | Save file, short code, OAuth | Save file is the pragmatic first step |
| Teacher materials | Markdown + print CSS, separate app | Keep simple, avoid a second codebase |
| Worksheet count | 10 core + optional extensions? | Nail 10 solid ones before scope creep |

---

## Not Yet Scoped

- Accessibility (screen readers, keyboard navigation for code editor)
- Localisation / non-English support
- Mobile/tablet optimisation (CodeMirror on touch is rough)
- Student-facing progress dashboard across worksheets
- Embeddable worksheet player (for school websites)
