// Unit tests for supabase-client.js request/response shaping and the typed RPC wrappers.
// Run with: node supabase-client-test.js  (or python3 scripts/run-js-tests.py supabase-client-test.js)

const SC = require('./supabase-client.js');

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; } else { failed++; console.log(`❌ FAILED: ${name}  ${detail || ''}`); }
}

const cfg = { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'pk_test' };

// ---- buildRpcRequest (pure) ----
const req = SC.buildRpcRequest('load_project', { p_code: 'brave-otter-oak' }, cfg);
check('builds the rpc URL', req.url === 'https://example.supabase.co/rest/v1/rpc/load_project', req.url);
check('POST method', req.method === 'POST');
check('apikey header', req.headers.apikey === 'pk_test');
check('bearer auth header', req.headers.Authorization === 'Bearer pk_test');
check('json content-type', req.headers['Content-Type'] === 'application/json');
check('json body', JSON.parse(req.body).p_code === 'brave-otter-oak');
check('empty args -> {}', SC.buildRpcRequest('f', null, cfg).body === '{}');

// ---- parseRpcResponse (pure) ----
let r = SC.parseRpcResponse(200, '{"ok":true,"version":3}');
check('200 -> ok true', r.ok === true && r.status === 200 && r.data.version === 3);
r = SC.parseRpcResponse(403, 'Host not in allowlist');
check('non-2xx -> ok false', r.ok === false && r.status === 403);
check('non-JSON body kept raw', r.data === 'Host not in allowlist');
check('empty body -> null data', SC.parseRpcResponse(200, '').data === null);

// ---- typed wrappers: capture the request via a non-resolving fake fetch ----
// rpc() calls fetch synchronously (before its first await), so the capture happens before
// the returned promise would settle; we never await it.
function capture(callWrapper) {
  let got = null;
  const fakeFetch = (url, init) => { got = { url, init }; return new Promise(() => {}); };
  callWrapper({ fetch: fakeFetch, config: cfg });
  return got;
}
function body(got) { return JSON.parse(got.init.body); }
function fnOf(got) { return got.url.split('/rpc/')[1]; }

let g = capture((o) => SC.loadProject('a-b-c', o));
check('loadProject', fnOf(g) === 'load_project' && body(g).p_code === 'a-b-c', g && g.url);

g = capture((o) => SC.saveProject('a-b-c', "print(1)", 2, 'sess', true, o));
check('saveProject maps all args', fnOf(g) === 'save_project'
  && body(g).p_content === 'print(1)' && body(g).p_base_version === 2
  && body(g).p_session === 'sess' && body(g).p_is_milestone === true, JSON.stringify(g && body(g)));

g = capture((o) => SC.projectHistory('a-b-c', o));
check('projectHistory', fnOf(g) === 'project_history' && body(g).p_code === 'a-b-c');

g = capture((o) => SC.projectVersion('a-b-c', 5, o));
check('projectVersion', fnOf(g) === 'project_version' && body(g).p_version === 5);

g = capture((o) => SC.teacherClasses('teach-code', o));
check('teacherClasses', fnOf(g) === 'teacher_classes' && body(g).p_teacher_code === 'teach-code');

g = capture((o) => SC.createClass('teach-code', '5B', 'Acme PS', 'pixel-game', o));
check('createClass maps all args', fnOf(g) === 'create_class'
  && body(g).p_name === '5B' && body(g).p_school === 'Acme PS'
  && body(g).p_project_slug === 'pixel-game', JSON.stringify(g && body(g)));

g = capture((o) => SC.addStudentsBulk('teach-code', 'cls-1', 'pixel-game', 10, ['a-b-c', 'd-e-f'], o));
check('addStudentsBulk maps count + pool', fnOf(g) === 'add_students_bulk'
  && body(g).p_class_id === 'cls-1' && body(g).p_count === 10
  && Array.isArray(body(g).p_codes) && body(g).p_codes.length === 2, JSON.stringify(g && body(g)));

g = capture((o) => SC.teacherRoster('teach-code', 'cls-1', o));
check('teacherRoster maps class_id', fnOf(g) === 'teacher_roster'
  && body(g).p_teacher_code === 'teach-code' && body(g).p_class_id === 'cls-1');

g = capture((o) => SC.appendStudent('teach-code', 'cls-1', 'pixel-game', 'Mia', 's-t-u', o));
check('appendStudent maps all args', fnOf(g) === 'append_student'
  && body(g).p_class_id === 'cls-1' && body(g).p_project_slug === 'pixel-game'
  && body(g).p_display_name === 'Mia' && body(g).p_student_code === 's-t-u', JSON.stringify(g && body(g)));

g = capture((o) => SC.reprintCodes('teach-code', 'cls-1', o));
check('reprintCodes maps class_id', fnOf(g) === 'reprint_codes'
  && body(g).p_teacher_code === 'teach-code' && body(g).p_class_id === 'cls-1');

g = capture((o) => SC.markComplete('teach-code', 'cp-id', o));
check('markComplete', fnOf(g) === 'mark_complete' && body(g).p_class_project_id === 'cp-id');

g = capture((o) => SC.setReadonly('teach-code', 'proj-1', true, o));
check('setReadonly maps args', fnOf(g) === 'set_readonly'
  && body(g).p_project_id === 'proj-1' && body(g).p_readonly === true);

g = capture((o) => SC.setAssigned('teach-code', 'proj-1', true, o));
check('setAssigned maps args', fnOf(g) === 'set_assigned'
  && body(g).p_project_id === 'proj-1' && body(g).p_assigned === true);

g = capture((o) => SC.renameClass('teach-code', 'cls-1', '5B Room 12', o));
check('renameClass maps args', fnOf(g) === 'rename_class'
  && body(g).p_class_id === 'cls-1' && body(g).p_name === '5B Room 12');

console.log(`\n📊 supabase-client test summary\n✅ Passed: ${passed}\n❌ Failed: ${failed}`);
if (failed === 0) { console.log('\n🎉 All supabase-client tests passed!'); process.exit(0); }
else { console.log(`\n⚠️  ${failed} failed.`); process.exit(1); }
