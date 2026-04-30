// Project page: per-function editor model.
// Loads a project JSON, renders one CodeMirror editor per task (function body
// only), and assembles them into a single Python program at run time. Each
// task body is wrapped as `def <name>():\n<indented body>`. Per-task compile()
// catches SyntaxErrors so one bad body doesn't kill the whole project.

const PARAM_PROJECT = 'project';
const DEFAULT_PROJECT = 'pixel-art';
const BODY_INDENT = '  ';
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
    card.dataset.taskId = '__setup__';

    const header = document.createElement('header');
    header.className = 'project-task-header';
    header.innerHTML = `
        <div class="project-task-titles">
            <span class="task-number setup-number">⚙</span>
            <h3 class="task-title">Setup</h3>
        </div>
        <span class="task-status task-status-pending" data-status>○ ready</span>
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

    const setupError = document.createElement('div');
    setupError.className = 'task-error';
    setupError.style.display = 'none';
    card.appendChild(setupError);

    host.appendChild(card);

    // Defer CM init to initTaskEditors() (parent must be visible first).
    host._editorEl = editorEl;
    host._statusEl = header.querySelector('[data-status]');
    host._errorEl = setupError;
    host._card = card;
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
    defLine.innerHTML = `<span class="def-lineno" data-lineno></span><span class="def-content"><span class="kw">def</span> <span class="fn">${escapeHtml(task.function)}</span>():</span>`;
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
        defLineEl: defLine,
        defLinenoEl: defLine.querySelector('[data-lineno]'),
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
            lineNumbers: true,
            indentUnit: 2,
            tabSize: 2,
            extraKeys: { 'Tab': cm => cm.replaceSelection('  ', 'end') },
            indentWithTabs: false,
            lineWrapping: true,
            viewportMargin: Infinity,
        });
        setupEditor.setSize('100%', '7em');
        setupEditor.on('change', (_cm, change) => {
            // setValue (programmatic load) shouldn't dirty the buffer, but
            // line offsets always need to follow line-count changes.
            if (change.origin !== 'setValue') markDirty();
            recomputeLineOffsets();
        });
    }

    for (const entry of taskEditors.values()) {
        const { editorEl, task } = entry;
        const cm = CodeMirror(editorEl, {
            value: task.starterBody || '',
            mode: 'python',
            theme: 'monokai',
            lineNumbers: true,
            indentUnit: 2,
            tabSize: 2,
            extraKeys: { 'Tab': cm => cm.replaceSelection('  ', 'end') },
            indentWithTabs: false,
            lineWrapping: true,
            viewportMargin: Infinity, // grow to fit content
        });
        const heightLines = task.editorHeight || 6;
        cm.setSize('100%', `${heightLines * 1.5}em`);
        cm.on('change', (_cm, change) => {
            // Programmatic loads (openProject) come through with origin
            // 'setValue' and shouldn't mark the buffer dirty — but line
            // offsets always need to follow line-count changes either way.
            if (change.origin !== 'setValue') markDirty();
            recomputeLineOffsets();
        });

        entry.cm = cm;
    }

    // Initial sync after every editor exists.
    recomputeLineOffsets();
}

// ─── Continuous line numbers ────────────────────────────────────────────
// Each editor is a slice of the assembled program. firstLineNumber on each
// CodeMirror is set so the displayed numbers match the line numbers Pyodide
// reports in tracebacks. Recomputed whenever any editor's line count changes
// (typing, loading a file, etc.) so insertions ripple downstream.

function countLines(s) {
    if (!s) return 0;
    return s.split('\n').length;
}

function recomputeLineOffsets() {
    if (!setupEditor) return;
    let line = 1;

    // Setup editor — first thing in the assembled program now that
    // use_canvas() runs as a separate JS-driven step.
    setupEditor.setOption('firstLineNumber', line);
    line += setupEditor.lineCount();
    line += 1; // blank separator emitted by the assembler

    // Each task: one line for `def name():`, then the body lines.
    for (const task of projectDef.tasks) {
        const entry = taskEditors.get(task.id);
        if (!entry || !entry.cm) continue;
        if (entry.defLinenoEl) entry.defLinenoEl.textContent = String(line);
        line += 1; // the def line itself
        entry.cm.setOption('firstLineNumber', line);
        // Body line count: empty body still emits `pass` from the assembler,
        // so use max(1, count).
        const bodyLines = Math.max(1, entry.cm.lineCount());
        line += bodyLines;
        line += 1; // blank separator
    }

    // Re-sync def line padding to the freshly-rendered gutter widths so the
    // def number column lines up with the editor's line-number column.
    syncDefLinePaddings();
}

// The CodeMirror gutter width depends on the digits of firstLineNumber +
// lineCount, so it can shift when offsets change. Pad each def line to match.
function syncDefLinePaddings() {
    for (const entry of taskEditors.values()) {
        if (!entry.cm || !entry.defLineEl) continue;
        const gutter = entry.cm.getGutterElement();
        if (!gutter) continue;
        // Use the gutter's measured width so def `1` lines up with body `1`.
        entry.defLineEl.style.setProperty('--gutter-width', gutter.offsetWidth + 'px');
    }
}

// ─── Run flow ────────────────────────────────────────────────────────────

async function runProject() {
    resetAllStatus();

    // Build the program in three segments so we can attribute exec failures
    // to whichever section caused them (Setup vs. function defs vs. Extras).
    const seg = assembleProgramSegmented();

    // Surface per-task syntax errors caught by the assembler before we run anything.
    for (const [taskId, errMsg] of seg.taskErrors) markTaskError(taskId, errMsg);

    // Setup syntax-check upfront so a broken preamble doesn't masquerade as a
    // runtime error in some unrelated task.
    const preambleSyntaxErr = seg.preambleSrc.trim() ? checkSyntax(seg.preambleSrc) : null;
    if (preambleSyntaxErr) setSetupError(preambleSyntaxErr);

    await executor.resetPythonEnvironment(0);
    setupCanvasFunctions(executor.getPyodide(), 0);
    const py = executor.getPyodide();

    // 0. Locked preamble — kept off the line-numbered surface students see, so
    //    line numbers in the editors match the running program. Failures here
    //    are project config bugs, not student errors.
    for (const line of (projectDef.lockedPreamble || [])) {
        try {
            await py.runPythonAsync(line);
        } catch (err) {
            displayGlobalError(`Couldn't initialise the canvas: ${extractPythonError(err)}`);
            return finalizeRunStatus();
        }
    }

    // 1. Setup preamble. A failure here is the student's variables.
    if (!preambleSyntaxErr && seg.preambleSrc.trim()) {
        try {
            await py.runPythonAsync(seg.preambleSrc);
        } catch (err) {
            setSetupError(extractPythonError(err));
            return finalizeRunStatus();
        }
    }

    // 2. Function definitions. Wrapping is JS-controlled, so this only fails
    // if our wrapping has a bug — extremely unlikely. Surface as a global
    // banner so we notice in the field.
    if (seg.fnDefsSrc.trim()) {
        try {
            await py.runPythonAsync(seg.fnDefsSrc);
        } catch (err) {
            displayGlobalError(`Couldn't load your functions: ${extractPythonError(err)}`);
            return finalizeRunStatus();
        }
    }

    // 3. Extras (preserved from a saved file). If they fail, attribute to Extras.
    if (seg.extrasSrc.trim()) {
        try {
            await py.runPythonAsync(seg.extrasSrc);
        } catch (err) {
            setExtrasError(extractPythonError(err));
            // Don't return — student tasks may still work without extras.
        }
    }

    // 4. Install the Python attribution helper so subsequent calls (draw_scene,
    // dpad presses) can attribute errors to whichever task function ran deepest.
    await installAttributionHelper();

    // 5. Initial scene render via the attributed call helper.
    const sceneResult = await callWithAttribution('draw_scene');
    if (!sceneResult.ok) {
        const taskId = taskIdForFunction(sceneResult.in_function);
        if (taskId) markTaskError(taskId, sceneResult.error_msg);
        else displayGlobalError(sceneResult.error_msg);
    }

    // 6. Per-task validation for anything not already in error.
    for (const [taskId, entry] of taskEditors.entries()) {
        if (entry.statusEl.classList.contains('task-status-fail')) continue;
        const result = await validateTask(entry.task);
        applyValidationResult(taskId, result);
    }

    finalizeRunStatus();
}

