# Wavelet Zone — Roadmap

> Rough planning document. Phases are loosely sequential but not strictly gated.

---

## Current State (as of Apr 2026)

- 5 solid worksheets (arithmetic → variables → loops → conditionals → strings)
- Worksheet 6 "Drawing with Code" exists but is not yet ready (animation infra incomplete — see below)
- In-browser Python via Pyodide, no accounts/server
- Worksheet validation system, execution trace in scratchpad
- localStorage progress, version-stamped cache clearing
- Refactored modular JS: `ProgressStore`, `TracePlayer`, `ProblemRenderer`

---

## Worksheet Sequence (agreed Apr 2026)

```
WS1  The Python Calculator       ✅ ready
WS2  Storing Your Numbers        ✅ ready
WS3  Making Things Repeat        ✅ ready
WS4  Making Decisions            ✅ ready
WS5  Working with Text           ✅ ready
WS6  Lists & Indexing            🔲 to build
WS7  Drawing with Code           🔧 infra in progress (see below)
WS8  Functions                   🔲 to build
WS9  Interactive I               🔲 to build (depends on WS7 infra)
WS10 Interactive II / Animation  🔲 to build (depends on WS9)
```

**Rationale for this order:**
- Lists before drawing — students can use lists for coordinates/colours, and it's a natural step from WS5 strings (both are sequences)
- Drawing as mid-course payoff — visual/fun reward before functions
- Functions after drawing — students have a concrete motivation ("DRY my drawing code") rather than learning abstraction in a vacuum
- Interactive last — builds on all prior concepts; complexity justifies the late position

---

## Phase 1 — Content Completion (near-term)

Goal: get to a complete, teachable course before adding infrastructure.

### WS5 iteration: comma-separated print args
WS5 teaches f-strings and string concatenation but never introduces `print('a', var, 'b')` with comma-separated arguments. This is a gap: WS6 uses it for `print('I have', len(animals), 'pets')` and it appears naturally in `print(i, animals[i])` for index-based iteration. A short run-then-edit pair should be added to WS5 (after the f-string section, before loops+f-strings) showing that `print()` can take multiple comma-separated values separated by spaces.

### WS6: Lists & Indexing (next to build)
Key concepts: creating lists, indexing (`list[0]`), negative indexing, `len()`, iterating with `for`, `append()`.
Scope to decide: whether slicing makes it in here or moves to WS8/WS9.

### WS7: Drawing with Code (infra first — see Phase 2)
Current `canvas-system.js` already uses **command buffering** — `draw(x, y, color)` appends to `_canvas_state['commands']`, JS flushes after execution. Works well for static drawing problems.
The animation problem: `show()` is currently a no-op until execution ends, so multi-frame loops never render intermediate frames.
WS7 only needs static drawing — the current infra is nearly sufficient. Main gap is deciding the final API surface and whether to keep the grid model or move to pixel/vector.

### WS8: Functions
Key concepts: `def`, parameters, return values, calling functions, reuse. Motivated by "make a reusable draw command".

**Teacher support materials** (alongside each worksheet):
- Worksheet guide: learning objectives, common mistakes, teaching notes
- Answer key with explanation of each validation rule
- Printable PDF versions of worksheets for offline use or assessment
- Format TBD — could be markdown + print stylesheet, or a separate `/teacher` route behind a simple passphrase

---

## Phase 2 — Graphics & Animation Infra

Goal: unblock WS7–WS10 with a solid, learner-friendly drawing API.

### Current canvas system
- Grid-based: `GRID3` (3×3, large cells) and `GRID100` (100×100, pixel-sized cells)
- Python API: `use_canvas(GRID3)`, `draw(x, y, color)`, `clear()`, `show()`
- Command buffering already in place — draw commands queue in Python, JS flushes to `<canvas>` after execution
- Static drawing works; animation does not (Pyodide blocks main thread, `requestAnimationFrame` can't interleave)

### Animation options (ranked by fit)

**Option A — Frame buffering (recommended for WS9–10):**
Student writes a `draw_frame(t)` function; JS calls it N times to build a list of frame snapshots, then plays them back with `setInterval`. No real-time loop, no threading. Fits the command-buffer model already in place.

**Option B — P5.js callbacks:**
Define `setup()` and `draw()` in Python, JS calls them via Pyodide bridge on each `requestAnimationFrame`. Possible but fragile — `draw()` must complete in <16ms or it jitters, and Python startup overhead per call is significant.

**Option C — Web Worker + SharedArrayBuffer:**
Run Pyodide in a worker, share frame data via `SharedArrayBuffer`. Proper isolation and smooth playback. High implementation complexity — not worth it for primary school scope.

**Decision (Apr 2026):** Use command buffering (Option A) for WS7 static drawing. Revisit frame buffering for WS9–10 animation when WS7 is stable.

### Scoped API vs free-form
Keep the scoped grid API for WS7 (easier to validate, maps to coordinate concepts from maths). For WS9–10 consider adding `move_to(x, y)` / `line_to(x, y)` turtle-style commands as an extension layer on top of the existing system.

### Sub-expression tracing in scratchpad

Worksheet traces are hand-authored JSON and can include any number of steps per line (e.g. an `eval` step showing `fruits[0] → 'apple'` before the `print` step). The scratchpad's dynamic tracer (`buildTraceScript()` in `scratchpad.js`) currently uses `sys.settrace()` which only fires on line events — it cannot observe sub-expression evaluation.

To bring sub-expression steps to the scratchpad:
- **Best approach: AST rewrite.** Before execution, walk the AST and instrument indexing (`Subscript`), function calls, and compound expressions by wrapping them in a recording helper. The AST infrastructure is already in `buildTraceScript()` (it already walks for-loops, if-statements, and print calls). Extending it to `Subscript` nodes and nested calls is the natural next step.
- **Not recommended:** `f_trace_opcodes` (Python 3.7+) can trace every bytecode op, but mapping opcodes back to meaningful evaluation steps is complex and noisy.
- **Priority:** Low — worksheet traces cover the teaching need. Revisit when WS8+ introduces function calls where sub-expression tracing becomes more valuable.

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
| Graphics API | Command buffering (chosen), frame buffering for animation | pygame-web/pygbag ruled out — too heavy for primary school scope |
| Assessment storage | File export, URL encoding, backend | Defer backend until there's a clear use case |
| Auth/persistence | Save file, short code, OAuth | Save file is the pragmatic first step |
| Teacher materials | Markdown + print CSS, separate app | Keep simple, avoid a second codebase |
| Worksheet count | 10 core + optional extensions? | Nail 10 solid ones before scope creep |

---

## Not Yet Scoped

- **AST-based validation** — WS6 exposed the limits of pattern matching: `code_contains` can't distinguish `fruits[2]` (read) from `fruits[2] = 'mango'` (assignment), and students can hack output-based checks with hardcoded prints. Pyodide includes Python's `ast` module — parsing student code into an AST would enable checks like "code contains an assignment to a list index" or "code uses a for loop that iterates over a list variable." See VALIDATION.md Phase 4 notes.
- Accessibility (screen readers, keyboard navigation for code editor)
- Localisation / non-English support
- Mobile/tablet optimisation (CodeMirror on touch is rough)
- Student-facing progress dashboard across worksheets
- Embeddable worksheet player (for school websites)
