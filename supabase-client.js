(function () {
// Thin Supabase RPC client shared by the teacher dashboard and (later) the student storage
// layer. The browser calls PostgREST directly: POST {url}/rest/v1/rpc/{fn} with the
// publishable key and the args as JSON; the SECURITY DEFINER functions authorise via the
// codes in those args (design_docs/PROJECT_STORAGE_V2.md §12.6).
//
// Request/response SHAPING is split into pure functions (buildRpcRequest / parseRpcResponse)
// so it can be unit-tested without a network or async; rpc() just wires them to fetch. The
// real round-trip is covered by scripts/supabase-itest.py against the live DB.

const CONFIG = (typeof require !== 'undefined')
  ? require('./config.js')
  : (typeof window !== 'undefined' ? window.WaveletConfig : undefined);

// Build the fetch request descriptor for an RPC call. Pure.
function buildRpcRequest(fn, args, cfg) {
  const c = cfg || CONFIG;
  const key = c && c.supabasePublishableKey;
  const url = c && c.supabaseUrl;
  return {
    url: `${url}/rest/v1/rpc/${fn}`,
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args || {})
  };
}

// Interpret an HTTP status + raw body into { ok, status, data }. Pure. `data` is the parsed
// JSON when possible (PostgREST returns the function's jsonb), else the raw text.
function parseRpcResponse(status, bodyText) {
  let data;
  try {
    data = bodyText === '' || bodyText == null ? null : JSON.parse(bodyText);
  } catch {
    data = bodyText;
  }
  return { ok: status >= 200 && status < 300, status: status, data: data };
}

// Call an RPC. Returns the parsed function result ({ ok, status, data }). `opts.fetch` lets
// callers/tests inject a fetch implementation.
async function rpc(fn, args, opts) {
  const o = opts || {};
  const doFetch = o.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!doFetch) {
    throw new Error('supabase-client: no fetch available');
  }
  const req = buildRpcRequest(fn, args, o.config);
  const res = await doFetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  const text = await res.text();
  return parseRpcResponse(res.status, text);
}

// Typed wrappers. Each returns the rpc() result; `.data` is the function's jsonb.
const api = {
  buildRpcRequest, parseRpcResponse, rpc,

  // Student
  loadProject: (code, opts) => rpc('load_project', { p_code: code }, opts),
  saveProject: (code, content, baseVersion, session, isMilestone, opts) =>
    rpc('save_project', {
      p_code: code, p_content: content, p_base_version: baseVersion,
      p_session: session, p_is_milestone: !!isMilestone
    }, opts),
  projectHistory: (code, opts) => rpc('project_history', { p_code: code }, opts),
  projectVersion: (code, version, opts) => rpc('project_version', { p_code: code, p_version: version }, opts),

  // Teacher
  teacherClasses: (teacherCode, opts) => rpc('teacher_classes', { p_teacher_code: teacherCode }, opts),
  createClass: (teacherCode, name, school, slug, opts) =>
    rpc('create_class', {
      p_teacher_code: teacherCode, p_name: name, p_school: school, p_project_slug: slug
    }, opts),
  // codes is a candidate pool; include a few extra beyond count so server-side collisions
  // can be filled from spares in one round-trip. Returns { added: [...], remaining }.
  addStudentsBulk: (teacherCode, classId, slug, count, codes, opts) =>
    rpc('add_students_bulk', {
      p_teacher_code: teacherCode, p_class_id: classId, p_project_slug: slug,
      p_count: count, p_codes: codes
    }, opts),
  teacherRoster: (teacherCode, opts) => rpc('teacher_roster', { p_teacher_code: teacherCode }, opts),
  appendStudent: (teacherCode, slug, displayName, studentCode, opts) =>
    rpc('append_student', {
      p_teacher_code: teacherCode, p_project_slug: slug,
      p_display_name: displayName, p_student_code: studentCode
    }, opts),
  reprintCodes: (teacherCode, opts) => rpc('reprint_codes', { p_teacher_code: teacherCode }, opts),
  markComplete: (teacherCode, classProjectId, opts) =>
    rpc('mark_complete', { p_teacher_code: teacherCode, p_class_project_id: classProjectId }, opts)
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.SupabaseClient = api;
}
})();
