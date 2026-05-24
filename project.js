// Project page: two-column band-based layout.
//
// Tasks are grouped into three bands:
//   Band 1 - 1:1 task/area pairs (task card left, function editor right).
//   Band 2 - cross-area tasks (full-width informational card, no editor).
//   Band 3 - freestyle (task card left, blank-slate editor right, runs at
//            module scope rather than wrapped in a def).
//
// Each task carries a tier (D / C / A-B). D-tier tasks are machine-validated;
// A-B tier tasks use self-check pills the student ticks; C tasks default to
// machine-validated but can self-check when the spec is genuinely subjective.

const PARAM_PROJECT = 'project';
const DEFAULT_PROJECT = 'pixel-game';
const BODY_INDENT = '  ';
const SUPPORTS_FSA = typeof window !== 'undefined' && 'showOpenFilePicker' in window;
const PY_FILE_TYPE = {
    description: 'Python file',
    accept: { 'text/x-python': ['.py'] }
};
const FILE_HEADER_MARKER = '# Wavelet';
const FREESTYLE_SECTION_MARKER = '# ── Freestyle ──';
const SELFCHECK_STORAGE_PREFIX = 'wavelet-project-selfcheck';

let executor = null;
let projectDef = null;
const taskEditors = new Map(); // taskId -> { cm, editorEl, statusEl, errorEl, task, isFreestyle }
const selfCheckPills = new Map(); // taskId -> pill element
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
        restoreSelfCheckPills();
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

// ─── Top-level rendering ────────────────────────────────────────────────

