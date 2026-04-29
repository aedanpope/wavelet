# Pixel Art Project — Design

> Status: **draft** — first sketch after Apr 2026 teacher convo. Not yet implemented.
> Scope: convert the existing WS7 "Drawing with Code" worksheet into the first project deliverable for the 10-week course. Project runs across weeks 8–10; students save a single `.py` file they can take home.

---

## 1. Shape of the project

A project is **one long Python file** the student edits over several lessons, structured around a fixed set of named functions. The page provides:

- A persistent **code editor** preloaded with scaffolding (function stubs, comments, imports).
- A **canvas** above the editor that re-renders whenever the student runs the project.
- A **task panel** down the side listing the guided objectives ("draw the four corners", "draw a border", "make something happen on left arrow"). Some are validated; some are open-ended and just check the function exists / doesn't crash.
- **Save / Open** buttons backed by the File System Access flow already shipped in the scratchpad.
- **Keyboard input area** (a focusable region under the canvas) so left/right/up/down arrow keys drive the student's `on_*_key()` functions.

The student is **not** clicking through problems sequentially. They scroll through one file, fill in each function as they go, and re-run the whole project to see it animate.

## 2. Save file format

A plain `.py` file. Header comment marks it as a Wavelet project; the rest is just Python. Crucially, the file runs anywhere — students can show parents or paste into IDLE.

```python
# Wavelet Pixel Art Project
# https://wavelet.zone/projects/pixel-art
# Student: ____
# Saved:   2026-04-29

use_canvas(GRID20)

THEME = 'sunset'   # try: 'sunset', 'forest', 'ocean', 'space'

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

The harness only cares that these specific function names exist. Anything else the student adds (helper functions, variables, comments) is preserved in the saved file. The file is the source of truth — we don't store anything project-specific in localStorage.

## 3. Harness execution model

When the student clicks **Run Project**:

1. Reset Python; load `canvas-system.js` shims.
2. `pyodide.runPythonAsync(student_code)` — defines all functions, sets `THEME`, calls `use_canvas(GRID20)`.
3. Call `draw_scene()` from JS. Commands buffer up.
4. Flush canvas — the static scene appears.
5. Bind keyboard listeners on the canvas's focus zone. On a key event:
   - Call the relevant `on_*_key()` function.
   - Call `draw_scene()` again (so the picture rebuilds from scratch — no need for the student to track diffs).
   - Flush.

This "fully redraw on every event" model is much simpler than diffing and is fine at 20×20.

For per-task validation (the green tick in the side panel), the harness runs each guided function **in isolation** on a hidden offscreen canvas, then checks the resulting `_canvas_state['grid']` against the expected one. Same `solution_code` rule type the worksheets already use — we just call one function instead of evaluating top-level code.

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

A new `project-pixel-art.json` (or similar) with a structure adjacent to but distinct from worksheets:

```jsonc
{
  "id": "project-pixel-art",
  "title": "Pixel Art Animation",
  "intro": "<p>Build a tiny scene that comes alive when you press arrow keys…</p>",
  "canvas": "GRID20",
  "starterFile": "projects/pixel-art-starter.py",
  "tasks": [
    {
      "id": "corners",
      "title": "Colour the corners",
      "function": "draw_corners",
      "guidance": "<p>Each corner is a single <code>draw(x, y, colour)</code> call…</p>",
      "validation": {
        "rules": [
          { "type": "solution_code",
            "solutionCode": "draw(0, 0, 'red')\ndraw(19, 0, 'red')\ndraw(0, 19, 'red')\ndraw(19, 19, 'red')",
            "scope": "function"   // run only this function, ignore colour, just check 4 corner cells filled
          }
        ]
      }
    },
    {
      "id": "border",
      "title": "Draw a border",
      "function": "draw_border",
      "guidance": "<p>Use a <code>for</code> loop to walk all four edges…</p>",
      "validation": {
        "rules": [
          { "type": "function_fills_cells",
            "cells": "border",         // helper that expands to all edge cells
            "anyColor": true
          }
        ]
      }
    },
    {
      "id": "left-key",
      "title": "On left arrow: do something cool",
      "function": "on_left_key",
      "guidance": "<p>Anything you like. Move a character? Change colours? It's your project.</p>",
      "validation": {
        "rules": [
          { "type": "function_runs_clean" } // open-ended: just check it doesn't error
        ]
      }
    }
    // … etc
  ]
}
```

Two new validation rule kinds — `function_fills_cells` and `function_runs_clean` — extend the existing system, used only by projects.

## 8. Build order

A tractable v1 build, in dependency order:

1. **GRID20** in `canvas-system.js` (one config object) — 5 min.
2. **Starter `.py` file** + project JSON sketched above — content work, no plumbing.
3. **Project page (`project.html` + `project.js`)** — clone of `worksheet.html` shape, but: single editor, single canvas, side-panel task list, file save/open. Reuses `code-executor.js`, `canvas-system.js`, `progress-store.js`. ~half-day.
4. **Per-function validation runner** — extract one function from student code, run it on hidden canvas, compare grid. Builds on existing `solution_code` validator. ~half-day.
5. **Keyboard binding** — focus div under canvas, listen for arrow keys, dispatch to the right Python function. ~1 hour.
6. **Animated replay** — toggle `flushCanvas` to walk commands on `setInterval` instead of synchronously. ~1 hour.
7. **Polish**: dirty indicator, save flow, "Open project" reads any `.py` file with the right header.
8. **Remove WS7** from `worksheets/index.json`, update course outline status.

## 9. Open questions for the next conversation

1. **Task validation strictness.** "Drew at least 4 corner cells" vs. "drew exactly the corner cells in any colour" vs. "matched the example exactly". Erring loose feels right for a project (the student's creative choices should pass), but the corner task in particular is well-defined and could be strict.
2. **Reset between key presses.** Is the model "redraw scene from scratch every time" (simple, what I sketched) or "press handler accumulates draws on top of previous state"? The latter is more like a paint program; the former lets students do real animation by tracking position in a `state` dict.
3. **Where state lives.** If the student moves a character with arrow keys, the position must persist. A `state = { 'x': 10, 'y': 10 }` global dict is the simplest hand-off — but we should pre-declare it in scaffolding so they don't fight Python's scoping rules. Worth showing them `state['x'] += 1` instead of `global` keyword.
4. **Replay-while-typing.** When students iterate, do they want the slow turtle replay every time, or only when they explicitly toggle "Animate"? I'd default OFF (instant) and have a toggle for show-off mode.
5. **Save header — strict or loose?** If we expect a specific comment header to identify a "Wavelet project file", do we refuse to load files without it, or just warn? Loose is friendlier.
6. **iPad keyboard.** Arrow keys on a touch device need on-screen buttons. Add to v2; for v1 mention as a known gap in teacher pack.

---

Once these are pinned down, items 1–8 in §8 are independent enough to do incrementally with student-visible progress at every step.
