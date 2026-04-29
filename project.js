// Project page: per-function editor model.
// Loads a project JSON, renders one CodeMirror editor per task (function body
// only), and assembles them into a single Python program at run time. Each
// task body is wrapped as `def <name>():\n<indented body>`. Per-task compile()
// catches SyntaxErrors so one bad body doesn't kill the whole project.

const PARAM_PROJECT = 'project';
const DEFAULT_PROJECT = 'pixel-art';
const BODY_INDENT = '    ';
const SUPPORTS_FSA = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const PY_FILE_TYPE = {
    description: 'Python file',
    accept: { 'text/x-python': ['.py'] }
};
const FILE_HEADER_MARKER = '# Wavelet';

let executor = null;
let projectDef = null;
const taskEditors = new Map(); // taskId -> { cm, statusEl, defLineEl, lastError }
let setupEditor = null; // CodeMirror for the editable preamble
let currentFileHandle = null;
let dirty = false;
let savedFlashTimer = null;
let currentExtras = ''; // raw source of any unrecognised top-level code from an opened file

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get(PARAM_PROJECT) || DEFAULT_PROJECT;

        const indexResp = await fetch('projects/index.json');
        const index = await indexResp.json();
        const entry = index.projects.find(p => p.id === projectId);
        if (!entry) {
            throw new Error(`Unknown project: ${projectId}`);
        }

        const projResp = await fetch(`projects/${entry.file}`);
        projectDef = await projResp.json();

        renderProject();
        await initPython();
        revealInterface();
        // CodeMirror needs the parent to be visible (non-display:none) before it
        // can measure itself. Initialise the per-task editors only after reveal,
        // otherwise they render blank until first focus.
        initTaskEditors();
    } catch (err) {
        console.error('Project failed to load:', err);
        document.getElementById('loading-overlay').innerHTML = `
            <div class="loading-content">
                <h2>Couldn't load the project</h2>
                <p>${err.message}</p>
            </div>`;
    }
});

async function initPython() {
    executor = new CodeExecutor();
    await executor.initialize();
    setupCanvasFunctions(executor.getPyodide(), 0);
}

function revealInterface() {
    document.getElementById('loading-overlay').style.display = 'none';
    document.getElementById('project-interface').style.display = 'block';
}

