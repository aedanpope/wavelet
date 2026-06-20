// ──────────────────────────────────────────────────────────────────────────
// Project Storage v2 (server mode). Active only when WaveletConfig.serverStorage
// is true (or ?storage=server); otherwise none of this runs and project.js's file
// Open/Save flow is used instead.
//
// This is a classic <script> (not a module), so it shares one global scope with
// project.js. It reads/writes the shared state vars declared there (serverCtl,
// serverCode, starterFileLines, saveBarTimer) and calls its helpers
// (loadFileIntoEditors, markClean, markDirty, assembleFileForDisk). project.js
// calls back into here at runtime (initServerStorage, flashSavedPill), so the two
// files are mutually referential but only ever at call time, never at load time.
// See design_docs/PROJECT_STORAGE_V2.md §6 (history) and §12 (architecture).
// ──────────────────────────────────────────────────────────────────────────

/* global serverCtl:writable, loadFileIntoEditors, markClean, markDirty, assembleFileForDisk */

// Server-mode state read here (and written from project.js's init for starterFileLines).
let serverCode = null;     // the student's code, for history lookups
let saveBarTimer = null;   // auto-hide timer for the "✓ Saved" butterbar state
let starterFileLines = 0;  // pristine starter file size; History shows lines added beyond it

function initServerStorage() {
    // Hide the file-based controls; server mode autosaves to the database.
    ['current-file', 'open-file-btn', 'save-file-btn', 'save-as-file-btn'].forEach(id => {
        const elx = document.getElementById(id);
        if (elx) elx.style.display = 'none';
    });
    const histBtn = document.getElementById('history-btn');
    if (histBtn) histBtn.addEventListener('click', openHistory);
    showLoginOverlay();
}

// Replay a CSS animation even if the element already has the class (removing it and forcing
// a reflow lets the same animation run again on a repeated failure).
function replayShake(elx) {
    if (!elx) return;
    elx.classList.remove('shake');
    void elx.offsetWidth;
    elx.classList.add('shake');
}

function showLoginOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'login-overlay';
    overlay.innerHTML =
        '<div class="login-card">' +
        '  <div id="login-step-code">' +
        '    <h2>Open your project</h2>' +
        '    <p>Type the code from your card.</p>' +
        '    <input id="login-code" type="text" autocomplete="off" spellcheck="false" placeholder="brave-otter-oak">' +
        '    <button id="login-btn">Open</button>' +
        '    <div id="login-msg" class="login-msg"></div>' +
        '  </div>' +
        '  <div id="login-step-confirm" style="display:none">' +
        '    <h2>Is this your project?</h2>' +
        '    <p class="confirm-name" id="confirm-name"></p>' +
        '    <div class="confirm-actions">' +
        '      <button id="confirm-yes">Yes, this is me</button>' +
        '      <button id="confirm-no" class="secondary">No, go back</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    document.body.appendChild(overlay);

    const card = overlay.querySelector('.login-card');
    const codeStep = overlay.querySelector('#login-step-code');
    const confirmStep = overlay.querySelector('#login-step-confirm');
    const input = overlay.querySelector('#login-code');
    const msgEl = overlay.querySelector('#login-msg');
    const fail = (text) => { msgEl.textContent = text; msgEl.classList.add('err'); replayShake(card); };

    function backToCode() {
        confirmStep.style.display = 'none';
        codeStep.style.display = '';
        input.focus();
        input.select();
    }

    async function submitCode() {
        const code = window.CodeWords ? window.CodeWords.canonical(input.value) : null;
        if (!code) { fail('Please check your code and try again.'); return; }
        msgEl.classList.remove('err');
        msgEl.textContent = 'Opening…';
        let res;
        try {
            res = await window.SupabaseClient.loadProject(code);
        } catch {
            res = null;
        }
        if (!res || !res.ok || !res.data || res.data.found === false) {
            fail("We couldn't find that project. Check your code.");
            return;
        }
        const data = res.data;
        if (data.display_name) {
            // Confirmation is a step IN the dialog (not a browser confirm(), which kids
            // click through without reading).
            overlay.querySelector('#confirm-name').textContent = data.display_name;
            msgEl.textContent = '';
            codeStep.style.display = 'none';
            confirmStep.style.display = '';
            overlay.querySelector('#confirm-yes').onclick = () => openWithProject(overlay, code, data);
            overlay.querySelector('#confirm-no').onclick = backToCode;
        } else {
            openWithProject(overlay, code, data);
        }
    }

    overlay.querySelector('#login-btn').addEventListener('click', submitCode);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submitCode(); });
    input.focus();
}

// Resume saved content (a new project has none) and wire the storage controller, then
// dismiss the overlay.
function openWithProject(overlay, code, data) {
    if (data.content) {
        loadFileIntoEditors(data.content, 'your project', true);
    }
    markClean();
    serverCode = code;
    serverCtl = window.ProjectStorage.createController({
        code: code,
        getContent: assembleFileForDisk,
        onStatus: updateSaveStatus,
        onConflict: onServerConflict
    });
    serverCtl.start({ version: data.version });
    serverCtl.attachLifecycle();
    const histBtn = document.getElementById('history-btn');
    if (histBtn) histBtn.style.display = '';
    overlay.remove();
}

