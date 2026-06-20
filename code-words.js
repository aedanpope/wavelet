(function () {
// Word-based access codes for students and teachers (design_docs/PROJECT_STORAGE_V2.md §3.1).
//
// A code is a sequence of content words plus one trailing CHECK word. Each position draws
// from a fixed category list (adjectives / animals / plants), so codes read as a natural
// phrase: students get adjective-animal-plant, e.g. "brave-otter-maple". The final word
// (a plant) is a weighted mod-256 checksum of the content words.
//
//   Student: adjective animal [plant=check]            -> 256^2 = 65,536 codes
//   Teacher: adjective animal adjective animal [plant=check] -> 256^4 = ~4.3 billion
//
// Typo safety: odd checksum weights are invertible mod 256, and every position is keyed
// to one category list, so (a) a word typed in the wrong category slot is rejected, and
// (b) changing any single content word changes the required check word. Therefore no
// single-word and no single-character slip can turn a valid code into another valid code:
// it always fails closed (invalid), never landing on someone else's code. Proven in
// code-words-test.js. This is optimal: with 3 words over a 256-symbol alphabet, 65,536 is
// the most codes you can have while guaranteeing single-error detection (Singleton bound),
// which is why the check is a whole word, not a few bits.

const LISTS = (typeof require !== 'undefined')
    ? require('./code-words-list.js')
    : (typeof window !== 'undefined' ? window.CodeWordsList : undefined);

const MOD = 256;

const { ADJECTIVES, ANIMALS, PLANTS } = LISTS || {};

for (const [name, list] of [['ADJECTIVES', ADJECTIVES], ['ANIMALS', ANIMALS], ['PLANTS', PLANTS]]) {
    if (!Array.isArray(list) || list.length !== MOD) {
        throw new Error(`code-words: ${name} must have exactly ${MOD} words, got ${list && list.length}`);
    }
}

// One index map per category list, keyed by the array itself so a list reused across
// positions (e.g. ADJECTIVES in the teacher scheme) shares its map.
const MAPS = new Map([
    [ADJECTIVES, new Map(ADJECTIVES.map((w, i) => [w, i]))],
    [ANIMALS, new Map(ANIMALS.map((w, i) => [w, i]))],
    [PLANTS, new Map(PLANTS.map((w, i) => [w, i]))]
]);

// A scheme is the ordered content lists plus the list the check word comes from.
const STUDENT = { content: [ADJECTIVES, ANIMALS], check: PLANTS };
const TEACHER = { content: [ADJECTIVES, ANIMALS, ADJECTIVES, ANIMALS], check: PLANTS };

// Odd weights (1, 3, 5, ...) are invertible mod 256, so changing any single content index
// always changes the checksum: single-error detecting.
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

// Generate a random valid code for the given scheme (default STUDENT). The returned code
// has scheme.content.length + 1 words (the extra one is the check word).
function generate(scheme = STUDENT) {
    const indices = scheme.content.map(() => Math.floor(Math.random() * MOD));
    const words = scheme.content.map((list, i) => list[indices[i]]);
    words.push(scheme.check[checkByte(indices)]);
    return words.join('-');
}

// True if `input` is a well-formed, checksum-valid code for the given scheme. Each content
// word must belong to that position's category list, and the final word must be the
// correct check word from scheme.check.
function isValid(input, scheme = STUDENT) {
    const tokens = tokenize(input);
    if (tokens.length !== scheme.content.length + 1) {
        return false;
    }
    const indices = [];
    for (let i = 0; i < scheme.content.length; i++) {
        const idx = MAPS.get(scheme.content[i]).get(tokens[i]);
        if (idx === undefined) {
            return false; // word not in this position's category
        }
        indices.push(idx);
    }
    const checkIdx = MAPS.get(scheme.check).get(tokens[tokens.length - 1]);
    if (checkIdx === undefined) {
        return false;
    }
    return checkByte(indices) === checkIdx;
}

// Canonical "a-b-c" form (lowercased, single dashes) for a valid code, else null.
// Use this to derive the value you hash for login lookup, so equivalent typings collapse
// to one key.
function canonical(input, scheme = STUDENT) {
    if (!isValid(input, scheme)) {
        return null;
    }
    return tokenize(input).join('-');
}

// Generate a code not already in use, retrying on collision. `isTaken(code)` returns
// truthy if the code is already used; pass e.g. a Set's membership check for batch minting
// a class roster, or a wrapper around a lookup. generate() is pure-random with no view of
// existing codes, so the AUTHORITATIVE uniqueness guard is the DB
// (projects.student_code_hash UNIQUE); this helper just keeps the rare in-process collision
// out of the way. Throws after `maxAttempts` (a signal the space is filling up, at which
// point use a scheme with more content words).
function generateUnique(isTaken, scheme = STUDENT, maxAttempts = 100) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = generate(scheme);
        if (!isTaken(code)) {
            return code;
        }
    }
    throw new Error('code-words: no unused code found; use a scheme with more words');
}

// Convenience wrappers for the two roles.
function generateStudentCode() {
    return generate(STUDENT);
}
function generateTeacherCode() {
    return generate(TEACHER);
}
function isStudentCode(input) {
    return isValid(input, STUDENT);
}
function isTeacherCode(input) {
    return isValid(input, TEACHER);
}

const api = {
    STUDENT, TEACHER,
    generate, isValid, canonical, generateUnique,
    generateStudentCode, generateTeacherCode, isStudentCode, isTeacherCode,
    ADJECTIVES, ANIMALS, PLANTS, MOD
};

// Export for Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}

// Export for browser
if (typeof window !== 'undefined') {
    window.CodeWords = api;
}
})();