function renderProject() {
    document.title = `${projectDef.title} - Python Learning Platform`;
    document.getElementById('project-title').textContent = projectDef.title;
    document.getElementById('project-description').textContent = projectDef.description || '';
    document.getElementById('project-intro').innerHTML = projectDef.intro || '';
    renderSetupCard();

    const tasksEl = document.getElementById('project-tasks');
    tasksEl.innerHTML = '';
    projectDef.tasks.forEach((task, idx) => {
        tasksEl.appendChild(renderTaskCard(task, idx));
    });

    document.getElementById('run-project-btn').addEventListener('click', runProject);
    document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('click', () => onKeyPress(btn.dataset.key));
    });

    // Save / Open
    document.getElementById('save-file-btn').addEventListener('click', saveProject);
    document.getElementById('open-file-btn').addEventListener('click', openProject);
    document.getElementById('file-input').addEventListener('change', handleFallbackFileInput);

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveProject();
        }
    });

    // Warn before leaving with unsaved edits.
    window.addEventListener('beforeunload', e => {
        if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
}

function renderSetupCard() {
    const host = document.getElementById('project-setup-host');
    host.innerHTML = '';
    const card = document.createElement('article');
    card.className = 'project-task project-setup';

    const header = document.createElement('header');
    header.className = 'project-task-header';
    header.innerHTML = `
        <div class="project-task-titles">
            <span class="task-number setup-number">⚙</span>
            <h3 class="task-title">Setup</h3>
        </div>
    `;
    card.appendChild(header);

    const guidance = document.createElement('div');
    guidance.className = 'task-guidance';
    guidance.innerHTML = '<p>Variables here exist before any function runs &mdash; you can read or change them in any task below. Add more if you want to remember more things between key presses (a score, a colour, a high-water mark&hellip;).</p>';
    card.appendChild(guidance);

    const editorFrame = document.createElement('div');
    editorFrame.className = 'task-editor-frame';

    // Locked preamble lines (use_canvas etc.) still run, but we don't expose
    // them in the Setup card UI — students don't need to see them, and one
    // (use_canvas) hardly belongs next to "your variables". The lines are
    // still emitted at run/save time from projectDef.lockedPreamble.

    const editorEl = document.createElement('div');
    editorEl.className = 'task-editor setup-editor';
    editorFrame.appendChild(editorEl);

    card.appendChild(editorFrame);
    host.appendChild(card);

    // Defer CM init to initTaskEditors() (parent must be visible first).
    host._editorEl = editorEl;
}

function renderTaskCard(task, idx) {
    const card = document.createElement('article');
    card.className = 'project-task';
    card.dataset.taskId = task.id;

    const header = document.createElement('header');
    header.className = 'project-task-header';
    header.innerHTML = `
        <div class="project-task-titles">
            <span class="task-number">${idx + 1}</span>
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
        </div>
        <span class="task-status task-status-pending" data-status>○ not run yet</span>
    `;
    card.appendChild(header);

    const guidance = document.createElement('div');
    guidance.className = 'task-guidance';
    guidance.innerHTML = task.guidance || '';
    card.appendChild(guidance);

    const editorFrame = document.createElement('div');
    editorFrame.className = 'task-editor-frame';

    const defLine = document.createElement('div');
    defLine.className = 'task-def-line';
    defLine.innerHTML = `<span class="kw">def</span> <span class="fn">${escapeHtml(task.function)}</span>():`;
    editorFrame.appendChild(defLine);

    const editorEl = document.createElement('div');
    editorEl.className = 'task-editor';
    editorFrame.appendChild(editorEl);

    card.appendChild(editorFrame);

    const taskError = document.createElement('div');
    taskError.className = 'task-error';
    taskError.style.display = 'none';
    card.appendChild(taskError);

    // Stash references; CodeMirror itself is initialised later (see
    // initTaskEditors), once the parent is visible and can be measured.
    taskEditors.set(task.id, {
        cm: null,
        editorEl,
        statusEl: header.querySelector('[data-status]'),
        errorEl: taskError,
        task,
    });

    return card;
}

function initTaskEditors() {
    // Setup editor first so it's positioned above the task editors.
    const setupHost = document.getElementById('project-setup-host');
    if (setupHost && setupHost._editorEl) {
        setupEditor = CodeMirror(setupHost._editorEl, {
            value: projectDef.editablePreamble || '',
            mode: 'python',
            theme: 'monokai',
            lineNumbers: false,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            lineWrapping: true,
            viewportMargin: Infinity,
        });
        setupEditor.setSize('100%', '7em');
        setupEditor.on('change', (_cm, change) => {
            if (change.origin === 'setValue') return;
            markDirty();
        });
    }

    for (const entry of taskEditors.values()) {
        const { editorEl, task } = entry;
        const cm = CodeMirror(editorEl, {
            value: task.starterBody || '',
            mode: 'python',
            theme: 'monokai',
            lineNumbers: false,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            lineWrapping: true,
            viewportMargin: Infinity, // grow to fit content
        });
        const heightLines = task.editorHeight || 6;
        cm.setSize('100%', `${heightLines * 1.5}em`);
        cm.on('change', (_cm, change) => {
            // Programmatic loads (openProject) come through with origin 'setValue'
            // and shouldn't mark the buffer dirty.
            if (change.origin === 'setValue') return;
            markDirty();
        });
        entry.cm = cm;
    }
}

// ─── Run flow ────────────────────────────────────────────────────────────

async function runProject() {
    const status = document.getElementById('project-status');
    status.innerHTML = 'Running…';

    // Reset per-task error UI
    for (const entry of taskEditors.values()) {
        entry.errorEl.style.display = 'none';
        entry.statusEl.className = 'task-status task-status-pending';
        entry.statusEl.textContent = '… running';
    }

    const { code, taskErrors } = assembleProgram();

    // Reset Python globals so previous state doesn't bleed across runs.
    await executor.resetPythonEnvironment(0);
    setupCanvasFunctions(executor.getPyodide(), 0);

    const outputEl = document.getElementById('output-0');
    try {
        await executor.executeCode(code, outputEl, 0);
    } catch (err) {
        status.innerHTML = `<strong>Error while defining your project:</strong> ${escapeHtml(err.message)}`;
        return;
    }

    // Mark per-task syntax errors caught by the assembler.
    for (const [taskId, errMsg] of taskErrors.entries()) {
        markTaskError(taskId, errMsg);
    }

    // Initial scene: clear + draw_scene + flush
    await runDrawScene();

    // Validate each task that wasn't already marked as a syntax error.
    for (const [taskId, entry] of taskEditors.entries()) {
        if (taskErrors.has(taskId)) continue;
        const result = await validateTask(entry.task);
        applyValidationResult(taskId, result);
    }

    status.innerHTML = 'Project running. Try the arrow buttons below the canvas!';
}

async function runDrawScene() {
    const py = executor.getPyodide();
    try {
        await py.runPythonAsync(`
try:
    clear()
except Exception:
    pass
try:
    draw_scene()
except Exception as _e:
    print('Error in draw_scene():', _e)
`);
    } finally {
        if (typeof autoFlushCanvas !== 'undefined') {
            autoFlushCanvas(py, 0);
        }
    }
}

async function onKeyPress(direction) {
    if (!executor || !executor.isReady()) return;
    const fnName = `on_${direction}_key`;
    const py = executor.getPyodide();
    try {
        await py.runPythonAsync(`
try:
    ${fnName}()
except Exception as _e:
    print('Error in ${fnName}():', _e)
`);
    } catch (err) {
        console.error(`${fnName} failed:`, err);
    }
    await runDrawScene();
}

// ─── Code assembly ───────────────────────────────────────────────────────

function assembleProgram() {
    const lines = [];
    const taskErrors = new Map();

    // Locked preamble (we own these — use_canvas, etc.)
    for (const line of (projectDef.lockedPreamble || [])) {
        lines.push(line);
    }

    // Editable preamble (student-owned globals)
    const editablePreamble = setupEditor ? setupEditor.getValue() : (projectDef.editablePreamble || '');
    if (editablePreamble.trim()) {
        lines.push(editablePreamble.replace(/\s+$/g, ''));
    }
    lines.push('');

    // Auto-inject `global` so students can write `x -= 1` inside a function
    // without hitting Python's UnboundLocalError. Crucially, we inject only
    // the candidate names that are *assigned* in this specific function body
    // (Assign/AugAssign/AnnAssign targets) — never just because a name is
    // referenced. If we injected unconditionally, a `for x in range(20)` loop
    // inside draw_border would clobber the global x (treating the loop var as
    // a global write), which broke the left/right buttons in the first cut.
    const candidateGlobals = scanGlobals(editablePreamble);

    for (const task of projectDef.tasks) {
        const entry = taskEditors.get(task.id);
        const rawBody = entry && entry.cm ? entry.cm.getValue() : (task.starterBody || '');

        // Tentatively wrap with no global decl so we can inspect the AST.
        const wrappedNoGlobals = wrapAsFunction(task.function, rawBody, null);
        const compileError = checkSyntax(wrappedNoGlobals);
        if (compileError) {
            taskErrors.set(task.id, compileError);
            lines.push(`def ${task.function}():`);
            lines.push(`${BODY_INDENT}pass  # (replaced because of a syntax error in your code)`);
            lines.push('');
            continue;
        }

        const assignedHere = scanAssignedGlobals(wrappedNoGlobals, candidateGlobals);
        const globalDecl = assignedHere.length ? `global ${assignedHere.join(', ')}` : null;
        lines.push(wrapAsFunction(task.function, rawBody, globalDecl));
        lines.push('');
    }

    // Extras: opaque to the editing UI, but they still run.
    if (currentExtras && currentExtras.trim()) {
        lines.push(currentExtras);
        lines.push('');
    }

    return { code: lines.join('\n'), taskErrors };
}

function wrapAsFunction(name, body, globalDecl) {
    const trimmed = (body || '').replace(/\s+$/g, '');
    const bodyLines = [];
    if (globalDecl) bodyLines.push(globalDecl);
    if (trimmed === '') {
        bodyLines.push('pass');
    } else {
        for (const line of trimmed.split('\n')) bodyLines.push(line);
    }
    const indented = bodyLines.map(l => BODY_INDENT + l).join('\n');
    return `def ${name}():\n${indented}`;
}

// Given a wrapped `def fn():\n    body…` source and a list of candidate names
// (the global candidates from the preamble), return the subset that are
// actually assigned to inside the function body. We deliberately ignore
// `For.target` so a `for x in range(20)` loop variable stays local even when
// `x` is a global elsewhere — otherwise the loop clobbers the global.
function scanAssignedGlobals(wrappedSrc, candidates) {
    if (!candidates || candidates.length === 0) return [];
    const py = executor.getPyodide();
    py.globals.set('_wavelet_fn_src', wrappedSrc);
    py.globals.set('_wavelet_fn_candidates', py.toPy(candidates));
    try {
        py.runPython(`
import ast as _ast
def _wavelet_scan_assigned():
    src = _wavelet_fn_src
    candidates = list(_wavelet_fn_candidates)
    try:
        tree = _ast.parse(src)
    except SyntaxError:
        return []
    if not tree.body or not isinstance(tree.body[0], _ast.FunctionDef):
        return []
    fn = tree.body[0]
    assigned = set()
    def visit_target(node):
        if isinstance(node, _ast.Name):
            assigned.add(node.id)
        elif isinstance(node, (_ast.Tuple, _ast.List)):
            for el in node.elts:
                visit_target(el)
    for node in _ast.walk(fn):
        # Note: For.target is intentionally NOT counted — loop variables
        # should remain local even when their name matches a global.
        if isinstance(node, _ast.Assign):
            for tgt in node.targets:
                visit_target(tgt)
        elif isinstance(node, (_ast.AugAssign, _ast.AnnAssign)):
            visit_target(node.target)
    return [c for c in candidates if c in assigned]
`);
        const fn = py.globals.get('_wavelet_scan_assigned');
        return fn().toJs();
    } catch (err) {
        console.warn('scanAssignedGlobals failed:', err);
        return [];
    } finally {
        py.globals.delete('_wavelet_fn_src');
        py.globals.delete('_wavelet_fn_candidates');
    }
}

// Parse the preamble source via Python's ast and return the names assigned
// at module level — these become candidates for the auto-injected `global`.
function scanGlobals(src) {
    if (!src || !src.trim()) return [];
    const py = executor.getPyodide();
    py.globals.set('_wavelet_preamble_src', src);
    try {
        py.runPython(`
import ast as _ast
def _wavelet_scan_globals(src):
    try:
        tree = _ast.parse(src)
    except SyntaxError:
        return []
    names = []
    seen = set()
    def visit_target(node):
        if isinstance(node, _ast.Name):
            if node.id not in seen:
                seen.add(node.id)
                names.append(node.id)
        elif isinstance(node, (_ast.Tuple, _ast.List)):
            for el in node.elts:
                visit_target(el)
    for node in tree.body:
        if isinstance(node, _ast.Assign):
            for tgt in node.targets:
                visit_target(tgt)
        elif isinstance(node, (_ast.AugAssign, _ast.AnnAssign)):
            visit_target(node.target)
    return names
`);
        const fn = py.globals.get('_wavelet_scan_globals');
        const result = fn(src);
        return result.toJs();
    } catch (err) {
        console.warn('scanGlobals failed:', err);
        return [];
    } finally {
        py.globals.delete('_wavelet_preamble_src');
    }
}

function checkSyntax(src) {
    try {
        const py = executor.getPyodide();
        // Python's compile() raises SyntaxError on bad code; surface its message.
        py.runPython(`
import builtins as _b
def _wavelet_check_syntax(src):
    try:
        _b.compile(src, '<task>', 'exec')
        return None
    except SyntaxError as e:
        return f"line {e.lineno}: {e.msg}"
`);
        const checker = py.globals.get('_wavelet_check_syntax');
        const result = checker(src);
        return result || null;
    } catch (err) {
        return err.message;
    }
}

function markTaskError(taskId, msg) {
    const entry = taskEditors.get(taskId);
    if (!entry) return;
    entry.statusEl.className = 'task-status task-status-fail';
    entry.statusEl.textContent = '✗ syntax error';
    entry.errorEl.style.display = 'block';
    entry.errorEl.textContent = msg;
}

// ─── Per-task validation ────────────────────────────────────────────────

async function validateTask(task) {
    const rules = (task.validation && task.validation.rules) || [];
    if (rules.length === 0) return { pass: true, kind: 'none' };

    for (const rule of rules) {
        if (rule.type === 'function_runs_clean') {
            const r = await ruleFunctionRunsClean(task);
            if (!r.pass) return r;
        } else if (rule.type === 'function_fills_cells') {
            const r = await ruleFunctionFillsCells(task, rule);
            if (!r.pass) return r;
        }
    }
    return { pass: true, kind: 'pass' };
}

async function ruleFunctionRunsClean(task) {
    const py = executor.getPyodide();
    try {
        await py.runPythonAsync(`
_wavelet_err = None
try:
    ${task.function}()
except Exception as _e:
    _wavelet_err = repr(_e)
`);
        const err = py.globals.get('_wavelet_err');
        if (err && err !== null) {
            return { pass: false, message: `Crashed: ${err}` };
        }
        return { pass: true };
    } catch (err) {
        return { pass: false, message: err.message };
    }
}

async function ruleFunctionFillsCells(task, rule) {
    const py = executor.getPyodide();
    const expected = expandCells(rule.cells);
    try {
        // Run the function in isolation on a fresh canvas-state.
        await py.runPythonAsync(`
_canvas_state['grid'] = {}
_canvas_state['commands'] = []
_wavelet_err = None
try:
    ${task.function}()
except Exception as _e:
    _wavelet_err = repr(_e)
`);
        const err = py.globals.get('_wavelet_err');
        if (err && err !== null) {
            return { pass: false, message: `Crashed: ${err}` };
        }

        const grid = py.runPython(`list(_canvas_state['grid'].items())`).toJs();
        // grid is [[ [x, y], color ], ...]
        const filledSet = new Set();
        const filledMap = new Map();
        for (const [coords, color] of grid) {
            const [x, y] = coords;
            const key = `${x},${y}`;
            filledSet.add(key);
            filledMap.set(key, color);
        }

        const expectedKeys = expected.map(([x, y]) => `${x},${y}`);
        const missing = expectedKeys.filter(k => !filledSet.has(k));
        if (missing.length > 0) {
            return { pass: false, message: `Missing ${missing.length} of ${expected.length} expected cells` };
        }

        if (rule.exact) {
            const extras = [...filledSet].filter(k => !expectedKeys.includes(k));
            if (extras.length > 0) {
                return { pass: false, message: `Drew ${extras.length} extra cells outside the expected pattern` };
            }
        }

        if (!rule.anyColor && rule.color) {
            const wrongColor = expected.find(([x, y]) => filledMap.get(`${x},${y}`) !== rule.color);
            if (wrongColor) {
                return { pass: false, message: `Wrong colour at (${wrongColor[0]}, ${wrongColor[1]})` };
            }
        }

        return { pass: true };
    } catch (err) {
        return { pass: false, message: err.message };
    } finally {
        // Restore the live scene so the visible canvas matches what the user sees.
        await runDrawScene();
    }
}

function expandCells(spec) {
    if (Array.isArray(spec)) return spec;
    if (spec === 'border') {
        const out = [];
        const N = 20;
        for (let x = 0; x < N; x++) { out.push([x, 0]); out.push([x, N - 1]); }
        for (let y = 1; y < N - 1; y++) { out.push([0, y]); out.push([N - 1, y]); }
        return out;
    }
    return [];
}

function applyValidationResult(taskId, result) {
    const entry = taskEditors.get(taskId);
    if (!entry) return;
    if (result.pass) {
        entry.statusEl.className = 'task-status task-status-pass';
        entry.statusEl.textContent = '✓ working';
        entry.errorEl.style.display = 'none';
    } else {
        entry.statusEl.className = 'task-status task-status-fail';
        entry.statusEl.textContent = '✗ ' + (result.message || 'not yet');
        entry.errorEl.style.display = 'none';
    }
}

// ─── Save / Open ─────────────────────────────────────────────────────────
// On disk the project is one .py file: header comment + preamble + one def
// per task + any "Extras" preserved verbatim from a previously-opened file.
// The file is fully runnable Python — students can paste it into IDLE.

function assembleFileForDisk() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [
        `${FILE_HEADER_MARKER} ${projectDef.title}`,
        `# Project: ${projectDef.id}`,
        `# Saved:   ${today}`,
        '',
    ];

    // Locked preamble we own
    for (const line of (projectDef.lockedPreamble || [])) lines.push(line);

    // Editable preamble (student globals)
    const editablePreamble = setupEditor ? setupEditor.getValue() : (projectDef.editablePreamble || '');
    if (editablePreamble.trim()) {
        lines.push(editablePreamble.replace(/\s+$/g, ''));
    }
    lines.push('');

    // Saved file is plain runnable Python (paste into IDLE etc.) — that means
    // any `x -= 1` inside a function won't work without `global x`. Inject
    // those declarations here too so the on-disk file matches what the
    // harness runs in the browser. Same per-function scoping as the
    // run-time assembler: only inject for names actually assigned in each
    // body, not for names that just happen to be referenced.
    const candidateGlobals = scanGlobals(editablePreamble);

    projectDef.tasks.forEach((task, idx) => {
        const entry = taskEditors.get(task.id);
        const body = entry && entry.cm ? entry.cm.getValue() : (task.starterBody || '');
        const wrappedNoGlobals = wrapAsFunction(task.function, body, null);
        // If the body has a syntax error we can't AST-scan it; fall back to
        // no global decl. The harness already surfaces the error at run time.
        let globalDecl = null;
        if (!checkSyntax(wrappedNoGlobals)) {
            const assigned = scanAssignedGlobals(wrappedNoGlobals, candidateGlobals);
            globalDecl = assigned.length ? `global ${assigned.join(', ')}` : null;
        }
        lines.push(`# Task ${idx + 1}: ${task.title}`);
        lines.push(wrapAsFunction(task.function, body, globalDecl));
        lines.push('');
    });

    if (currentExtras && currentExtras.trim()) {
        lines.push('# ── Extras (preserved from your file) ──');
        lines.push(currentExtras.replace(/\s+$/g, ''));
        lines.push('');
    }

    return lines.join('\n');
}