// Pyodide's err.message is a multi-line traceback. The student-facing line is
// the last "ErrorType: message" line — the rest is implementation detail.
function extractPythonError(err) {
    const msg = (err && err.message) ? err.message : String(err);
    const lines = msg.split('\n').map(s => s.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
        if (/^[A-Z][A-Za-z]*(Error|Exception|Warning):/.test(lines[i])) return lines[i];
    }
    return lines[lines.length - 1] || msg;
}

async function installAttributionHelper() {
    const py = executor.getPyodide();
    const knownNames = projectDef.tasks.map(t => t.function);
    py.globals.set('_wavelet_known_names', py.toPy(knownNames));
    py.runPython(`
def _wavelet_call_safely(fn_name):
    # Walks the exception traceback to find the deepest frame whose function
    # is one of the project's tasks. That's where the bug lives.
    known = set(_wavelet_known_names)
    fn = globals().get(fn_name)
    if not callable(fn):
        return {'ok': False,
                'error_msg': f"'{fn_name}' is not defined yet",
                'in_function': fn_name}
    try:
        fn()
        return {'ok': True, 'in_function': None, 'error_msg': None}
    except Exception as e:
        deepest = fn_name
        tb = e.__traceback__
        while tb is not None:
            frame_name = tb.tb_frame.f_code.co_name
            if frame_name in known:
                deepest = frame_name
            tb = tb.tb_next
        return {'ok': False,
                'error_msg': f'{type(e).__name__}: {e}',
                'in_function': deepest}
`);
}

