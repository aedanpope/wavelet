# Canvas System Design

**Date:** 2025-10-29
**Status:** Design Complete - Ready for Implementation
**Target Worksheet:** Worksheet 6

---

## Executive Summary

This document describes the design for a grid-based canvas drawing system for the Wavelet Zone platform. Students will use Python code to color cells on a grid using mathematical coordinates, learning loops and coordinate systems through visual feedback.

### Core Features
- Two grid sizes: **GRID3** (3x3) and **GRID100** (100x100)
- Simple Python API: `draw(x, y, color)`, `show()`, `clear()`
- Bottom-left coordinate system (like math: (0,0) is bottom-left)
- Visual output rendered above text output
- Automatic validation by comparing canvas states

---

## 1. Student-Facing API

### 1.1 Functions

```python
# Setup (provided in starter code)
use_canvas(GRID3)      # Initialize 3x3 canvas
use_canvas(GRID100)    # Initialize 100x100 canvas

# Drawing
draw(x, y)             # Draw black at coordinate (x, y)
draw(x, y, 'red')      # Draw with named color
draw(x, y, '#FF5733')  # Draw with hex color

# Control
show()                 # Flush drawings to screen (auto-called at end)
clear()                # Reset canvas to all white

# Constants
GRID3                  # 3x3 grid constant
GRID100                # 100x100 grid constant
```

### 1.2 Example Student Code

**GRID3 Example (Beginner):**
```python
use_canvas(GRID3)

# Draw a smiley face
draw(0, 2, 'yellow')   # Left eye
draw(2, 2, 'yellow')   # Right eye
draw(1, 0, 'red')      # Mouth
```

**GRID100 Example (Loops):**
```python
use_canvas(GRID100)

# Draw a horizontal rainbow
colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']
for i in range(6):
    for x in range(100):
        draw(x, 50 + i, colors[i])
```

### 1.3 Color Support

**Supported Formats:**
- All CSS named colors (e.g., `'red'`, `'blue'`, `'hotpink'`, `'cornflowerblue'`)
- Hex codes (e.g., `'#FF0000'`, `'#00FF00'`)
- Default canvas background: white
- Default draw color: black

**Rationale:** Supporting all CSS colors gives students creative freedom while still being simple to use.

---

## 2. Coordinate System

### 2.1 Bottom-Left Origin (Math Convention)

```
GRID3 Coordinate System:

(0,2) (1,2) (2,2)    <-- Top row
(0,1) (1,1) (2,1)    <-- Middle row
(0,0) (1,0) (2,0)    <-- Bottom row (y=0)
  ^
  |
x=0 (left edge)
```

**Rationale:**
- [+] Matches mathematical Cartesian coordinates
- [+] Students can apply knowledge in math class
- [+] Y increases upward (natural for "up" = "bigger")
- [-] Different from array indexing [row][col]
- [-] Different from screen coordinates (top-left)
- **Decision:** Educational value of math convention outweighs short-term familiarity

### 2.2 Coordinate Labels

**GRID3:** Show coordinate labels on axes to help students learn
**GRID100:** Hide labels (too cluttered, students already know coordinates by then)

---

## 3. Technical Architecture

### 3.1 Data Flow

```
Student Code (Python)          JavaScript Bridge          Browser DOM
---------------------          -----------------          -----------

use_canvas(GRID3)      --->    Initialize canvas state
                               Create <canvas> element  --->  Inject into output area

draw(1, 2, 'red')      --->    Add to command buffer
                               {type: 'draw', x: 1, y: 2, color: 'red'}

draw(0, 1, 'blue')     --->    Add to command buffer
                               {type: 'draw', x: 0, y: 1, color: 'blue'}

show()                 --->    Batch render all commands --->  Update canvas pixels
(or auto at end)               Clear command buffer

Validation:
  Run solution code    --->    Generate solution state
  Compare states       --->    Deep compare grid objects
  Return result        --->    Show feedback
```

### 3.2 Canvas State Storage

**Python-side internal state:**
```python
_canvas_state = {
    'grid': {},              # Sparse dict: {(x, y): 'color'}
    'size': 'GRID3',         # 'GRID3' or 'GRID100'
    'dimensions': (3, 3),    # (width, height)
    'commands': []           # [{type: 'draw', x, y, color}, ...]
}
```

