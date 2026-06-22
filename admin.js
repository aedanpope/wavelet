// Owner-only helper: generate a teacher code and the matching mint_teacher(...) SQL to paste
// into the Supabase SQL editor. No database access from this page; the code is created only
// when the owner runs the SQL. See design_docs/PROJECT_STORAGE_V2.md §3.4 / §12.6.

(function () {
  const CW = window.CodeWords;
  const el = (id) => document.getElementById(id);

  let teacherCode = CW.generateTeacherCode();

  // SQL single-quote escaping: ' -> ''. Blank fields become NULL.
  function sqlText(value) {
    const v = (value || '').trim();
    return v ? `'${v.replace(/'/g, "''")}'` : 'null';
  }

  function buildSql() {
    const school = sqlText(el('school').value);
    const name = sqlText(el('name').value);
    return `select mint_teacher(${school}, ${name}, '${teacherCode}');`;
  }

  function render() {
    el('code').textContent = teacherCode;
    el('sql').textContent = buildSql();
  }

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
        const prev = btn.textContent;
        btn.textContent = '✓ copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = prev; btn.classList.remove('copied'); }, 1200);
      }
    } catch {
      /* clipboard blocked; the text is still selectable */
    }
  }

  el('regen').addEventListener('click', () => { teacherCode = CW.generateTeacherCode(); render(); });
  el('copy-code').addEventListener('click', (e) => copyText(teacherCode, e.currentTarget));
  el('copy-sql').addEventListener('click', (e) => copyText(buildSql(), e.currentTarget));
  el('school').addEventListener('input', () => { el('sql').textContent = buildSql(); });
  el('name').addEventListener('input', () => { el('sql').textContent = buildSql(); });

  render();
})();