function renderProject() {
    document.title = `${projectDef.title} - Python Learning Platform`;
    document.getElementById('project-title').textContent = projectDef.title;
    document.getElementById('project-description').textContent = projectDef.description || '';
    document.getElementById('project-intro').innerHTML = projectDef.intro || '';
    buildSetupCard();
    renderBands();

    document.getElementById('run-project-btn').addEventListener('click', runProject);
    document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('click', () => onKeyPress(btn.dataset.key));
    });

    // Stage fullscreen toggle: lets students blow up the canvas + d-pad
    // to play mode once their project is running.
    const fsBtn = document.getElementById('stage-fullscreen-btn');
    if (fsBtn) fsBtn.addEventListener('click', toggleStageFullscreen);

    // Save / Open
    document.getElementById('save-file-btn').addEventListener('click', saveProject);
    document.getElementById('open-file-btn').addEventListener('click', openProject);
    document.getElementById('file-input').addEventListener('change', handleFallbackFileInput);

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveProject();
            return;
        }
        if (e.key === 'Escape') {
            const stage = document.getElementById('project-stage');
            if (stage && stage.classList.contains('project-stage--fullscreen')) {
                e.preventDefault();
                toggleStageFullscreen();
            }
            return;
        }
        // Arrow keys drive the player when the game area has focus, ie. no
        // editor or form field is currently focused. Lets students play with
        // the keyboard rather than reaching for the on-screen d-pad once the
        // project is running.
        const dirMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const dir = dirMap[e.key];
        if (dir && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditingFocus(document.activeElement)) {
            e.preventDefault();
            onKeyPress(dir);
        }
    });

    // Warn before leaving with unsaved edits.
    window.addEventListener('beforeunload', e => {
        if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
}

// Walk the JSON tasks in order, group consecutive entries into bands.
// Concept cards reset the current band - they render full-width between
// bands. A {type:"setup-anchor"} block injects the State card at that
// position. If no anchor is present, the State card sits at the top of
// the bands (legacy default).
function renderBands() {
    const host = document.getElementById('project-bands');
    host.innerHTML = '';

    const entries = projectDef.tasks || [];
    const hasAnchor = entries.some(b => b.type === 'setup-anchor');

    let currentBandEl = null;
    let currentBandKind = null;
    const closeBand = () => { currentBandEl = null; currentBandKind = null; };

    if (!hasAnchor && setupCardState) {
        host.appendChild(setupCardState.card);
    }

    for (const block of entries) {
        if (block.type === 'concept') {
            closeBand();
            host.appendChild(window.ProblemRenderer.createConceptElement(block));
            continue;
        }
        if (block.type === 'setup-anchor') {
            closeBand();
            if (setupCardState) host.appendChild(setupCardState.card);
            continue;
        }
        const kind = bandFor(block);
        if (kind !== currentBandKind) {
            closeBand();
            currentBandEl = openBand(kind);
            host.appendChild(currentBandEl);
            currentBandKind = kind;
        }
        appendToBand(currentBandEl, currentBandKind, block);
    }
}

function bandFor(task) {
    if (task.freestyle) return 3;
    if (task.crossArea) return 2;
    return 1;
}

function openBand(kind) {
    const section = document.createElement('section');
    section.className = `project-band project-band-${kind}`;
    section.dataset.band = String(kind);

    const label = document.createElement('div');
    label.className = 'band-label';
    label.textContent = {
        1: 'Step by step',
        2: 'Combine your code',
        3: 'Freestyle'
    }[kind] || '';
    section.appendChild(label);

    const inner = document.createElement('div');
    inner.className = `band-grid band-grid-${kind}`;
    section.appendChild(inner);
    section._inner = inner;
    return section;
}

function appendToBand(bandEl, kind, task) {
    const inner = bandEl._inner;
    if (kind === 1 || kind === 3) {
        const { taskCard, areaCard } = renderPair(task, kind === 3);
        inner.appendChild(taskCard);
        inner.appendChild(areaCard);
    } else if (kind === 2) {
        inner.appendChild(renderCrossAreaCard(task));
    }
}

// ─── Setup card (unchanged shape) ────────────────────────────────────────

// Setup state. The card is built up-front so initTaskEditors can wire
// CodeMirror; renderBands decides where to insert it (default = at the
// top, or wherever a setup-anchor block in the JSON places it).
let setupCardState = null;

function buildSetupCard() {
    const card = document.createElement('article');
    card.className = 'project-task project-setup';
    card.dataset.taskId = '__setup__';

    const header = document.createElement('header');
    header.className = 'project-task-header';
    header.innerHTML = `
        <div class="project-task-titles">
            <span class="task-number setup-number">⚙</span>
            <h3 class="task-title">State</h3>
        </div>
        <span class="task-status task-status-pending" data-status>○ ready</span>
    `;
    card.appendChild(header);

    const guidance = document.createElement('div');
    guidance.className = 'task-guidance';
    guidance.innerHTML = '<p>The locked top line creates the <code>state</code> object. Below it are the player\'s position variables, read or change them in any task. Add your own if you want to remember other things between key presses (a score, a colour, a high-water mark&hellip;).</p>';
    card.appendChild(guidance);

    const editorFrame = document.createElement('div');
    editorFrame.className = 'task-editor-frame';

    const editorEl = document.createElement('div');
    editorEl.className = 'task-editor setup-editor';
    editorFrame.appendChild(editorEl);

    card.appendChild(editorFrame);

    const setupError = document.createElement('div');
    setupError.className = 'task-error';
    setupError.style.display = 'none';
    card.appendChild(setupError);

    setupCardState = {
        card,
        editorEl,
        statusEl: header.querySelector('[data-status]'),
        errorEl: setupError,
    };
}

// Compatibility shim for code that used to read the setup state via
// document.getElementById('project-setup-host'). Returns an object with
// the same _editorEl / _statusEl / _errorEl fields the old host had.
function getSetupHost() {
    return setupCardState ? {
        _editorEl: setupCardState.editorEl,
        _statusEl: setupCardState.statusEl,
        _errorEl: setupCardState.errorEl,
    } : null;
}

// ─── Card rendering ──────────────────────────────────────────────────────

// Returns { taskCard, areaCard } for a Band 1 or Band 3 task.
function renderPair(task, isFreestyle) {
    const taskCard = makeTaskCard(task);
    const areaCard = makeAreaCard(task, isFreestyle);

    // Register the area editor so initTaskEditors() can wire CodeMirror.
    taskEditors.set(task.id, {
        cm: null,
        editorEl: areaCard._editorEl,
        statusEl: taskCard._statusEl,
        // areaErrorEl: syntax/runtime errors that are about the code itself
        // (shown on the area card next to the editor).
        // cardErrorEl: validation rule messages (shown at the bottom of the
        // task card on the left, so the pill in the header stays a tiny ✗).
        errorEl: areaCard._errorEl,
        cardErrorEl: taskCard._cardErrorEl,
        task,
        isFreestyle,
    });

    return { taskCard, areaCard };
}

function makeTaskCard(task) {
    const card = document.createElement('article');
    card.className = `project-task project-task-card tier-${tierClass(task.tier)}`;
    card.dataset.taskId = task.id;

    const { header, statusEl } = makeTaskHeader(task);
    card.appendChild(header);
    card._statusEl = statusEl;

    const guidance = document.createElement('div');
    guidance.className = 'task-guidance';
    guidance.innerHTML = task.guidance || '';
    card.appendChild(guidance);

    // Full error message lives here, at the bottom of the task card, so the
    // status pill in the header can stay as a tiny ✗ icon. Hidden when the
    // task is passing or not yet run.
    const taskCardError = document.createElement('div');
    taskCardError.className = 'task-error task-card-error';
    taskCardError.style.display = 'none';
    card.appendChild(taskCardError);
    card._cardErrorEl = taskCardError;

    return card;
}

function makeTaskHeader(task) {
    const header = document.createElement('header');
    header.className = 'project-task-header';

    const titles = document.createElement('div');
    titles.className = 'project-task-titles';
    titles.innerHTML = `
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        ${optionalBadgeHtml(task)}
    `;
    header.appendChild(titles);

    const statusEl = task.selfCheck
        ? makeSelfCheckPill(task)
        : makeDefaultStatusPill();
    header.appendChild(statusEl);

    return { header, statusEl };
}

function makeDefaultStatusPill() {
    const s = document.createElement('span');
    s.className = 'task-status task-status-pending';
    s.textContent = '○ not run';
    return s;
}

function makeSelfCheckPill(task) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'task-status task-status-selfcheck';
    pill.dataset.taskId = task.id;
    pill.innerHTML = '☐ <span class="pill-label">tick when done</span>';
    pill.addEventListener('click', () => toggleSelfCheck(task.id));
    selfCheckPills.set(task.id, pill);
    return pill;
}

function toggleSelfCheck(taskId) {
    const pill = selfCheckPills.get(taskId);
    if (!pill) return;
    const isChecked = pill.classList.contains('checked');
    setSelfCheckPill(taskId, !isChecked);
    saveSelfCheckState(taskId, !isChecked);
}

function setSelfCheckPill(taskId, checked) {
    const pill = selfCheckPills.get(taskId);
    if (!pill) return;
    pill.classList.toggle('checked', checked);
    pill.innerHTML = checked
        ? '☑ <span class="pill-label">done · self</span>'
        : '☐ <span class="pill-label">tick when done</span>';
}

function selfCheckKey(taskId) {
    return `${SELFCHECK_STORAGE_PREFIX}:${projectDef.id}:${taskId}`;
}

