// Unit tests for progress-store.js applyVersion() — the "clear local storage on a content
// version bump" logic. Verifies student progress is reset while the teacher dashboard's
// local-only PDF names are preserved.
// Run with: node progress-store-test.js  (or python3 scripts/run-js-tests.py progress-store-test.js)

const ProgressStore = require('./progress-store.js');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; } else { failed++; console.log(`❌ FAILED: ${name}  ${detail || ''}`); }
}

// A minimal in-memory localStorage stand-in.
function makeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
    has: (k) => map.has(k),
    get: (k) => (map.has(k) ? map.get(k) : null)
  };
}

// ── version change: clears student progress, keeps the teacher dashboard's PDF names ──
const s1 = makeStorage({
  appVersion: 'old-sha',
  pythonProgress: '{"w1":1}',
  'wavelet-project-selfcheck:pixel-game:t1': '1',
  scratchpadState: '{"code":"x"}',
  'wavelet-pdf-names': '{"abc":"Alexis"}',
  'wavelet-teacher-code': 'foxtrot-abacus'
});
ProgressStore.applyVersion(s1, 'new-sha');
check('version change clears student worksheet progress', s1.get('pythonProgress') === null);
check('version change clears student self-check state', s1.get('wavelet-project-selfcheck:pixel-game:t1') === null);
check('version change clears scratchpad state', s1.get('scratchpadState') === null);
check('version change PRESERVES teacher dashboard PDF names',
  s1.get('wavelet-pdf-names') === '{"abc":"Alexis"}', s1.get('wavelet-pdf-names'));
check('version change PRESERVES the saved teacher code',
  s1.get('wavelet-teacher-code') === 'foxtrot-abacus', s1.get('wavelet-teacher-code'));
check('version change records the new version', s1.get('appVersion') === 'new-sha');

// ── same version: nothing cleared ──
const s2 = makeStorage({ appVersion: 'same-sha', pythonProgress: '{"w1":1}' });
ProgressStore.applyVersion(s2, 'same-sha');
check('same version keeps student progress', s2.get('pythonProgress') === '{"w1":1}');
check('same version keeps the version stamp', s2.get('appVersion') === 'same-sha');

// ── first run (no stored version): stamp it, clear nothing ──
const s3 = makeStorage({ pythonProgress: '{"w1":1}', 'wavelet-pdf-names': '{"x":"Sam"}' });
ProgressStore.applyVersion(s3, 'first-sha');
check('first run does not clear progress', s3.get('pythonProgress') === '{"w1":1}');
check('first run keeps PDF names', s3.get('wavelet-pdf-names') === '{"x":"Sam"}');
check('first run stamps the version', s3.get('appVersion') === 'first-sha');

// ── version change with no PDF names present: still fine, no crash ──
const s4 = makeStorage({ appVersion: 'a', pythonProgress: '{"w1":1}' });
ProgressStore.applyVersion(s4, 'b');
check('version change without PDF names clears progress and re-stamps',
  s4.get('pythonProgress') === null && s4.get('appVersion') === 'b' && s4.get('wavelet-pdf-names') === null);

// ── guards: missing storage / version are no-ops ──
ProgressStore.applyVersion(null, 'x');           // should not throw
ProgressStore.applyVersion(makeStorage({}), undefined); // should not throw
check('null storage / undefined version are safe no-ops', true);

console.log(`\n📊 progress-store test summary\n✅ Passed: ${passed}\n❌ Failed: ${failed}`);
if (failed === 0) { console.log('\n🎉 All progress-store tests passed!'); process.exit(0); }
else { console.log(`\n⚠️  ${failed} failed.`); process.exit(1); }