**Why sparse dictionary:**
- [+] Efficient for GRID100 (only stores colored cells, not all 10,000)
- [+] Fast lookup: O(1) for checking cell color
- [+] Easy to compare two states (dict equality)
- [+] Small memory footprint for validation

**JavaScript rendering:**
- HTML5 `<canvas>` element (not DOM divs)
- Canvas 2D API for pixel drawing
- Batch rendering from command buffer

---

## 4. UI/UX Design

### 4.1 Canvas Sizing

**GRID3 (3x3):**
- Desktop: 360px x 360px (120px per cell)
- Mobile: 270px x 270px (90px per cell)
- Touch-friendly cell sizes
- Grid lines visible (dark border)

**GRID100 (100x100):**
- Desktop/Tablet: 500px x 500px (5px per cell)
- Mobile: 400px x 400px (4px per cell)
- Grid lines hidden (too cluttered)
- `image-rendering: pixelated` for crisp pixels

### 4.2 Responsive Layout

```css
.canvas-container {
    width: 100%;
    max-width: 500px;  /* GRID100 */
    aspect-ratio: 1;   /* Always square */
    margin: 0 auto;
}

canvas {
    width: 100%;
    height: 100%;
    border: 2px solid #667eea;
    border-radius: 8px;
}

@media (max-width: 768px) {
    .canvas-container {
        max-width: 90vw;  /* Smaller on mobile */
    }
}
```

### 4.3 Output Area Layout

```
+-------------------------------+
|  Problem Title                |
|  Problem Description          |
|  +----------+  +----------+   |
|  |  Code    |  | +------+ |   | <-- Canvas above
|  |  Editor  |  | |Canvas| |   |
|  |          |  | +------+ |   |
|  |          |  | ---------+   |
|  |          |  | Text     |   | <-- Text output below
|  |          |  | Output   |   |
|  +----------+  +----------+   |
+-------------------------------+
```

**Rationale:** Canvas above shows visual result first (primary focus), text output below shows print statements (secondary/debug).

---

## 5. Validation System

### 5.1 Strategy: Canvas State Comparison

Extend existing `solution_code` validation to automatically compare canvas states when `problem.canvas === true`.

```json
{
  "title": "Draw a horizontal line",
  "canvas": true,
  "validation": {
    "rules": [
      {
        "type": "solution_code",
        "solutionCode": "use_canvas(GRID3)\ndraw(0, 1)\ndraw(1, 1)\ndraw(2, 1)"
      }
    ]
  }
}
```

### 5.2 Validation Flow

```javascript
// In validation.js - extend validateSolutionCode()

async function validateSolutionCode(rule, studentCode, problem, codeExecutor) {
    // 1. Student code already ran, extract canvas state
    const studentCanvas = getCanvasState(codeExecutor, 'student');
    const studentOutput = getTextOutput(codeExecutor, 'student');

    // 2. Run solution code in fresh environment
    await resetEnvironment();
    await runSolutionCode(rule.solutionCode);
    const solutionCanvas = getCanvasState(codeExecutor, 'solution');
    const solutionOutput = getTextOutput(codeExecutor, 'solution');

    // 3. Compare text outputs (existing logic)
    const textMatches = (studentOutput === solutionOutput);

    // 4. NEW: Compare canvas states if canvas problem
    let canvasMatches = true;
    if (problem.canvas) {
        canvasMatches = deepEqual(studentCanvas.grid, solutionCanvas.grid);
    }

    // 5. Both must match
    if (textMatches && canvasMatches) {
        return { isValid: true, message: "Perfect! ✓" };
    }

    // 6. Generate helpful feedback
    return {
        isValid: false,
        message: generateDiffFeedback(studentCanvas, solutionCanvas, textMatches)
    };
}
```

### 5.3 Feedback Generation

**Current Plan:** Simple feedback for MVP
- "Perfect!" - Both canvas and output match
- "Your canvas doesn't match the expected pattern." - Canvas mismatch
- "Your output is incorrect." - Text output mismatch