async function saveProject() {
    if (SUPPORTS_FSA) await saveProjectViaFSA();
    else saveProjectViaDownload();
}

async function openProject() {
    if (SUPPORTS_FSA) await openProjectViaFSA();
    else document.getElementById('file-input').click();
}

async function saveProjectViaFSA() {
    let handle = currentFileHandle && currentFileHandle.createWritable ? currentFileHandle : null;
    if (!handle) {
        try {
            handle = await window.showSaveFilePicker({
                suggestedName: suggestedFilename(),
                types: [PY_FILE_TYPE]
            });
        } catch (err) {
            if (err.name === 'AbortError') return;
            alert('Could not open the save dialog.');
            return;
        }
    }
    try {
        const writable = await handle.createWritable();
        await writable.write(assembleFileForDisk());
        await writable.close();
        currentFileHandle = handle;
        markClean();
        flashSaved();
    } catch (err) {
        alert('Could not save that file: ' + (err.message || err.name));
    }
}

function saveProjectViaDownload() {
    const suggested = (currentFileHandle && currentFileHandle.name) || suggestedFilename();
    let name = prompt('Save as:', suggested);
    if (name === null) return;
    name = name.trim();
    if (!name) name = suggestedFilename();
    if (!/\.[a-z0-9]+$/i.test(name)) name += '.py';

    const blob = new Blob([assembleFileForDisk()], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    currentFileHandle = { name };
    markClean();
    flashSaved();
}

async function openProjectViaFSA() {
    let handle;
    try {
        [handle] = await window.showOpenFilePicker({ types: [PY_FILE_TYPE], multiple: false });
    } catch (err) {
        if (err.name === 'AbortError') return;
        alert('Could not open the file picker.');
        return;
    }
    try {
        const file = await handle.getFile();
        const text = await file.text();
        if (!loadFileIntoEditors(text, file.name)) return; // user cancelled banner
        currentFileHandle = handle;
        markClean();
    } catch (err) {
        alert('Could not read that file: ' + (err.message || err.name));
    }
}

function handleFallbackFileInput(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        if (!loadFileIntoEditors(ev.target.result || '', file.name)) return;
        // Fallback path can't write back — track only the name for the next download prompt.
        currentFileHandle = { name: file.name };
        markClean();
    };
    reader.onerror = () => alert('Could not read that file.');
    reader.readAsText(file);
}