async function callWithAttribution(fnName) {
    const py = executor.getPyodide();
    try {
        const fn = py.globals.get('_wavelet_call_safely');
        const result = fn(fnName);
        const obj = result.toJs({ dict_converter: Object.fromEntries });
        if (typeof autoFlushCanvas !== 'undefined') autoFlushCanvas(py, 0);
        return obj;
    } catch (err) {
        return { ok: false, error_msg: extractPythonError(err), in_function: fnName };
    }
}

function taskIdForFunction(fnName) {
    for (const t of projectDef.tasks) {
        if (t.function === fnName) return t.id;
    }
    return null;
}

// Wipes the visible canvas via Python's clear(), then calls draw_scene
// through the attribution helper so any failure inside a task function ends
// up routed to the right card.
async function runDrawScene() {
    const py = executor.getPyodide();
    try {
        await py.runPythonAsync('clear()');
    } catch (_e) { /* canvas may not yet be initialised — fine */ }
    return callWithAttribution('draw_scene');
}

async function onKeyPress(direction) {
    if (!executor || !executor.isReady()) return;
    const fnName = `on_${direction}_key`;

    // The attribution helper isn't installed until after a successful Run.
    // If the student presses an arrow before running, prompt them to Run.
    const py = executor.getPyodide();
    if (!py.globals.get('_wavelet_call_safely')) {
        document.getElementById('project-status').innerHTML =
            'Click <strong>Run Project</strong> first to load your code.';
        return;
    }

    // Run the handler, then re-render the scene. Both go through attribution
    // so any error lands on the right task card.
    const handlerResult = await callWithAttribution(fnName);
    if (!handlerResult.ok) {
        const taskId = taskIdForFunction(handlerResult.in_function);
        if (taskId) markTaskError(taskId, handlerResult.error_msg);
        else displayGlobalError(handlerResult.error_msg);
        finalizeRunStatus();
        return;
    }

    // Clear + redraw scene with attribution.
    try { await py.runPythonAsync('clear()'); } catch (_e) {}
    const sceneResult = await callWithAttribution('draw_scene');
    if (!sceneResult.ok) {
        const taskId = taskIdForFunction(sceneResult.in_function);
        if (taskId) markTaskError(taskId, sceneResult.error_msg);
        else displayGlobalError(sceneResult.error_msg);
        finalizeRunStatus();
    }
}

// ─── Status / error UI ──────────────────────────────────────────────────

// Reset every card to a neutral "ready" state. We never leave a "… running"
// pill behind because exec failures abort before validation runs and the
// yellow state misleads.
function resetAllStatus() {
    const host = document.getElementById('project-setup-host');
    if (host && host._statusEl) {
        host._statusEl.className = 'task-status task-status-pending';
        host._statusEl.textContent = '○ ready';
    }
    if (host && host._errorEl) host._errorEl.style.display = 'none';

    for (const entry of taskEditors.values()) {
        entry.statusEl.className = 'task-status task-status-pending';
        entry.statusEl.textContent = '○ ready';
        entry.errorEl.style.display = 'none';
    }

    const status = document.getElementById('project-status');
    if (status) status.innerHTML = 'Running…';
}

function setSetupError(msg) {
    const host = document.getElementById('project-setup-host');
    if (!host || !host._statusEl) return;
    host._statusEl.className = 'task-status task-status-fail';
    host._statusEl.textContent = '✗ error';
    host._errorEl.style.display = 'block';
    host._errorEl.textContent = msg;
}

function setExtrasError(msg) {
    const codeEl = document.getElementById('extras-code');
    if (!codeEl) return;
    let banner = document.getElementById('extras-error');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'extras-error';
        banner.className = 'task-error';
        banner.style.margin = '8px 12px';
        codeEl.parentElement.insertBefore(banner, codeEl);
    }
    banner.style.display = 'block';
    banner.textContent = `Error in Extras: ${msg}`;
}