// ── History / restore (student-facing version browser, §6) ──────────────────

async function openHistory() {
    if (!serverCode) return;
    let res;
    try {
        res = await window.SupabaseClient.projectHistory(serverCode);
    } catch {
        res = null;
    }
    const versions = (res && res.ok && res.data && res.data.found) ? (res.data.versions || []) : [];
    showHistoryOverlay(versions, starterFileLines);
}

function fmtHistoryTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    return d.toLocaleString();
}

function showHistoryOverlay(versions, baseline) {
    baseline = baseline || 0;
    const overlay = document.createElement('div');
    overlay.className = 'history-overlay';
    const rows = versions.length
        ? versions.map(v => {
            // The server returns each version's full line count; subtract the starter
            // file size to show how many lines the student has added beyond it.
            let lines = '';
            if (typeof v.line_count === 'number') {
                const n = Math.max(0, v.line_count - baseline);
                lines = `<span class="hv-lines">+${n} line${n === 1 ? '' : 's'}</span>`;
            }
            return `<li class="history-row" data-version="${v.version}">` +
                `<span class="hv-when">${fmtHistoryTime(v.created_at)}</span>` +
                lines +
                `<span class="hv-go">Go back to this →</span>` +
                '</li>';
        }).join('')
        : '<li class="history-empty">No saved versions yet. Edit and your work will appear here.</li>';
    overlay.innerHTML =
        '<div class="history-card">' +
        '  <h2>Your saved versions</h2>' +
        '  <p>Pick one to go back to it. Your current work is kept in history too, so you can switch back.</p>' +
        `  <ul class="history-list">${rows}</ul>` +
        '  <button id="history-close" class="secondary">Close</button>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#history-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelectorAll('.history-row').forEach(row => {
        row.addEventListener('click', () => restoreVersion(parseInt(row.getAttribute('data-version'), 10), overlay));
    });
}

async function restoreVersion(version, overlay) {
    let res;
    try {
        res = await window.SupabaseClient.projectVersion(serverCode, version);
    } catch {
        res = null;
    }
    if (!res || !res.ok || !res.data || !res.data.found) {
        return; // leave the overlay open; nothing changed
    }
    // Load the old content and let autosave write it as a new latest version (history is
    // append-only, so nothing is lost).
    loadFileIntoEditors(res.data.content, 'a saved version', true);
    markDirty();
    if (overlay) overlay.remove();
}

// Briefly flash the green save pill with custom text (e.g. Ctrl+S when already saved).
function flashSavedPill(text) {
    const bar = document.getElementById('save-bar');
    if (!bar) return;
    if (saveBarTimer) { clearTimeout(saveBarTimer); saveBarTimer = null; }
    bar.textContent = text;
    bar.className = 'save-bar saved show';
    saveBarTimer = setTimeout(() => { bar.classList.remove('show'); }, 2000);
}

function updateSaveStatus(s) {
    // Persistent header chip: always reflects the current state for at-a-glance reassurance.
    const chip = document.getElementById('save-status');
    if (chip) {
        const labels = {
            saving: ['Saving…', 'saving'],
            saved: ['✓ Saved', 'saved'],
            unsaved: ['Editing…', 'unsaved'],
            blocked: ['⚠ Not saved', 'blocked']
        };
        const lab = labels[s.status] || [s.status, ''];
        chip.textContent = lab[0];
        chip.className = 'save-status ' + lab[1];
        chip.style.display = '';
    }
    // Transient butterbar: brief green when saved, persistent red when blocked, quiet while editing.
    const bar = document.getElementById('save-bar');
    if (!bar) return;
    if (saveBarTimer) { clearTimeout(saveBarTimer); saveBarTimer = null; }
    if (s.status === 'saved') {
        markClean(); // server save confirmed: the page is no longer "unsaved"
        bar.textContent = '✓ Saved';
        bar.className = 'save-bar saved show';
        saveBarTimer = setTimeout(() => { bar.classList.remove('show'); }, 2000);
    } else if (s.status === 'blocked') {
        bar.textContent = '⚠ Not saved — check your internet connection';
        bar.className = 'save-bar blocked show';
    } else {
        // 'unsaved' / 'saving' are transient and autosave is quick, so fade the pill out
        // rather than nagging on every edit (state class kept so it fades, not snaps).
        bar.classList.remove('show');
    }
}

function onServerConflict() {
    // Latest change is saved, but another device also edited this project. A history/restore
    // UI comes later; for now note it on the butterbar, then let it auto-hide.
    const bar = document.getElementById('save-bar');
    if (saveBarTimer) { clearTimeout(saveBarTimer); saveBarTimer = null; }
    if (bar) {
        bar.textContent = '✓ Saved — note: also edited on another device';
        bar.className = 'save-bar saved show';
        saveBarTimer = setTimeout(() => { bar.classList.remove('show'); }, 6000);
    }
}
