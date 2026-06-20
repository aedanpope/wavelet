// Unit tests for project-storage.js pure logic (the hard-source-of-truth decision + beacon
// payload). The async controller is exercised live in the browser; here we lock down the
// rules that must never regress.
// Run: node project-storage-test.js  (or python3 scripts/run-js-tests.py project-storage-test.js)

const PS = require('./project-storage.js');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; } else { failed++; console.log(`❌ FAILED: ${name}  ${detail || ''}`); }
}

// ---- applySaveResult: the durability rule ----
// Confirmed save advances the version and reports saved.
let r = PS.applySaveResult({ version: 4 }, { ok: true, status: 200, data: { ok: true, version: 5, conflict: false } });
check('confirmed -> saved + new version', r.status === 'saved' && r.version === 5 && r.conflict === false && r.error === null, JSON.stringify(r));

// Conflict flag carried through (still saved).
r = PS.applySaveResult({ version: 4 }, { ok: true, status: 200, data: { ok: true, version: 6, conflict: true } });
check('conflict flag surfaces', r.status === 'saved' && r.version === 6 && r.conflict === true, JSON.stringify(r));

// Server logical failure (e.g. unknown_code) -> blocked, version unchanged, NOT saved.
r = PS.applySaveResult({ version: 4 }, { ok: true, status: 200, data: { ok: false, error: 'unknown_code' } });
check('server ok:false -> blocked', r.status === 'blocked' && r.version === 4 && r.error === 'unknown_code', JSON.stringify(r));

// Size cap rejection -> blocked.
r = PS.applySaveResult({ version: 9 }, { ok: true, status: 200, data: { ok: false, error: 'too_large' } });
check('too_large -> blocked', r.status === 'blocked' && r.version === 9 && r.error === 'too_large', JSON.stringify(r));

// HTTP error -> blocked, version unchanged.
r = PS.applySaveResult({ version: 7 }, { ok: false, status: 403, data: 'forbidden' });
check('http error -> blocked', r.status === 'blocked' && r.version === 7 && r.error === 'http_403', JSON.stringify(r));

// Network failure (null result) -> blocked, version unchanged.
r = PS.applySaveResult({ version: 2 }, null);
check('network/null -> blocked', r.status === 'blocked' && r.version === 2 && r.error === 'network', JSON.stringify(r));

// Invariant: a non-confirmed result NEVER reports saved and NEVER advances the version.
const bad = [
  null,
  { ok: false, status: 500, data: null },
  { ok: true, status: 200, data: { ok: false, error: 'x' } },
  { ok: true, status: 200, data: null },
  { ok: true, status: 200, data: { version: 99 } } // missing ok:true
];
let invariantHeld = true;
bad.forEach((res) => {
  const o = PS.applySaveResult({ version: 3 }, res);
  if (o.status === 'saved' || o.version !== 3) { invariantHeld = false; }
});
check('never claims saved / advances version without explicit ok:true', invariantHeld);

// ---- buildBeaconSave: pure payload ----
const cfg = { supabaseUrl: 'https://x.supabase.co', supabasePublishableKey: 'pk a+b' };
const beacon = PS.buildBeaconSave('brave-otter-oak', "print(1)", 3, 'sess-1', cfg);
check('beacon URL targets save_project with apikey query',
  beacon.url === 'https://x.supabase.co/rest/v1/rpc/save_project?apikey=pk%20a%2Bb', beacon.url);
const bb = JSON.parse(beacon.body);
check('beacon body has all args, is_milestone false',
  bb.p_code === 'brave-otter-oak' && bb.p_content === 'print(1)' && bb.p_base_version === 3
  && bb.p_session === 'sess-1' && bb.p_is_milestone === false, beacon.body);

// ---- makeSession ----
const s1 = PS.makeSession();
const s2 = PS.makeSession();
check('makeSession returns a distinct token string', typeof s1 === 'string' && s1.length > 4 && s1 !== s2, `${s1} ${s2}`);

console.log(`\n📊 project-storage test summary\n✅ Passed: ${passed}\n❌ Failed: ${failed}`);
if (failed === 0) { console.log('\n🎉 All project-storage tests passed!'); process.exit(0); }
else { console.log(`\n⚠️  ${failed} failed.`); process.exit(1); }