function displayGlobalError(msg) {
    const status = document.getElementById('project-status');
    if (status) status.innerHTML = `<strong>Error:</strong> ${escapeHtml(msg)}`;
}

// Count failed cards, render the summary in the sticky stage, and scroll to
// the first error if there is one. Called at the end of every run / key press.
function finalizeRunStatus() {
    const failingCards = document.querySelectorAll('.project-task .task-status-fail');
    const status = document.getElementById('project-status');
    if (!status) return;
    if (failingCards.length === 0) {
        status.innerHTML = '✓ Project running. Try the arrow buttons below the canvas!';
        return;
    }
    const noun = failingCards.length === 1 ? 'task needs' : 'tasks need';
    status.innerHTML = `
        <span class="status-fail-text">✗ ${failingCards.length} ${noun} fixing</span>
        <button type="button" class="status-jump-btn" id="status-jump-btn">Jump to first ↓</button>
    `;
    document.getElementById('status-jump-btn').addEventListener('click', scrollToFirstError);
    scrollToFirstError();
}

// Smooth-scroll to the first failing card, leaving the sticky stage clear.
function scrollToFirstError() {
    const failingPill = document.querySelector('.project-task .task-status-fail');
    if (!failingPill) return;
    const card = failingPill.closest('.project-task');
    if (!card) return;
    const stage = document.querySelector('.project-stage');
    const stageHeight = stage ? stage.offsetHeight : 0;
    const cardTop = card.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: cardTop - stageHeight - 16, behavior: 'smooth' });
}

// ─── Code assembly ───────────────────────────────────────────────────────

// Build the runnable program in three segments — preamble, function defs,
// extras — so the run loop can exec each piece separately and attribute
// failures to the right card. assembleFileForDisk uses the same building
// blocks but adds the on-disk header / per-task labels.
function assembleProgramSegmented() {
    const taskErrors = new Map();

    // Preamble: only the editable section. The locked preamble (use_canvas)
    // is invoked separately from JS during runProject so it doesn't take a
    // line number that students can't see — the visible editor line numbers
    // match the running program's line numbers.
    const editablePreamble = setupEditor ? setupEditor.getValue() : (projectDef.editablePreamble || '');
    const preambleSrc = editablePreamble.trim() ? editablePreamble.replace(/\s+$/g, '') : '';

    const fnLines = [];
    for (const task of projectDef.tasks) {
        const entry = taskEditors.get(task.id);
        const rawBody = entry && entry.cm ? entry.cm.getValue() : (task.starterBody || '');

        const wrapped = wrapAsFunction(task.function, rawBody);
        const compileError = checkSyntax(wrapped);
        if (compileError) {
            taskErrors.set(task.id, compileError);
            fnLines.push(`def ${task.function}():`);
            fnLines.push(`${BODY_INDENT}pass  # (replaced because of a syntax error in your code)`);
            fnLines.push('');
            continue;
        }

        fnLines.push(wrapped);
        fnLines.push('');
    }
    const fnDefsSrc = fnLines.join('\n');

    const extrasSrc = (currentExtras && currentExtras.trim()) ? currentExtras : '';

    return { preambleSrc, fnDefsSrc, extrasSrc, taskErrors };
}

// Single-blob form used only by old call sites we haven't refactored yet.
function assembleProgram() {
    const seg = assembleProgramSegmented();
    const lines = [];
    if (seg.preambleSrc) { lines.push(seg.preambleSrc); lines.push(''); }
    if (seg.fnDefsSrc) { lines.push(seg.fnDefsSrc); }
    if (seg.extrasSrc) { lines.push(seg.extrasSrc); lines.push(''); }
    return { code: lines.join('\n'), taskErrors: seg.taskErrors };
}

function wrapAsFunction(name, body) {
    const trimmed = (body || '').replace(/\s+$/g, '');
    const bodyLines = trimmed === '' ? ['pass'] : trimmed.split('\n');
    const indented = bodyLines.map(l => BODY_INDENT + l).join('\n');
    return `def ${name}():\n${indented}`;
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

    projectDef.tasks.forEach((task, idx) => {
        const entry = taskEditors.get(task.id);
        const body = entry && entry.cm ? entry.cm.getValue() : (task.starterBody || '');
        lines.push(`# Task ${idx + 1}: ${task.title}`);
        lines.push(wrapAsFunction(task.function, body));
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
import ast, textwrap

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
