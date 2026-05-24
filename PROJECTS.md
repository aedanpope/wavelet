# Project Authoring Guide

This document captures the design principles, constraints, and editorial cadence behind Wavelet's **projects**. It is the project-side companion to `WORKSHEETS.md`. Anyone (human or AI) drafting a new project should read both, because most of what makes a worksheet good also makes a project good, but the format, the time budget, and the assessment model are different in ways that change how you design tasks.

For the concrete example everything here is being calibrated against, see the Pixel Game design (`design_docs/PROJECT_PIXEL_GAME.md`) and its content (`projects/pixel-game.json`).

---

## Before You Start a New Project

1. **Read `WORKSHEETS.md`.** Projects re-use the same vocabulary (concept cards, validation rules, starter code, hints) and aim at the same students. The differences below are layered on top.
2. **Read every existing project JSON.** As with worksheets, skim is not enough. Internalise the cadence of the task list and how tasks step from "fully specified" through to "make it your own".
3. **Pin down which worksheets the project comes after.** A project should lean on concepts the class has already covered. List the concepts you expect to use, and circle the one or two you'll need to introduce inline.
4. **Sketch the take-home artefact first.** Projects exist so a student has something to show a parent. Before you design tasks, decide what the finished `.py` file does when run and what the canvas/output looks like. The tasks then work backwards from that artefact.

---

## What a Project Is (and Isn't)

A **project** is a multi-session deliverable the student iterates on, saves to a single `.py` file, and takes home. Worksheets are the floor (everyone gets through them with validated, scaffolded problems). Projects are the ceiling (something open-ended the student owns).

| | Worksheet | Project |
|---|---|---|
| Duration | One class (1 hour), occasionally two | **Three supervised classes** (3 x 1h) |
| State | Stateless, per-problem | A single `.py` file the student saves and re-opens |
| Granularity | 24-30 small problems | 6-10 tasks, mixed difficulty |
| Concept scope | One major concept (+ sub-concepts) | Uses skills from prior worksheets; **may introduce 1-2 new concepts inline** if the project needs them (e.g. `dict`-style state, event handlers) |
| Validation | Tight on early problems, loose on creative | Tiered: tight on the D-tier tasks, loose on C-tier, minimal on A/B-tier |
| Platform | Worksheets must work on iPad (touch + on-screen keyboard) | **Laptop-only.** See "Platform constraint" below. |
| Outcome | Pass/fail per problem, progress bar | Teacher-graded **D / C / A-B** based on which tier of tasks the student completed |
| Show-off factor | Low (the worksheet is the lesson) | **High.** The artefact is the point: print it, screenshot it, demo it. |

---

## Project Constraints

### Time budget: 3 x 1-hour supervised classes

Plan tasks for a self-paced upper-primary student to complete the D-tier and C-tier work in roughly **two** classes, with the third reserved for the creative A/B-tier and polishing. This is not a strict allocation:

- A D-only student should still be able to finish *something they're proud of* in three classes.
- A fast student should run out of *required* work by mid-class 2 and spend the rest of the time on A/B creative tasks.
- "Supervised" means a teacher is in the room and can unstick a stuck student. It does **not** mean the teacher has time to write code for individual students. The task scaffolding has to do most of the unblocking work.

### Concept budget

Default: **only use concepts already taught in worksheets the class has finished.** If the project genuinely needs something new (e.g. `dict`-style attribute access on a state object for Pixel Game, or `import random` for the quiz brief), introduce it inline via a concept card placed *before the first task that uses it*. Keep new-concept count to **one or two per project, maximum.** If you want a third, you probably want a new worksheet.

This is the analogue of the worksheet rule "don't introduce more than one new concept per problem". The project equivalent is: don't ambush students with a pile of unfamiliar syntax on top of an already-bigger task.

### Platform: laptop only

Projects are **laptop-only.** Worksheets target iPad too (a deliberate choice for the validated, finger-tappable problem flow), but projects don't:

