// Unit tests for cover-sheet.js pure layout helpers (the jsPDF/QR rendering is
// browser-only and not covered here).
// Run with: node cover-sheet-test.js  (or: python3 scripts/run-js-tests.py cover-sheet-test.js)

const {
    buildProjectUrl, buildShortUrl, displayUrl, sheetTitle,
    fitCodeFontSize, linesThatFit, cropCodeLines, clipLine, splitIntoColumns
} = require('./cover-sheet.js');

let passed = 0;
let failed = 0;
function check(name, condition) {
    if (condition) { passed++; } else { failed++; console.log(`❌ FAILED: ${name}`); }
}

// ── buildProjectUrl ─────────────────────────────────────────────────────────
check('buildProjectUrl puts code in the fragment',
    buildProjectUrl('https://wavelet.zone', 'pixel-game', 'brave-otter-oak')
        === 'https://wavelet.zone/project.html?project=pixel-game#code=brave-otter-oak');
check('buildProjectUrl strips a trailing slash on origin',
    buildProjectUrl('https://wavelet.zone/', 'pixel-game', 'a-b-c')
        === 'https://wavelet.zone/project.html?project=pixel-game#code=a-b-c');
check('buildProjectUrl encodes the project id',
    buildProjectUrl('https://x.dev', 'a b', 'c').indexOf('project=a%20b') !== -1);
check('buildProjectUrl keeps code out of the query string',
    buildProjectUrl('https://x.dev', 'p', 'secret-code').indexOf('?project=p#code=secret-code') !== -1);

// ── buildShortUrl / displayUrl ───────────────────────────────────────────────
check('buildShortUrl is the root with a code query',
    buildShortUrl('https://wavelet.zone', 'perky-fish-fig') === 'https://wavelet.zone/?code=perky-fish-fig');
check('buildShortUrl strips a trailing slash on origin',
    buildShortUrl('https://wavelet.zone/', 'a-b-c') === 'https://wavelet.zone/?code=a-b-c');
check('displayUrl drops protocol and the slash before the query',
    displayUrl('https://wavelet.zone/?code=perky-fish-fig') === 'wavelet.zone?code=perky-fish-fig');
check('displayUrl leaves a path-bearing url readable',
    displayUrl('https://x.dev/project.html?project=p#code=c') === 'x.dev/project.html?project=p#code=c');

// ── sheetTitle ──────────────────────────────────────────────────────────────
check('sheetTitle adds the possessive', sheetTitle('Sam', 'Pixel Game') === "Sam's Pixel Game");
check('sheetTitle says "My ..." when there is no name', sheetTitle('', 'Pixel Game') === 'My Pixel Game');
check('sheetTitle treats whitespace-only as no name', sheetTitle('   ', 'Pixel Game') === 'My Pixel Game');
check('sheetTitle trims whitespace around a real name', sheetTitle('  Sam  ', 'Pixel Game') === "Sam's Pixel Game");
check('sheetTitle uses a bare apostrophe for a name ending in s', sheetTitle('Alexis', 'Pixel Game') === "Alexis' Pixel Game");
check('sheetTitle handles an uppercase trailing S', sheetTitle('Chris', 'Pixel Game') === "Chris' Pixel Game");

// ── fitCodeFontSize ─────────────────────────────────────────────────────────
const geom = { availableHeight: 600, maxFont: 9, minFont: 5, lineHeightRatio: 1.25 };
check('fitCodeFontSize uses the max font when everything fits',
    fitCodeFontSize(5, geom) === 9);
check('fitCodeFontSize shrinks when there are many lines',
    fitCodeFontSize(80, geom) < 9 && fitCodeFontSize(80, geom) >= 5);
check('fitCodeFontSize never goes below minFont',
    fitCodeFontSize(100000, geom) === 5);
check('fitCodeFontSize is monotonic: more lines never gives a bigger font',
    fitCodeFontSize(40, geom) >= fitCodeFontSize(60, geom));

// ── linesThatFit ────────────────────────────────────────────────────────────
check('linesThatFit at font 9 in 600pt height',
    linesThatFit(9, geom) === Math.floor(600 / (9 * 1.25)));
check('linesThatFit returns at least 1',
    linesThatFit(1000, { availableHeight: 10, lineHeightRatio: 1.25 }) === 1);

// ── cropCodeLines ───────────────────────────────────────────────────────────
const short = ['a', 'b', 'c'];
check('cropCodeLines leaves short input untouched',
    cropCodeLines(short, 10).cropped === false && cropCodeLines(short, 10).lines.length === 3);
const long = Array.from({ length: 20 }, (_, i) => `line${i}`);
const cropped = cropCodeLines(long, 5);
check('cropCodeLines flags cropping', cropped.cropped === true);
check('cropCodeLines respects the line budget', cropped.lines.length === 5);
check('cropCodeLines ends with a marker line', /rest of your code/.test(cropped.lines[cropped.lines.length - 1]));
check('cropCodeLines does not mutate its input', long.length === 20);

// ── clipLine ────────────────────────────────────────────────────────────────
check('clipLine leaves short lines alone', clipLine('hello', 10) === 'hello');
check('clipLine truncates with an ellipsis', clipLine('hello world', 6) === 'hello…');
check('clipLine handles tiny budgets', clipLine('abc', 1) === 'abc');

// ── splitIntoColumns ────────────────────────────────────────────────────────
const sixLines = ['a', 'b', 'c', 'd', 'e', 'f'];
const split2 = splitIntoColumns(sixLines, 3, 2);
check('splitIntoColumns returns one array per column', split2.length === 2);
check('splitIntoColumns fills the left column first (column-fill order)',
    split2[0].join('') === 'abc' && split2[1].join('') === 'def');
check('splitIntoColumns keeps short input in the left column',
    splitIntoColumns(['a', 'b'], 5, 2)[0].join('') === 'ab' &&
    splitIntoColumns(['a', 'b'], 5, 2)[1].length === 0);
check('splitIntoColumns covers every line exactly once',
    split2.flat().join('') === sixLines.join(''));
check('splitIntoColumns guards a zero per-column count (no infinite empties)',
    splitIntoColumns(['a', 'b'], 0, 2)[0].length === 1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { process.exit(1); }