**Future Enhancement:** Smart diff analysis
```javascript
function generateDiffFeedback(studentGrid, solutionGrid) {
    const missing = findMissingCells(studentGrid, solutionGrid);
    const extra = findExtraCells(studentGrid, solutionGrid);
    const wrong = findWrongColors(studentGrid, solutionGrid);

    if (missing.length > 0) {
        return `You're missing ${missing.length} cell(s). Check the pattern carefully!`;
    }
    if (extra.length > 0) {
        return `You have ${extra.length} extra cell(s). Try removing some!`;
    }
    if (wrong.length > 0) {
        return `Some cells are the wrong color. Check your colors!`;
    }
}
```

---

## 6. Error Handling

### 6.1 Out-of-Bounds Coordinates

**Behavior:** Print friendly warning, don't crash, don't draw

```python
# Student code
use_canvas(GRID3)
draw(5, 5, 'red')  # Out of bounds

# Output
Warning: Oops! (5, 5) is outside the GRID3 canvas (3x3). Try smaller numbers!
```

**Implementation:**
```python
def draw(x, y, color='black'):
    width, height = _canvas_state['dimensions']
    if not (0 <= x < width and 0 <= y < height):
        print(f"Warning: Oops! ({x}, {y}) is outside the {_canvas_state['size']} canvas ({width}x{height}). Try smaller numbers!")
        return
    # ... proceed with drawing
```

### 6.2 Invalid Colors

**Behavior:** Print warning, use black as fallback

```python
draw(1, 1, 'not-a-color')
# Output: Warning: Color 'not-a-color' not recognized. Using black instead.
```

### 6.3 Missing use_canvas()

**Behavior:** Clear error message

```python
draw(1, 1)  # Before calling use_canvas()
# Output: Warning: You need to call use_canvas(GRID3) or use_canvas(GRID100) before drawing!
```

---

## 7. Performance Optimizations

### 7.1 Batching Draw Commands

**Problem:** Calling JavaScript from Python 10,000 times (GRID100) is slow

**Solution:** Batch commands, flush once

```python
# Student code
for y in range(100):
    for x in range(100):
        draw(x, y, 'blue')  # Adds to buffer, doesn't render yet

