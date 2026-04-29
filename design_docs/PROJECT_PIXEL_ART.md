# Pixel Art Project — Design

> Status: **draft v2** — iterating on the per-function-editor model.
> Scope: convert the existing WS7 "Drawing with Code" worksheet into the first project deliverable for the 10-week course. Project runs across weeks 8–10; students save a single `.py` file they can take home.

---

## 1. Shape of the project

The page presents one **task per editable text area**, not one big file. Each task has its own small CodeMirror editor that holds a single function body. Students never see (or can mangle) the full source — they fill in `draw_corners`, then `draw_border`, then `on_left_key`, and the harness stitches the whole thing into a runnable Python program behind the scenes.

Page layout:

- **Canvas** at the top, big and central.
- **"Run Project"** button (singular — there is no per-task run button).
- **Vertical stack of task cards.** Each card has:
  - Title + guidance prose ("Colour the four corners…").
  - A read-only header line showing the function signature (`def draw_corners():`) so students see what they're filling in.
  - A small editor (CodeMirror) holding only the *body* of that function. Indented one level. Students can't change the signature line.
  - A status pill (✓ pass / ✗ fail / open-ended) updated after each run.
- **Save / Open** buttons on the page header, reusing the scratchpad's File System Access flow.
- **Direction-pad** (4 on-screen buttons: ← ↑ → ↓) under the canvas. Pressing a button calls the corresponding `on_*_key()` then re-runs `draw_scene()`. Buttons rather than physical arrow keys because (a) CodeMirror eats the arrows when the editor has focus and (b) iPad and touch laptops get parity for free with mouse-click users.

Visual hint that all editors run together: a continuous **left rail** (a 4px coloured stripe) runs down the left edge of every task card and connects them, so the cards read as panels of a single program rather than independent problems. The "Run Project" button at the top can pulse the rail green→top-to-bottom on a successful run, reinforcing "all of these execute together, in order".

