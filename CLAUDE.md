# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

Wavelet Zone is an interactive Python learning platform for upper primary students. It uses a worksheet-based approach with problems across three difficulty levels (easy/medium/hard) to ensure all students can make progress. The platform runs Python code directly in the browser using Pyodide (WebAssembly).

## Development Commands

### Setup (first time)
```bash
# Install dependencies
npm install

# Install git hooks (auto-stamps version.js after every commit)
npm run setup
```

### Local Development
```bash
# Start development server with live reload
npm run dev

# Start simple development server
npm run serve
# or
npm start
```

### Testing
```bash
# Run all tests
npm run test:all

# Run individual test suites
npm run test                    # error-handler tests
npm run test:homepage:basic     # homepage basic tests  
npm run test:validation         # validation system tests
npm run test:input-system       # input system tests
```

### Deployment
```bash
# Build for deployment (static files)
# IMPORTANT: Always run before pushing to GitHub for deployment
npm run build

# Deploy with Docker
npm run deploy:docker
```

**Version stamping**: `version.js` is automatically updated on every commit via the git post-commit hook (installed by `npm run setup`). This ensures localStorage is cleared for users when content changes.

### Cloudflare Pages preview URLs

The project deploys to Cloudflare Pages. Production: `wavelet.zone`. Pages project slug: `wavelet-e8x`.

**Always use `scripts/cloudflare-alias.py` to generate the preview URL — never compute it by hand.** Eyeballing character counts is error-prone (Cloudflare truncates at 28 chars and trims trailing `-`).

```bash
python3 scripts/cloudflare-alias.py                  # current branch
python3 scripts/cloudflare-alias.py <branch-name>    # explicit branch
```

The rule the script encodes: lowercase the branch name, replace runs of non-alphanumeric chars with `-`, truncate to 28 chars, strip any trailing `-`. Examples:

- `claude/test-cloud-code-8WTmb` → `https://claude-test-cloud-code-8wtmb.wavelet-e8x.pages.dev` (28 chars, no truncation)
- `claude/onedrive-file-picker-ZjviR` → `https://claude-onedrive-file-picker.wavelet-e8x.pages.dev` (truncated at the dash before `zjvir`, trailing `-` stripped)
- `claude/modernize-worksheet-2-TPGZj` → `https://claude-modernize-worksheet-2.wavelet-e8x.pages.dev`

When working on a PR or feature branch, share the script's output so the user can preview the change once Cloudflare finishes building. If that alias doesn't resolve, the per-deployment hash URL (`https://<8-hex>.wavelet-e8x.pages.dev`) can be read from the Cloudflare Pages commit status on the pushed SHA via the GitHub MCP.

## Architecture

### Core Files
- `index.html` - Main entry point and worksheet selector
- `worksheet.html` - Individual worksheet interface  
- `script.js` - Main application logic and worksheet loading
- `worksheet.js` - Worksheet-specific functionality and code execution
- `validation.js` - Answer validation and feedback system
- `input-system.js` - Textbox-based input system for interactive problems
- `error-handler.js` - Python error parsing and user-friendly messages
- `styles.css` - All CSS styling with custom properties

### Worksheet System
- `worksheets/index.json` - Master list of available worksheets
- `worksheets/worksheet-N.json` - Individual worksheet content and problems
- `worksheets/template.json` - Template for creating new worksheets

### Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Python Runtime**: Pyodide v0.28.2 (Python compiled to WebAssembly)
- **Code Editor**: CodeMirror 5.65.2
- **Math Rendering**: MathJax (for mathematical expressions)

## Key Systems

### Input System (`get_input()` function)
For interactive Python problems, students use textbox inputs instead of command-line input:
```python
# Single input (no argument needed)
number = get_input()

# Named inputs  
num1 = get_input('first_number')
num2 = get_input('second_number')
```

### Validation System
Problems are validated using pattern matching, output checking, and code analysis. See `VALIDATION.md` for detailed validation rules.

### Progress Tracking
Automatic progress persistence using localStorage. Students' code and completion status are saved per worksheet.

### Concept Cards (worksheet problem type `"type": "concept"`)
A non-interactive explanatory block that can be inserted between coding problems in any worksheet. Rendered by `createConceptElement()` in `worksheet.js`; excluded from problem numbering/progress tracking via the `getProblems()` filter.