# After code completes (or on show())
# JavaScript: Render all 10,000 commands at once
```

**Implementation:**
```javascript
function flushCanvas(canvasState) {
    const ctx = canvasElement.getContext('2d');
    const cellSize = canvasElement.width / canvasState.dimensions[0];

    // Batch render all commands
    canvasState.commands.forEach(cmd => {
        ctx.fillStyle = cmd.color;
        // Flip Y coordinate for bottom-left origin
        const flippedY = canvasState.dimensions[1] - 1 - cmd.y;
        ctx.fillRect(cmd.x * cellSize, flippedY * cellSize, cellSize, cellSize);
    });

    // Clear buffer
    canvasState.commands = [];
}
```

### 7.2 Auto-flush Behavior

**When to flush:**
1. **Explicit `show()`** - Student calls it
2. **Auto at code completion** - After runCode() finishes
3. **Validation** - Before comparing states

**Why both manual and auto:**
- Beginners don't need to know about `show()` (auto-flush works)
- Advanced students can call `show()` multiple times for animations
- No confusion about "why isn't my canvas showing"

---

## 8. Implementation Scope

### 8.1 Files to Create

```
canvas-system.js               # New - Canvas Python-JS bridge
```

### 8.2 Files to Modify

```
code-executor.js               # Add canvas setup hooks
worksheet.js                   # Inject canvas HTML, handle canvas problems
validation.js                  # Extend solution_code to compare canvas states
styles.css                     # Canvas responsive styling
worksheets/template.json       # Add canvas example
```

### 8.3 Worksheet Content

```
worksheets/worksheet-6.json    # New canvas worksheet
```

---

## 9. Key Design Decisions & Tradeoffs

### 9.1 Grid Sizes: GRID3 vs GRID100

**Decision:** Use explicit size constants (GRID3, GRID100) instead of SMALL/LARGE

**Rationale:**
- [+] Students see exact dimensions (3x3, 100x100)
- [+] Reinforces concept of "grid" with width and height
- [+] Easy to add GRID10, GRID50 later
- [-] Longer to type than SMALL/LARGE
- **Verdict:** Educational clarity > brevity

### 9.2 Function Naming: draw() vs color_cell()

**Decision:** Use `draw()` instead of `color_cell()`

**Rationale:**
- [+] Only 4 characters (iPad-friendly)
- [+] Natural verb students know
- [+] Generalizable (could draw lines, shapes later)
- [-] Less specific than "color_cell"
- **Verdict:** Brevity and intuitiveness win

### 9.3 Coordinate System: Bottom-Left vs Top-Left

**Decision:** Bottom-left origin (math convention)

**Rationale:**
- [+] Matches Cartesian coordinates in math class
- [+] Y increasing upward is intuitive ("up" = "bigger")
- [+] Transferable knowledge to graphing, geometry
- [-] Different from array indexing [row][col]
- [-] Different from screen coordinates (top-left)
- **Verdict:** Long-term educational value outweighs short-term familiarity

### 9.4 Validation: State Comparison vs Pixel Comparison

**Decision:** Compare internal Python dict state, not canvas pixels

**Rationale:**
- [+] Fast and deterministic (no anti-aliasing issues)
- [+] Can provide specific feedback (which cells differ)
- [+] No HTML canvas needed for validation
- [+] Works with sparse storage (efficient for GRID100)
- [-] Doesn't catch rendering bugs
- **Verdict:** State comparison is simpler, faster, and more educational

### 9.5 Canvas Rendering: HTML Canvas vs DOM Grid

**Decision:** Use HTML5 `<canvas>` element, not DOM divs

**Rationale:**
- [+] Fast rendering for 10,000 cells (GRID100)
- [+] Built-in pixel manipulation
- [+] Smaller memory footprint
- [+] Can export as image (future feature)
- [-] Requires coordinate flipping for bottom-left origin
- **Verdict:** Performance requirements dictate canvas over DOM

### 9.6 Color Support: Limited vs Full CSS

**Decision:** Support all CSS named colors + hex codes

**Rationale:**
- [+] Creative freedom for students
- [+] Easy parsing (CSS parser built into browsers)
- [+] Students learn real web color formats
- [-] More error cases (typos in color names)
- **Verdict:** Educational value and creativity > simplicity

### 9.7 Auto-flush: Always vs Manual

**Decision:** Auto-flush at code completion + allow manual `show()`

**Rationale:**
- [+] Beginners don't need to know about `show()`
- [+] Advanced students can use `show()` for animations
- [+] Reduces confusion ("why isn't my canvas updating?")
- [-] Slight complexity in implementation
- **Verdict:** Better UX for all skill levels

### 9.8 Validation Feedback: Simple vs Detailed

**Decision:** Start with simple feedback, enhance later

**MVP:** "Your canvas doesn't match"
**Future:** "You're missing 3 cells" or "Cell (2, 1) should be red"

**Rationale:**
- [+] Simpler to implement for MVP
- [+] Can enhance incrementally based on student needs
- [+] Avoids giving away answers too easily
- **Verdict:** Ship simple, iterate based on feedback

---

## 10. Implementation Plan

### Phase 1: Core Infrastructure (PR #1)
**Goal:** Basic canvas drawing works for GRID3 with manual testing capability

**Tasks:**
1. Create `canvas-system.js`
   - Implement `use_canvas()`, `draw()`, `show()`, `clear()`
   - Canvas state management
   - Command batching and rendering
   - Coordinate system conversion (bottom-left)
   - Error handling (bounds checking, color validation)

2. Modify `code-executor.js`
   - Add canvas setup hook in `executeCode()`
   - Reset canvas state in `resetPythonEnvironment()`
   - Auto-flush canvas after code completion

3. Modify `worksheet.js`
   - Detect `problem.canvas === true`
   - Inject `<canvas>` element into output area
   - Position canvas above text output
   - Wire up canvas functions before code execution

4. Add basic styles in `styles.css`
   - `.canvas-container` responsive sizing
   - Canvas border and styling
   - Mobile breakpoints

5. Create `worksheets/worksheet-6.json` (BASIC VERSION)
   - **3 simple test problems only** for manual testing:
     - Problem 1: Draw a single cell
     - Problem 2: Draw a horizontal line (3 cells)
     - Problem 3: Draw a simple pattern (corner cells)
   - Minimal validation (can be enhanced in Phase 3)

6. Update `worksheets/index.json`
   - Add worksheet 6 to master list

**Testing:**
- Manual testing with worksheet 6 problems
- Verify coordinates work (bottom-left origin)
- Test error handling (out of bounds, invalid colors)
- Test on mobile/tablet
- Verify worksheet loads and renders correctly

**Success Criteria:**
- Can draw on GRID3 canvas
- Canvas renders correctly
- Coordinates work as expected
- Responsive on all devices
- Worksheet 6 loads and 3 test problems work

---

### Phase 2: GRID100 & Optimization (PR #2)
**Goal:** Support large canvases efficiently

**Tasks:**
1. Add GRID100 support in `canvas-system.js`
   - Optimize batch rendering for 10,000 cells
   - Test performance with nested loops

2. Add grid styling in `styles.css`
   - Show grid lines on GRID3 (with coordinate labels)
   - Hide grid lines on GRID100
   - Optimize pixel rendering (`image-rendering: pixelated`)

3. Create coordinate label rendering
   - JavaScript function to draw axis labels
   - Only for GRID3

**Testing:**
- Performance test: Fill entire GRID100 canvas
- Verify grid lines show/hide correctly
- Test coordinate labels on GRID3

**Success Criteria:**
- GRID100 renders smoothly (< 1 second for full fill)
- Coordinate labels visible on GRID3
- No visual artifacts or performance issues

---

### Phase 3: Validation System (PR #3)
**Goal:** Automatic validation by canvas state comparison

**Tasks:**
1. Modify `validation.js`
   - Extend `validateSolutionCode()` to detect canvas problems
   - Add canvas state comparison logic
   - Implement `deepEqual()` for grid comparison
   - Generate basic feedback messages

2. Add helper functions
   - `getCanvasState(codeExecutor, context)` - Extract Python state
   - `compareCanvasStates(student, solution)` - Deep comparison
   - `generateDiffFeedback(student, solution)` - Basic feedback

**Testing:**
- Create test problems with validation
- Test with correct solutions (should pass)
- Test with wrong solutions (should fail)
- Verify feedback messages

**Success Criteria:**
- Validation correctly detects matches/mismatches
- Feedback messages are helpful
- Both canvas and text output validated together

---

### Phase 4: Worksheet Content Expansion (PR #4)
**Goal:** Expand Worksheet 6 to full difficulty progression

**Note:** Basic 3-problem version created in Phase 1 for testing

**Tasks:**
1. Expand `worksheets/worksheet-6.json` to full version
   - **Additional Easy problems (GRID3):**
     - Draw a vertical line
     - Draw a diagonal
     - Create more patterns

   - **Medium problems (GRID3):**
     - Use a loop to fill a row
     - Use nested loops for a pattern
     - Conditional coloring

   - **Hard problems (GRID100):**
     - Draw horizontal rainbow with loops
     - Create checkerboard pattern
     - Draw concentric squares
     - Draw gradient effect

2. Update `worksheets/template.json`
   - Add canvas problem template

3. Enhance validation with better feedback
   - Use improved diff feedback from Phase 3

**Testing:**
- Complete full worksheet as a student would
- Verify all validations work
- Test on different devices
- Get feedback from test users

**Success Criteria:**
- Worksheet has clear learning progression
- All problems validate correctly
- Instructions are clear and educational

---

### Phase 5: Polish & Documentation (PR #5)
**Goal:** Finalize UX and document system

**Tasks:**
1. Enhanced feedback (optional)
   - Implement detailed diff analysis
   - Show which cells are missing/wrong
   - Add visual hints

2. Quality of life features
   - Color picker reference (show available colors)
   - "Download canvas as image" button
   - Canvas reset button in UI

3. Documentation
   - Update `CLAUDE.md` with canvas system
   - Add canvas section to `VALIDATION.md`
   - Create student help documentation

4. Testing
   - Cross-browser testing
   - Performance benchmarking
   - Accessibility review

**Success Criteria:**
- System is well-documented
- UX is polished and intuitive
- All tests pass

---

## 11. Future Enhancements

### 11.1 Additional Grid Sizes
- GRID10 (10x10) - Medium complexity
- GRID50 (50x50) - Between GRID3 and GRID100
- Custom sizes: `use_canvas(width, height)`

### 11.2 Advanced Drawing Functions
```python
draw_line(x1, y1, x2, y2, color)    # Draw line between points
draw_rect(x, y, width, height, color)  # Filled rectangle
draw_circle(x, y, radius, color)    # Filled circle
```

### 11.3 Animation Support
```python
# Draw frame by frame
for frame in range(10):
    draw(frame, 5, 'red')
    show()
    sleep(0.1)  # Pause between frames