function saveSelfCheckState(taskId, checked) {
    try {
        if (checked) localStorage.setItem(selfCheckKey(taskId), '1');
        else localStorage.removeItem(selfCheckKey(taskId));
    } catch (_e) { /* localStorage may be unavailable; tick state is in-memory only */ }
}

function restoreSelfCheckPills() {
    for (const [taskId] of selfCheckPills) {
        try {
            if (localStorage.getItem(selfCheckKey(taskId)) === '1') {
                setSelfCheckPill(taskId, true);
            }
        } catch (_e) { /* ignore */ }
    }
}

function makeAreaCard(task, isFreestyle) {
    const card = document.createElement('article');
    card.className = `project-area-card${isFreestyle ? ' project-area-freestyle' : ''}`;
    card.dataset.taskId = task.id;

    const header = document.createElement('header');
    header.className = 'area-card-header';
    const sig = areaSignatureFor(task, isFreestyle);
    header.innerHTML = `
        <code class="area-signature">${escapeHtml(sig)}</code>
        <span class="area-syntax-badge" data-syntax style="display:none;">⚠ syntax error</span>
    `;
    card.appendChild(header);

    if (task.areaDescription) {
        const desc = document.createElement('div');
        desc.className = 'area-description';
        desc.textContent = task.areaDescription;
        card.appendChild(desc);
    }

    const editorFrame = document.createElement('div');
    editorFrame.className = 'task-editor-frame';
    const editorEl = document.createElement('div');
    editorEl.className = 'task-editor';
    editorFrame.appendChild(editorEl);
    card.appendChild(editorFrame);

    const taskError = document.createElement('div');
    taskError.className = 'task-error';
    taskError.style.display = 'none';
    card.appendChild(taskError);

    card._editorEl = editorEl;
    card._errorEl = taskError;
    card._syntaxBadge = header.querySelector('[data-syntax]');

    return card;
}

// Band 2 cross-area task: full-width card, no editor. Lists area chips so the
// student knows which editors to open.
function renderCrossAreaCard(task) {
    const card = document.createElement('article');
    card.className = `project-task project-task-card project-cross-area tier-${tierClass(task.tier)}`;
    card.dataset.taskId = task.id;

    const header = document.createElement('header');
    header.className = 'project-task-header';

    const titles = document.createElement('div');
    titles.className = 'project-task-titles';
    const chipHtml = (task.areaChips || [])
        .map(c => `<span class="area-chip">${escapeHtml(c)}</span>`)
        .join('');
    titles.innerHTML = `
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        ${optionalBadgeHtml(task)}
        <div class="area-chips">${chipHtml}</div>
    `;
    header.appendChild(titles);

    const statusEl = task.selfCheck ? makeSelfCheckPill(task) : makeDefaultStatusPill();
    header.appendChild(statusEl);

    card.appendChild(header);
    card._statusEl = statusEl;

    const guidance = document.createElement('div');
    guidance.className = 'task-guidance';
    guidance.innerHTML = task.guidance || '';
    card.appendChild(guidance);

    const taskCardError = document.createElement('div');
    taskCardError.className = 'task-error task-card-error';
    taskCardError.style.display = 'none';
    card.appendChild(taskCardError);
    card._cardErrorEl = taskCardError;

    return card;
}

function areaSignatureFor(task, isFreestyle) {
    if (isFreestyle) return '# ' + (task.function || 'your_additions');
    if (isMultiFunction(task)) {
        const names = task.functions.map(f => f.name + '()');
        return '# ' + names.join(', ');
    }
    return 'def ' + task.function + '():';
}

function tierClass(tier) {
    if (tier === 'D') return 'd';
    if (tier === 'C') return 'c';
    if (tier === 'A-B' || tier === 'AB' || tier === 'A/B') return 'ab';
    return 'unknown';
}

// Visible badge on task cards. D-tier is the "required core" of the
// project, so it gets no badge. C and A-B are stretch tasks and show
// "optional" so students don't feel they have to finish everything.
// The underlying tier field is still tracked in projectDef for future
// teacher views (grading guide, completion sweep, etc.).
function optionalBadgeHtml(task) {
    const t = task.tier;
    if (!t || t === 'D') return '';
    return '<span class="optional-badge" title="Optional, finish the required tasks first if you want">optional</span>';
}

// ─── Editor init ─────────────────────────────────────────────────────────

