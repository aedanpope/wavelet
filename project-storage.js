// Student-side storage controller for the project page. Wraps the Supabase RPC client with
// the hard-source-of-truth save contract: a save counts as durable ONLY when the server
// confirms it; otherwise the UI shows blocked and never claims "saved" (design_docs/
// PROJECT_STORAGE_V2.md §3.3, §12.2-§12.3a).
//
// The async orchestration can't be unit-tested in the no-Node V8 harness, so the decision
// logic is factored into PURE functions (applySaveResult, buildBeaconSave) that ARE tested;
// the controller just wires them to the client, a debounce timer, and the page.

(function () {
  const SC = (typeof require !== 'undefined')
    ? require('./supabase-client.js')
    : (typeof window !== 'undefined' ? window.SupabaseClient : undefined);
  const CONFIG = (typeof require !== 'undefined')
    ? require('./config.js')
    : (typeof window !== 'undefined' ? window.WaveletConfig : undefined);

  const AUTOSAVE_MS = 30000;     // save this long after the last edit (idle debounce, §12.2)
  const AUTOSAVE_MAX_MS = 60000; // ...but never wait longer than this while dirty, so a
                                 // student typing non-stop still autosaves periodically.

  // A per-tab session token, used for optimistic-concurrency ("edited on another laptop").
  function makeSession() {
    return 's-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
  }

  // PURE. Interpret a saveProject result (the supabase-client rpc() shape: { ok, status,
  // data }) against the current { version }. Anything other than an explicit server
  // {ok:true} is "blocked" and does NOT advance the version or claim saved.
  function applySaveResult(state, result) {
    const confirmed = result && result.ok && result.data && result.data.ok === true;
    if (!confirmed) {
      const err = (result && result.data && result.data.error)
        || (result ? ('http_' + result.status) : 'network');
      return { status: 'blocked', version: state.version, conflict: false, error: err };
    }
    return {
      status: 'saved',
      version: result.data.version,
      conflict: !!result.data.conflict,
      error: null
    };
  }

  // PURE. Build the best-effort close-flush request. sendBeacon can't set headers, so the
  // publishable key rides in the query string (PostgREST accepts ?apikey=) and the body is
  // JSON (§12.3a). Returns { url, body }.
  function buildBeaconSave(code, content, baseVersion, session, cfg) {
    const c = cfg || CONFIG;
    const url = `${c.supabaseUrl}/rest/v1/rpc/save_project?apikey=${encodeURIComponent(c.supabasePublishableKey)}`;
    const body = JSON.stringify({
      p_code: code, p_content: content, p_base_version: baseVersion,
      p_session: session, p_is_milestone: false
    });
    return { url: url, body: body };
  }

  // Controller. opts: { code, getContent:()=>string, onStatus?:(s)=>void,
  //   onConflict?:()=>void, client?, config?, session?, scheduler?:{setTimeout,clearTimeout} }
  function createController(opts) {
    const o = opts || {};
    const code = o.code;
    const client = o.client || SC;
    const cfg = o.config || CONFIG;
    const getContent = o.getContent || function () { return ''; };
    const onStatus = o.onStatus || function () {};
    const onConflict = o.onConflict || function () {};
    const sched = o.scheduler || { setTimeout: setTimeout, clearTimeout: clearTimeout };
    const session = o.session || makeSession();

    let version = 0;
    let status = 'idle';
    let dirty = false;
    let timer = null;      // idle debounce, reset on every edit
    let maxTimer = null;   // max-wait cap, armed once per dirty period, NOT reset per edit
    let inFlight = false;

    function setStatus(s, extra) {
      status = s;
      onStatus(Object.assign({ status: s, version: version, dirty: dirty }, extra || {}));
    }

    function clearTimers() {
      if (timer !== null) { sched.clearTimeout(timer); timer = null; }
      if (maxTimer !== null) { sched.clearTimeout(maxTimer); maxTimer = null; }
    }

    // Seed from a load_project result.
    function start(loadResult) {
      version = (loadResult && typeof loadResult.version === 'number') ? loadResult.version : 0;
      dirty = false;
      setStatus('saved');
    }

    // Call when the editors change.
    function noteEdit() {
      dirty = true;
      setStatus('unsaved');
      // Idle debounce: (re)start the 30s timer on every edit.
      if (timer !== null) { sched.clearTimeout(timer); }
      timer = sched.setTimeout(function () { timer = null; save(false); }, AUTOSAVE_MS);
      // Max-wait cap: armed once when we first go dirty, NOT reset per edit, so non-stop
      // typing still autosaves within AUTOSAVE_MAX_MS.
      if (maxTimer === null) {
        maxTimer = sched.setTimeout(function () { maxTimer = null; save(false); }, AUTOSAVE_MAX_MS);
      }
    }

    // Confirmed save. milestone=true for a Run (always snapshots). Returns a promise of the
    // outcome from applySaveResult.
    async function save(milestone) {
      clearTimers();
      if (inFlight || (!dirty && !milestone)) { return null; }
      inFlight = true;
      setStatus('saving');
      const content = getContent();
      let result;
      try {
        result = await client.saveProject(code, content, version, session, !!milestone);
      } catch {
        result = null;
      }
      const outcome = applySaveResult({ version: version }, result);
      inFlight = false;
      if (outcome.status === 'saved') {
        version = outcome.version;
        dirty = false;
        setStatus('saved', { conflict: outcome.conflict });
        if (outcome.conflict) { onConflict(); }
      } else {
        setStatus('blocked', { error: outcome.error });
      }
      return outcome;
    }

    // Best-effort flush on tab hide (§12.3a). Never updates the visible status.
    function attachLifecycle(target) {
      const doc = target || (typeof document !== 'undefined' ? document : null);
      if (!doc) { return; }
      const nav = (typeof window !== 'undefined') ? window.navigator : null;
      doc.addEventListener('visibilitychange', function () {
        if (doc.visibilityState === 'hidden' && dirty && nav && nav.sendBeacon) {
          const b = buildBeaconSave(code, getContent(), version, session, cfg);
          nav.sendBeacon(b.url, new Blob([b.body], { type: 'application/json' }));
        }
      });
    }

    return {
      start,
      noteEdit,
      attachLifecycle,
      run: () => save(true),
      saveNow: () => save(false),
      getSession: () => session,
      getVersion: () => version,
      getStatus: () => status
    };
  }

  const api = { makeSession, applySaveResult, buildBeaconSave, createController, AUTOSAVE_MS };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof window !== 'undefined') { window.ProjectStorage = api; }
})();