**JSON schema** (all fields except `title` and `content` are optional):
```json
{
  "type": "concept",
  "icon": "💡",
  "title": "Key Concept: ...",
  "content": "<p>HTML content with <code>inline code</code> and <strong>bold</strong></p>",
  "examples": [
    { "input": "3",  "substituted": "print(3 + 5)",  "output": "8"  },
    { "input": "10", "substituted": "print(10 + 5)", "output": "15" }
  ],
  "footer": "Optional italic closing thought."
}
```

**Rendered structure**: amber/yellow gradient card (`background: linear-gradient(135deg, #fffbeb, #fef3c7)`) with a left amber border. Header has a large icon + bold title. Body renders `content` as raw HTML. The optional `examples` block shows a row of pills for each example: `You type X → Python sees <code>…</code> → prints Y`. Footer appears in italic below.

**Styling**: all in `styles.css` under `/* Concept Card */` — classes `.concept-card`, `.concept-header`, `.concept-icon`, `.concept-body`, `.concept-examples`, `.concept-example`, `.example-input`, `.example-arrow`, `.example-code`, `.example-output`, `.concept-footer`.

**Potential future uses:**
- Insert concept cards at the start of any worksheet to introduce a key idea before the first problem
- Use between problem groups to bridge from one concept to the next (e.g. before introducing strings in Worksheet 5)
- Could be extended: add a `"type": "concept"` variant with a live code demo or embedded trace player to show the concept executing step-by-step

### Python Scratchpad (`scratchpad.html` / `scratchpad.js`)
A free-form Python workspace outside the worksheet structure. Features configurable inputs (`get_input()`), an optional canvas, and an **Execution Trace** mode.

**Trace mode** (`trace-toggle` checkbox → "Run & Trace"):
- Uses `sys.settrace()` in Pyodide to record every line event
- Generates a list of *steps* (each line has a `before` and `after` sub-step), serialised to JSON via `_wavelet_trace_result`
- Each step carries: `line` (1-indexed), `locals` snapshot, `output` (accumulated stdout so far), `phase` (`before`/`after`), `ann` (annotation chip), `for_ctx` (for-loop iterable state)
- JS `TracePlayer` class drives playback: slider, prev/next/play controls, variable panel, output-so-far panel
- Line highlight uses a sliding CSS-transitioned overlay (`div.trace-line-overlay`) inside the CodeMirror scroller, animated with `transition: top`
- Annotations shown on relevant steps: `print → "value"`, `if condition → true/false`, `for x in [...]` with consumed/current item styling

**Potential future uses to keep in mind:**
- Embed a read-only trace player inside a worksheet problem to *demo* how a specific piece of code executes (e.g. explain a for-loop or accumulator pattern before students write their own)
- Add a "trace this" hint mode on hard problems so students can step through a working solution
- Use the scratchpad page in a teacher walkthrough / live demo context
- If pulling trace into worksheets: the `TracePlayer` class and `buildTraceScript()` / `runTrace()` functions in `scratchpad.js` are self-contained and could be imported or duplicated into `worksheet.js` with minor wiring changes

## Code Style Guidelines

### JavaScript
- Use ES6+ features (async/await, arrow functions, template literals)
- Prefer `const`/`let` over `var`
- Use `ErrorHandler` utility for consistent error processing
- Add JSDoc comments for complex functions
- Cache DOM elements to minimize queries

### Python Error Handling
Always reset Python environment between executions and provide educational error messages:
```javascript
try {
    await resetPythonEnvironment();
    await pyodide.runPythonAsync(code);
} catch (error) {
    const errorInfo = ErrorHandler.extractErrorInfo(error.message);
    displayOutput(output, errorInfo.fullMessage, 'error');
}
```

### CSS
- Use CSS custom properties for theming
- Follow BEM-like naming for complex components
- Mobile-first responsive design
- Modern CSS (Grid, Flexbox)


## Important Notes

- User is on Windows (native, no WSL2) - use bash-compatible commands via Git Bash
- All Python code execution happens in browser via Pyodide
- Educational context is paramount - keep UI intuitive for beginners
- Worksheets 1-4 focus on numerical programming; strings introduced in Worksheet 5
- When creating new worksheets, follow the structure in `template.json`
- Always test worksheet problems across different difficulty levels