function initTaskEditors() {
    // Setup editor first so it's positioned above the task editors.
    const setupHost = getSetupHost();
    if (setupHost && setupHost._editorEl) {
        setupEditor = CodeMirror(setupHost._editorEl, {
            value: buildSetupSource(projectDef.editablePreamble),
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
        const seedLines = countSeedLines();
        setupEditor.setSize('100%', '12.5em');
        if (seedLines > 0) {
            setupEditor.on('beforeChange', (_cm, change) => {
                if (change.origin === 'setValue') return;
                if (change.from.line < seedLines) change.cancel();
            });
            for (let i = 0; i < seedLines; i++) {
                setupEditor.addLineClass(i, 'background', 'cm-def-line');
                setupEditor.addLineClass(i, 'wrap', 'cm-def-line-wrap');
            }
        }
        setupEditor.on('change', (_cm, change) => {
            if (change.origin !== 'setValue') markDirty();
        });
    }

    for (const entry of taskEditors.values()) {
        const { editorEl, task, isFreestyle } = entry;
        const multi = isMultiFunction(task);
        const initialValue = isFreestyle
            ? (task.starterBody || '')
            : multi
                ? buildMultiFunctionSource(task.functions)
                : buildEditorSource(task.function, task.starterBody);
        const cm = CodeMirror(editorEl, {
            value: initialValue,
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

        if (!isFreestyle) {
            // Lock every line that starts with `def ` (so single-def
            // tasks lock line 0 and multi-function tasks lock all four
            // def lines). The check is dynamic, so as the student adds
            // body lines and pushes the next def down, the right line
            // stays locked.
            cm.on('beforeChange', (_cm, change) => {
                if (change.origin === 'setValue') return;
                const ln = cm.getLine(change.from.line) || '';
                if (ln.startsWith('def ')) change.cancel();
            });
            const markDefLines = () => {
                cm.eachLine(line => {
                    const i = cm.getLineNumber(line);
                    const isDef = line.text.startsWith('def ');
                    const op = isDef ? 'addLineClass' : 'removeLineClass';
                    cm[op](i, 'background', 'cm-def-line');
                    cm[op](i, 'wrap', 'cm-def-line-wrap');
                });
            };
            markDefLines();
            cm.on('change', markDefLines);
        }

        if (isFreestyle) {
            // Freestyle editor auto-grows with content rather than
            // overflow-scrolling. min-height keeps a fresh project from
            // starting with a tiny box; after that, newlines extend it.
            cm.setSize('100%', 'auto');
            const minLines = task.editorHeight || 6;
            cm.getWrapperElement().style.minHeight = `${minLines * 1.5}em`;
        } else {
            const heightLines = (task.editorHeight || 6) + (multi ? task.functions.length : 1);
            cm.setSize('100%', `${heightLines * 1.5}em`);
        }
        cm.on('change', (_cm, change) => {
            if (change.origin !== 'setValue') markDirty();
        });

        entry.cm = cm;
    }

    if (setupEditor) setupEditor.refresh();
    for (const entry of taskEditors.values()) {
        if (entry.cm) entry.cm.refresh();
    }
}

function buildEditorSource(fnName, body) {
    const trimmed = (body || '').replace(/\s+$/g, '');
    const bodyLines = trimmed === '' ? ['pass'] : trimmed.split('\n');
    const indented = bodyLines.map(l => l === '' ? '' : BODY_INDENT + l).join('\n');
    return `def ${fnName}():\n${indented}\n`;
}

// A task with `functions: [...]` hosts multiple function defs in a
// single editor. Used for things like the four arrow-button handlers,
// where the student fills in tightly-related bodies side by side.
function isMultiFunction(task) {
    return Array.isArray(task.functions) && task.functions.length > 0;
}

function getTaskFunctionNames(task) {
    if (task.freestyle) return [];
    if (isMultiFunction(task)) return task.functions.map(f => f.name);
    if (task.function) return [task.function];
    return [];
}

// Build the editor value for a multi-function area by concatenating each
// function's def + body, separated by blank lines.
function buildMultiFunctionSource(funcs) {
    return funcs.map(f => buildEditorSource(f.name, f.starterBody)).join('\n');
}

function buildSetupSource(editablePart) {
    const seed = projectDef.setupSeed || '';
    return seed + (editablePart || '');
}

function countSeedLines() {
    const seed = projectDef.setupSeed || '';
    if (!seed) return 0;
    return seed.replace(/\n$/, '').split('\n').length;
}

function seedLockedLines() {
    const seed = projectDef.setupSeed || '';
    return seed.replace(/\n$/, '').split('\n').filter(l => l.trim() !== '');
}

// Real coding tasks: have an editor (Band 1 or Band 3). Excludes concept
// cards, setup-anchor placeholders, and Band 2 cross-area tasks.
function getCodingTasks() {
    return (projectDef.tasks || []).filter(t => !t.type && !t.crossArea);
}

// Function-defined tasks only (Band 1). Excludes freestyle (which runs at
// module scope) and cross-area (no function at all).
function getFunctionTasks() {
    return getCodingTasks().filter(t => !t.freestyle);
}

function getFreestyleTask() {
    return (projectDef.tasks || []).find(t => t.freestyle);
}

// ─── Run flow ────────────────────────────────────────────────────────────

async function runProject() {
    resetAllStatus();

    const seg = assembleProgramSegmented();

    const preambleSyntaxErr = seg.preambleSrc.trim() ? checkSyntax(seg.preambleSrc) : null;
    if (preambleSyntaxErr) setSetupError(preambleSyntaxErr);

    const freestyleSyntaxErr = seg.freestyleSrc.trim() ? checkSyntax(seg.freestyleSrc) : null;
    if (freestyleSyntaxErr && seg.freestyleTaskId) {
        markTaskError(seg.freestyleTaskId, freestyleSyntaxErr);
    }

    await executor.resetPythonEnvironment(0);
    setupCanvasFunctions(executor.getPyodide(), 0);
    const py = executor.getPyodide();

    // 0. Locked preamble.
    for (const line of (projectDef.lockedPreamble || [])) {
        try {
            await py.runPythonAsync(line);
        } catch (err) {
            displayGlobalError(`Couldn't initialise the canvas: ${extractPythonError(err)}`);
            return finalizeRunStatus();
        }
    }

    // 1. Setup preamble.
    if (!preambleSyntaxErr && seg.preambleSrc.trim()) {
        try {
            await py.runPythonAsync(seg.preambleSrc);
        } catch (err) {
            setSetupError(extractPythonError(err));
            return finalizeRunStatus();
        }
    }

    // 2. Freestyle code at module scope (after setup, before function defs).
    if (!freestyleSyntaxErr && seg.freestyleSrc.trim() && seg.freestyleTaskId) {
        try {
            await py.runPythonAsync(seg.freestyleSrc);
        } catch (err) {
            markTaskError(seg.freestyleTaskId, extractPythonError(err));
            // Don't abort; the rest of the project may still work without freestyle.
        }
    }

    // 3. Per-task function definitions.
    for (const def of seg.fnDefs) {
        if (def.syntaxError) {
            markTaskError(def.taskId, def.syntaxError);
            continue;
        }
        try {
            await py.runPythonAsync(def.src);
        } catch (err) {
            markTaskError(def.taskId, extractPythonError(err));
        }
    }

    // 4. Extras preserved from open file.
    if (seg.extrasSrc.trim()) {
        try {
            await py.runPythonAsync(seg.extrasSrc);
        } catch (err) {
            setExtrasError(extractPythonError(err));
        }
    }

    // 5. Attribution helper.
    await installAttributionHelper();

    // 6. Initial scene render.
    const sceneResult = await callWithAttribution('draw_scene');
    setPlayInfo(sceneResult.output);
    if (!sceneResult.ok) {
        const taskId = taskIdForFunction(sceneResult.in_function);
        if (taskId) markTaskError(taskId, sceneResult.error_msg);
        else displayGlobalError(sceneResult.error_msg);
    }

    // 7. Per-task validation. Self-check tasks skip programmatic validation.
    for (const [taskId, entry] of taskEditors.entries()) {
        if (entry.statusEl.classList.contains('task-status-fail')) continue;
        if (entry.task.selfCheck) continue;
        const result = await validateTask(entry.task);
        applyValidationResult(taskId, result);
    }

    finalizeRunStatus();
}

function extractPythonError(err) {
    const msg = (err && err.message) ? err.message : String(err);
    const lines = msg.split('\n').map(s => s.trim()).filter(Boolean);
    let lineNo = null;
    for (const ln of lines) {
        const m = ln.match(/line\s+(\d+)/i);
        if (m) lineNo = parseInt(m[1], 10);
    }
    let core = lines[lines.length - 1] || msg;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (/^[A-Z][A-Za-z]*(Error|Exception|Warning):/.test(lines[i])) {
            core = lines[i];
            break;
        }
    }
    return lineNo ? `Line ${lineNo}: ${core}` : core;
}

async function installAttributionHelper() {
    const py = executor.getPyodide();
    const knownNames = [];
    for (const t of getFunctionTasks()) knownNames.push(...getTaskFunctionNames(t));
    py.globals.set('_wavelet_known_names', py.toPy(knownNames));
    py.runPython(`
import sys, io

def _wavelet_call_safely(fn_name):
    known = set(_wavelet_known_names)
    fn = globals().get(fn_name)
    if not callable(fn):
        return {'ok': False,
                'error_msg': f"'{fn_name}' is not defined yet",
                'in_function': fn_name,
                'line': None,
                'output': ''}
    # Redirect stdout into a buffer so print() calls from inside the
    # student's function are captured and surfaced in the play-info
    # panel under the canvas. We restore stdout in the finally so any
    # unrelated print() (e.g. from validation) goes to the console.
    old_stdout = sys.stdout
    buf = io.StringIO()
    sys.stdout = buf
    try:
        fn()
        return {'ok': True, 'in_function': None, 'error_msg': None,
                'line': None, 'output': buf.getvalue()}
    except Exception as e:
        deepest = fn_name
        deepest_line = None
        tb = e.__traceback__
        while tb is not None:
            frame_name = tb.tb_frame.f_code.co_name
            if frame_name in known:
                deepest = frame_name
                deepest_line = tb.tb_lineno
            tb = tb.tb_next
        prefix = f'Line {deepest_line}: ' if deepest_line else ''
        return {'ok': False,
                'error_msg': f'{prefix}{type(e).__name__}: {e}',
                'in_function': deepest,
                'line': deepest_line,
                'output': buf.getvalue()}
    finally:
        sys.stdout = old_stdout
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
        return { ok: false, error_msg: extractPythonError(err), in_function: fnName, output: '' };
    }
}

// Surface whatever the student's draw_scene (or handlers) print() into
// the panel below the canvas. Replaces panel content on each call so it
// always reflects the most recent frame's output. Hidden when empty.
function setPlayInfo(text) {
    const panel = document.getElementById('play-info');
    if (!panel) return;
    const trimmed = (text || '').replace(/\s+$/, '');
    if (trimmed) {
        panel.textContent = trimmed;
        panel.style.display = '';
    } else {
        panel.textContent = '';
        panel.style.display = 'none';
    }
}

// Combines handler output + draw_scene output into a single panel update.
function setPlayInfoFromFrame(...parts) {
    setPlayInfo(parts.filter(Boolean).map(s => s.replace(/\s+$/, '')).filter(Boolean).join('\n'));
}

function taskIdForFunction(fnName) {
    for (const t of getFunctionTasks()) {
        if (getTaskFunctionNames(t).includes(fnName)) return t.id;
    }
    return null;
}

async function runDrawScene() {
    const py = executor.getPyodide();
    try {
        await py.runPythonAsync('clear()');
    } catch (_e) { /* canvas may not yet be initialised */ }
    return callWithAttribution('draw_scene');
}

async function onKeyPress(direction) {
    if (!executor || !executor.isReady()) return;
    const fnName = `on_${direction}_key`;

    const py = executor.getPyodide();
    if (!py.globals.get('_wavelet_call_safely')) {
        document.getElementById('project-status').innerHTML =
            'Click <strong>Run Project</strong> first to load your code.';
        return;
    }

    const handlerResult = await callWithAttribution(fnName);
    if (!handlerResult.ok) {
        const taskId = taskIdForFunction(handlerResult.in_function);
        if (taskId) markTaskError(taskId, handlerResult.error_msg);
        else displayGlobalError(handlerResult.error_msg);
        setPlayInfo(handlerResult.output);
        finalizeRunStatus();
        return;
    }

    try { await py.runPythonAsync('clear()'); } catch (_e) { /* clear is best-effort */ }
    const sceneResult = await callWithAttribution('draw_scene');
    // Show both handler and draw_scene output in the panel - handler runs
    // first (changes state), draw_scene renders that state. Either or both
    // may have called print().
    setPlayInfoFromFrame(handlerResult.output, sceneResult.output);
    if (!sceneResult.ok) {
        const taskId = taskIdForFunction(sceneResult.in_function);
        if (taskId) markTaskError(taskId, sceneResult.error_msg);
        else displayGlobalError(sceneResult.error_msg);
        finalizeRunStatus();
    }
}

// ─── Status / error UI ──────────────────────────────────────────────────

function resetAllStatus() {
    setPlayInfo('');
    const host = getSetupHost();
    if (host && host._statusEl) {
        host._statusEl.className = 'task-status task-status-pending';
        host._statusEl.textContent = '○ ready';
    }
    if (host && host._errorEl) host._errorEl.style.display = 'none';

    for (const entry of taskEditors.values()) {
        if (entry.cardErrorEl) entry.cardErrorEl.style.display = 'none';
        // Self-check pills stay as the student left them - they're not reset
        // by a project run.
        if (entry.task.selfCheck) {
            entry.errorEl.style.display = 'none';
            const card = entry.editorEl.closest('.project-area-card');
            if (card && card._syntaxBadge) card._syntaxBadge.style.display = 'none';
            continue;
        }
        entry.statusEl.className = 'task-status task-status-pending';
        entry.statusEl.textContent = '○ ready';
        entry.errorEl.style.display = 'none';
        const card = entry.editorEl.closest('.project-area-card');
        if (card && card._syntaxBadge) card._syntaxBadge.style.display = 'none';
    }

    const status = document.getElementById('project-status');
    if (status) status.innerHTML = 'Running…';
}

function setSetupError(msg) {
    const host = getSetupHost();
    if (!host || !host._statusEl) return;
    host._statusEl.className = 'task-status task-status-fail';
    host._statusEl.textContent = '✗ error';
    host._errorEl.style.display = 'block';
    host._errorEl.textContent = msg;
}

function setExtrasError(msg) {
    console.warn('Extras error:', msg);
}

function displayGlobalError(msg) {
    const status = document.getElementById('project-status');
    if (status) status.innerHTML = `<strong>Error:</strong> ${escapeHtml(msg)}`;
}

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
}

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

function assembleProgramSegmented() {
    const editablePreamble = setupEditor ? setupEditor.getValue() : (projectDef.editablePreamble || '');
    const preambleSrc = editablePreamble.trim() ? editablePreamble.replace(/\s+$/g, '') : '';

    let freestyleSrc = '';
    let freestyleTaskId = null;
    const freestyleTask = getFreestyleTask();
    if (freestyleTask) {
        const entry = taskEditors.get(freestyleTask.id);
        if (entry && entry.cm) {
            freestyleSrc = entry.cm.getValue().replace(/\s+$/g, '');
            freestyleTaskId = freestyleTask.id;
        }
    }

    const fnDefs = [];
    for (const task of getFunctionTasks()) {
        const entry = taskEditors.get(task.id);
        let src;
        if (entry && entry.cm) {
            src = entry.cm.getValue();
        } else if (isMultiFunction(task)) {
            src = buildMultiFunctionSource(task.functions);
        } else {
            src = buildEditorSource(task.function, task.starterBody);
        }
        const syntaxError = checkSyntax(src);
        fnDefs.push({ taskId: task.id, src, syntaxError });
    }

    const extrasSrc = (currentExtras && currentExtras.trim()) ? currentExtras : '';

    return { preambleSrc, freestyleSrc, freestyleTaskId, fnDefs, extrasSrc };
}

function checkSyntax(src) {
    try {
        const py = executor.getPyodide();
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
    // For self-check tasks, surface the error on the area card without
    // overwriting the student's self-check pill.
    if (entry.task.selfCheck) {
        entry.errorEl.style.display = 'block';
        entry.errorEl.textContent = msg;
        const card = entry.editorEl.closest('.project-area-card');
        if (card && card._syntaxBadge) card._syntaxBadge.style.display = '';
        return;
    }
    entry.statusEl.className = 'task-status task-status-fail';
    entry.statusEl.textContent = '✗ error';
    entry.errorEl.style.display = 'block';
    entry.errorEl.textContent = msg;
}

// ─── Per-task validation ────────────────────────────────────────────────

async function validateTask(task) {
    const rules = (task.validation && task.validation.rules) || [];
    if (rules.length === 0) return { pass: true, kind: 'none' };

    for (const rule of rules) {
        if (rule.type === 'function_runs_clean') {
            // Multi-function tasks check every named function so empty
            // bodies (pass) still register as runnable.
            const names = getTaskFunctionNames(task);
            for (const name of names) {
                const r = await ruleFunctionRunsClean(name);
                if (!r.pass) return r;
            }
        } else if (rule.type === 'function_fills_cells') {
            const r = await ruleFunctionFillsCells(task, rule);
            if (!r.pass) return r;
        } else if (rule.type === 'state_change') {
            const r = await ruleStateChange(rule);
            if (!r.pass) return r;
        }
    }
    return { pass: true, kind: 'pass' };
}

async function ruleFunctionRunsClean(fnName) {
    const py = executor.getPyodide();
    try {
        await py.runPythonAsync(`
_wavelet_err = None
# Snapshot the project's state object so a validation call that mutates
# state (e.g. on_left_key doing state.player_x -= 1) doesn't leave the
# player in a different position than the student expects.
_wavelet_state_snapshot = dict(state.__dict__) if 'state' in globals() and hasattr(state, '__dict__') else None
try:
    ${fnName}()
except Exception as _e:
    _wavelet_err = repr(_e)
finally:
    if _wavelet_state_snapshot is not None:
        state.__dict__.clear()
        state.__dict__.update(_wavelet_state_snapshot)
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
        await py.runPythonAsync(`
_canvas_state['grid'] = {}
_canvas_state['commands'] = []
_wavelet_err = None
# See ruleFunctionRunsClean for why we snapshot state here.
_wavelet_state_snapshot = dict(state.__dict__) if 'state' in globals() and hasattr(state, '__dict__') else None
try:
    ${task.function}()
except Exception as _e:
    _wavelet_err = repr(_e)
finally:
    if _wavelet_state_snapshot is not None:
        state.__dict__.clear()
        state.__dict__.update(_wavelet_state_snapshot)
`);
        const err = py.globals.get('_wavelet_err');
        if (err && err !== null) {
            return { pass: false, message: `Crashed: ${err}` };
        }

        const grid = py.runPython(`list(_canvas_state['grid'].items())`).toJs();
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
        await runDrawScene();
    }
}

// Behavioural validation: call a function, check that a named state
// variable changed by the expected delta. Used for the buttons task so
// an empty on_right_key body fails instead of getting a free ✓.
//   { type: "state_change", function: "on_left_key",
//     var: "state.player_x", delta: -1 }
async function ruleStateChange(rule) {
    const py = executor.getPyodide();
    const fnName = rule.function;
    const varExpr = rule.var;
    const expected = rule.delta;
    try {
        await py.runPythonAsync(`
_wavelet_state_snapshot = dict(state.__dict__) if 'state' in globals() and hasattr(state, '__dict__') else None
_wavelet_err = None
_wavelet_pass = False
_wavelet_msg = None
try:
    _wavelet_before = ${varExpr}
    ${fnName}()
    _wavelet_after = ${varExpr}
    _wavelet_delta = _wavelet_after - _wavelet_before
    if _wavelet_delta == ${expected}:
        _wavelet_pass = True
    else:
        _wavelet_msg = f"${fnName}() should change ${varExpr} by ${expected}, but it changed by {_wavelet_delta}"
except Exception as _e:
    _wavelet_err = repr(_e)
finally:
    if _wavelet_state_snapshot is not None:
        state.__dict__.clear()
        state.__dict__.update(_wavelet_state_snapshot)
`);
        const err = py.globals.get('_wavelet_err');
        if (err && err !== null) return { pass: false, message: `Crashed: ${err}` };
        const passed = py.globals.get('_wavelet_pass');
        if (!passed) {
            const msg = py.globals.get('_wavelet_msg');
            return { pass: false, message: msg || `${fnName}() did not change ${varExpr} as expected` };
        }
        return { pass: true };
    } catch (err) {
        return { pass: false, message: err.message };
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
    if (!entry || entry.task.selfCheck) return;
    if (result.pass) {
        entry.statusEl.className = 'task-status task-status-pass';
        entry.statusEl.textContent = '✓ working';
        if (entry.cardErrorEl) entry.cardErrorEl.style.display = 'none';
    } else {
        // Pill stays a short ✗ marker in the header; full message goes
        // into the task-card error block at the bottom of the card.
        entry.statusEl.className = 'task-status task-status-fail';
        entry.statusEl.textContent = '✗ not yet';
        if (entry.cardErrorEl) {
            entry.cardErrorEl.textContent = result.message || 'Not passing yet.';
            entry.cardErrorEl.style.display = 'block';
        }
    }
}

// ─── Save / Open ─────────────────────────────────────────────────────────

function assembleFileForDisk() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [
        `${FILE_HEADER_MARKER} ${projectDef.title}`,
        `# Project: ${projectDef.id}`,
        `# Saved:   ${today}`,
        '',
    ];

    for (const line of (projectDef.lockedPreamble || [])) lines.push(line);

    const editablePreamble = setupEditor ? setupEditor.getValue() : (projectDef.editablePreamble || '');
    if (editablePreamble.trim()) {
        lines.push(editablePreamble.replace(/\s+$/g, ''));
    }
    lines.push('');

    // Freestyle section between Setup and the function defs, matching run order.
    const freestyleTask = getFreestyleTask();
    if (freestyleTask) {
        const entry = taskEditors.get(freestyleTask.id);
        const src = entry && entry.cm
            ? entry.cm.getValue().replace(/\s+$/g, '')
            : (freestyleTask.starterBody || '').replace(/\s+$/g, '');
        lines.push(FREESTYLE_SECTION_MARKER);
        lines.push(src);
        lines.push('');
    }

    getFunctionTasks().forEach((task, idx) => {
        const entry = taskEditors.get(task.id);
        let src;
        if (entry && entry.cm) {
            src = entry.cm.getValue();
        } else if (isMultiFunction(task)) {
            src = buildMultiFunctionSource(task.functions);
        } else {
            src = buildEditorSource(task.function, task.starterBody);
        }
        lines.push(`# Task ${idx + 1}: ${task.title}`);
        lines.push(src.replace(/\s+$/g, ''));
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
        if (!loadFileIntoEditors(text, file.name)) return;
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
        currentFileHandle = { name: file.name };
        markClean();
    };
    reader.onerror = () => alert('Could not read that file.');
    reader.readAsText(file);
}

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

    // Split freestyle section out before parsing the rest.
    const { mainText, freestyleSource } = splitFreestyleSection(text);

    const knownNames = [];
    for (const t of getFunctionTasks()) knownNames.push(...getTaskFunctionNames(t));
    const lockedSet = new Set([
        ...(projectDef.lockedPreamble || []).map(s => s.trim()),
        ...seedLockedLines().map(s => s.trim()),
    ]);
    const parsed = parseProjectFile(mainText, knownNames, lockedSet);

    const missing = [];
    for (const task of getFunctionTasks()) {
        const entry = taskEditors.get(task.id);
        if (!entry || !entry.cm) continue;
        if (isMultiFunction(task)) {
            // Rebuild multi-function source from parsed bodies, falling
            // back to each function's starterBody if it's not in the file.
            const funcsWithBodies = task.functions.map(f => ({
                name: f.name,
                starterBody: parsed.bodies.has(f.name)
                    ? parsed.bodies.get(f.name)
                    : f.starterBody,
            }));
            const allFound = task.functions.every(f => parsed.bodies.has(f.name));
            entry.cm.setValue(buildMultiFunctionSource(funcsWithBodies));
            if (!allFound) missing.push(task.title);
        } else if (parsed.bodies.has(task.function)) {
            entry.cm.setValue(buildEditorSource(task.function, parsed.bodies.get(task.function)));
        } else {
            entry.cm.setValue(buildEditorSource(task.function, task.starterBody));
            missing.push(task.title);
        }
        entry.errorEl.style.display = 'none';
        if (!entry.task.selfCheck) {
            entry.statusEl.className = 'task-status task-status-pending';
            entry.statusEl.textContent = '○ not run';
        }
    }

    const freestyleTask = getFreestyleTask();
    if (freestyleTask) {
        const entry = taskEditors.get(freestyleTask.id);
        if (entry && entry.cm) {
            entry.cm.setValue(freestyleSource || freestyleTask.starterBody || '');
            entry.errorEl.style.display = 'none';
        }
    }

    if (setupEditor) {
        setupEditor.setValue(buildSetupSource(parsed.editablePreamble || projectDef.editablePreamble || ''));
    }

    currentExtras = parsed.extras;

    const status = document.getElementById('project-status');
    const bits = [];
    bits.push(`Opened <strong>${escapeHtml(filename)}</strong>.`);
    if (missing.length) bits.push(`Reset to starter: ${escapeHtml(missing.join(', '))}.`);
    bits.push('Click <strong>Run Project</strong> to try it.');
    status.innerHTML = bits.join(' ');

    return true;
}

// Pull out the freestyle section delimited by FREESTYLE_SECTION_MARKER. The
// section runs until the next "# Task" comment header or end-of-file.
function splitFreestyleSection(text) {
    const idx = text.indexOf(FREESTYLE_SECTION_MARKER);
    if (idx === -1) return { mainText: text, freestyleSource: '' };
    const before = text.slice(0, idx);
    const after = text.slice(idx + FREESTYLE_SECTION_MARKER.length);
    const taskMarkerRegex = /^# Task \d+:/m;
    const taskIdx = after.search(taskMarkerRegex);
    let freestyleSource = '';
    let rest = '';
    if (taskIdx === -1) {
        freestyleSource = after.replace(/^\s*\n/, '');
    } else {
        freestyleSource = after.slice(0, taskIdx).replace(/^\s*\n/, '');
        rest = after.slice(taskIdx);
    }
    return { mainText: before + rest, freestyleSource: freestyleSource.replace(/\s+$/g, '') };
}

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
            continue
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
    if (setupEditor && setupEditor.getValue() !== buildSetupSource(projectDef.editablePreamble)) return true;
    for (const [, entry] of taskEditors) {
        if (!entry.cm) continue;
        let starter;
        if (entry.isFreestyle) {
            starter = entry.task.starterBody || '';
        } else if (isMultiFunction(entry.task)) {
            starter = buildMultiFunctionSource(entry.task.functions);
        } else {
            starter = buildEditorSource(entry.task.function, entry.task.starterBody);
        }
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

// True when the user's focus is somewhere we shouldn't hijack arrow keys:
// inside a CodeMirror editor, an input/textarea, or a contenteditable
// element. The d-pad keyboard binding skips in those cases so cursor
// navigation in editors still works.
function isEditingFocus(el) {
    if (!el || el === document.body) return false;
    if (el.closest && el.closest('.CodeMirror')) return true;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
}

// ─── Stage fullscreen toggle ─────────────────────────────────────────────

function toggleStageFullscreen() {
    const stage = document.getElementById('project-stage');
    const btn = document.getElementById('stage-fullscreen-btn');
    if (!stage || !btn) return;
    const entering = !stage.classList.contains('project-stage--fullscreen');
    stage.classList.toggle('project-stage--fullscreen', entering);
    document.body.classList.toggle('stage-fullscreen-active', entering);
    btn.textContent = entering ? '✕' : '⛶';
    btn.title = entering ? 'Exit full screen (Esc)' : 'Play in full screen (Esc to exit)';
    btn.setAttribute('aria-label', entering ? 'Exit full screen' : 'Full screen');
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
