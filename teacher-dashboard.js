// Teacher dashboard logic. Talks to the Supabase RPCs via supabase-client.js. The teacher
// code is the capability: it is passed to every call and never persisted. One teacher code
// unlocks all of that teacher's classes; the dashboard shows a class list, then a per-class
// roster. See design_docs/PROJECT_STORAGE_V2.md §7 (dashboard) and §12.6 (RPCs).

(function () {
  const SC = window.SupabaseClient;
  const CW = window.CodeWords;

  const el = (id) => document.getElementById(id);
  const teacherInput = el('teacher-code');
  const statusBox = el('status');
  const classesWrap = el('classes-wrap');
  const rosterWrap = el('roster-wrap');
  const rosterBody = document.querySelector('#roster tbody');
  const rosterCount = el('roster-count');
  const revealBtn = el('reveal-btn');

  let teacherCode = null;     // the code currently loaded
  let teacherInfo = null;     // { name, school } from teacher_classes
  let classes = [];           // the teacher's classes
  let currentClass = null;    // { class_id, name, school, ... } when a class is open
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

  function fmtDate(iso) {
    if (!iso) { return ''; }
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Feather "copy" icon (two overlapping rounded rectangles).
  const COPY_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="9" y="9" width="13" height="13" rx="2"></rect>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

  async function copyText(text, btn) {
    try {
      if (window.navigator && window.navigator.clipboard) {
        await window.navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      if (btn) {
        const prev = btn.innerHTML;
        btn.innerHTML = '✓';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = prev; btn.classList.remove('copied'); }, 1200);
      }
    } catch {
      /* clipboard blocked; the code text is still selectable */
    }
  }

  // Turn a project slug into a friendly title for the sheet ("pixel-game" -> "Pixel Game").
  function prettyTitle(slug) {
    return String(slug || 'project').split(/[-_]/).filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // ── View switching ──────────────────────────────────────────────────────

  function showClasses() {
    currentClass = null;
    rosterWrap.style.display = 'none';
    classesWrap.style.display = '';
  }

  function showRoster() {
    classesWrap.style.display = 'none';
    rosterWrap.style.display = '';
  }

  // ── Class list ──────────────────────────────────────────────────────────

  function renderClassList() {
    teacherInfo = teacherInfo || {};
    const who = teacherInfo.name || 'Your classes';
    el('teacher-heading').textContent = teacherInfo.school ? `${who} — ${teacherInfo.school}` : who;
    if (!classes.length) {
      el('class-list').innerHTML = '<div class="empty">No classes yet. Create one below.</div>';
      return;
    }
    el('class-list').innerHTML = classes.map((c) => {
      const n = c.student_count || 0;
      const meta = [c.school, c.created_at ? `created ${fmtDate(c.created_at)}` : ''].filter(Boolean).join(' • ');
      return `<button class="class-card" data-class-id="${esc(c.class_id)}">
        <span><span class="cc-name">${esc(c.name || 'Untitled class')}</span>` +
        (meta ? `<br><span class="cc-meta">${esc(meta)}</span>` : '') + `</span>
        <span class="cc-count">${n} student${n === 1 ? '' : 's'}</span>
      </button>`;
    }).join('');
  }

  async function loadClasses(selectId) {
    msg('Loading…');
    const res = await SC.teacherClasses(teacherCode);
    if (!res.ok || !res.data || res.data.ok === false) {
      const err = res.data && res.data.error ? res.data.error : `HTTP ${res.status}`;
      msg(err === 'bad_teacher_code' ? 'That teacher code was not recognised.' : `Error: ${esc(err)}`, 'err');
      classesWrap.style.display = 'none';
      rosterWrap.style.display = 'none';
      return false;
    }
    msg('');
    teacherInfo = res.data.teacher || {};
    classes = res.data.classes || [];
    renderClassList();
    if (selectId) {
      const cls = classes.find((c) => c.class_id === selectId);
      if (cls) { selectClass(cls); return true; }
    }
    showClasses();
    return true;
  }

  async function onLoad() {
    const code = (teacherInput.value || '').trim();
    if (!code) { msg('Enter a teacher code.', 'err'); return; }
    teacherCode = code;
    await loadClasses();
  }

  async function onCreateClass() {
    const name = (el('new-class-name').value || '').trim();
    const school = (el('new-class-school').value || '').trim();
    const slug = (el('new-class-slug').value || '').trim() || 'pixel-game';
    if (!name) { el('create-result').innerHTML = '<div class="msg err">Enter a class name.</div>'; return; }
    el('create-class-btn').disabled = true;
    try {
      const res = await SC.createClass(teacherCode, name, school || null, slug);
      if (!res.data || res.data.ok === false) {
        const err = res.data && res.data.error ? res.data.error : `HTTP ${res.status}`;
        const human = err === 'too_many_classes' ? 'You have reached the class limit.' : esc(err);
        el('create-result').innerHTML = `<div class="msg err">Could not create class: ${human}</div>`;
        return;
      }
      el('new-class-name').value = '';
      el('new-class-school').value = '';
      el('create-result').innerHTML = '';
      await loadClasses(res.data.class_id);  // open the new class
    } finally {
      el('create-class-btn').disabled = false;
    }
  }

  // ── Roster (one class) ──────────────────────────────────────────────────

  function selectClass(cls) {
    currentClass = cls;
    codesById = null;
    revealedIds = new Set();
    el('class-heading').textContent = cls.school ? `${cls.name} — ${cls.school}` : cls.name;
    el('add-result').innerHTML = '';
    el('bulk-result').innerHTML = '';
    showRoster();
    loadRoster();
  }

  function updateRevealBtn() {
    revealBtn.textContent = revealedIds.size > 0 ? 'Hide all codes' : 'Reveal all codes';
  }

  function nameCell(name) {
    const n = (name || '').trim();
    return n ? esc(n) : '<span class="muted-name">(no name)</span>';
  }

  function renderRoster(roster) {
    currentRoster = roster;
    rosterCount.textContent = `${roster.length} student${roster.length === 1 ? '' : 's'}`;
    rosterBody.innerHTML = roster.map((r, i) => {
      const id = esc(r.project_id);
      const codeVal = (codesById && codesById[r.project_id]) || '';
      const codeCell = revealedIds.has(r.project_id)
        ? `<span class="code-cell">${esc(codeVal || '…')}</span>` +
          `<button class="copy-btn" data-copy="${esc(codeVal)}" title="Copy code">${COPY_ICON}</button> ` +
          `<span class="code-toggle" data-reveal-id="${id}">hide</span>`
        : `<span class="code-toggle" data-reveal-id="${id}">show</span>`;
      const status = r.completed_at ? '✓ complete' : '—';
      return `<tr>
        <td>${i + 1}</td>
        <td>${nameCell(r.display_name)}</td>
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
    const res = await SC.reprintCodes(teacherCode, currentClass.class_id);
    if (!res.ok || !res.data || res.data.ok === false) {
      msg('Could not fetch student codes.', 'err');
      return false;
    }
    codesById = {};
    (res.data.cards || []).forEach((c) => { codesById[c.project_id] = c.student_code; });
    return true;
  }

  async function loadRoster() {
    if (!currentClass) { return false; }
    msg('Loading…');
    const res = await SC.teacherRoster(teacherCode, currentClass.class_id);
    if (!res.ok || !res.data || res.data.ok === false) {
      const err = res.data && res.data.error ? res.data.error : `HTTP ${res.status}`;
      msg(err === 'bad_teacher_code' ? 'That class was not recognised.' : `Error: ${esc(err)}`, 'err');
      return false;
    }
    msg('');
    renderRoster(res.data.roster || []);
    return true;
  }

  // Per-row click: toggle just that student's code (lazily fetching codes on first reveal).
  async function onRosterClick(e) {
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) { copyText(copyBtn.getAttribute('data-copy'), copyBtn); return; }
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
    if (!currentClass) { return; }
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

  // Add one named (or unnamed) student. Generates a code client-side, retrying the rare
  // server-side collision.
  async function onAdd() {
    if (!currentClass) { return; }
    const name = (el('add-name').value || '').trim();
    const slug = (el('add-slug').value || '').trim() || 'pixel-game';
    el('add-btn').disabled = true;
    try {
      let added = false;
      let code = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        code = CW.generateStudentCode();
        const res = await SC.appendStudent(teacherCode, currentClass.class_id, slug, name || null, code);
        if (res.data && res.data.ok) { added = true; break; }
        if (res.data && res.data.error === 'class_full') {
          el('add-result').innerHTML = '<div class="msg err">This class is full (200 students max).</div>';
          return;
        }
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
      const who = name ? `<strong>${esc(name)}</strong>` : 'a student';
      el('add-result').innerHTML =
        `<div class="card-out">Added ${who}. Their code (write it on a card):<br>` +
        `<span class="code-cell" style="font-size:1.1rem">${esc(code)}</span> ` +
        `<button class="copy-btn" data-copy="${esc(code)}" title="Copy code">${COPY_ICON}</button></div>`;
      const addCopyBtn = el('add-result').querySelector('.copy-btn');
      if (addCopyBtn) { addCopyBtn.addEventListener('click', () => copyText(addCopyBtn.getAttribute('data-copy'), addCopyBtn)); }
      el('add-name').value = '';
      codesById = null;        // a new student exists; refetch codes on next reveal
      revealedIds = new Set();  // collapse reveals so nothing shows a stale placeholder
      await loadRoster();
    } finally {
      el('add-btn').disabled = false;
    }
  }

  // Generate n unique student codes, deduped within this batch.
  function makeUniqueCodes(n) {
    const seen = new Set();
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = CW.generateUnique((x) => seen.has(x));
      if (!c) { break; }  // exhausted attempts (vanishingly unlikely)
      seen.add(c);
      out.push(c);
    }
    return out;
  }

  // Bulk-add anonymous (blank-name) students. Sends a candidate pool a bit larger than the
  // target so the server can fill any hash collision from spares in one round-trip; tops up
  // across a few attempts if needed.
  async function onBulkAdd() {
    if (!currentClass) { return; }
    const want = parseInt(el('bulk-count').value, 10);
    const slug = (el('bulk-slug').value || '').trim() || 'pixel-game';
    if (!want || want < 1) { el('bulk-result').innerHTML = '<div class="msg err">Enter how many to add.</div>'; return; }
    if (want > 40) { el('bulk-result').innerHTML = '<div class="msg err">Add at most 40 at a time.</div>'; return; }
    el('bulk-btn').disabled = true;
    try {
      const collected = [];
      let remaining = null;
      for (let attempt = 0; attempt < 3 && collected.length < want; attempt++) {
        const need = want - collected.length;
        const pool = makeUniqueCodes(need + Math.max(5, Math.ceil(need * 0.25)))
          .filter((c) => collected.indexOf(c) === -1);
        const res = await SC.addStudentsBulk(teacherCode, currentClass.class_id, slug, need, pool);
        if (!res.data || res.data.ok === false) {
          const err = res.data && res.data.error ? res.data.error : `HTTP ${res.status}`;
          el('bulk-result').innerHTML = `<div class="msg err">Could not add students: ${esc(err)}</div>`;
          return;
        }
        (res.data.added || []).forEach((c) => collected.push(c));
        remaining = res.data.remaining;
        if (remaining === 0) { break; }  // class hit the 200 cap
      }
      renderBulkResult(collected, want, remaining);
      codesById = null;
      revealedIds = new Set();
      await loadRoster();
    } finally {
      el('bulk-btn').disabled = false;
    }
  }

  function renderBulkResult(codes, want, remaining) {
    if (!codes.length) {
      el('bulk-result').innerHTML = '<div class="msg err">No codes were added' +
        (remaining === 0 ? ' (the class is full).' : '.') + '</div>';
      return;
    }
    const list = codes.map((c) =>
      `<span class="code-cell" style="display:inline-block;margin:2px 10px 2px 0">${esc(c)}</span>` +
      `<button class="copy-btn" data-copy="${esc(c)}" title="Copy code">${COPY_ICON}</button>`
    ).join('');
    const short = codes.length < want
      ? `<div class="msg err">Only ${codes.length} of ${want} added` +
        (remaining === 0 ? ' (the class is full).' : '.') + `</div>`
      : '';
    el('bulk-result').innerHTML =
      `<div class="card-out">Added <strong>${codes.length}</strong> blank-name code${codes.length === 1 ? '' : 's'}. ` +
      `Use "Print code table" to hand them out and write names against them.<br>${list}</div>${short}`;
    el('bulk-result').querySelectorAll('.copy-btn').forEach((b) =>
      b.addEventListener('click', () => copyText(b.getAttribute('data-copy'), b)));
  }

  // ── Printing ────────────────────────────────────────────────────────────

  // A compact Name + Code table for classroom handout (one or two pages). Opens a print
  // window; blank names render as a write-on line so a teacher can pair codes to the class
  // list by hand.
  function openCodeTablePrint(className, school, rows) {
    const w = window.open('', '_blank');
    if (!w) { msg('Pop-up blocked. Allow pop-ups for this site to print the code table.', 'err'); return; }
    const tbody = rows.map((r, i) => {
      const name = (r.name || '').trim();
      const nameCellHtml = name ? esc(name) : '<span class="blank"></span>';
      return `<tr><td class="n">${i + 1}</td><td>${nameCellHtml}</td><td class="code">${esc(r.code)}</td></tr>`;
    }).join('');
    const subParts = [school, `${rows.length} student${rows.length === 1 ? '' : 's'}`, 'Wavelet login codes'];
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(className)} — codes</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #555; font-size: 12px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ccc; font-size: 13px; }
  th { border-bottom: 2px solid #333; }
  td.n { width: 28px; color: #777; }
  td.code { font-family: 'Courier New', monospace; font-weight: bold; white-space: nowrap; }
  .blank { display: inline-block; border-bottom: 1px solid #aaa; width: 150px; height: 1em; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <h1>${esc(className)}</h1>
  <p class="sub">${esc(subParts.filter(Boolean).join(' • '))}</p>
  <table><thead><tr><th>#</th><th>Name</th><th>Code</th></tr></thead><tbody>${tbody}</tbody></table>
  <script>window.onload = function () { window.print(); };<\/script>
</body></html>`;
    w.document.write(html);
    w.document.close();
  }

  async function onPrintCodeTable() {
    if (!currentClass || !currentRoster.length) { msg('Add some students first.', 'err'); return; }
    if (!(await ensureCodes())) { return; }
    const rows = currentRoster.map((r) => ({ name: r.display_name || '', code: codesById[r.project_id] || '' }));
    openCodeTablePrint(currentClass.name, currentClass.school, rows);
  }

  // Build the whole-class progress-pack PDF (one page per student): identity block +
  // play-at-home QR + their finished code. Fetches each student's content via load_project.
  async function onPrintFinal() {
    if (!currentClass || !currentRoster.length) { msg('Add some students first.', 'err'); return; }
    if (!window.CoverSheet) { msg('Printing is unavailable (library failed to load).', 'err'); return; }
    const btn = el('print-final-btn');
    const prev = btn.textContent;
    btn.disabled = true;
    try {
      if (!(await ensureCodes())) { return; }
      const students = [];
      for (let i = 0; i < currentRoster.length; i++) {
        const r = currentRoster[i];
        const code = codesById[r.project_id];
        if (!code) { continue; }
        btn.textContent = `Building… ${i + 1}/${currentRoster.length}`;
        let content = '';
        try {
          const res = await SC.loadProject(code);
          if (res.ok && res.data && res.data.found !== false) { content = res.data.content || ''; }
        } catch {
          /* leave content empty; the sheet still prints the identity block */
        }
        students.push({ name: r.display_name, code, content });
      }
      if (!students.length) { msg('No students to print.', 'err'); return; }
      const slug = (currentRoster[0] && currentRoster[0].project_slug) || 'pixel-game';
      btn.textContent = 'Saving PDF…';
      await window.CoverSheet.generateFinalSheets({
        students, projectId: slug, projectTitle: prettyTitle(slug)
      });
      msg(`Built progress sheets for ${students.length} student${students.length === 1 ? '' : 's'}.`, 'ok');
    } catch (e) {
      msg('Could not build the PDF: ' + esc(e && e.message ? e.message : e), 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  // ── Wiring ──────────────────────────────────────────────────────────────

  el('load-btn').addEventListener('click', onLoad);
  teacherInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { onLoad(); } });
  el('create-class-btn').addEventListener('click', onCreateClass);
  el('class-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-class-id]');
    if (!card) { return; }
    const cls = classes.find((c) => c.class_id === card.getAttribute('data-class-id'));
    if (cls) { selectClass(cls); }
  });
  el('back-btn').addEventListener('click', () => { loadClasses(); });
  revealBtn.addEventListener('click', onRevealToggle);
  el('refresh-btn').addEventListener('click', loadRoster);
  el('add-btn').addEventListener('click', onAdd);
  el('bulk-btn').addEventListener('click', onBulkAdd);
  el('print-codes-btn').addEventListener('click', onPrintCodeTable);
  el('print-final-btn').addEventListener('click', onPrintFinal);
  rosterBody.addEventListener('click', onRosterClick);
})();