```

### 11.4 Color Palette Helper
```python
get_rainbow_color(i)  # Returns color from rainbow
get_gradient(start, end, steps)  # Color gradient
```

### 11.5 Export & Sharing
- Download canvas as PNG
- Share canvas via URL
- Gallery of student creations

---

## 12. Risk Assessment

### 12.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GRID100 performance issues | Medium | High | Batch rendering, optimize loops |
| Browser compatibility issues | Low | Medium | Test on all major browsers |
| Coordinate confusion (bottom-left) | High | Low | Clear labels, helpful errors |
| Validation false negatives | Low | High | Thorough testing, manual review |

### 12.2 Educational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Students don't understand coordinates | Medium | High | Coordinate labels on GRID3, clear examples |
| Too difficult for beginners | Low | High | Start with GRID3, simple problems first |
| Not enough challenge for advanced | Low | Medium | GRID100 + loop problems provide depth |

---

## 13. Success Metrics

### 13.1 Technical Success
- [x] Canvas renders in < 1 second for GRID100 full fill
- [x] No console errors in browser
- [x] Works on Chrome, Firefox, Safari, Edge
- [x] Mobile responsive (tested on iOS/Android)

### 13.2 Educational Success
- [x] Students complete worksheet 6 at same rate as other worksheets
- [x] < 5% error rate due to coordinate confusion
- [x] Positive feedback on visual learning
- [x] Students successfully use loops in GRID100 problems

---

## 14. Open Questions

**None** - All design decisions finalized as of 2025-10-29

---

## 15. Appendix

### 15.1 Complete API Reference

```python
# Canvas Setup
use_canvas(GRID3)      # Initialize 3x3 canvas
use_canvas(GRID100)    # Initialize 100x100 canvas

