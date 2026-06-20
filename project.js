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
let serverCtl = null; // Project Storage v2 controller, set by initServerStorage() when serverStorage is on
let dirty = false;
let savedFlashTimer = null;
let currentExtras = ''; // raw source of any unrecognised top-level code from an opened file
// Tracks which task the student is currently working on, so the validation
// UI can highlight only that task with the full red treatment after a Run.
// Other failing tasks get a quieter neutral pill so students aren't drowned
// in red. Set on every editor change, cleared only when reset.
let lastEditedTaskId = null;
// Interval handle for the on_tick() extension hook (1Hz "real-time" loop).
// Set after each Run, cleared at the start of the next Run so a fresh
// run replaces the old loop instead of stacking ticks.
let tickInterval = null;
const TICK_MS = 1000;
// True once Run has loaded the code and the project is interactive (d-pad,
// arrow keys, and the on_tick loop are live). Stop flips it back to false so
// the project freezes on its last frame until the next Run.
let projectRunning = false;
// Setup state. The card is built up-front so initTaskEditors can wire
// CodeMirror; renderBands decides where to insert it (default = at the
// top, or wherever a setup-anchor block in the JSON places it).
let setupCardState = null;

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
    document.getElementById('stop-project-btn').addEventListener('click', stopProject);
    document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('click', () => onKeyPress(btn.dataset.key));
    });

    // Stage fullscreen toggle: lets students blow up the canvas + d-pad
    // to play mode once their project is running.
    const fsBtn = document.getElementById('stage-fullscreen-btn');
    if (fsBtn) fsBtn.addEventListener('click', toggleStageFullscreen);

    // Save / Open
    document.getElementById('save-file-btn').addEventListener('click', saveProject);
    document.getElementById('save-as-file-btn').addEventListener('click', saveProjectAs);
    document.getElementById('open-file-btn').addEventListener('click', openProject);
    document.getElementById('file-input').addEventListener('change', handleFallbackFileInput);

    // Project Storage v2: when enabled, swap the file Open/Save flow for code-login + server
    // autosave. Default off, so the existing flow is untouched for the current cohort.
    if (window.WaveletConfig && window.WaveletConfig.serverStorage) {
        initServerStorage();
    }

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (e.shiftKey) saveProjectAs();
            else saveProject();
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
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isEditingFocus(document.activeElement)) return;
        // Arrow keys drive the player via on_*_key handlers (same code
        // path as the on-screen d-pad). Lets students play with the
        // keyboard once the project is running.
        const dirMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const dir = dirMap[e.key];
        if (dir) {
            e.preventDefault();
            onKeyPress(dir);
            return;
        }
        // Letter / digit keys are routed through on_key(key) if the
        // student has defined that single function. Used by the
        // multiplayer extension ("press W to move player 2 up").
        const ch = e.key.length === 1 ? e.key.toLowerCase() : '';
        if (/^[a-z0-9]$/.test(ch) && functionDefinedInPython('on_key')) {
            e.preventDefault();
            onLetterKey(ch);
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
// the bands (legacy default). Numbers each real task in order so the
// renderer and status messages can reference them by number ("task 3").
function renderBands() {
    const host = document.getElementById('project-bands');
    host.innerHTML = '';

    const entries = projectDef.tasks || [];
    const hasAnchor = entries.some(b => b.type === 'setup-anchor');

    // Assign sequential numbers to every real task block (skipping
    // concept cards and the setup-anchor marker).
    let nextNum = 1;
    for (const block of entries) {
        if (block.type === 'concept' || block.type === 'setup-anchor') continue;
        // Explainer tasks render as knowledge cards (no visible number), so
        // skip them in the count to keep the student-facing numbers contiguous.
        if (block.explainer) continue;
        block._taskNumber = nextNum++;
    }

    let currentBandEl = null;
    let currentBandKind = null;
    const closeBand = () => { currentBandEl = null; currentBandKind = null; };

    // Only the first "Tasks" (Band 1) group gets a heading; later Band 1
    // groups (split apart by concept cards / the State anchor) render without
    // a repeated label so the page reads as one continuous task list.
    let firstTaskBandSeen = false;

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
            let labelText = bandLabel(kind);
            if (kind === 1) {
                labelText = firstTaskBandSeen ? '' : labelText;
                firstTaskBandSeen = true;
            }
            currentBandEl = openBand(kind, labelText);
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

function bandLabel(kind) {
    return {
        1: 'Tasks',
        2: 'Combine your code',
        3: 'Freestyle'
    }[kind] || '';
}

function openBand(kind, labelText) {
    const section = document.createElement('section');
    section.className = `project-band project-band-${kind}`;
    section.dataset.band = String(kind);

    if (labelText) {
        const label = document.createElement('div');
        label.className = 'band-label';
        label.textContent = labelText;
        section.appendChild(label);
    }

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

// ─── Setup (State) card ──────────────────────────────────────────────────

// State renders as a knowledge-card + code-area pair, the same shape as the
// draw_scene explainer: a short "what this is" card on the left, the (already
// filled in, editable) state code on the right. It's a no-op for the student
// to start; they only come back to it to add their own variables.
function buildSetupCard() {
    const section = document.createElement('section');
    section.className = 'project-band project-band-setup';
    section.dataset.taskId = '__setup__';

    const grid = document.createElement('div');
    grid.className = 'band-grid band-grid-1';
    section.appendChild(grid);

    // Left: knowledge card.
    const know = makeKnowledgeCard({
        icon: '📦',
        title: 'State',
        guidance: '<p>The <code>state</code> object is your project\'s memory. It holds on to things between key presses, like where the player is. Its starting position is set to <code>(10, 10)</code> for you.</p><p>You don\'t need to change anything here to begin. Later you can add your own variables (like a score) to remember more.</p>',
    });
    grid.appendChild(know);

    // Right: area card holding the editable state editor.
    const area = document.createElement('article');
    area.className = 'project-area-card project-area-setup';

    const header = document.createElement('header');
    header.className = 'area-card-header';
    header.innerHTML = `
        <code class="area-signature">state</code>
        <span class="area-syntax-badge" data-syntax style="display:none;">⚠ syntax error</span>
    `;
    area.appendChild(header);

    const desc = document.createElement('div');
    desc.className = 'area-description';
    desc.textContent = 'Runs once before everything else. The top line is locked; add your own variables below it.';
    area.appendChild(desc);

    const editorFrame = document.createElement('div');
    editorFrame.className = 'task-editor-frame';
    const editorEl = document.createElement('div');
    editorEl.className = 'task-editor setup-editor';
    editorFrame.appendChild(editorEl);
    area.appendChild(editorFrame);

    const setupError = document.createElement('div');
    setupError.className = 'task-error';
    setupError.style.display = 'none';
    area.appendChild(setupError);

    grid.appendChild(area);

    // Hidden status span: setSetupError() / resetAllStatus() still poke a
    // statusEl, but State shows no pill now (the red error box and syntax
    // badge surface any problem). See makeKnowledgeCard for the same pattern.
    const status = document.createElement('span');
    status.className = 'task-status';
    status.style.display = 'none';

    setupCardState = {
        card: section,
        editorEl,
        statusEl: status,
        errorEl: setupError,
        syntaxBadge: header.querySelector('[data-syntax]'),
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
        _syntaxBadge: setupCardState.syntaxBadge,
    } : null;
}

// ─── Card rendering ──────────────────────────────────────────────────────

// Returns { taskCard, areaCard } for a Band 1 or Band 3 task.
function renderPair(task, isFreestyle) {
    const taskCard = task.explainer ? makeKnowledgeCard(task) : makeTaskCard(task);
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

// A "knowledge card" sits in the left column where a task card would, but
// explains a piece of pre-filled code instead of asking the student to write
// it. Used for tasks flagged `explainer: true` (e.g. draw_scene, State): the
// code on the right is already complete, a no-op for the student to start, so
// there's no status pill or number, just a short explanation.
function makeKnowledgeCard(task) {
    const card = document.createElement('article');
    card.className = 'project-task project-knowledge-card';
    if (task.id) card.dataset.taskId = task.id;

    const header = document.createElement('header');
    header.className = 'knowledge-card-header';
    header.innerHTML = `
        <span class="knowledge-icon">${task.icon || '📘'}</span>
        <h3 class="knowledge-title">${escapeHtml(task.title)}</h3>
    `;
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'knowledge-body';
    body.innerHTML = task.guidance || task.content || '';
    card.appendChild(body);

    // The run/validation machinery expects every registered task entry to
    // have a statusEl it can poke. A knowledge card shows no pill, so give it
    // a detached, hidden status span purely to satisfy that contract. There's
    // no card-level validation message either (errors surface on the area
    // card via isSelfManaged), so cardErrorEl is null.
    const status = document.createElement('span');
    status.className = 'task-status';
    status.style.display = 'none';
    card._statusEl = status;
    card._cardErrorEl = null;

    return card;
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
        <h3 class="task-title">${taskNumberHtml(task)}${escapeHtml(task.title)}</h3>
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
        <h3 class="task-title">${taskNumberHtml(task)}${escapeHtml(task.title)}</h3>
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

// Small numeric prefix on task titles. Numbers come from renderBands,
// which walks the JSON in order and assigns 1, 2, 3, ... to each real
// task. Numbers let status messages reference tasks ("task 3") and
// help students orient.
function taskNumberHtml(task) {
    if (!task._taskNumber) return '';
    return `<span class="task-number-prefix">${task._taskNumber}.</span> `;
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
            // No CodeMirror scrollbars: the editor auto-grows to fit its
            // content (setSize 'auto' below) and lineWrapping handles long
            // lines, so a scrollbar would only ever be a stray artifact.
            scrollbarStyle: 'null',
        });
        const seedLines = countSeedLines();
        // Auto-grow with content, like every task editor. min-height keeps a
        // fresh State section from collapsing to a sliver.
        setupEditor.setSize('100%', 'auto');
        setupEditor.getWrapperElement().style.minHeight = '12.5em';
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
            // See the setup editor above: every editor auto-grows, so
            // CodeMirror's own scrollbars are never needed and only ever
            // flash in as a stray artifact. Turn them off everywhere.
            scrollbarStyle: 'null',
        });

        if (!isFreestyle) {
            // Lock the generated `def name():` header line(s) by LINE IDENTITY
            // (CodeMirror line handles), not by matching the header text. We
            // capture the handle of the first line matching each header and
            // freeze those specific lines. This matters for two reasons:
            //   - the lock follows each header as body lines push it down, and
            //   - a SECOND identical `def name():` line the student later types
            //     (e.g. from a bad paste) gets a fresh handle that is NOT in the
            //     locked set, so they can still select and delete it. Matching
            //     by text alone froze the duplicate too, which locked students
            //     out of fixing their own code.
            const defHeaders = new Set(
                (multi ? task.functions.map(f => f.name) : [task.function])
                    .map(name => `def ${name}():`)
            );
            const lockedHandles = new Set();
            const captureHeaders = () => {
                lockedHandles.clear();
                const remaining = new Set(defHeaders);
                cm.eachLine(lineHandle => {
                    if (remaining.has(lineHandle.text)) {
                        remaining.delete(lineHandle.text);
                        lockedHandles.add(lineHandle);
                        cm.addLineClass(lineHandle, 'background', 'cm-def-line');
                        cm.addLineClass(lineHandle, 'wrap', 'cm-def-line-wrap');
                    }
                });
            };
            captureHeaders();
            cm.on('beforeChange', (_cm, change) => {
                if (change.origin === 'setValue') return;
                for (let l = change.from.line; l <= change.to.line; l++) {
                    if (lockedHandles.has(cm.getLineHandle(l))) {
                        change.cancel();
                        return;
                    }
                }
            });
            // After a file load (setValue) the old line handles are discarded,
            // so re-capture the headers on the freshly-set content.
            cm.on('change', (_cm, change) => {
                if (change.origin === 'setValue') captureHeaders();
            });
        }

        // Every editor auto-grows with its content rather than
        // overflow-scrolling. min-height keeps a fresh editor from starting
        // as a tiny box; after that, new lines extend it. For function
        // editors the min also reserves room for the locked def header(s).
        cm.setSize('100%', 'auto');
        const defLines = isFreestyle ? 0 : (multi ? task.functions.length : 1);
        const minLines = (task.editorHeight || 6) + defLines;
        cm.getWrapperElement().style.minHeight = `${minLines * 1.5}em`;
        cm.on('change', (_cm, change) => {
            if (change.origin !== 'setValue') {
                markDirty();
                lastEditedTaskId = task.id;
            }
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
    // End on an already-indented blank line so the cursor lands inside the
    // function body when the student starts typing. Without the indent that
    // trailing line sat at column 0, inviting code outside the function and an
    // IndentationError. Trailing whitespace is stripped on save and is a
    // harmless blank line at run time, so this only affects the typing affordance.
    return `def ${fnName}():\n${indented}\n${BODY_INDENT}`;
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

// Tasks the run/validation machinery should not stamp a pass/fail pill on.
// selfCheck tasks own their own tick; explainer tasks are knowledge cards
// whose code is pre-filled (a no-op for the student) so there's nothing to
// grade. Both still surface real syntax/runtime errors on their area card.
function isSelfManaged(task) {
    return Boolean(task.selfCheck || task.explainer);
}

// ─── Run flow ────────────────────────────────────────────────────────────

async function runProject() {
    resetAllStatus();
    if (serverCtl) serverCtl.run(); // a Run is a milestone save (fire-and-forget)

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
        if (def.duplicateDef) {
            markTaskError(def.taskId,
                `You have two functions called ${def.duplicateDef}(). Python only keeps the ` +
                `last one, so your earlier code won't run. Delete the extra ` +
                `def ${def.duplicateDef}(): line and keep your code in one function.`);
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
        if (isSelfManaged(entry.task)) continue;
        const result = await validateTask(entry.task);
        applyValidationResult(taskId, result);
    }

    // 8. Start (or restart) the on_tick loop. If the student has defined
    //    on_tick(), the project calls it once per second so they can build
    //    real-time things (a wandering creature, a countdown timer).
    projectRunning = true;
    setRunningUI(true);
    startTickLoop();

    finalizeRunStatus();
}

// Stop the running project: halt the on_tick loop and stop responding to the
// d-pad / arrow keys. The canvas keeps its last frame so the scene doesn't
// vanish; clicking Run Project starts it again. Python state is left intact.
function stopProject() {
    if (!projectRunning) return;
    stopTickLoop();
    projectRunning = false;
    setRunningUI(false);
    const status = document.getElementById('project-status');
    if (status) {
        status.innerHTML = '⏹ Project stopped. Click <strong>Run Project</strong> to play again.';
    }
}

// Toggle the Run / Stop buttons. Run stays visible (it doubles as restart);
// Stop only appears while the project is live.
function setRunningUI(running) {
    const stopBtn = document.getElementById('stop-project-btn');
    if (stopBtn) stopBtn.style.display = running ? '' : 'none';
}

// Tick loop: drives on_tick() at TICK_MS intervals. Started after every
// successful Run and torn down at the start of the next one so the loop
// always reflects the most-recently-loaded code. If the student hasn't
// defined on_tick the interval just checks-and-skips, cheap.
function startTickLoop() {
    stopTickLoop();
    tickInterval = setInterval(handleTick, TICK_MS);
}

function stopTickLoop() {
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
}

async function handleTick() {
    if (!projectRunning) return;
    if (!executor || !executor.isReady()) return;
    if (!functionDefinedInPython('on_tick')) return;
    const py = executor.getPyodide();
    if (!py.globals.get('_wavelet_call_safely')) return;

    const handlerResult = await callWithAttribution('on_tick');
    if (!handlerResult.ok) {
        const taskId = taskIdForFunction(handlerResult.in_function);
        if (taskId) markTaskError(taskId, handlerResult.error_msg);
        else displayGlobalError(handlerResult.error_msg);
        setPlayInfo(handlerResult.output);
        // Stop the loop on error so we don't spam the same error every second.
        stopTickLoop();
        finalizeRunStatus();
        return;
    }
    try { await py.runPythonAsync('clear()'); } catch (_e) { /* clear is best-effort */ }
    const sceneResult = await callWithAttribution('draw_scene');
    setPlayInfoFromFrame(handlerResult.output, sceneResult.output);
    if (!sceneResult.ok) {
        const taskId = taskIdForFunction(sceneResult.in_function);
        if (taskId) markTaskError(taskId, sceneResult.error_msg);
        else displayGlobalError(sceneResult.error_msg);
        stopTickLoop();
        finalizeRunStatus();
    }
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

def _wavelet_call_safely(fn_name, *args):
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
        fn(*args)
        return {'ok': True, 'in_function': None, 'error_msg': None,
                'line': None, 'output': buf.getvalue()}
    except Exception as e:
        # Walk the traceback to attribute the error. We prefer the deepest
        # frame whose function name belongs to a known task editor (so the
        # error lands on the right card). When no known frame exists, e.g.
        # the student defined on_tick / on_key / a helper inside the
        # freestyle editor, fall back to the deepest user frame so we still
        # produce a line number and a meaningful in_function name.
        deepest = fn_name
        deepest_line = None
        user_name = fn_name
        user_line = None
        tb = e.__traceback__
        while tb is not None:
            frame_name = tb.tb_frame.f_code.co_name
            if frame_name != '_wavelet_call_safely':
                user_name = frame_name
                user_line = tb.tb_lineno
            if frame_name in known:
                deepest = frame_name
                deepest_line = tb.tb_lineno
            tb = tb.tb_next
        if deepest_line is None:
            deepest = user_name
            deepest_line = user_line
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

async function callWithAttribution(fnName, ...args) {
    const py = executor.getPyodide();
    try {
        const fn = py.globals.get('_wavelet_call_safely');
        const result = fn(fnName, ...args);
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
    // Anything the harness calls that isn't tied to a Band 1 task must have
    // been defined in the freestyle editor (on_tick, on_key, a helper the
    // student wrote). Surface those errors on the freestyle area card so
    // they're never silently dropped.
    const freestyleTask = getFreestyleTask();
    return freestyleTask ? freestyleTask.id : null;
}

async function runDrawScene() {
    const py = executor.getPyodide();
    try {
        await py.runPythonAsync('clear()');
    } catch (_e) { /* canvas may not yet be initialised */ }
    return callWithAttribution('draw_scene');
}

// Letter / digit key path: routes a single key press into the student's
// on_key(key) function (if defined). After the handler runs, re-render
// the scene the same way arrow presses do. Used for multiplayer-style
// extensions ("press W to move player 2").
async function onLetterKey(key) {
    if (!executor || !executor.isReady()) return;
    const py = executor.getPyodide();
    if (!py.globals.get('_wavelet_call_safely')) return;

    const handlerResult = await callWithAttribution('on_key', key);
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
    setPlayInfoFromFrame(handlerResult.output, sceneResult.output);
    if (!sceneResult.ok) {
        const taskId = taskIdForFunction(sceneResult.in_function);
        if (taskId) markTaskError(taskId, sceneResult.error_msg);
        else displayGlobalError(sceneResult.error_msg);
        finalizeRunStatus();
    }
}

// True if `fnName` is currently defined and callable in Pyodide globals.
// Used by the keyboard listener to skip letter keys when the student
// hasn't defined an on_key handler, so non-game keys don't spam errors.
function functionDefinedInPython(fnName) {
    if (!executor || !executor.isReady()) return false;
    try {
        const py = executor.getPyodide();
        const ok = py.runPython(
            `'${fnName}' in globals() and callable(globals().get('${fnName}'))`
        );
        return Boolean(ok);
    } catch (_e) {
        return false;
    }
}

async function onKeyPress(direction) {
    if (!executor || !executor.isReady()) return;
    const fnName = `on_${direction}_key`;

    const py = executor.getPyodide();
    if (!projectRunning || !py.globals.get('_wavelet_call_safely')) {
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
    stopTickLoop();
    // Drop out of the running state until this Run reaches the interactive
    // stage. If it fails early (e.g. setup error) the Stop button stays
    // hidden; a successful Run sets it back to true at the end.
    projectRunning = false;
    setRunningUI(false);
    setPlayInfo('');
    const host = getSetupHost();
    if (host && host._statusEl) {
        host._statusEl.className = 'task-status task-status-pending';
        host._statusEl.textContent = '○ ready';
    }
    if (host && host._errorEl) host._errorEl.style.display = 'none';
    if (host && host._syntaxBadge) host._syntaxBadge.style.display = 'none';

    for (const entry of taskEditors.values()) {
        if (entry.cardErrorEl) entry.cardErrorEl.style.display = 'none';
        // Self-check pills stay as the student left them - they're not reset
        // by a project run. Explainer cards have no pill at all, but follow
        // the same "clear errors, leave status alone" path.
        if (isSelfManaged(entry.task)) {
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
    if (host._syntaxBadge) host._syntaxBadge.style.display = '';
}

function setExtrasError(msg) {
    console.warn('Extras error:', msg);
}

function displayGlobalError(msg) {
    const status = document.getElementById('project-status');
    if (status) status.innerHTML = `<strong>Error:</strong> ${escapeHtml(msg)}`;
}

function finalizeRunStatus() {
    const status = document.getElementById('project-status');
    if (!status) return;
    // Prefer pointing at the most recently edited task if it's failing,
    // otherwise surface any other task that's currently showing an error.
    // We check both the fail pill (Band 1 tasks) and a visible area-card
    // error (selfCheck tasks like freestyle, which keep their pill state
    // for the student to tick).
    const failingEntry = findFailingTaskEntry();
    if (failingEntry) {
        const num = failingEntry.task._taskNumber || '?';
        const title = escapeHtml(failingEntry.task.title);
        const failingId = failingEntry.task.id;
        // When the card is showing an actual code error (a red error box),
        // point the student straight at it. A plain validation failure has
        // no error box, so the generic "Jump to it" reads better there.
        const label = entryHasCodeError(failingEntry) ? 'Jump to error ↓' : 'Jump to it ↓';
        status.innerHTML = `
            <span class="status-keep-going">Keep going on task ${num}: <strong>${title}</strong></span>
            <button type="button" class="status-jump-btn" id="status-jump-btn">${label}</button>
        `;
        document.getElementById('status-jump-btn').addEventListener('click', () => scrollToTask(failingId));
        return;
    }
    status.innerHTML = '✓ Project running. Try the arrow buttons (or your keyboard arrow keys).';
}

function entryHasError(entry) {
    if (!entry) return false;
    if (entry.statusEl && entry.statusEl.classList.contains('task-status-fail')) return true;
    return entryHasCodeError(entry);
}

// True only when the area card is showing a real syntax/runtime error box,
// as opposed to a validation failure that just flips the status pill.
function entryHasCodeError(entry) {
    if (!entry) return false;
    const errEl = entry.errorEl;
    return Boolean(errEl && errEl.style.display !== 'none' && errEl.textContent.trim());
}

function findFailingTaskEntry() {
    if (lastEditedTaskId) {
        const e = taskEditors.get(lastEditedTaskId);
        if (entryHasError(e)) return e;
    }
    for (const entry of taskEditors.values()) {
        if (entryHasError(entry)) return entry;
    }
    return null;
}

function scrollToTask(taskId) {
    if (!taskId) return;
    const card = document.querySelector(
        `.project-task[data-task-id="${taskId}"]`
    );
    if (!card) return;
    // Scroll the card to the top of the viewport. Nothing overlays the
    // content while scrolling: the stage sits in its own column on wide
    // layouts and is position: static (not sticky) on stacked layouts.
    const cardTop = card.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: cardTop - 16, behavior: 'smooth' });
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
        const duplicateDef = syntaxError ? null : findDuplicateDef(src);
        fnDefs.push({ taskId: task.id, src, syntaxError, duplicateDef });
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

// Find a top-level function defined more than once in a task editor. This is
// VALID Python (it parses fine), but Python silently keeps only the last
// definition, so a student who pastes a second `def draw_corners():` above
// their real code wipes it out with no error. compile()/ast.parse don't
// raise on this, so we inspect the parsed tree and count the names instead.
// Returns the duplicated name (string) or null.
function findDuplicateDef(src) {
    try {
        const py = executor.getPyodide();
        py.runPython(`
import ast as _ast
def _wavelet_find_duplicate_def(src):
    try:
        tree = _ast.parse(src)
    except SyntaxError:
        return None  # syntax errors are reported separately
    seen = set()
    for node in tree.body:
        if isinstance(node, _ast.FunctionDef):
            if node.name in seen:
                return node.name
            seen.add(node.name)
    return None
`);
        const finder = py.globals.get('_wavelet_find_duplicate_def');
        return finder(src) || null;
    } catch (_err) {
        return null;  // best-effort: never block a run on the check itself
    }
}

function markTaskError(taskId, msg) {
    const entry = taskEditors.get(taskId);
    if (!entry) return;
    // For self-managed tasks (self-check + explainer), surface the error on
    // the area card without touching a pill the student owns / that isn't there.
    if (isSelfManaged(entry.task)) {
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
    if (!entry || isSelfManaged(entry.task)) return;
    if (result.pass) {
        entry.statusEl.className = 'task-status task-status-pass';
        entry.statusEl.textContent = '✓ working';
        if (entry.cardErrorEl) entry.cardErrorEl.style.display = 'none';
        return;
    }
    // Failing. Only the "active" task (most recently edited) gets the
    // full red treatment with an error message; other failing tasks
    // show a quieter neutral pill so the student isn't drowned in red.
    const isActive = (taskId === lastEditedTaskId);
    if (isActive) {
        entry.statusEl.className = 'task-status task-status-fail';
        entry.statusEl.textContent = '✗ keep going';
        if (entry.cardErrorEl) {
            entry.cardErrorEl.textContent = result.message || 'Not passing yet.';
            entry.cardErrorEl.style.display = 'block';
        }
    } else {
        entry.statusEl.className = 'task-status task-status-pending';
        entry.statusEl.textContent = '○ not yet';
        if (entry.cardErrorEl) entry.cardErrorEl.style.display = 'none';
    }
}

// ─── Save / Open ─────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// Project Storage v2 (server mode). Active only when WaveletConfig.serverStorage
// is true; otherwise none of this runs and the file Open/Save flow above is used.
// ──────────────────────────────────────────────────────────────────────────

function initServerStorage() {
    // Hide the file-based controls; server mode autosaves to the database.
    ['current-file', 'open-file-btn', 'save-file-btn', 'save-as-file-btn'].forEach(id => {
        const elx = document.getElementById(id);
        if (elx) elx.style.display = 'none';
    });
    showLoginOverlay();
}

function showLoginOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'login-overlay';
    overlay.innerHTML =
        '<div class="login-card">' +
        '<h2>Open your project</h2>' +
        '<p>Type the code from your card.</p>' +
        '<input id="login-code" type="text" autocomplete="off" spellcheck="false" placeholder="brave-otter-oak">' +
        '<button id="login-btn">Open</button>' +
        '<div id="login-msg" class="login-msg"></div>' +
        '</div>';
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#login-code');
    const doLogin = () => handleServerLogin(overlay, input.value);
    overlay.querySelector('#login-btn').addEventListener('click', doLogin);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    input.focus();
}

async function handleServerLogin(overlay, raw) {
    const msgEl = overlay.querySelector('#login-msg');
    const code = window.CodeWords ? window.CodeWords.canonical(raw) : null;
    if (!code) {
        msgEl.textContent = 'Please check your code and try again.';
        return;
    }
    msgEl.textContent = 'Opening…';
    let res;
    try {
        res = await window.SupabaseClient.loadProject(code);
    } catch {
        res = null;
    }
    if (!res || !res.ok || !res.data || res.data.found === false) {
        msgEl.textContent = "We couldn't find that project. Check your code.";
        return;
    }
    const data = res.data;
    if (data.display_name && !confirm(`Is this ${data.display_name}'s project?`)) {
        msgEl.textContent = 'No problem, type your own code.';
        return;
    }
    // Resume: load saved content into the editors (a new project has null content).
    if (data.content) {
        loadFileIntoEditors(data.content, 'your project');
    }
    markClean();
    serverCtl = window.ProjectStorage.createController({
        code: code,
        getContent: assembleFileForDisk,
        onStatus: updateSaveStatus,
        onConflict: onServerConflict
    });
    serverCtl.start({ version: data.version });
    serverCtl.attachLifecycle();
    overlay.remove();
}

function updateSaveStatus(s) {
    const elx = document.getElementById('save-status');
    if (!elx) return;
    const map = {
        saving: ['Saving…', 'saving', ''],
        saved: ['✓ Saved', 'saved', ''],
        unsaved: ['Editing…', 'unsaved', ''],
        blocked: ['⚠ Not saved', 'blocked', 'Your last change has not been saved. Check your internet connection.']
    };
    const entry = map[s.status] || [s.status, '', ''];
    elx.style.display = '';
    elx.textContent = entry[0];
    elx.className = 'save-status ' + entry[1];
    elx.title = entry[2];
}

function onServerConflict() {
    // Latest change is saved, but another device also edited this project. A history/restore
    // UI comes later; for now just flag it on the status chip.
    const elx = document.getElementById('save-status');
    if (elx) elx.title = 'This project was also edited on another device. Your latest change is saved.';
}

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
    if (SUPPORTS_FSA) await saveProjectViaFSA(false);
    else saveProjectViaDownload();
}

// Save As always asks for a fresh destination, even when a file is already
// open, so students can branch their work to a new file.
async function saveProjectAs() {
    if (SUPPORTS_FSA) await saveProjectViaFSA(true);
    else saveProjectViaDownload();
}

async function openProject() {
    if (SUPPORTS_FSA) await openProjectViaFSA();
    else document.getElementById('file-input').click();
}

async function saveProjectViaFSA(forceNew) {
    let handle = (!forceNew && currentFileHandle && currentFileHandle.createWritable) ? currentFileHandle : null;
    if (!handle) {
        try {
            // Seed Save As with the currently-open file's name (e.g.
            // pixel-game-rain.py) rather than the generic project default,
            // so students branch from their own file instead of resetting.
            const suggestedName = (currentFileHandle && currentFileHandle.name) || suggestedFilename();
            handle = await window.showSaveFilePicker({
                suggestedName,
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
        if (!isSelfManaged(entry.task)) {
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
    if (parsed.error) {
        // Syntax error: bodies were recovered line-by-line so the student
        // can fix the mistake in the editor instead of losing their work.
        bits.push(`⚠️ There's a syntax error to fix (${escapeHtml(parsed.error)}). Your code is loaded so you can repair it.`);
    } else if (missing.length) {
        bits.push(`Reset to starter: ${escapeHtml(missing.join(', '))}.`);
    }
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

def _wavelet_parse_fallback(src, known, locked, error):
    # The file has a syntax error so ast can't parse it. Recover the
    # student's work line-by-line instead of dumping the whole file into
    # the read-only Extras panel: split out the top-level function bodies
    # (where the error usually is) so they load back into their editors and
    # the student can fix the mistake in place.
    lines = src.split('\\n')
    bodies = {}
    editable = []
    extras = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()
        # A top-level "def name(...):" header (no leading indentation).
        if line[:4] == 'def ' and stripped.endswith(':'):
            name = stripped[4:].split('(')[0].strip()
            j = i + 1
            body_lines = []
            while j < n and (lines[j].strip() == '' or lines[j][:1] in (' ', '\\t')):
                body_lines.append(lines[j])
                j += 1
            while body_lines and body_lines[-1].strip() == '':
                body_lines.pop()
            if name in known:
                body = textwrap.dedent('\\n'.join(body_lines)) if body_lines else ''
                bodies[name] = body.rstrip() + '\\n' if body.strip() else ''
            else:
                extras.append('\\n'.join(lines[i:j]))
            i = j
            continue
        if stripped == '' or stripped in locked or stripped.startswith('#'):
            i += 1
            continue
        # Top-level assignment / import lines are treated as editable
        # preamble (e.g. state.player_x = 10); anything else is Extras.
        if (line[:7] == 'import ' or line[:5] == 'from '
                or (line[:1] not in (' ', '\\t') and ('=' in line or ':' in stripped))):
            editable.append(line)
        else:
            extras.append(line)
        i += 1
    return {
        'bodies': bodies,
        'editablePreamble': ('\\n'.join(editable) + '\\n') if editable else '',
        'extras': '\\n'.join(extras).strip(),
        'error': error,
    }

def _wavelet_parse_project():
    src = _wavelet_src
    known = set(_wavelet_known)
    locked = set(_wavelet_locked)
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return _wavelet_parse_fallback(src, known, locked, f'line {e.lineno}: {e.msg}')

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
    if (serverCtl) serverCtl.noteEdit(); // fires on every edit; the controller debounces
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