// Returns true if the file was applied, false if the user cancelled.
function loadFileIntoEditors(text, filename) {
    const looksLikeProject = text.trimStart().startsWith(FILE_HEADER_MARKER);
    if (!looksLikeProject) {
        const ok = confirm(
            `"${filename}" doesn't look like a saved Wavelet project (no marker comment).\n\n` +
            `Open it anyway? Any function whose name matches a task will be loaded; everything else goes into the read-only Extras panel.`
        );
        if (!ok) return false;
    }

    const dirtyBefore = anyEditorDifferentFromStarter();
    if (dirtyBefore && !confirm('Replace your current project with the contents of this file?')) {
        return false;
    }

    const knownNames = projectDef.tasks.map(t => t.function);
    const lockedSet = new Set((projectDef.lockedPreamble || []).map(s => s.trim()));
    const parsed = parseProjectFile(text, knownNames, lockedSet);

    const missing = [];
    for (const task of projectDef.tasks) {
        const entry = taskEditors.get(task.id);
        if (!entry || !entry.cm) continue;
        if (parsed.bodies.has(task.function)) {
            entry.cm.setValue(parsed.bodies.get(task.function));
        } else {
            entry.cm.setValue(task.starterBody || '');
            missing.push(task.title);
        }
        entry.errorEl.style.display = 'none';
        entry.statusEl.className = 'task-status task-status-pending';
        entry.statusEl.textContent = '○ not run yet';
    }

    if (setupEditor) {
        setupEditor.setValue(parsed.editablePreamble || projectDef.editablePreamble || '');
    }

    currentExtras = parsed.extras;
    renderExtras();

    const status = document.getElementById('project-status');
    const bits = [];
    bits.push(`Opened <strong>${escapeHtml(filename)}</strong>.`);
    if (missing.length) bits.push(`Reset to starter: ${escapeHtml(missing.join(', '))}.`);
    if (parsed.extras.trim()) bits.push(`${parsed.extras.trim().split('\n').length} line(s) preserved as Extras.`);
    bits.push('Click <strong>Run Project</strong> to try it.');
    status.innerHTML = bits.join(' ');

    return true;
}

