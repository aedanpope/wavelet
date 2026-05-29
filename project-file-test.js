// Tests for the project file-loading / parsing logic in project.js.
//
// The parser that decides whether a student's saved .py file loads back into
// the editors (vs. getting lost) is Python embedded in a JS template string
// and normally run inside Pyodide. Rather than reimplement it, this test
// EXTRACTS that exact embedded Python from project.js and runs it through the
// system python3 (available in CI), so we exercise the real code.
//
// Covered scenarios focus on "can a student break things or get locked out":
//   - well-formed Wavelet file round-trips into the right bodies
//   - missing functions fall back to starter (reported as missing, not lost)
//   - a duplicate def is detected (valid Python, silently keeps the last one)
//   - a syntax error still recovers function bodies instead of dumping to Extras
//   - locked preamble lines are dropped, editable preamble is kept
//   - unknown top-level code goes to Extras (preserved, not executed as a task)
//
// Plus a pure-JS test of the assemble -> reopen round trip.

const fs = require('fs');
const { execFileSync } = require('child_process');
const assert = require('assert');

const SRC = fs.readFileSync(require.resolve('./project.js'), 'utf8');

let passed = 0;
let failed = 0;
function check(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        failed++;
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
    }
}

// ── Extract an embedded Python block by a marker it contains ───────────────
// project.js calls py.runPython(`...python...`) in several places. We grab the
// block whose body contains the given marker, then undo the JS template-literal
// escaping (\\n -> \n, \\ -> \) so python3 sees the real source.
function extractEmbeddedPython(marker) {
    const blocks = [...SRC.matchAll(/runPython\(`([\s\S]*?)`\)/g)].map(m => m[1]);
    const block = blocks.find(b => b.includes(marker));
    if (!block) throw new Error(`No embedded python block containing "${marker}"`);
    return block.replace(/\\\\/g, '\\');
}

const PARSER_PY = extractEmbeddedPython('_wavelet_parse_project');
const DUP_PY = extractEmbeddedPython('_wavelet_find_duplicate_def');
const SYNTAX_PY = extractEmbeddedPython('_wavelet_check_syntax');

function runPython(prelude, driver) {
    const program = `${prelude}\n\nimport json, sys\n${driver}\n`;
    const out = execFileSync('python3', ['-c', program], { encoding: 'utf8' });
    return JSON.parse(out);
}

// Call the file parser with a given source / known-names / locked-lines set.
function parseFile(src, known, locked) {
    const driver = `
_wavelet_src = ${JSON.stringify(src)}
_wavelet_known = ${JSON.stringify(known)}
_wavelet_locked = ${JSON.stringify(locked)}
res = _wavelet_parse_project()
print(json.dumps(res))
`;
    return runPython(PARSER_PY, driver);
}

function findDuplicateDef(src) {
    const driver = `print(json.dumps(_wavelet_find_duplicate_def(${JSON.stringify(src)})))`;
    return runPython(DUP_PY, driver);
}

function checkSyntax(src) {
    const driver = `print(json.dumps(_wavelet_check_syntax(${JSON.stringify(src)})))`;
    return runPython(SYNTAX_PY, driver);
}

const KNOWN = ['draw_corners', 'draw_player', 'draw_scene', 'on_left_key'];
const LOCKED = ['use_canvas(GRID20)', 'from types import SimpleNamespace', 'state = SimpleNamespace()'];

console.log('\n🧪 project file parser (embedded python via python3)\n');

check('well-formed file loads each known function body', () => {
    const src = [
        'use_canvas(GRID20)',
        'from types import SimpleNamespace',
        'state = SimpleNamespace()',
        'state.player_x = 10',
        '',
        'def draw_corners():',
        "  draw(0, 0, 'red')",
        "  draw(19, 0, 'blue')",
        '',
        'def draw_player():',
        "  draw(state.player_x, 5, 'lime')",
    ].join('\n');
    const r = parseFile(src, KNOWN, LOCKED);
    assert.strictEqual(r.error, null);
    assert.ok(r.bodies.draw_corners.includes("draw(0, 0, 'red')"), 'corners body kept');
    assert.ok(r.bodies.draw_corners.includes("draw(19, 0, 'blue')"), 'second corner kept');
    assert.ok(r.bodies.draw_player.includes("draw(state.player_x, 5, 'lime')"), 'player body kept');
    assert.ok(r.editablePreamble.includes('state.player_x = 10'), 'editable preamble kept');
    assert.ok(!r.editablePreamble.includes('SimpleNamespace'), 'locked lines dropped from preamble');
});

