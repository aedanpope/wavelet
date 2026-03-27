// Scratchpad — free-form Python workspace with configurable inputs and canvas

let codeExecutor = null;
let codeEditor = null;
let inputConfigs = []; // Array of { id, name, type, placeholder }

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
        if (confirm('Clear all code?')) { codeEditor.setValue(''); saveState(); }
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