- The project page is the most code-heavy surface in the platform, multiple editors stacked vertically, plus file save/open. iPad Safari has known UX gaps (no overwrite on save, awkward keyboard for `_`, `:`, `[`, etc.) that punish a multi-week project.
- Restricting to laptop **unlocks real keyboard input** as a design tool. Projects can use arrow keys, letter keys, `Enter`, etc., for input instead of on-screen buttons. (The Pixel Game currently uses on-screen direction-pad buttons; future projects, and potentially Pixel Game v2, can take physical key events now that we've dropped the touch requirement.)
- It also means we can rely on a real `Tab` key for editor indentation, copy-paste shortcuts, and the dev-tools workflow during teacher demos.

Capture this in the project page UI: a small "best on a laptop" notice for any student who lands on the project from an iPad, with a link to switch to a worksheet instead.

### Take-home artefact

Every project produces a single `.py` file. The file:

- **Runs inside Wavelet.** It is not a standalone Python program; it depends on the project harness (canvas shims, locked preamble, event wiring). To demo at home, a parent uploads the file to the same project page on `wavelet.zone` and clicks Run. We don't try to make the file paste-able into IDLE / Thonny / `python3`, because doing so would force harness shims into the file at the cost of clarity and student-readable structure.
- **Has a marker comment** (`# Wavelet ... Project`) so Open can re-hydrate it, but is *loose* about it: a file without the marker still opens with a warning, so students who tweak the header don't get locked out.
- **Round-trips through the editing UI.** Save assembles the file from the editors; Open parses it back via Python `ast`. If we can't round-trip a file faithfully, we can't expect students to take work between sessions.

> **TODO (sharing):** investigate encoding the assembled `.py` into a share link (gzip + base64url in a URL hash fragment) that hydrates the project when opened. One payload, two surfaces: render as a QR for a printed take-home sheet, and as a plain `https://` link for email / messaging. Falls back to file upload if the code overflows URL/QR capacity.

---

## Project Structure: Coding Areas + Task Checklist

This is the **central structural decision** for projects. A project is not a sequence of independent problems (that's a worksheet). It's:

1. **A small number of coding areas** (editors / functions / sections) that together make up the program.
2. **A checklist of tasks** that direct the student to fill in or extend those coding areas.

The two are decoupled: one editor can be the target of multiple tasks ("fill in `draw_background`" + "add three more shapes to `draw_background`" + "make `draw_background` change colour each frame"), and one task can touch multiple editors ("on the up button, also bump the score in the State section").

### Why this split

In a worksheet, each problem is a self-contained editor with a single right answer. In a project, the student is building **one program**, so the editors have to live together and call each other. But the program is too big to give as a single empty editor (most students would freeze). Splitting into named editors with locked structure gives:

- A safety net (locked function signatures, locked preamble, see `PROJECT_PIXEL_GAME.md` §3).
- An obvious shape (the student sees `draw_corners`, `draw_border`, `draw_scene` as the skeleton of the program before writing any code).
- An iteration surface (tasks point at specific editors; the student doesn't have to navigate a 200-line file).

### How tasks reference coding areas

- A task always **names the function(s) or editor(s) it's about** (`function: "draw_corners"` in the JSON, or `functions: ["on_left_key", "on_right_key", "on_up_key", "on_down_key"]` for a cross-area task).
- A task's `guidance` should explain *what to put in those areas* (and optionally why, and what success looks like).
- A task can declare validation rules that run against the named area(s), or behavioural rules that check whole-project state after simulated events.
- Open-ended tasks ("decorate the background", "make the up button do something cool") still reference at least one specific editor; they just relax the validation to `function_runs_clean` (does it execute without an error) or rely on a self-check tick (see "Status pills" below).

### Task : area cardinality

The 1:1 case (one task -> one area) is the default and the right shape for almost all D-tier work. The model deliberately allows other cardinalities for higher-tier tasks:

| Cardinality | Example | Tier fit |
|---|---|---|
| **1 task -> 1 area** | "Colour the corners" edits only `draw_corners` | D (always), most C |
| **Many tasks -> 1 area** | Same `draw_background` editor with three tasks pointing at it: (D) "draw a row at the bottom", (C) "use a `for` loop to fill a stripe", (A-B) "make it your own" | Lets a single area carry a progressive ladder |
| **1 task -> many areas** | "Stop the player at the walls" edits all four `on_*_key` bodies | C+ and A-B only |
| **1 task -> 0 areas** | "Read the coordinate card, then tick when ready" | Pacing checkpoints for D students |
| **0 tasks -> 1 area** | The freestyle "your additions" editor with no task pointing at it | Pure A-B surface |

**Rule of thumb:** D-tier tasks stay strictly 1:1. Cross-area or many-to-one is reserved for C-tier and above, and the task card must list every area it touches as chips so the student knows where to type.

---

## The Three-Tier Task Model (D / C / A-B)

Projects are graded by the teacher into three bands, calibrated to roughly match the bell curve of an upper-primary class:

| Tier | Who | What they can do | Task style |
|---|---|---|---|
| **D** | Bottom of the class, students who need scaffolding to stay engaged | Complete a **fully specified** task with examples, instructions, and supervision | Step-by-step. Worked example in the guidance. Tight validation. The student copies the example, edits coordinates, runs it. |
| **C** | Middle of the class, the bulk of students | Complete a **specified** task without step-by-step instructions | Goal stated. No worked example. Hint available. Validation checks the *output*, not the structure. The student picks the approach. |
| **A-B** | Top ~25%, students who finish early | Complete an **unspecified** (creative) task | Prompt only. "Make it your own." Loose validation, often just `function_runs_clean`. Teacher grades on what was built, not on auto-checks. |

This is the project equivalent of the worksheet's "first third / middle third / final third" difficulty curve, but with two important differences:

- **Every project has tasks at every tier.** A worksheet ramps difficulty over time; a project offers all three tiers throughout, so every student can engage.
- **A student "completes" a project at whatever tier they reach.** D-tier students who do the D tasks and nothing else have a complete, runnable, take-home project. C and A-B work is additive on top.

### Designing D-tier tasks

- **Fully specified.** The task is the recipe; the student executes it.
- **Worked example in the guidance** showing exactly what to type for at least one case (e.g. "the bottom-left corner is `draw(0, 0, 'red')`. Add the other three.").
- **Tight validation** so the student gets a green tick when they're done (`exact: true` for cell-fill tasks, `solution_code` for closed-form tasks).
- **Concrete success criterion** the teacher can eyeball: "all four corners coloured", "border around the canvas".
- **Should be doable in 5-10 minutes** if the student follows the recipe.

D-tier examples in Pixel Game: "Colour the corners" (`exact: true, anyColor: true` against 4 named cells); "Draw a border" (`exact: true` against the border ring).

### Designing C-tier tasks

- **Specified, but not step-by-stepped.** "Build the scene by calling your other functions, in the right order." The student has to choose the order, but doesn't have to invent it from scratch.
- **No worked example for the main move**, but **brief hints** for the sub-steps (e.g. "remember, later draws appear on top").
- **Loose validation** (`function_runs_clean`, `output_contains`) so the validator says "your code ran" without prescribing how.
- **Concept reminders inline.** Don't re-teach, but flag the prior worksheet concept the student needs to recall ("use a `for` loop to walk all four edges").

C-tier examples in Pixel Game: "Build the scene" (call the other functions in order); "Draw the player" (use `state.player_x/y`, draw a single cell, optionally extend).

### Designing A-B tier (creative) tasks

- **Unspecified.** "Do something cool when the up button is pressed." No prescribed shape.
- **Multiple example directions** in the guidance so a blank-page student gets unstuck, but **no canonical answer**. ("Move the player? Change a colour? Paint a streak? It's up to you.")
- **Minimal validation.** `function_runs_clean` is usually enough. The teacher grades on what the student built.
- **Should be repeatable.** A student who finishes one creative task should be able to extend it ("add another shape to your background", "make the down button do something different").

A-B examples in Pixel Game: "Draw the background" (blank-slate creative decoration with `function_runs_clean`); the four `on_*_key` slots.

### Validation maps to tiers

| Tier | Typical validation rules | Failure UX |
|---|---|---|
| D | `function_fills_cells` with `exact: true`, `solution_code`, `function_spec` | Green validated tick on completion, red box with diff if wrong |
| C | `function_fills_cells` with `exact: false`, `output_contains`, `function_runs_clean` + a structural requirement (`code_contains "for"`); **behavioural rules** for cross-area tasks (e.g. "after `on_left_key`, `state.player_x` decreased") | Green tick or "your code ran, here's what it drew" |
| A-B | `function_runs_clean` paired with a self-check tick | Self-checked tick on student confirmation; runtime errors surfaced on the area card |

The `function_runs_clean` rule passes on an empty body so that an in-progress creative slot is not flagged red. This matches the worksheet rule of pairing a requirement with a correctness check, *except* that for creative tasks there is no automatic correctness check, by design.

**Cross-area tasks** validate against whole-project behaviour, not a single function's output. Rules like `after_keypress` (simulate pressing left, assert `state.player_x` decreased) or `state_changes` (run the project, assert a named variable updated) live on the task itself rather than on any one area, because the student is free to implement the behaviour wherever they like.

---

## Anatomy of a Project Page

The Pixel Game is the reference layout. Future projects can deviate but should justify why.

The page is **two-column** on the task surface: tasks on the left, coding areas on the right. This matches the worksheet eye-path students already know (read on the left, type on the right) and lets the two card types specialise: task cards talk about *intent*, area cards talk about *mechanics*.

```
┌──────────────────────────────────────────────────────────────┐
│  Header: title, Save / Open buttons                          │
├──────────────────────────────────────────────────────────────┤
│  Intro prose (1-3 short paragraphs)                          │
├──────────────────────────────────────────────────────────────┤
│  Canvas (centred, big)                                       │
│  Run Project button                                          │
│  Direction-pad (or other input widget)                       │
├──────────────────────────────────────────────────────────────┤
│  Setup section (state variables, editable)                   │
│  Locked preamble shown as a read-only chip                   │
├──────────────────────── BAND 1: 1:1 pairs ───────────────────┤
│  TASKS (left)                  │  AREAS (right)              │
│  [D] Corners                   │  draw_corners() editor      │
│  [D] Border                    │  draw_border() editor       │
│  [D] Add a stripe   ┐          │                             │
│  [C] Use a for loop ┤          │  draw_background() editor   │  ← many tasks -> 1 area
│  [A-B] Make it yours┘          │                             │
│  [C] Build the scene           │  draw_scene() editor        │
│  [D] Draw the player           │  draw_player() editor       │
│  [D] Left button               │  on_left_key() editor       │
│  [D] Right button              │  on_right_key() editor      │
│  [D] Up button                 │  on_up_key() editor         │
│  [D] Down button               │  on_down_key() editor       │
├──────────────────── BAND 2: cross-area tasks ────────────────┤
│  Full-width task cards with area chips. No 1:1 partner.      │
│  [C] Stop at the walls    (touches: on_left, on_right, ...)  │
│  [A-B] Add a score        (touches: setup, scene, keys)      │
├──────────────────── BAND 3: freestyle ───────────────────────┤
│  [A-B] Invent something        │  your_additions editor      │
└──────────────────────────────────────────────────────────────┘
```

The three bands give every student tier a place to focus, and let a teacher tier-grade with one top-to-bottom sweep: required pairs (Band 1) -> behaviour-shaped extensions (Band 2) -> evidence of independent thinking (Band 3).

A few load-bearing details:

- **One "Run Project" button.** Not per-task. The project runs as one program; per-task runs are for hidden validation only.
- **Locked function signatures.** Students fill in bodies. They cannot delete a `def`, break indentation at the function level, or accidentally nuke the structure. See `PROJECT_PIXEL_GAME.md` §3.
- **Locked preamble.** Anything structurally critical (`use_canvas(...)`, imports) lives in a read-only chip the student can see but not edit. Editable state lives below it.
- **Concept cards inline.** Same `"type": "concept"` block worksheets use. Place before the first task that needs the concept. Same "1-2 sentences body, 1 example, 1-line footer" rule applies. Concept cards span the full width (no right-column partner).
- **Cross-area highlighting.** When a Band 2 task card is focused, the area editors it touches get a subtle highlight border so the student can find them.

### What goes on each card

**Task card (left column):**
- Tier badge (D / C / A-B), visually distinct per tier
- Title, guidance prose
- Hint button (optional)
- For Band 2 cards: chips listing the areas the task touches
- **Status pill** (see below)
- No code

**Area card (right column):**
- Function signature header (locked, read-only)
- Editor body
- A one-line "About this area" descriptor of the *mechanics* ("Called once per render, runs before `draw_player`.")
- A small **syntax-error badge** if the body fails to compile (distinct from any task's pass/fail state, because syntax errors are area-shaped not task-shaped)
- No prose about *what to do*: that's the task's job

### Status pills: validated vs self-checked

Every task carries a status pill. There are **two visually distinct kinds** because teachers need to tell them apart at grading time:

- **Validated tick** (solid green check). Earned by a programmatic rule passing: `function_fills_cells`, `function_runs_clean`, behavioural rule, etc. The student didn't tick this; the harness did.
- **Self-checked tick** (outlined check with a small "self" label). The student ticks a checkbox on the card to mark the task done. Used when the task can't be machine-validated (creative work, "read this concept card", "show your teacher").

Which kind a task uses follows the tier:

| Tier | Pill style |
|---|---|
| **D** | Validated only. **Never self-check** — D students will tick reflexively to chase completion, which defeats the validation. |
| **C** | Validated by default. Self-check allowed when the task's success criterion is genuinely subjective (rare). |
| **A-B** | Usually self-check (often paired with `function_runs_clean` so the runtime sanity check still happens). Validated only when there's a concrete behavioural test that fits. |

---

## Editorial Principles

Most of `WORKSHEETS.md`'s "Editorial Principles" apply unchanged: short content, direct tone, concrete examples, hints that unblock instead of solve, no em-dashes. The project-specific overlays:

- **Frame every task with what tier it sits in**, in your head if not on the page. If you can't say whether a task is D, C, or A-B, the guidance is probably ambiguous.
- **Give the student permission to skip.** A-B tasks should say "if you want" or "your call" so a D-tier student doesn't feel they've failed by leaving the creative slot at `pass`.
- **The intro prose sells the project.** Worksheet intros explain what the student will learn. Project intros explain what the student will *build*, and why it's cool. ("Build your own pixel-game scene that animates when you press the arrow buttons.")
- **Don't bury the deliverable.** The artefact (canvas, file, screenshot) is the point; tasks are the path to it. Order the page so the artefact is visible first, tasks below.
- **Inline new-concept introductions are concept cards, not paragraphs.** If the project needs `state.x` style attribute access, put it in a concept card before the first task that uses it, not in the task's `guidance`. This makes it visually distinct and re-readable.

---

## Differences from Worksheets (Recap)

Quick reference for what a project author should *not* copy from `WORKSHEETS.md`:

- **No Run -> Edit -> Write -> Apply cycle per concept.** Projects are not concept-introduction surfaces. They're applications. If you find yourself building a Run-Edit-Write ramp, that's a sign the concept belongs in a worksheet, not a project.
- **No 24-30 problem count.** Aim for **6-10 tasks**, plus 1-2 concept cards if you're introducing something new.
- **No "creative challenge as the last problem" structure.** Creative tasks (A-B tier) are interleaved with required tasks, not bolted on at the end.
- **No "complete every problem" expectation.** A student finishes a project when they hit a stopping point they're happy with, not when every box is green. D-tier students will leave A-B tasks at `pass`; that's a complete D-tier project.
- **No iPad support.** Worksheets are tested on iPad; projects are not. Build for laptop and keyboard.

---

## Checklist for Reviewing a New Project

Before finalising a new project, verify:

- [ ] The project fits in **3 x 1-hour supervised classes** for a self-paced student
- [ ] **Every task is taggable as D, C, or A-B.** No ambiguous-tier tasks
- [ ] **D-tier tasks have a worked example in the guidance** and tight validation
- [ ] **C-tier tasks state the goal without prescribing the approach** and have loose-but-real validation
- [ ] **A-B tier tasks offer multiple example directions** and use self-check pills (with `function_runs_clean` as a runtime safety net)
- [ ] The required (D + C) tasks alone form **a complete, runnable, take-home program**
- [ ] **D-tier tasks are strictly 1 task : 1 area.** Cross-area tasks are tier C or above
- [ ] **The project has a freestyle "your additions" area** with at least one A-B task pointing at it
- [ ] **Status pills visibly distinguish** validated ticks from self-check ticks
- [ ] **At most 1-2 new concepts** are introduced inline, each via a concept card before its first use
- [ ] Every concept used (new or recalled) is **already taught in worksheets the class has finished**, or covered by an inline concept card
- [ ] **Function signatures are locked** in the UI; the student can't structurally break the file
- [ ] **The locked preamble** holds everything the harness needs; students don't get blank-line surprises
- [ ] The on-disk `.py` file demos by **upload to the project page**, not standalone interpretation
- [ ] **Save and Open round-trip** the file faithfully (no lost code, no scrambled order)
- [ ] The project page has a **"laptop recommended"** notice for iPad users
- [ ] The intro **sells the artefact** in 1-3 short paragraphs
- [ ] **No em-dashes** anywhere in JSON, guidance, or concept cards (use commas, colons, parentheses)
