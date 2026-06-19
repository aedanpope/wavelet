// Word-based access codes for students and teachers (design_docs/PROJECT_STORAGE_V2.md §3.1).
//
// A code is N content words plus one trailing check word, all drawn from the 256-word
// list in code-words-list.js, e.g. "brave-otter-maple". Each word encodes a byte (its
// index 0..255). The check word is a weighted mod-256 checksum of the content words.
//
// Property (the reason for the checksum): changing any ONE word of a valid code, to any
// other word in the list, always breaks the checksum, so the result is invalid rather
// than a different valid code. A misspelt word is not in the list, so it is invalid too.
// Therefore no single-word (and no single-character) slip can land a student on someone
// else's code: a typo always fails closed. See code-words-test.js for the proofs.
//
// Word count is a parameter: students use 2 content words (256^2 = 65,536 codes),
// teachers can use more for a larger space (e.g. 3 -> ~16.7M).

const WORDS = (typeof require !== 'undefined')
    ? require('./code-words-list.js')
    : (typeof window !== 'undefined' ? window.CodeWordsList : undefined);

const MOD = 256;

if (!Array.isArray(WORDS) || WORDS.length !== MOD) {
    throw new Error(`code-words: expected exactly ${MOD} words, got ${WORDS && WORDS.length}`);
}

// word -> index, for parsing.
const INDEX = new Map(WORDS.map((w, i) => [w, i]));

// Odd weights (1, 3, 5, ...) are invertible mod 256, so changing any single content
// index by a non-zero amount always changes the checksum: single-error detecting.
function weightFor(position) {
    return 2 * position + 1;
}

function checkByte(contentIndices) {
    let sum = 0;
    for (let i = 0; i < contentIndices.length; i++) {
        sum = (sum + weightFor(i) * contentIndices[i]) % MOD;
    }
    return (MOD - (sum % MOD)) % MOD;
}

// Split arbitrary user input into lowercase word tokens. Case-insensitive, and any run of
// non-letters (spaces, dashes, doubled separators) is a delimiter, so "Brave Otter Maple",
// "brave--otter--maple", and " brave-otter-maple " all tokenize identically.
function tokenize(input) {
    return String(input).toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

// Generate a random valid code with `wordCount` content words (default 2, for students).
function generate(wordCount = 2) {
    const content = [];
    for (let i = 0; i < wordCount; i++) {
        content.push(Math.floor(Math.random() * MOD));
    }
    const indices = content.concat(checkByte(content));
    return indices.map((i) => WORDS[i]).join('-');
}

// True if `input` is a well-formed, checksum-valid code of `wordCount` content words.
function isValid(input, wordCount = 2) {
    const tokens = tokenize(input);
    if (tokens.length !== wordCount + 1) {
        return false;
    }
    const indices = [];
    for (const token of tokens) {
        const idx = INDEX.get(token);
        if (idx === undefined) {
            return false; // not a known word
        }
        indices.push(idx);
    }
    const content = indices.slice(0, wordCount);
    return checkByte(content) === indices[wordCount];
}

// Canonical "a-b-c" form (lowercased, single dashes) for a valid code, else null.
// Use this to derive the value you hash for login lookup, so equivalent typings collapse
// to one key.
function canonical(input, wordCount = 2) {
    if (!isValid(input, wordCount)) {
        return null;
    }
    return tokenize(input).join('-');
}

const api = { generate, isValid, canonical, WORDS, MOD };

// Export for Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}

// Export for browser
if (typeof window !== 'undefined') {
    window.CodeWords = api;
}
