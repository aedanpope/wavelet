// Unit tests for code-words.js (access-code generation, validation, typo safety).
// Run with: node code-words-test.js

const { generate, isValid, canonical, WORDS, MOD } = require('./code-words.js');

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
// Word list integrity
// ---------------------------------------------------------------------------
check('word list has exactly 256 entries', WORDS.length === MOD && MOD === 256);
check('word list entries are unique', new Set(WORDS).size === WORDS.length);
check('word list entries are lowercase a-z', WORDS.every((w) => /^[a-z]+$/.test(w)));

// ---------------------------------------------------------------------------
// generate() produces valid codes, at different word counts
// ---------------------------------------------------------------------------
for (const wordCount of [2, 3, 4]) {
    let allValid = true;
    let allShaped = true;
    for (let i = 0; i < 3000; i++) {
        const code = generate(wordCount);
        if (!isValid(code, wordCount)) allValid = false;
        if (code.split('-').length !== wordCount + 1) allShaped = false;
    }
    check(`generate(${wordCount}) always produces a valid code`, allValid);
    check(`generate(${wordCount}) has ${wordCount + 1} words`, allShaped);
}

// A 2-word code (the student default) must be valid against the default arg.
check('generate() defaults to a valid 2-word code', isValid(generate()));

// ---------------------------------------------------------------------------
// Input normalisation: case, spaces, doubled/var separators
// ---------------------------------------------------------------------------
const sample = generate(2); // e.g. "brave-otter-maple"
check('accepts uppercase', isValid(sample.toUpperCase()));
check('accepts spaces instead of dashes', isValid(sample.replace(/-/g, ' ')));
check('accepts doubled dashes', isValid(sample.replace(/-/g, '--')));
check('accepts surrounding whitespace', isValid(`  ${sample}  `));
check('canonical collapses variants to one key',
    canonical(sample.toUpperCase().replace(/-/g, '  ')) === sample);
check('canonical of invalid code is null', canonical('not a real code') === null);

// ---------------------------------------------------------------------------
// Rejects malformed input
// ---------------------------------------------------------------------------
check('rejects empty string', !isValid(''));
check('rejects wrong word count (too few)', !isValid('brave-otter'));
check('rejects wrong word count (too many)', !isValid(`${sample}-otter`));
check('rejects unknown word', !isValid('brave-otter-zzzzz'));
check('rejects non-word junk', !isValid('12345'));

// ---------------------------------------------------------------------------
// THE core property: no single-WORD substitution of a valid code is another valid code.
// For a sample of valid 2-word codes, swap each position with every other word and
// assert the result never validates.
// ---------------------------------------------------------------------------
let singleWordLeak = null;
outer:
for (let n = 0; n < 1500 && singleWordLeak === null; n++) {
    const code = generate(2);
    const parts = code.split('-'); // [content0, content1, check]
    for (let pos = 0; pos < parts.length; pos++) {
        for (let w = 0; w < WORDS.length; w++) {
            if (WORDS[w] === parts[pos]) continue; // same word, not a change
            const mutated = parts.slice();
            mutated[pos] = WORDS[w];
            if (isValid(mutated.join('-'))) {
                singleWordLeak = `${code} -> ${mutated.join('-')}`;
                break outer;
            }
        }
    }
}
check('no single-word substitution yields another valid code', singleWordLeak === null);
if (singleWordLeak) console.log(`   leak: ${singleWordLeak}`);

// ---------------------------------------------------------------------------
// Char-level safety: no single-character edit of a valid code yields a valid code.
// (Covers mistypes that land on a different word, e.g. cat->bat, and misspellings.)
// ---------------------------------------------------------------------------
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz-'.split('');
let singleCharLeak = null;
charOuter:
for (let n = 0; n < 400 && singleCharLeak === null; n++) {
    const code = generate(2);
    for (let i = 0; i < code.length; i++) {
        for (const ch of ALPHABET) {
            if (ch === code[i]) continue;
            const mutated = code.slice(0, i) + ch + code.slice(i + 1);
            if (mutated !== code && isValid(mutated)) {
                singleCharLeak = `${code} -> ${mutated}`;
                break charOuter;
            }
        }
    }
}
check('no single-character substitution yields another valid code', singleCharLeak === null);
if (singleCharLeak) console.log(`   leak: ${singleCharLeak}`);

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
