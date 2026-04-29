// @ts-nocheck
// Scratchpad — free-form Python workspace with configurable inputs and canvas
/* global CodeExecutor, InputSystem, ErrorHandler, setupCanvasFunctions, autoFlushCanvas, resetCanvasState */

let codeExecutor = null;
let codeEditor = null;
let inputConfigs = []; // Array of { id, name, type, placeholder }
let tracePlayer = null;
let currentFileHandle = null; // Set when a file is opened/saved via the File System Access API.
let dirty = false; // True when editor content differs from last write/open.
let savedFlashTimer = null;

const SUPPORTS_FSA = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const PY_FILE_TYPE = {
    description: 'Python file',
    accept: { 'text/x-python': ['.py'] }
};

// TracePlayer is defined in trace-player.js, loaded before this script.

// ── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'scratchpadState';

function saveState() {
    try {
        const state = {
            code: codeEditor ? codeEditor.getValue() : '',
            editorHeight: parseInt(document.getElementById('editor-height').value) || 10,
            inputsEnabled: document.getElementById('inputs-toggle').checked,
            inputConfigs,
            canvasEnabled: document.getElementById('canvas-toggle').checked,
            traceEnabled: document.getElementById('trace-toggle').checked,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save scratchpad state:', e);
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('Failed to load scratchpad state:', e);
        return null;
    }
}

function restoreState(state) {
    if (!state) return;

    // Editor height
    if (state.editorHeight) {
        document.getElementById('editor-height').value = state.editorHeight;
        applyEditorHeight();
    }

    // Canvas toggle
    if (state.canvasEnabled) {
        document.getElementById('canvas-toggle').checked = true;
    }

    // Trace toggle
    if (state.traceEnabled) {
        document.getElementById('trace-toggle').checked = true;
        document.getElementById('run-btn').textContent = '▶ Run & Trace';
    }

    // Inputs
    if (state.inputsEnabled && Array.isArray(state.inputConfigs)) {
        inputConfigs = state.inputConfigs;
        document.getElementById('inputs-toggle').checked = true;
        document.getElementById('inputs-config').style.display = 'block';
        renderInputsConfig();
        renderInputFields();
        syncInputSection();
    }

    // Code (last, so editor is sized correctly first)
    if (state.code) {
        codeEditor.setValue(state.code);
    }
}

// ── Initialization ──────────────────────────────────────────────────────────

async function init() {
    try {
        codeExecutor = new CodeExecutor();
        await codeExecutor.initialize();
        setupEventListeners();
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('scratchpad-interface').style.display = 'block';
        initCodeEditor(); // must run after the interface is visible so CodeMirror can measure gutters
        restoreState(loadState());
    } catch (error) {
        console.error('Scratchpad init failed:', error);
    }
}

function initCodeEditor() {
    const height = parseInt(document.getElementById('editor-height').value) || 10;
    codeEditor = CodeMirror(document.getElementById('code-editor'), {
        mode: 'python',
        theme: 'monokai',
        lineNumbers: true,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        extraKeys: { 'Tab': cm => cm.replaceSelection('  ', 'end') }
    });
    codeEditor.setSize(null, height * 23 + 10);
    codeEditor.on('change', (cm, change) => {
        // Programmatic loads (restoreState, openCode, clear) come through with origin 'setValue'
        // and shouldn't mark the buffer dirty.
        if (change.origin === 'setValue') return;
        markDirty();
    });
    codeEditor.on('change', debounce(saveState, 500));
}

// ── Event Listeners ─────────────────────────────────────────────────────────

function setupEventListeners() {
    document.getElementById('run-btn').addEventListener('click', runCode);

    document.getElementById('clear-code-btn').addEventListener('click', () => {
        if (confirm('Clear all code?')) {
            if (tracePlayer) { tracePlayer.cleanup(); tracePlayer = null; }
            document.getElementById('trace-player').style.display = 'none';
            restoreOutput();
            codeEditor.setValue('');
            // Drop the file association — a subsequent Save should prompt for a name
            // rather than silently overwriting the previous file with empty contents.
            currentFileHandle = null;
            markClean();
            saveState();
        }
    });

    // Warn before leaving with unsaved edits — file-write hasn't happened, so closing the
    // tab risks losing work if localStorage gets cleared (shared school laptop, browser
    // wipe, etc.).
    window.addEventListener('beforeunload', e => {
        if (dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Editor height
    document.getElementById('height-decrease').addEventListener('click', () => {
        const input = document.getElementById('editor-height');
        input.value = Math.max(3, parseInt(input.value) - 1);
        applyEditorHeight(); saveState();
    });
    document.getElementById('height-increase').addEventListener('click', () => {
        const input = document.getElementById('editor-height');
        input.value = Math.min(50, parseInt(input.value) + 1);
        applyEditorHeight(); saveState();
    });
    document.getElementById('editor-height').addEventListener('change', () => { applyEditorHeight(); saveState(); });

    // Inputs toggle
    document.getElementById('inputs-toggle').addEventListener('change', e => {
        const on = e.target.checked;
        document.getElementById('inputs-config').style.display = on ? 'block' : 'none';
        if (on && inputConfigs.length === 0) addInput();
        syncInputSection();
        saveState();
    });

    // Canvas toggle
    document.getElementById('canvas-toggle').addEventListener('change', saveState);

    // Trace toggle — update run button label
    document.getElementById('trace-toggle').addEventListener('change', e => {
        const btn = document.getElementById('run-btn');
        btn.textContent = e.target.checked ? '▶ Run & Trace' : '▶ Run Code';
        if (!e.target.checked && tracePlayer) {
            tracePlayer.cleanup();
            tracePlayer = null;
            document.getElementById('trace-player').style.display = 'none';
            restoreOutput();
        }
        saveState();
    });

    // Trace player controls
    document.getElementById('trace-first').addEventListener('click', () => tracePlayer?.goToStep(0));
    document.getElementById('trace-prev').addEventListener('click', () => tracePlayer?.goToStep(tracePlayer.currentStep - 1));
    document.getElementById('trace-next').addEventListener('click', () => tracePlayer?.goToStep(tracePlayer.currentStep + 1));
    document.getElementById('trace-last').addEventListener('click', () => tracePlayer?.goToStep(tracePlayer.steps.length - 1));
    document.getElementById('trace-play').addEventListener('click', () => {
        if (!tracePlayer) return;
        tracePlayer.playTimer ? tracePlayer.pause() : tracePlayer.play();
    });
    document.getElementById('trace-slider').addEventListener('input', e => {
        tracePlayer?.goToStep(parseInt(e.target.value));
    });

    // Add input button
    document.getElementById('add-input-btn').addEventListener('click', addInput);

    // Save / Open file
    document.getElementById('save-file-btn').addEventListener('click', saveCode);
    document.getElementById('open-file-btn').addEventListener('click', openCode);
    document.getElementById('file-input').addEventListener('change', handleFallbackFileInput);

    // Ctrl/Cmd+S — students reach for this from Word; intercept the browser's "save page" default.
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveCode();
        }
    });
}

// ── Save / Open File ────────────────────────────────────────────────────────
// Two paths:
//   - File System Access API (Chromium incl. Edge/Chrome on Windows): true round-trip.
//     Open returns a handle; subsequent Save overwrites that file in place.
//   - Fallback (Safari/iPad, Firefox): hidden <input type="file"> for open, prompt-named
//     blob download for save.

async function openCode() {
    if (SUPPORTS_FSA) {
        await openCodeViaFSA();
    } else {
        document.getElementById('file-input').click();
    }
}

async function saveCode() {
    if (SUPPORTS_FSA) {
        await saveCodeViaFSA();
    } else {
        saveCodeViaDownload();
    }
}

async function openCodeViaFSA() {
    let handle;
    try {
        [handle] = await window.showOpenFilePicker({
            types: [PY_FILE_TYPE],
            multiple: false
        });
    } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled — silent
        alert('Could not open the file picker.');
        return;
    }

    const existing = codeEditor ? codeEditor.getValue().trim() : '';
    if (existing && !confirm('Replace your current code with the contents of this file?')) return;

    try {
        const file = await handle.getFile();
        const text = await file.text();
        codeEditor.setValue(text);
        currentFileHandle = handle;
        markClean();
        saveState();
    } catch (err) {
        alert('Could not read that file. Try again or pick a different file.');
    }
}

