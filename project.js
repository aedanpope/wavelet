// Project page: per-function editor model.
// Loads a project JSON, renders one CodeMirror editor per task (function body
// only), and assembles them into a single Python program at run time. Each
// task body is wrapped as `def <name>():\n<indented body>`. Per-task compile()
// catches SyntaxErrors so one bad body doesn't kill the whole project.

const PARAM_PROJECT = 'project';
const DEFAULT_PROJECT = 'pixel-art';
const BODY_INDENT = '    ';

let executor = null;
let projectDef = null;
const taskEditors = new Map(); // taskId -> { cm, statusEl, defLineEl, lastError }

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
    document.getElementById('preamble-code').textContent = (projectDef.preamble || []).join('\n');

    const tasksEl = document.getElementById('project-tasks');
    tasksEl.innerHTML = '';
    projectDef.tasks.forEach((task, idx) => {
        tasksEl.appendChild(renderTaskCard(task, idx));
    });

    document.getElementById('run-project-btn').addEventListener('click', runProject);
    document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('click', () => onKeyPress(btn.dataset.key));
    });
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

    // Preamble
    for (const line of (projectDef.preamble || [])) {
        lines.push(line);
    }
    lines.push('');

    for (const task of projectDef.tasks) {
        const entry = taskEditors.get(task.id);
        const rawBody = entry ? entry.cm.getValue() : (task.starterBody || '');
        const wrapped = wrapAsFunction(task.function, rawBody);

        const compileError = checkSyntax(wrapped);
        if (compileError) {
            taskErrors.set(task.id, compileError);
            // Substitute a no-op so the rest of the project still loads
            lines.push(`def ${task.function}():`);
            lines.push(`${BODY_INDENT}pass  # (replaced because of a syntax error in your code)`);
        } else {
            lines.push(wrapped);
        }
        lines.push('');
    }

    return { code: lines.join('\n'), taskErrors };
}

function wrapAsFunction(name, body) {
    const trimmed = (body || '').replace(/\s+$/g, '');
    if (trimmed === '') {
        return `def ${name}():\n${BODY_INDENT}pass`;
    }
    const indented = trimmed
        .split('\n')
        .map(line => BODY_INDENT + line)
        .join('\n');
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

// ─── Utilities ───────────────────────────────────────────────────────────

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
