// @ts-nocheck
// Scratchpad — free-form Python workspace with configurable inputs and canvas
/* global CodeExecutor, InputSystem, ErrorHandler, setupCanvasFunctions, autoFlushCanvas, resetCanvasState */

let codeExecutor = null;
let codeEditor = null;
let inputConfigs = []; // Array of { id, name, type, placeholder }
let tracePlayer = null;

// ── Trace Player ─────────────────────────────────────────────────────────────

class TracePlayer {
    constructor(steps, prints, editor) {
        this.steps = steps;   // [{line, locals}]  (line is 1-indexed)
        this.prints = prints; // [{at_step, text}]
        this.editor = editor;
        this.currentStep = -1;
        this.highlightedLine = -1;
        this.playTimer = null;
        this.prevLocals = {};
    }

    goToStep(n) {
        if (n < 0 || n >= this.steps.length) return;

        // Remove previous line highlight
        if (this.highlightedLine >= 0) {
            this.editor.removeLineClass(this.highlightedLine, 'background', 'trace-current-line');
            this.editor.removeLineClass(this.highlightedLine, 'gutter', 'trace-current-line-gutter');
        }

        this.currentStep = n;
        const step = this.steps[n];
        const lineIdx = step.line - 1; // CodeMirror is 0-indexed

        // Apply new line highlight
        this.editor.addLineClass(lineIdx, 'background', 'trace-current-line');
        this.editor.addLineClass(lineIdx, 'gutter', 'trace-current-line-gutter');
        this.editor.scrollIntoView({ line: lineIdx, ch: 0 }, 80);
        this.highlightedLine = lineIdx;

        this._renderVars(step.locals, step.for_ctx, step.phase, step.ann);
        this._renderOutput(n);
        this._updateControls();

        this.prevLocals = { ...step.locals };
    }

    _renderVars(locals, forCtx, phase, ann) {
        const panel = document.getElementById('trace-vars');
        const keys = Object.keys(locals);
        let html = '';

        // for-loop context chip
        if (forCtx) {
            let iterHtml;
            if (forCtx.items && forCtx.items.length > 0) {
                const k = forCtx.iteration ?? 0;
                const itemsHtml = forCtx.items.map((item, idx) => {
                    let cls = 'trace-iter-item';
                    if (idx < k)                          cls += ' consumed';
                    else if (idx === k && phase === 'before') cls += ' current';
                    else if (idx <= k && phase === 'after')   cls += ' consumed';
                    return `<span class="${cls}">${escHtml(item)}</span>`;
                }).join('<span class="trace-iter-sep">, </span>');
                iterHtml = `[${itemsHtml}]`;
            } else {
                iterHtml = escHtml(forCtx.iter);
            }
            html += `<div class="trace-for-ctx">
                <span class="trace-for-kw">for</span>
                <span class="trace-for-target">${escHtml(forCtx.target)}</span>
                <span class="trace-for-kw">in</span>
                <span class="trace-for-iter-items">${iterHtml}</span>
            </div>`;
        }

        // annotation chip
        if (ann) {
            if (ann.type === 'loop_done') {
                html += `<div class="trace-ann trace-ann-done">loop complete</div>`;
            } else if (ann.type === 'loop_assigned') {
                html += `<div class="trace-ann trace-ann-assign">${escHtml(ann.value)} → ${escHtml(ann.var)}</div>`;
            } else if (ann.type === 'if_result') {
                const cls = ann.value ? 'trace-ann-true' : 'trace-ann-false';
                const icon = ann.value ? '✓ true' : '✗ false';
                html += `<div class="trace-ann ${cls}">${escHtml(ann.cond)} → ${icon}</div>`;
            } else if (ann.type === 'print') {
                const preview = ann.preview != null
                    ? ` → <span class="trace-ann-print-val">"${escHtml(ann.preview)}"</span>`
                    : '';
                html += `<div class="trace-ann trace-ann-print">print${preview}</div>`;
            } else if (ann.type === 'if_test') {
                html += `<div class="trace-ann trace-ann-if">if ${escHtml(ann.cond)}</div>`;
            }
        }

        if (keys.length === 0 && !forCtx && !ann) {
            html += '<span class="trace-empty">No variables yet</span>';
        } else {
            html += keys.map(k => {
                const changed = this.prevLocals[k] !== locals[k];
                return `<div class="trace-var-row${changed ? ' trace-var-changed' : ''}">
                    <span class="trace-var-name">${escHtml(k)}</span>
                    <span class="trace-var-eq">=</span>
                    <span class="trace-var-value">${escHtml(locals[k])}</span>
                </div>`;
            }).join('');
        }

        panel.innerHTML = html;
    }

    _renderOutput(upToStep) {
        const text = this.prints
            .filter(p => p.at_step <= upToStep)
            .map(p => p.text)
            .join('');
        const panel = document.getElementById('trace-output-panel');
        const content = document.getElementById('trace-output');
        if (text) {
            content.textContent = text;
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }

    _updateControls() {
        const n = this.currentStep;
        const max = this.steps.length - 1;
        document.getElementById('trace-first').disabled = n <= 0;
        document.getElementById('trace-prev').disabled = n <= 0;
        document.getElementById('trace-next').disabled = n >= max;
        document.getElementById('trace-last').disabled = n >= max;
        document.getElementById('trace-slider').value = n;
        const phase = this.steps[n].phase === 'after' ? ' · after' : '';
        document.getElementById('trace-step-count').textContent = `Step ${n + 1} / ${this.steps.length}${phase}`;
    }

    play() {
        if (this.playTimer) return;
        if (this.currentStep >= this.steps.length - 1) this.goToStep(0);
        const speed = parseInt(document.getElementById('trace-speed').value);
        document.getElementById('trace-play').textContent = '⏸ Pause';
        const advance = () => {
            if (this.currentStep >= this.steps.length - 1) { this.pause(); return; }
            this.goToStep(this.currentStep + 1);
        };
        this.playTimer = setInterval(advance, speed);
    }

    pause() {
        if (this.playTimer) { clearInterval(this.playTimer); this.playTimer = null; }
        document.getElementById('trace-play').textContent = '▶ Play';
    }

    cleanup() {
        this.pause();
        if (this.highlightedLine >= 0) {
            this.editor.removeLineClass(this.highlightedLine, 'background', 'trace-current-line');
            this.editor.removeLineClass(this.highlightedLine, 'gutter', 'trace-current-line-gutter');
            this.highlightedLine = -1;
        }
    }
}

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
            saveState();
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

        tracePlayer = new TracePlayer(steps, prints, codeEditor);
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
                                  'phase': 'after', 'ann': ann})
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
                              'phase': 'before', 'ann': ann_before})
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
    final_snap = _tr_snap({k: v for k, v in _tr_ns.items() if not k.startswith('_')})
    _tr_steps.append({'line': pend['line'], 'locals': final_snap, 'for_ctx': pend['for_ctx'],
                      'phase': 'after', 'ann': None})

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

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
