// Teacher dashboard logic. Talks to the Supabase RPCs via supabase-client.js. The teacher
// code is the capability: it is passed to every call and never persisted.
// See design_docs/PROJECT_STORAGE_V2.md §7 (dashboard) and §12.6 (RPCs).

(function () {
  const SC = window.SupabaseClient;
  const CW = window.CodeWords;

  const el = (id) => document.getElementById(id);
  const teacherInput = el('teacher-code');
  const statusBox = el('status');
  const rosterWrap = el('roster-wrap');
  const rosterBody = document.querySelector('#roster tbody');
  const rosterCount = el('roster-count');
  const revealBtn = el('reveal-btn');

  let teacherCode = null;     // the code currently loaded
  let currentRoster = [];     // last rendered roster
  let codesById = null;       // project_id -> student_code, fetched lazily via reprint
  let revealedIds = new Set();// which rows currently show their code

  function msg(text, kind) {
    statusBox.innerHTML = text ? `<div class="msg ${kind || ''}">${text}</div>` : '';
  }

  function fmtTime(iso) {
    if (!iso) { return 'never'; }
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function updateRevealBtn() {
    revealBtn.textContent = revealedIds.size > 0 ? 'Hide all codes' : 'Reveal all codes';
  }

  function renderRoster(roster) {
    currentRoster = roster;
    rosterCount.textContent = `${roster.length} student${roster.length === 1 ? '' : 's'}`;
    rosterBody.innerHTML = roster.map((r, i) => {
      const id = esc(r.project_id);
      const codeCell = revealedIds.has(r.project_id)
        ? `<span class="code-cell code-toggle" data-reveal-id="${id}" title="click to hide">${esc((codesById && codesById[r.project_id]) || '…')}</span>`
        : `<span class="code-toggle" data-reveal-id="${id}">show</span>`;
      const status = r.completed_at ? '✓ complete' : '—';
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(r.display_name)}</td>
        <td>${esc(r.project_slug)}</td>
        <td>${esc(r.version)}</td>
        <td>${esc(fmtTime(r.last_saved_at))}</td>
        <td>${status}</td>
        <td>${codeCell}</td>
      </tr>`;
    }).join('');
    updateRevealBtn();
  }

  // Fetch the decrypted codes once (reprint returns the whole class).
  async function ensureCodes() {
    if (codesById) { return true; }
    const res = await SC.reprintCodes(teacherCode);
    if (!res.ok || !res.data || res.data.ok === false) {
      msg('Could not fetch student codes.', 'err');
      return false;
    }
    codesById = {};
    (res.data.cards || []).forEach((c) => { codesById[c.project_id] = c.student_code; });
    return true;
  }

  async function loadRoster() {
    msg('Loading…');
    const res = await SC.teacherRoster(teacherCode);
    if (!res.ok || !res.data || res.data.ok === false) {
      const err = res.data && res.data.error ? res.data.error : `HTTP ${res.status}`;
      msg(err === 'bad_teacher_code' ? 'That teacher code was not recognised.' : `Error: ${esc(err)}`, 'err');
      rosterWrap.style.display = 'none';
      return false;
    }
    msg('');
    rosterWrap.style.display = '';
    renderRoster(res.data.roster || []);
    return true;
  }

  async function onLoad() {
    const code = (teacherInput.value || '').trim();
    if (!code) { msg('Enter a teacher code.', 'err'); return; }
    teacherCode = code;
    codesById = null;
    revealedIds = new Set();
    await loadRoster();
  }

  // Per-row click: toggle just that student's code (lazily fetching codes on first reveal).
  async function onRosterClick(e) {
    const target = e.target.closest('[data-reveal-id]');
    if (!target) { return; }
    const id = target.getAttribute('data-reveal-id');
    if (revealedIds.has(id)) {
      revealedIds.delete(id);
      renderRoster(currentRoster);
      return;
    }
    if (!(await ensureCodes())) { return; }
    revealedIds.add(id);
    renderRoster(currentRoster);
  }

  // Global button: reveal all, or hide all if any are showing.
  async function onRevealToggle() {
    if (!teacherCode) { return; }
    if (revealedIds.size > 0) {
      revealedIds = new Set();
      renderRoster(currentRoster);
      return;
    }
    if (!confirm('Reveal all student codes on screen? Avoid doing this while projecting to the class.')) { return; }
    if (!(await ensureCodes())) { return; }
    currentRoster.forEach((r) => revealedIds.add(r.project_id));
    renderRoster(currentRoster);
  }

  async function onAdd() {
    const name = (el('add-name').value || '').trim();
    const slug = (el('add-slug').value || '').trim() || 'pixel-game';
    if (!name) { el('add-result').innerHTML = '<div class="msg err">Enter a student name.</div>'; return; }
    el('add-btn').disabled = true;
    try {
      // Generate a code client-side and retry on the rare server-side collision.
      let added = false;
      let code = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        code = CW.generateStudentCode();
        const res = await SC.appendStudent(teacherCode, slug, name, code);
        if (res.data && res.data.ok) { added = true; break; }
        if (!(res.data && res.data.error === 'code_taken')) {
          const err = res.data && res.data.error ? res.data.error : `HTTP ${res.status}`;
          el('add-result').innerHTML = `<div class="msg err">Could not add student: ${esc(err)}</div>`;
          return;
        }
      }
      if (!added) {
        el('add-result').innerHTML = '<div class="msg err">Could not find a free code, try again.</div>';
        return;
      }
      el('add-result').innerHTML =
        `<div class="card-out">Added <strong>${esc(name)}</strong>. Their code (write it on a card):<br>` +
        `<span class="code-cell" style="font-size:1.1rem">${esc(code)}</span></div>`;
      el('add-name').value = '';
      codesById = null;        // a new student exists; refetch codes on next reveal
      revealedIds = new Set();  // collapse reveals so nothing shows a stale placeholder
      await loadRoster();
    } finally {
      el('add-btn').disabled = false;
    }
  }

  el('load-btn').addEventListener('click', onLoad);
  teacherInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { onLoad(); } });
  revealBtn.addEventListener('click', onRevealToggle);
  el('refresh-btn').addEventListener('click', loadRoster);
  el('add-btn').addEventListener('click', onAdd);
  rosterBody.addEventListener('click', onRosterClick);
})();