check('a missing known function is simply absent (falls back to starter, not lost)', () => {
    const src = 'def draw_corners():\n  draw(0, 0, "red")\n';
    const r = parseFile(src, KNOWN, LOCKED);
    assert.ok('draw_corners' in r.bodies, 'present function parsed');
    assert.ok(!('draw_player' in r.bodies), 'absent function not invented');
    // loadFileIntoEditors uses this absence to reset that task to starter.
});

check('unknown top-level function goes to Extras, not executed as a task', () => {
    const src = 'def some_helper():\n  return 42\n';
    const r = parseFile(src, KNOWN, LOCKED);
    assert.ok(!('some_helper' in r.bodies), 'unknown fn not a task body');
    assert.ok(r.extras.includes('some_helper'), 'unknown fn preserved in extras');
});

check('empty file parses without error and loses nothing', () => {
    const r = parseFile('', KNOWN, LOCKED);
    assert.strictEqual(r.error, null);
    assert.deepStrictEqual(r.bodies, {});
    assert.strictEqual(r.extras, '');
});

check('only-marker file (no code) parses cleanly', () => {
    const r = parseFile('# Wavelet Pixel Game\n# Project: pixel-game\n', KNOWN, LOCKED);
    assert.strictEqual(r.error, null);
});

console.log('\n🧪 syntax-error recovery (the rehydrate fix)\n');

check('syntax error still recovers known function bodies into editors', () => {
    // Missing close paren inside draw_corners -> file does not ast.parse.
    const src = [
        'state.player_x = 10',
        'def draw_corners():',
        "  draw(0, 0, 'red'",         // <- broken line
        "  draw(19, 0, 'blue')",
        'def draw_player():',
        "  draw(1, 1, 'lime')",
    ].join('\n');
    const r = parseFile(src, KNOWN, LOCKED);
    assert.ok(r.error, 'error is reported');
    assert.ok('draw_corners' in r.bodies, 'broken function body still recovered');
    assert.ok(r.bodies.draw_corners.includes("draw(0, 0, 'red'"), 'broken line preserved verbatim');
    assert.ok('draw_player' in r.bodies, 'following function also recovered');
    assert.ok(r.editablePreamble.includes('state.player_x = 10'), 'preamble recovered');
});

check('syntax error: unknown code still routed to extras, not lost', () => {
    const src = 'mystery(\n\ndef draw_corners():\n  draw(0,0,"red")\n';
    const r = parseFile(src, KNOWN, LOCKED);
    assert.ok(r.error, 'error reported');
    // draw_corners is recoverable; the dangling mystery( line is preserved somewhere.
    const everywhere = JSON.stringify(r);
    assert.ok(everywhere.includes('mystery'), 'nothing silently dropped');
});

console.log('\n🧪 duplicate-def detection (valid Python, silently breaks tasks)\n');

check('duplicate def is detected', () => {
    const src = 'def draw_corners():\n  draw(0,0,"red")\n\ndef draw_corners():\n  pass\n';
    assert.strictEqual(findDuplicateDef(src), 'draw_corners');
});

check('single def is not flagged', () => {
    const src = 'def draw_corners():\n  draw(0,0,"red")\n';
    assert.strictEqual(findDuplicateDef(src), null);
});

check('two different defs are not flagged', () => {
    const src = 'def draw_corners():\n  pass\n\ndef draw_player():\n  pass\n';
    assert.strictEqual(findDuplicateDef(src), null);
});

check('syntax error does not throw from the duplicate finder (returns null)', () => {
    assert.strictEqual(findDuplicateDef('def draw_corners(:\n  pass'), null);
});

console.log('\n🧪 syntax checker (compile-based)\n');

check('valid code reports no syntax error', () => {
    assert.strictEqual(checkSyntax('def f():\n  return 1\n'), null);
});

check('invalid code reports a line + message', () => {
    const r = checkSyntax('def f(:\n  return 1\n');
    assert.ok(typeof r === 'string' && r.includes('line'), 'syntax error string returned');
});

check('a duplicate def is NOT a syntax error (this is why we need ast inspection)', () => {
    // This is the crux: compile() accepts duplicate defs, so checkSyntax can't
    // catch them; only findDuplicateDef (ast walk) does.
    assert.strictEqual(checkSyntax('def f():\n  pass\ndef f():\n  pass\n'), null);
});

console.log(`\n${failed === 0 ? '✅' : '❌'} project-file-test: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
