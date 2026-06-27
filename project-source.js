// Shared, pure helpers for assembling a project's .py source and measuring it. No DOM, no
// state. The student project page (project.js) has its own copies of the assembly logic; this
// module mirrors the code-bearing parts so the TEACHER dashboard can compute the SAME starter
// baseline the student History view subtracts ("lines you wrote"). Keep in sync with project.js
// (buildEditorSource / assembleFileForDisk) and supabase migration 0004 (meaningful_line_count).
// Exposed as window.ProjectSource and via CommonJS for tests.
(function () {
  'use strict';

  const BODY_INDENT = '  ';

  // Count "meaningful" code lines: non-blank, not a comment-only (#...) line, not a bare `pass`.
  // Matches meaningful_line_count() in supabase/migrations/0004_meaningful_lines.sql.
  function meaningfulLineCount(content) {
    return String(content == null ? '' : content).split('\n').filter((line) => {
      const t = line.trim();
      return t !== '' && t[0] !== '#' && t !== 'pass';
    }).length;
  }

  // One function task's editor source: `def name():` + indented body (or `pass` when empty).
  function buildEditorSource(fnName, body) {
    const trimmed = (body || '').replace(/\s+$/g, '');
    const bodyLines = trimmed === '' ? ['pass'] : trimmed.split('\n');
    const indented = bodyLines.map((l) => (l === '' ? '' : BODY_INDENT + l)).join('\n');
    return `def ${fnName}():\n${indented}\n${BODY_INDENT}`;
  }

  function isMultiFunction(task) {
    return Array.isArray(task.functions) && task.functions.length > 0;
  }

  function buildMultiFunctionSource(funcs) {
    return funcs.map((f) => buildEditorSource(f.name, f.starterBody)).join('\n');
  }

  // The code-bearing parts of a project's PRISTINE starter file, in the same order project.js
  // assembleFileForDisk() emits them at init. Header / "# Task N" / freestyle-marker comment
  // lines are omitted because they don't affect meaningfulLineCount (they're comments):
  //   locked preamble, setup seed + editable preamble, freestyle starter, function task sources.
  function assembleStarterSource(def) {
    const d = def || {};
    const parts = [];
    (d.lockedPreamble || []).forEach((l) => parts.push(l));
    parts.push((d.setupSeed || '') + (d.editablePreamble || ''));  // buildSetupSource() at init
    const tasks = d.tasks || [];
    const freestyle = tasks.find((t) => t.freestyle);
    if (freestyle) { parts.push(freestyle.starterBody || ''); }
    // getFunctionTasks(): real coding tasks (no `type`, not crossArea), excluding freestyle.
    tasks.filter((t) => !t.type && !t.crossArea && !t.freestyle).forEach((task) => {
      parts.push(isMultiFunction(task)
        ? buildMultiFunctionSource(task.functions)
        : buildEditorSource(task.function, task.starterBody));
    });
    return parts.join('\n');
  }

  // Meaningful line count of a project's pristine starter (the baseline to subtract from a
  // student's latest meaningful line count to get "lines you wrote").
  function starterMeaningfulLines(def) {
    return meaningfulLineCount(assembleStarterSource(def));
  }

  // The PRISTINE starter file as it would be saved to disk, mirroring project.js
  // assembleFileForDisk() with no student edits: header, locked preamble, setup (seed +
  // editable preamble), the freestyle section, then each function task under a "# Task N"
  // marker. Used by the teacher dashboard to print a starter page for an "assigned" student
  // who has no saved work yet, so it reads the same as a real submission. The "# Saved:" date
  // line is intentionally omitted: nothing was saved.
  function assembleStarterFile(def) {
    const d = def || {};
    const lines = [`# Wavelet ${d.title || ''}`, `# Project: ${d.id || ''}`, ''];
    (d.lockedPreamble || []).forEach((l) => lines.push(l));
    const setup = ((d.setupSeed || '') + (d.editablePreamble || ''));
    if (setup.trim()) { lines.push(setup.replace(/\s+$/g, '')); }
    lines.push('');
    const tasks = d.tasks || [];
    const freestyle = tasks.find((t) => t.freestyle);
    if (freestyle) {
      lines.push('# ── Freestyle ──');
      lines.push((freestyle.starterBody || '').replace(/\s+$/g, ''));
      lines.push('');
    }
    // getFunctionTasks(): real coding tasks (no `type`, not crossArea), excluding freestyle.
    tasks.filter((t) => !t.type && !t.crossArea && !t.freestyle).forEach((task, idx) => {
      const src = isMultiFunction(task)
        ? buildMultiFunctionSource(task.functions)
        : buildEditorSource(task.function, task.starterBody);
      lines.push(`# Task ${idx + 1}: ${task.title || ''}`);
      lines.push(src.replace(/\s+$/g, ''));
      lines.push('');
    });
    return lines.join('\n');
  }

  const api = {
    meaningfulLineCount, buildEditorSource, buildMultiFunctionSource,
    isMultiFunction, assembleStarterSource, starterMeaningfulLines, assembleStarterFile
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof window !== 'undefined') { window.ProjectSource = api; }
})();
