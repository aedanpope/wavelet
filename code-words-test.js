// Unit tests for code-words.js (access-code generation, validation, typo safety).
// Run with: node code-words-test.js  (or: python3 scripts/run-js-tests.py code-words-test.js)

const {
    STUDENT, TEACHER,
    generate, isValid, canonical, generateUnique,
    generateStudentCode, generateTeacherCode, isStudentCode, isTeacherCode,
    ADJECTIVES, ANIMALS, PLANTS, MOD
} = require('./code-words.js');

let passed = 0;
let failed = 0;

function check(name, condition) {
    if (condition) {
        passed++;
    } else {
        failed++;
        console.log(`❌ FAILED: ${name}`);
    }
}

// ---------------------------------------------------------------------------
// Word list integrity: 256 each, unique, lowercase a-z, and disjoint categories
// ---------------------------------------------------------------------------
for (const [name, list] of [['ADJECTIVES', ADJECTIVES], ['ANIMALS', ANIMALS], ['PLANTS', PLANTS]]) {
    check(`${name} has exactly 256 entries`, list.length === MOD && MOD === 256);
    check(`${name} entries are unique`, new Set(list).size === list.length);
    check(`${name} entries are lowercase a-z`, list.every((w) => /^[a-z]+$/.test(w)));
}
const setA = new Set(ADJECTIVES);
const setN = new Set(ANIMALS);
const setP = new Set(PLANTS);
check('categories are disjoint',
    ![...setA].some((w) => setN.has(w) || setP.has(w)) && ![...setN].some((w) => setP.has(w)));

// ---------------------------------------------------------------------------
// Student codes: adjective-animal-plant, valid, right shape
// ---------------------------------------------------------------------------
let studentOk = true;
for (let i = 0; i < 3000; i++) {
    const code = generateStudentCode();
    const parts = code.split('-');
    if (!isStudentCode(code) || parts.length !== 3) {
        studentOk = false;
    }
    // category-by-position
    if (!setA.has(parts[0]) || !setN.has(parts[1]) || !setP.has(parts[2])) {
        studentOk = false;
    }
}
check('generateStudentCode: valid adjective-animal-plant codes', studentOk);

// ---------------------------------------------------------------------------
// Teacher codes: longer, valid, distinguishable from student codes
// ---------------------------------------------------------------------------
let teacherOk = true;
for (let i = 0; i < 3000; i++) {
    const code = generateTeacherCode();
    if (!isTeacherCode(code) || code.split('-').length !== 5) {
        teacherOk = false;
    }
    if (isStudentCode(code)) {
        teacherOk = false; // wrong length for the student scheme
    }
}
check('generateTeacherCode: valid 5-word codes, not valid as student codes', teacherOk);
check('a student code is not valid as a teacher code', !isTeacherCode(generateStudentCode()));

// ---------------------------------------------------------------------------
// Input normalisation: case, spaces, doubled/var separators
// ---------------------------------------------------------------------------
const sample = generateStudentCode(); // e.g. "brave-otter-maple"
check('accepts uppercase', isStudentCode(sample.toUpperCase()));
check('accepts spaces instead of dashes', isStudentCode(sample.replace(/-/g, ' ')));
check('accepts doubled dashes', isStudentCode(sample.replace(/-/g, '--')));
check('accepts surrounding whitespace', isStudentCode(`  ${sample}  `));
check('canonical collapses variants to one key',
    canonical(sample.toUpperCase().replace(/-/g, '  ')) === sample);
check('canonical of invalid code is null', canonical('not a real code') === null);

// ---------------------------------------------------------------------------
// Rejects malformed input
// ---------------------------------------------------------------------------
check('rejects empty string', !isStudentCode(''));
check('rejects wrong word count (too few)', !isStudentCode(sample.split('-').slice(0, 2).join('-')));
check('rejects wrong word count (too many)', !isStudentCode(`${sample}-maple`));
check('rejects unknown word', !isStudentCode('brave-otter-zzzzz'));
check('rejects a word in the wrong category slot',
    // animal in the adjective position
    !isStudentCode(`${ANIMALS[0]}-${ANIMALS[1]}-${PLANTS[0]}`));

// ---------------------------------------------------------------------------
// generateUnique(): batch minting yields distinct, valid codes; throws when exhausted
// ---------------------------------------------------------------------------
const taken = new Set();
let batchOk = true;
for (let i = 0; i < 300; i++) {
    const code = generateUnique((c) => taken.has(c), STUDENT);
    if (!isStudentCode(code) || taken.has(code)) {
        batchOk = false;
    }
    taken.add(code);
}
check('generateUnique mints distinct valid codes for a batch', batchOk && taken.size === 300);
let threw = false;
try {
    generateUnique(() => true, STUDENT, 50);
} catch (e) {
    threw = e instanceof Error;
}
check('generateUnique throws when the space is exhausted', threw);

// ---------------------------------------------------------------------------
// CORE: no single-word substitution of a valid student code is another valid code.
// For each position, swap with every word of the SAME category (the only swaps that
// could possibly validate) and assert it never does.
// ---------------------------------------------------------------------------
const POS_LISTS = [ADJECTIVES, ANIMALS, PLANTS];
let wordLeak = null;
outer:
for (let n = 0; n < 1200 && wordLeak === null; n++) {
    const code = generateStudentCode();
    const parts = code.split('-');
    for (let pos = 0; pos < parts.length; pos++) {
        const list = POS_LISTS[pos];
        for (let w = 0; w < list.length; w++) {
            if (list[w] === parts[pos]) {
                continue;
            }
            const mutated = parts.slice();
            mutated[pos] = list[w];
            if (isStudentCode(mutated.join('-'))) {
                wordLeak = `${code} -> ${mutated.join('-')}`;
                break outer;
            }
        }
    }
}
check('no single-word substitution yields another valid code', wordLeak === null);
if (wordLeak) { console.log(`   leak: ${wordLeak}`); }

// ---------------------------------------------------------------------------
// Char-level safety: no single-character edit of a valid code yields a valid code.
// ---------------------------------------------------------------------------
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz-'.split('');
let charLeak = null;
charOuter:
for (let n = 0; n < 400 && charLeak === null; n++) {
    const code = generateStudentCode();
    for (let i = 0; i < code.length; i++) {
        for (const ch of ALPHABET) {
            if (ch === code[i]) {
                continue;
            }
            const mutated = code.slice(0, i) + ch + code.slice(i + 1);
            if (mutated !== code && isStudentCode(mutated)) {
                charLeak = `${code} -> ${mutated}`;
                break charOuter;
            }
        }
    }
}
check('no single-character substitution yields another valid code', charLeak === null);
if (charLeak) { console.log(`   leak: ${charLeak}`); }

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n📊 code-words test summary');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
    console.log('\n🎉 All code-words tests passed!');
    process.exit(0);
} else {
    console.log(`\n⚠️  ${failed} code-words test(s) failed.`);
    process.exit(1);
}