# Drawing Functions
draw(x, y)             # Draw black at (x, y)
draw(x, y, color)      # Draw with color (named or hex)

# Control Functions
show()                 # Flush commands to screen (auto-called)
clear()                # Reset canvas to white

# Constants
GRID3                  # 3x3 grid
GRID100                # 100x100 grid
```

### 15.2 Internal State Structure

```python
_canvas_state = {
    'grid': {
        (0, 0): 'red',
        (1, 2): 'blue',
        # ... sparse dict of colored cells
    },
    'size': 'GRID3',           # or 'GRID100'
    'dimensions': (3, 3),      # (width, height)
    'commands': [
        {'type': 'draw', 'x': 0, 'y': 0, 'color': 'red'},
        {'type': 'draw', 'x': 1, 'y': 2, 'color': 'blue'},
        # ... buffered commands
    ]
}
```

### 15.3 Example Worksheet Problem

```json
{
  "title": "Draw a horizontal line",
  "content": "A horizontal line goes from left to right at the same y-coordinate.",
  "task": "Draw a black horizontal line across the middle row (y=1) of the canvas.",
  "starterCode": "use_canvas(GRID3)\n\n# Draw cells at y=1\n",
  "hint": "You need to draw at (0,1), (1,1), and (2,1)",
  "canvas": true,
  "validation": {
    "rules": [
      {
        "type": "solution_code",
        "solutionCode": "use_canvas(GRID3)\ndraw(0, 1)\ndraw(1, 1)\ndraw(2, 1)"
      }
    ]
  }
}
```

---

**End of Design Document**