function renderExtras() {
    const panel = document.getElementById('project-extras');
    const codeEl = document.getElementById('extras-code');
    if (currentExtras && currentExtras.trim()) {
        codeEl.textContent = currentExtras;
        panel.style.display = '';
    } else {
        codeEl.textContent = '';
        panel.style.display = 'none';
    }
}

// Parse a project .py file via Python's ast module (in Pyodide).
// Categorisation of top-level nodes:
//   - FunctionDef with known name        -> task editor body (with auto-
//                                           injected `global ...` stripped)
//   - Statement matching a locked line   -> dropped (we own & regenerate)
//   - Imports / assignments              -> editable preamble editor
//   - Anything else (incl. unknown defs) -> Extras
function parseProjectFile(src, knownNames, lockedSet) {
    const py = executor.getPyodide();
    py.globals.set('_wavelet_src', src);
    py.globals.set('_wavelet_known', py.toPy(knownNames));
    py.globals.set('_wavelet_locked', py.toPy([...lockedSet]));
    try {
        py.runPython(`
import ast, textwrap, re

_GLOBAL_RE = re.compile(r'^\\s*global\\s+[A-Za-z_][A-Za-z0-9_,\\s]*$')

def _wavelet_strip_injected_global(body_src):
    # Drop a leading 'global ...' line if present — the harness re-injects
    # it on the next Run/Save so we don't want it to pile up in the editor.
    lines = body_src.split('\\n')
    # Skip leading blank lines.
    i = 0
    while i < len(lines) and lines[i].strip() == '':
        i += 1
    if i < len(lines) and _GLOBAL_RE.match(lines[i]):
        del lines[i]
        # Also drop a single blank line right after if it's there, to keep things tidy.
        if i < len(lines) and lines[i].strip() == '':
            del lines[i]
    return '\\n'.join(lines)

def _wavelet_parse_project():
    src = _wavelet_src
    known = set(_wavelet_known)
    locked = set(_wavelet_locked)
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return {'bodies': {}, 'editablePreamble': '', 'extras': src,
                'error': f'line {e.lineno}: {e.msg}'}

    bodies = {}
    editable_segments = []
    extras_segments = []

    PREAMBLE_TYPES = (ast.Import, ast.ImportFrom, ast.Assign, ast.AugAssign, ast.AnnAssign)

    for node in tree.body:
        seg = ast.get_source_segment(src, node) or ''
        stripped = seg.strip()
        if not stripped:
            continue
        if isinstance(node, ast.FunctionDef) and node.name in known:
            lines = seg.split('\\n')
            body = textwrap.dedent('\\n'.join(lines[1:]))
            body = _wavelet_strip_injected_global(body)
            bodies[node.name] = body.rstrip() + '\\n' if body.strip() else ''
        elif stripped in locked:
            continue  # we own this line, regenerated on save
        elif isinstance(node, PREAMBLE_TYPES):
            editable_segments.append(seg)
        else:
            extras_segments.append(seg)

    return {
        'bodies': bodies,
        'editablePreamble': '\\n'.join(editable_segments) + ('\\n' if editable_segments else ''),
        'extras': '\\n\\n'.join(extras_segments),
        'error': None,
    }
`);
        const result = py.globals.get('_wavelet_parse_project')().toJs({ dict_converter: Object.fromEntries });
        const bodies = new Map();
        for (const [k, v] of Object.entries(result.bodies)) bodies.set(k, v);
        return {
            bodies,
            editablePreamble: result.editablePreamble || '',
            extras: result.extras || '',
            error: result.error,
        };
    } finally {
        py.globals.delete('_wavelet_src');
        py.globals.delete('_wavelet_known');
        py.globals.delete('_wavelet_locked');
    }
}