This model trades flexibility (students can't add their own helper functions) for safety (they cannot break the project structurally — no missing colons, mis-indented blocks, or accidentally-deleted function defs that nuke the whole program).

## 2. Save file format

A plain `.py` file. Header comment marks it as a Wavelet project; the rest is just Python. Crucially, the file runs anywhere — students can show parents or paste into IDLE.

The file is the **on-disk** representation; the editing UI is a structured view of it. On Save, JS assembles the file from the editors. On Open, JS parses the file back into editors (see §10).

```python
# Wavelet Pixel Art Project
# https://wavelet.zone/projects/pixel-art
# Student: ____
# Saved:   2026-04-29

use_canvas(GRID20)
state = {'x': 10, 'y': 10}

# ── Task 1: corners ───────────────────────────────
def draw_corners():
    """Color all four corners of the canvas."""
    # YOUR CODE HERE
    pass

# ── Task 2: border ────────────────────────────────
def draw_border():
    """Draw a coloured border around the edge."""
    # YOUR CODE HERE
    pass

# ── Task 3: your scene ────────────────────────────
def draw_scene():
    """Build the static picture. Called once at start, and after every key press."""
    draw_border()
    draw_corners()
    # add more here!

# ── Task 4: respond to keys ───────────────────────
def on_left_key():
    """Do something cool when the left arrow is pressed."""
    pass

def on_right_key():
    pass

def on_up_key():
    pass

def on_down_key():
    pass
```

The harness owns all the structural lines (function signatures, the `state` dict, the `use_canvas(...)` call). Students only contribute function bodies. The on-disk file is fully formed Python — runnable anywhere — but the editing UI never gives them the rope to break the structure.

## 3. Harness execution model

When the student clicks **Run Project**:

1. Reset Python; load `canvas-system.js` shims.
2. **Assemble** the program by concatenating, in fixed order:
   - The fixed harness preamble (`use_canvas(GRID20)`, the shared `state = {...}` dict, any imports).
   - For each task: `def {function_name}():\n` followed by the editor's contents indented one level. If the editor is empty, insert `    pass` so the def is still valid.
3. `pyodide.runPythonAsync(assembled_code)` — defines all functions and sets up state.
4. Call `draw_scene()` from JS. Commands buffer up.
5. Flush canvas — the static scene appears.
6. Wire up the direction-pad buttons. On a button click:
   - Call the relevant `on_*_key()` function.
   - Call `draw_scene()` again (so the picture rebuilds from scratch — no need for the student to track diffs).
   - Flush.

   **Reset between presses, not paint-on-top.** Every press re-runs `draw_scene()` from a cleared canvas. Persistent state (player position, score, etc.) is held in the preamble's `state` dict, which `draw_scene` reads.

This "fully redraw on every event" model is much simpler than diffing and is fine at 20×20.

For per-task validation (the green tick on each card), the harness runs each guided function **in isolation** on a hidden offscreen canvas, then checks the resulting `_canvas_state['grid']` against the expected one. Same `solution_code` rule type the worksheets already use — we just call one function instead of evaluating top-level code.

**Indent / syntax safety net.** Even with the def line locked, students can still produce a `SyntaxError` inside the body (mismatched indents, an unterminated string). The assembler catches and surfaces these per-editor: if `compile()` of the wrapped function fails, that task's status pill goes red with the error message, and the harness substitutes `pass` for that one body so the rest of the project still runs. Students see "Task 3: SyntaxError on line 2" instead of a project-wide explosion.

## 4. Animation: turtle-style trace replay

The user's idea: instead of every `draw()` snapping instantly, the student's commands play back over time so the picture *draws itself*. This sells the "I made an animation" feeling without needing a real `setInterval` loop in Python.

Mechanism — trivial extension of the existing command buffer:

- `draw()` already appends to `_canvas_state['commands']`.
- Today: JS flushes the whole buffer to the canvas in one tick (`flushCanvas`).
- Change: add a `replaySpeed` mode where JS walks the command list with `setInterval(…, ms)` instead of in one synchronous loop. UI exposes this as a slider or a "✏️ Animate drawing" toggle on the run button.

For keypress responses, we *also* play back the resulting frame as an animation, so left-arrow visibly "redraws" the new state. Optional per-handler annotation if we want to suppress this (e.g. `@instant` decorator? probably not for v1).

This is **not** a real animation loop — there's no `for t in range(60)` running every frame. That's Phase 2 (frame buffering, ROADMAP). We're trading expressiveness for simplicity: keypresses change state, and the redraw plays back nicely.

## 5. Mapping current WS7 problems → project tasks

| WS7 problem            | Becomes |
|------------------------|---------|
| Your First Pixel       | Discarded — covered by the "intro" prose at the top of the project page. |
| Draw a Horizontal Line | Folded into a "warm-up" mini-task before Task 1. |
| Color the Corners      | **Task 1: `draw_corners()`** — validated (4 specific cells, any colour). |
| First Loop Drawing     | Hint inside Task 2 (border uses a loop). |
| Vertical Line w/ Loop  | Hint inside Task 2. |
| Create a Rainbow       | Optional extension task ("rainbow background"). |
| Fill a Square          | Hint inside Task 5 (drawing a player/object). |

Net result: WS7 disappears from `worksheets/index.json`; its didactic content lives inline as scaffolding around the function stubs. Students who never did WS7 can still attempt the project — the prose teaches the same coordinate concepts on the way in.

## 6. Grid choice

Add `GRID20` (20×20, ~25px cells, gridlines on, no coordinate labels — they'd be too cramped). `GRID3` is too small for a scene; `GRID100` is too big to draw by hand. Also leaves room for animations without overwhelming visual noise.

## 7. Project schema (sketch)

A project JSON now describes only **the harness frame** plus **per-task editor metadata** — student code lives in editors at runtime and gets stitched in at run time, not stored in the JSON.

```jsonc
{
  "id": "project-pixel-art",
  "title": "Pixel Art Animation",
  "intro": "<p>Build a tiny scene that comes alive when you press arrow keys…</p>",
  "canvas": "GRID20",

  // Lines the harness always emits, before any student code. Students never see
  // or edit these directly — they're rendered as a small read-only "Setup"
  // chip at the top of the page so kids know they exist.
  "preamble": [
    "use_canvas(GRID20)",
    "state = {'x': 10, 'y': 10}"
  ],

  "tasks": [
    {
      "id": "corners",
      "title": "Colour the corners",
      "function": "draw_corners",
      "guidance": "<p>Each corner is a single <code>draw(x, y, colour)</code> call…</p>",
      "starterBody": "draw(0, 0, 'red')\n# add the other three corners\n",
      "editorHeight": 6,
      "validation": {
        "rules": [
          { "type": "function_fills_cells",
            "cells": [[0,0],[19,0],[0,19],[19,19]],
            "anyColor": true
          }
        ]
      }
    },
    {
      "id": "border",
      "title": "Draw a border",
      "function": "draw_border",
      "guidance": "<p>Use a <code>for</code> loop to walk all four edges…</p>",
      "starterBody": "for x in range(20):\n    draw(x, 0)\n# now do the other three sides\n",
      "editorHeight": 8,
      "validation": {
        "rules": [
          { "type": "function_fills_cells", "cells": "border", "anyColor": true }
        ]
      }
    },
    {
      "id": "scene",
      "title": "Build your scene",
      "function": "draw_scene",
      "guidance": "<p>This runs every time you press a key. Call your other tasks here, plus anything else you want.</p>",
      "starterBody": "draw_border()\ndraw_corners()\n# what else lives in your scene?\n",
      "editorHeight": 8,
      "validation": { "rules": [ { "type": "function_runs_clean" } ] }
    },
    {
      "id": "left-key",
      "title": "On left arrow: do something cool",
      "function": "on_left_key",
      "guidance": "<p>Anything you like. Move a character (<code>state['x'] -= 1</code>)? Change colours? It's your project.</p>",
      "starterBody": "# YOUR CODE HERE\npass\n",
      "editorHeight": 6,
      "validation": { "rules": [ { "type": "function_runs_clean" } ] }
    }
    // ... right-key, up-key, down-key follow the same shape
  ]
}
```

Two new validation rule kinds — `function_fills_cells` and `function_runs_clean` — extend the existing system, used only by projects.

### 7a. Validation rule semantics (locked)

**`function_fills_cells`** — "after running this function (and *only* this function) on a fresh canvas, did the listed cells end up coloured?"

```jsonc
{
  "type": "function_fills_cells",
  "cells": [[0,0],[19,0],[0,19],[19,19]],
  "anyColor": true,        // optional: ignore colour, only check positions
  "exact": true            // optional: require *only* these cells, no extras
}
```

Per-question knobs let us be strict where it matters and loose where the student's creativity should pass:

- **Hello-world "Colour the corners"**: `exact: true, anyColor: true` — exactly four cells, positions locked, any colour the student chose.
- **"Draw a border"**: `exact: true, anyColor: true` against the full ring of edge cells.
- **Free-form decoration tasks (if any later)**: `exact: false, anyColor: true` — student must hit the listed cells but is free to add more.

**`function_runs_clean`** — "calling this function with no args raises no exception".

- Empty body (`pass`) → ✓ green. An empty creative slot is a valid in-progress state.
- Body that runs without error → ✓ green.
- Body that raises → ✗ red, with the error surfaced on the card.

This rule is what backs every open-ended task (`on_left_key`, `draw_scene`, etc.).

## 8. Build order

A tractable v1 build, in dependency order:

1. **GRID20** in `canvas-system.js` (one config object) — 5 min.
2. **Project JSON** sketched above — content work, no plumbing.
3. **Project page (`project.html` + `project.js`)** — *new* layout: header, canvas, run button, vertical stack of task cards each with its own CodeMirror, direction-pad, file save/open. Reuses `code-executor.js`, `canvas-system.js`. ~1 day.
4. **Code assembler** — concatenate preamble + each task's wrapped body into one Python program; per-task `compile()` for the syntax safety net described in §3. ~half-day.
5. **Per-function validation runner** — call one function in isolation on a hidden canvas, compare grid. New `function_fills_cells` and `function_runs_clean` rule types. ~half-day.
6. **Direction-pad wiring** — four buttons, on click call `on_*_key()` then `draw_scene()` then flush. ~1 hour.
7. **File save/open** — assemble file on save; on open, parse with Python's `ast` (in Pyodide) to extract function bodies back into editors; backfill missing functions from `starterBody`; stash unknown top-level code in a read-only "Extras" panel. ~half-day.
8. **Polish**: dirty indicator, left-rail visual, run-success rail pulse, loose-header "open anyway?" banner.
9. **Remove WS7** from `worksheets/index.json`, update course outline status.

**Deferred past v1:** turtle-style animated replay (the `setInterval` walk of the command buffer). The default is instant flush; we'll revisit once the rest of the project flow is stable and we've watched real students use it.

## 9. Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Function-signature visibility | **Option A**: greyed read-only `def name():` line at the top of each editor; body editable, indented one level. |
| 2 | Reset vs. paint-on-top between key events | **Reset.** Every key press re-runs `draw_scene()` on a freshly cleared canvas. |
| 3 | Persistence between events | **Plain global variables** in an editable Setup section, named `player_x = 10`, `player_y = 10`. Students write `player_x -= 1` directly in handlers; the harness auto-injects `global player_x, player_y, …` at the top of every wrapped function body that *assigns* to one of those names (`Assign`/`AugAssign`/`AnnAssign` targets only, never just references — and `For.target` is excluded). Two earlier iterations got this wrong: a `state` dict (rejected — dictionaries weren't taught), and plain `x`, `y` (rejected — `for x in range(20)` in `draw_border` collided with the global, leaving `x = 19` after every redraw and breaking left/right movement). The `player_` prefix removes the bug class by naming. The `use_canvas(GRID20)` line stays locked but isn't shown in the Setup card UI — students don't need to see it. |
| 4 | Validation strictness | Per-rule knobs (`exact`, `anyColor`) so we tighten the hello-world corners task and loosen creative ones. `function_runs_clean` passes on `pass`. |
| 5 | On-disk parsing | `ast` walk of top-level `FunctionDef`s. Missing functions → backfill from `starterBody`. Unknown top-level code → read-only "Extras" panel, preserved on save. |
| 6 | Replay-while-typing | **Off by default; deferred past v1.** Big "Run Project" button does an instant flush. |
| 7 | Input mechanism | **On-screen direction-pad** (4 HTML buttons) under the canvas — works on iPad/touch and avoids the CodeMirror-eats-arrow-keys problem. No physical-key binding in v1. |
| 8 | Save-file header | **Loose.** Marker comment is helpful but optional; non-marker files open with a "doesn't look like a Wavelet project, open anyway?" banner. |
| 9 | Helper functions | **Not in v1.** If a student wants reuse, they call other task functions from `draw_scene`. We add a "Your own helpers" slot only if a class outgrows this. |

---

Design is locked. Items 1–9 in §8 are independently shippable in order; each leaves the project in a runnable state.