async function saveCodeViaFSA() {
    let handle = currentFileHandle;
    if (!handle) {
        try {
            handle = await window.showSaveFilePicker({
                suggestedName: 'scratchpad.py',
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
        await writable.write(codeEditor.getValue());
        await writable.close();
        currentFileHandle = handle;
        markClean();
        flashSaved();
    } catch (err) {
        alert('Could not save that file: ' + (err.message || err.name));
    }
}

function saveCodeViaDownload() {
    const suggested = (currentFileHandle && currentFileHandle.name) || 'scratchpad.py';
    let name = prompt('Save as:', suggested);
    if (name === null) return; // user cancelled
    name = name.trim();
    if (!name) name = 'scratchpad.py';
    if (!/\.[a-z0-9]+$/i.test(name)) name += '.py';

    const blob = new Blob([codeEditor.getValue()], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Track the most recent download name so the next prompt pre-fills with it.
    currentFileHandle = { name };
    markClean();
    flashSaved();
}

function handleFallbackFileInput(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const existing = codeEditor ? codeEditor.getValue().trim() : '';
    if (existing && !confirm('Replace your current code with the contents of this file?')) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
        codeEditor.setValue(ev.target.result || '');
        // Fallback path can't write back to the chosen file — track only the name for the next download prompt.
        currentFileHandle = { name: file.name };
        markClean();
        saveState();
    };
    reader.onerror = () => alert('Could not read that file. Try again or pick a different file.');
    reader.readAsText(file);

    // Reset so picking the same file again still fires `change`.
    e.target.value = '';
}

function updateCurrentFileLabel() {
    const label = document.getElementById('current-file');
    if (!label) return;
    // Don't clobber the in-progress save flash; it'll re-render itself when it expires.
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

function markDirty() {
    if (dirty) return;
    dirty = true;
    updateCurrentFileLabel();
}

function markClean() {
    dirty = false;
    updateCurrentFileLabel();
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
        updateCurrentFileLabel();
    }, 1500);
}

function applyEditorHeight() {
    const height = Math.max(3, Math.min(50, parseInt(document.getElementById('editor-height').value) || 10));
    document.getElementById('editor-height').value = height;
    codeEditor.setSize(null, height * 23 + 10);
}

// ── Input Configuration ──────────────────────────────────────────────────────

function addInput() {
    inputConfigs.push({
        id: Date.now(),
        name: `value${inputConfigs.length + 1}`,
        type: 'number',
        placeholder: ''
    });
    renderInputsConfig();
    renderInputFields();
    syncInputSection();
    saveState();
}

function removeInput(id) {
    inputConfigs = inputConfigs.filter(ic => ic.id !== id);
    renderInputsConfig();
    renderInputFields();
    syncInputSection();
    saveState();
}

/** Show/hide the runtime input section based on toggle + whether any inputs exist */
function syncInputSection() {
    const inputsEnabled = document.getElementById('inputs-toggle').checked;
    document.getElementById('input-section').style.display =
        (inputsEnabled && inputConfigs.length > 0) ? 'block' : 'none';
}

/** Render the settings-panel rows for configuring input fields */
function renderInputsConfig() {
    const list = document.getElementById('inputs-config-list');
    list.innerHTML = '';

    inputConfigs.forEach(ic => {
        const row = document.createElement('div');
        row.className = 'input-config-row';
        row.innerHTML = `
            <input type="text" class="input-config-name" value="${escHtml(ic.name)}" placeholder="name" data-id="${ic.id}">
            <select class="input-config-type" data-id="${ic.id}">
                <option value="number"${ic.type === 'number' ? ' selected' : ''}>number</option>
                <option value="text"${ic.type === 'text' ? ' selected' : ''}>text</option>
                <option value="boolean"${ic.type === 'boolean' ? ' selected' : ''}>boolean</option>
            </select>
            <input type="text" class="input-config-placeholder" value="${escHtml(ic.placeholder)}" placeholder="placeholder (optional)" data-id="${ic.id}">
            <button class="remove-input-btn" title="Remove input">✕</button>
        `;

        row.querySelector('.input-config-name').addEventListener('input', e => {
            ic.name = e.target.value;
            renderInputFields();
            saveState();
        });
        row.querySelector('.input-config-type').addEventListener('change', e => {
            ic.type = e.target.value;
            saveState();
        });
        row.querySelector('.input-config-placeholder').addEventListener('input', e => {
            ic.placeholder = e.target.value;
            renderInputFields();
            saveState();
        });
        row.querySelector('.remove-input-btn').addEventListener('click', () => removeInput(ic.id));

        list.appendChild(row);
    });
}

/** Render the runtime input fields that appear below the code editor */
function renderInputFields() {
    const container = document.getElementById('input-fields');

    // Preserve existing values before re-rendering
    const savedValues = {};
    inputConfigs.forEach(ic => {
        const el = document.getElementById(`input-0-${ic.name}`);
        if (el) savedValues[ic.name] = el.value;
    });

    container.innerHTML = '';
    inputConfigs.forEach(ic => {
        const div = document.createElement('div');
        div.className = 'input-field';

        const inputType = ic.type === 'boolean' ? 'text' : ic.type;
        div.innerHTML = `
            <label for="input-0-${escHtml(ic.name)}">${escHtml(ic.name)} =</label>
            <input
                type="${inputType}"
                id="input-0-${escHtml(ic.name)}"
                name="${escHtml(ic.name)}"
                placeholder="${escHtml(ic.placeholder || '')}"
                class="problem-input"
                value="${escHtml(savedValues[ic.name] || '')}"
            >
        `;
        container.appendChild(div);
    });
}

// ── Code Execution ───────────────────────────────────────────────────────────

async function runCode() {
    if (document.getElementById('trace-toggle').checked) {
        return runTrace();
    }
    let code = codeEditor.getValue();
    const output = document.getElementById('output-0');

    if (!code.trim()) {
        displayOutput(output, '', 'error', '❌ Please enter some code to run.');
        return;
    }

    const inputsEnabled = document.getElementById('inputs-toggle').checked;

    // Validate inputs are filled
    if (inputsEnabled && inputConfigs.length > 0) {
        for (const ic of inputConfigs) {
            const el = document.getElementById(`input-0-${ic.name}`);
            if (el && !el.value.trim()) {
                displayOutput(output, '', 'error', `❌ Please fill in the "${ic.name}" input field.`);
                return;
            }
        }
    }

    try {
        displayOutput(output, '', 'running');

        await codeExecutor.resetPythonEnvironment(0);

        // Set up get_input() if inputs are enabled
        if (inputsEnabled && inputConfigs.length > 0) {
            const syntheticProblem = { inputs: inputConfigs.map(ic => ({ name: ic.name, type: ic.type })) };
            InputSystem.setupGetInputFunction(codeExecutor.getPyodide(), syntheticProblem, 0);
        }

        // get_choice() is always available
        InputSystem.setupGetChoiceFunction(codeExecutor.getPyodide(), 0);

        // Set up canvas if enabled
        const canvasEnabled = document.getElementById('canvas-toggle').checked;
        if (canvasEnabled && typeof setupCanvasFunctions !== 'undefined') {
            setupCanvasFunctions(codeExecutor.getPyodide(), 0);
        }

        code = codeExecutor.processCodeForAsync(code);

        const result = await codeExecutor.executeCode(code, output, 0);

        displayOutput(output, result.printOutput, 'normal');

    } catch (error) {
        const errorInfo = ErrorHandler.extractErrorInfo(error.message);
        displayOutput(output, errorInfo.fullMessage, 'error', '❌ There was an error running your code.');
    }
}

async function runTrace() {
    const code = codeEditor.getValue();
    const output = document.getElementById('output-0');
    const inputsEnabled = document.getElementById('inputs-toggle').checked;

    if (!code.trim()) {
        displayOutput(output, '', 'error', '❌ Please enter some code to run.');
        return;
    }

    // Cleanup any previous trace
    if (tracePlayer) { tracePlayer.cleanup(); tracePlayer = null; }
    document.getElementById('trace-player').style.display = 'none';
    restoreOutput();

    try {
        displayOutput(output, '', 'running');
        await codeExecutor.resetPythonEnvironment(0);

        const pyodide = codeExecutor.getPyodide();

        // Mirror the same setup as runCode()
        if (inputsEnabled && inputConfigs.length > 0) {
            const syntheticProblem = { inputs: inputConfigs.map(ic => ({ name: ic.name, type: ic.type })) };
            InputSystem.setupGetInputFunction(pyodide, syntheticProblem, 0);
        }
        InputSystem.setupGetChoiceFunction(pyodide, 0);

        pyodide.globals.set('_wavelet_user_code', code);

        await pyodide.runPythonAsync(buildTraceScript());

        const resultJson = pyodide.globals.get('_wavelet_trace_result');
        const data = JSON.parse(resultJson);
        const { steps, prints, print_output } = data;

        if (!steps || steps.length === 0) {
            displayOutput(output, print_output || '', 'normal', 'ℹ️ No executable lines to trace.');
            return;
        }

        // Hide the output area — full output goes into the trace player instead
        output.style.display = 'none';
        output.closest('.output-section').classList.add('trace-active');

        // Build and show trace player
        const slider = document.getElementById('trace-slider');
        slider.max = steps.length - 1;
        slider.value = 0;

        const elFn = name => document.getElementById(
            name === 'count' ? 'trace-step-count' :
            name === 'output-panel' ? 'trace-output-panel' :
            `trace-${name}`
        );
        tracePlayer = new TracePlayer(steps, codeEditor, elFn, {
            playSpeed: () => parseInt(document.getElementById('trace-speed').value)
        });
        document.getElementById('trace-player').style.display = 'block';
        tracePlayer.goToStep(0);

    } catch (error) {
        restoreOutput(output);
        const errorInfo = ErrorHandler.extractErrorInfo(error.message);
        displayOutput(output, errorInfo.fullMessage, 'error', '❌ There was an error running your code.');
    }
}

function restoreOutput(outputEl) {
    outputEl = outputEl || document.getElementById('output-0');
    outputEl.style.display = '';
    outputEl.closest('.output-section')?.classList.remove('trace-active');
}

function buildTraceScript() {
    return `
import sys as _sys_tr
import json as _json_tr
import builtins as _bi_tr

_tr_steps = []
_tr_prints = []
_tr_output = []
_tr_orig_print = _bi_tr.print

def _tr_print(*args, sep=' ', end='\\n', **kwargs):
    text = sep.join(str(a) for a in args) + end
    _tr_prints.append({'at_step': len(_tr_steps), 'text': text})
    _tr_output.append(text)

# Analyse the AST to know loop ranges, if ranges, and print lines
_tr_for_loops  = {}   # lineno → {target, iter_src, body_start, body_end}
_tr_if_stmts   = {}   # lineno → {cond_src, body_start, body_end, orelse_lineno}
_tr_print_args = {}   # lineno → {arg_srcs: [...], sep_src: '...'}

try:
    import ast as _tr_ast
    for _tr_node in _tr_ast.walk(_tr_ast.parse(_wavelet_user_code)):
        if isinstance(_tr_node, _tr_ast.For):
            _tr_for_loops[_tr_node.lineno] = {
                'target':     _tr_ast.unparse(_tr_node.target),
                'iter_src':   _tr_ast.unparse(_tr_node.iter),
                'body_start': _tr_node.body[0].lineno,
                'body_end':   _tr_node.end_lineno,
            }
        elif isinstance(_tr_node, _tr_ast.If):
            _tr_if_stmts[_tr_node.lineno] = {
                'cond_src':      _tr_ast.unparse(_tr_node.test),
                'body_start':    _tr_node.body[0].lineno,
                'body_end':      _tr_node.body[-1].end_lineno,
                'orelse_lineno': _tr_node.orelse[0].lineno if _tr_node.orelse else None,
                'end_lineno':    _tr_node.end_lineno,
            }
        elif isinstance(_tr_node, _tr_ast.Expr) and isinstance(_tr_node.value, _tr_ast.Call):
            _tr_fn = _tr_node.value.func
            if isinstance(_tr_fn, _tr_ast.Name) and _tr_fn.id == 'print':
                _tr_call = _tr_node.value
                _tr_sep_src = "' '"
                for _tr_kw in _tr_call.keywords:
                    if _tr_kw.arg == 'sep':
                        _tr_sep_src = _tr_ast.unparse(_tr_kw.value)
                _tr_print_args[_tr_node.lineno] = {
                    'arg_srcs': [_tr_ast.unparse(a) for a in _tr_call.args],
                    'sep_src':  _tr_sep_src,
                }
except Exception:
    pass

_tr_ns             = {}   # isolated namespace for user code
_tr_pending        = [None]  # [{'line', 'for_ctx'}] — waiting for next event to close as 'after'
_tr_for_visit_count = {}  # lineno → number of iterations completed so far

def _tr_snap(lc):
    s = {}
    for k, v in lc.items():
        if not k.startswith('_'):
            try:
                r = repr(v)
                s[k] = r[:120] if len(r) > 120 else r
            except Exception:
                s[k] = '<error>'
    return s

def _tr_tracer(frame, event, arg):
    if event == 'line' and frame.f_code.co_filename == '<user_trace>':
        if len(_tr_steps) < 1000:
            _tr_lc   = dict(frame.f_locals)
            snap     = _tr_snap(_tr_lc)
            cur_line = frame.f_lineno

            # ── Close the pending 'after' step from the previous line ──
            pend = _tr_pending[0]
            if pend is not None:
                ann = None
                pl  = pend['line']

                fl = _tr_for_loops.get(pl)
                if fl:
                    if fl['body_start'] <= cur_line <= fl['body_end']:
                        ann = {'type': 'loop_assigned', 'var': fl['target'],
                               'value': snap.get(fl['target'], '?')}
                    else:
                        ann = {'type': 'loop_done', 'var': fl['target']}

                ist = _tr_if_stmts.get(pl)
                if ist and ann is None:
                    if ist['body_start'] <= cur_line <= ist['body_end']:
                        ann = {'type': 'if_result', 'cond': ist['cond_src'], 'value': True}
                    else:
                        ann = {'type': 'if_result', 'cond': ist['cond_src'], 'value': False}

                _tr_steps.append({'line': pl, 'locals': snap, 'for_ctx': pend['for_ctx'],
                                  'phase': 'after', 'ann': ann, 'output': ''.join(_tr_output)})
                _tr_pending[0] = None

            # ── Record 'before' step for current line ──
            for_ctx = None
            fl = _tr_for_loops.get(cur_line)
            if fl:
                visit_k = _tr_for_visit_count.get(cur_line, 0)
                _tr_for_visit_count[cur_line] = visit_k + 1
                try:
                    iv = eval(fl['iter_src'], globals(), _tr_lc)
                    ir = repr(iv)
                    items = None
                    if isinstance(iv, (list, tuple)) and len(iv) <= 40:
                        items = [repr(x)[:40] for x in iv]
                    elif isinstance(iv, range) and len(iv) <= 40:
                        items = [repr(x) for x in iv]
                    for_ctx = {'target': fl['target'], 'iter': ir[:120] if len(ir) > 120 else ir,
                               'items': items, 'iteration': visit_k}
                except Exception:
                    for_ctx = {'target': fl['target'], 'iter': fl['iter_src'],
                               'items': None, 'iteration': 0}

            ann_before = None
            if cur_line in _tr_print_args:
                pa = _tr_print_args[cur_line]
                try:
                    sep = eval(pa['sep_src'], globals(), _tr_lc) if pa['sep_src'] != "' '" else ' '
                    parts = [str(eval(a, globals(), _tr_lc)) for a in pa['arg_srcs']]
                    preview = sep.join(parts)
                    ann_before = {'type': 'print', 'preview': preview[:60]}
                except Exception:
                    ann_before = {'type': 'print', 'preview': None}
            elif cur_line in _tr_if_stmts:
                ann_before = {'type': 'if_test', 'cond': _tr_if_stmts[cur_line]['cond_src']}

            _tr_steps.append({'line': cur_line, 'locals': snap, 'for_ctx': for_ctx,
                              'phase': 'before', 'ann': ann_before, 'output': ''.join(_tr_output)})
            _tr_pending[0] = {'line': cur_line, 'for_ctx': for_ctx}

    return _tr_tracer

_bi_tr.print = _tr_print
_sys_tr.settrace(_tr_tracer)
try:
    exec(compile(_wavelet_user_code, '<user_trace>', 'exec'), globals(), _tr_ns)
finally:
    _sys_tr.settrace(None)
    _bi_tr.print = _tr_orig_print

# Close the final pending 'after' step using the namespace end-state
if _tr_pending[0] is not None:
    pend = _tr_pending[0]
    pl = pend['line']
    final_snap = _tr_snap({k: v for k, v in _tr_ns.items() if not k.startswith('_')})
    ann = None
    # If an if-line is still pending at end-of-code, its body never ran → condition was False
    ist = _tr_if_stmts.get(pl)
    if ist:
        ann = {'type': 'if_result', 'cond': ist['cond_src'], 'value': False}
    # If a for-line is still pending (e.g. empty iterable), loop is done
    fl = _tr_for_loops.get(pl)
    if fl and ann is None:
        ann = {'type': 'loop_done', 'var': fl['target']}
    _tr_steps.append({'line': pl, 'locals': final_snap, 'for_ctx': pend['for_ctx'],
                      'phase': 'after', 'ann': ann, 'output': ''.join(_tr_output)})

_wavelet_trace_result = _json_tr.dumps({
    'steps': _tr_steps,
    'prints': _tr_prints,
    'print_output': ''.join(_tr_output),
    'truncated': len(_tr_steps) >= 1000,
})
`;
}

// ── Output Display ───────────────────────────────────────────────────────────

function displayOutput(outputElement, content, type = 'normal', message = null) {
    const existingCanvas = outputElement.querySelector('.canvas-container');

    outputElement.innerHTML = '';
    outputElement.className = `output ${type}`;

    if (existingCanvas) outputElement.appendChild(existingCanvas);

    const scroll = document.createElement('div');
    scroll.className = 'output-text-scroll';

    if (!content.trim() && type !== 'running') {
        const empty = document.createElement('div');
        empty.className = 'output-empty';
        empty.textContent = '<program ran and produced no output>';
        scroll.appendChild(empty);
    }

    if (content.trim()) {
        const lines = content.split('\n');
        let truncated = content;
        let wasTruncated = false;
        if (lines.length > 1000) {
            truncated = lines.slice(0, 1000).join('\n');
            wasTruncated = true;
        }
        const contentDiv = document.createElement('div');
        contentDiv.className = 'output-content';
        contentDiv.textContent = truncated;
        scroll.appendChild(contentDiv);
        if (wasTruncated) {
            const truncDiv = document.createElement('div');
            truncDiv.className = 'output-truncated';
            truncDiv.textContent = `Output truncated after 1000 lines (${lines.length} total lines).`;
            scroll.appendChild(truncDiv);
        }
    }

    if (message) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `output-message ${type}`;
        msgDiv.textContent = message;
        scroll.appendChild(msgDiv);
    }

    outputElement.appendChild(scroll);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// escHtml is provided by trace-player.js (window.escHtml)

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