function anyEditorDifferentFromStarter() {
    if (setupEditor && setupEditor.getValue() !== (projectDef.editablePreamble || '')) return true;
    for (const [, entry] of taskEditors) {
        if (!entry.cm) continue;
        const starter = entry.task.starterBody || '';
        if (entry.cm.getValue() !== starter) return true;
    }
    return false;
}

function suggestedFilename() {
    return `${projectDef.id}.py`;
}

// ─── Dirty / saved indicator ─────────────────────────────────────────────

function markDirty() {
    if (dirty) return;
    dirty = true;
    updateFileLabel();
}

function markClean() {
    dirty = false;
    updateFileLabel();
}

function updateFileLabel() {
    const label = document.getElementById('current-file');
    if (!label) return;
    if (label.classList.contains('saved-flash')) return;
    label.classList.toggle('dirty', dirty);
    if (currentFileHandle && currentFileHandle.name) {
        label.textContent = currentFileHandle.name;
        label.style.display = '';
    } else if (dirty) {
        label.textContent = 'Unsaved';
        label.style.display = '';
    } else {
        label.textContent = '';
        label.style.display = 'none';
    }
}

function flashSaved() {
    const label = document.getElementById('current-file');
    if (!label) return;
    if (savedFlashTimer) clearTimeout(savedFlashTimer);
    label.classList.remove('dirty');
    label.classList.add('saved-flash');
    label.textContent = '✓ Saved';
    label.style.display = '';
    savedFlashTimer = setTimeout(() => {
        savedFlashTimer = null;
        label.classList.remove('saved-flash');
        updateFileLabel();
    }, 1500);
}

// ─── Utilities ───────────────────────────────────────────────────────────

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
