// Unit tests for project-source.js (shared starter-assembly + meaningful line count).
// Run with: node project-source-test.js  (or python3 scripts/run-js-tests.py project-source-test.js)

const PS = require('./project-source.js');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; } else { failed++; console.log(`❌ FAILED: ${name}  ${detail || ''}`); }
}

// ---- meaningfulLineCount ----
check('blank/comment/pass are not counted',
  PS.meaningfulLineCount('# a comment\npass\n\n  \nprint(1)') === 1,
  String(PS.meaningfulLineCount('# a comment\npass\n\n  \nprint(1)')));
check('inline comment still counts (only whole-line # dropped)',
  PS.meaningfulLineCount('x = 1  # note') === 1);
check('indented pass dropped, indented code kept',
  PS.meaningfulLineCount('  pass\n    y = 2') === 1);
check('empty content -> 0', PS.meaningfulLineCount('') === 0 && PS.meaningfulLineCount(null) === 0);

// ---- buildEditorSource ----
check('buildEditorSource empty body -> def + pass',
  PS.buildEditorSource('draw', '') === 'def draw():\n  pass\n  ',
  JSON.stringify(PS.buildEditorSource('draw', '')));
check('buildEditorSource counts as 1 meaningful (def line only)',
  PS.meaningfulLineCount(PS.buildEditorSource('draw', 'pass')) === 1);

// ---- starterMeaningfulLines: a synthetic project def with a known meaningful total ----
const def = {
  lockedPreamble: ['import math', 'use_canvas(GRID20)'],   // 2
  setupSeed: 'state = SimpleNamespace()\n',                 // 1
  editablePreamble: 'state.x = 0\n# comment\n',             // 1 (comment ignored)
  tasks: [
    { type: 'concept' },                                     // ignored (has type)
    { function: 'draw', starterBody: 'pass' },               // def draw():            -> 1
    { function: 'move', starterBody: '# todo\npass' },       // def move():            -> 1
    { freestyle: true, starterBody: 'x = 1' },               // x = 1                  -> 1
    { crossArea: true, function: 'skip', starterBody: 'y = 2' }, // excluded (crossArea)
    { functions: [{ name: 'a', starterBody: 'pass' }, { name: 'b', starterBody: 'z = 3' }] } // def a(), def b(), z=3 -> 3
  ]
};
check('starterMeaningfulLines sums code-bearing parts (expect 10)',
  PS.starterMeaningfulLines(def) === 10, String(PS.starterMeaningfulLines(def)));
check('crossArea + concept tasks excluded',
  PS.assembleStarterSource(def).indexOf('skip') === -1);

console.log(`\n📊 project-source test summary\n✅ Passed: ${passed}\n❌ Failed: ${failed}`);
if (failed === 0) { console.log('\n🎉 All project-source tests passed!'); process.exit(0); }
else { console.log(`\n⚠️  ${failed} failed.`); process.exit(1); }
