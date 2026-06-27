#!/usr/bin/env python3
"""Integration test for the Project Storage v2 RPCs against a live Supabase project.

Drives the real plpgsql functions (0002_rpc.sql + 0003_teachers.sql) end to end:
append_student -> load -> save (incl. concurrency + size cap) -> history -> reprint ->
mark_complete, then the multi-class RPCs (teacher_classes, create_class, add_students_bulk,
class-scoped roster). The schema can only be validated against a running Postgres, so this is
the source of truth for the RPC runtime (the migrations themselves only get syntax-checked
offline). Requires migrations 0002-0006 applied to the target DB.

Config (a throwaway test class) comes from env vars, falling back to supabase/test-config.json:
  SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_TEST_TEACHER_CODE, SUPABASE_TEST_PROJECT_SLUG

Re-running is safe: each run mints a fresh student with a unique canonical code. Set
SUPABASE_SERVICE_KEY (the service-role key) to delete that row at the end, so repeated runs
stay fully idempotent and never accumulate toward the per-class cap. Without it, each run
leaves one project row behind.

Usage:
  python3 scripts/supabase-itest.py
Exits non-zero on any failure. Skips (exit 0) if no config is available.

NOTE: needs network egress to the Supabase host. In Claude Code web sessions that host must
be on the environment's egress allowlist.
"""
import json
import os
import random
import string
import sys
import urllib.request
import urllib.error
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "supabase" / "test-config.json"


def load_config():
    cfg = {}
    if CONFIG_PATH.exists():
        cfg = json.loads(CONFIG_PATH.read_text())
    url = os.environ.get("SUPABASE_URL", cfg.get("url"))
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", cfg.get("publishable_key"))
    teacher = os.environ.get("SUPABASE_TEST_TEACHER_CODE", cfg.get("teacher_code"))
    slug = os.environ.get("SUPABASE_TEST_PROJECT_SLUG", cfg.get("project_slug", "pixel-game"))
    service = os.environ.get("SUPABASE_SERVICE_KEY")
    if not (url and key and teacher):
        return None
    return {"url": url.rstrip("/"), "key": key, "teacher": teacher, "slug": slug, "service": service}


def rpc(cfg, fn, args, key=None):
    body = json.dumps(args).encode()
    api_key = key or cfg["key"]
    req = urllib.request.Request(
        f"{cfg['url']}/rest/v1/rpc/{fn}",
        data=body,
        headers={
            "apikey": api_key,
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
        },
    )
    def parse(raw):
        try:
            return json.loads(raw or "null")
        except json.JSONDecodeError:
            return {"_raw": raw}
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, parse(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, parse(e.read().decode())


def rest_delete(cfg, table, row_id):
    """Service-role REST delete (bypasses RLS) for test cleanup. Returns True on success."""
    req = urllib.request.Request(
        f"{cfg['url']}/rest/v1/{table}?id=eq.{row_id}",
        method="DELETE",
        headers={"apikey": cfg["service"], "Authorization": "Bearer " + cfg["service"]},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status in (200, 204)
    except urllib.error.HTTPError:
        return False


PASS = 0
FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ok  {name}")
    else:
        FAIL += 1
        print(f"FAIL  {name}  {detail}")


def main():
    cfg = load_config()
    if cfg is None:
        print("supabase-itest: no config (set env or supabase/test-config.json) -> skipped")
        return 0

    # A unique, CANONICAL code (lowercase letters + dashes only), like a real code-words
    # code, so normalize_code() is a no-op and reprint round-trips exactly. Using digits
    # here would be normalised to dashes and not match on reprint.
    rand = "".join(random.choice(string.ascii_lowercase) for _ in range(12))
    student = os.environ.get("SUPABASE_TEST_STUDENT_CODE", "itest-" + rand)
    name = "ITest " + rand[:6]

    # The teacher's earliest class (teacher_classes orders by created_at). All the class-scoped
    # teacher RPCs below take this class_id.
    _, res = rpc(cfg, "teacher_classes", {"p_teacher_code": cfg["teacher"]})
    classes = res.get("classes", []) if isinstance(res, dict) and res.get("ok") else []
    check("teacher_classes returns a class to test against", len(classes) >= 1, str(res)[:200])
    if not classes:
        print(f"\nsupabase-itest: {PASS} passed, {FAIL} failed")
        return 1
    class_id = classes[0]["class_id"]

    # append_student (class-scoped)
    st, res = rpc(cfg, "append_student", {
        "p_teacher_code": cfg["teacher"], "p_class_id": class_id, "p_project_slug": cfg["slug"],
        "p_display_name": name, "p_student_code": student})
    check("append_student ok", st == 200 and res and res.get("ok"), f"{st} {res}")
    project_id = res.get("project_id") if isinstance(res, dict) else None
    class_project_id = res.get("class_project_id") if isinstance(res, dict) else None

    # load (fresh): found, version 0, content null, name matches (for "is this you?")
    _, res = rpc(cfg, "load_project", {"p_code": student})
    check("load fresh: found + v0 + null content", res.get("found") and res.get("version") == 0 and res.get("content") is None, str(res))
    check("load returns display_name", res.get("display_name") == name, str(res))

    # save v1
    _, res = rpc(cfg, "save_project", {"p_code": student, "p_content": "print('hi')", "p_base_version": 0, "p_session": "s1", "p_is_milestone": True})
    check("save v1 ok, conflict false", res.get("ok") and res.get("version") == 1 and res.get("conflict") is False, str(res))

    # load shows v1 content
    _, res = rpc(cfg, "load_project", {"p_code": student})
    check("load v1 content", res.get("version") == 1 and res.get("content") == "print('hi')", str(res))

    # save v2 same session (no conflict)
    _, res = rpc(cfg, "save_project", {"p_code": student, "p_content": "print('two')", "p_base_version": 1, "p_session": "s1", "p_is_milestone": True})
    check("save v2 ok, conflict false", res.get("ok") and res.get("version") == 2 and res.get("conflict") is False, str(res))

    # concurrent save: stale base + different session -> conflict true (but still saved)
    _, res = rpc(cfg, "save_project", {"p_code": student, "p_content": "print('other')", "p_base_version": 1, "p_session": "s2", "p_is_milestone": True})
    check("concurrent save flags conflict", res.get("ok") and res.get("version") == 3 and res.get("conflict") is True, str(res))

    # size cap
    _, res = rpc(cfg, "save_project", {"p_code": student, "p_content": "A" * 300000, "p_base_version": 3, "p_session": "s1"})
    check("oversized save rejected", res.get("ok") is False and res.get("error") == "too_large", str(res))

    # history + version fetch
    _, res = rpc(cfg, "project_history", {"p_code": student})
    versions = [v["version"] for v in res.get("versions", [])] if res.get("found") else []
    check("history has milestone versions", res.get("found") and len(versions) >= 1, str(res))
    _, res = rpc(cfg, "project_version", {"p_code": student, "p_version": 1})
    check("fetch v1 snapshot content", res.get("found") and res.get("content") == "print('hi')", str(res))

    # meaningful line count: blank lines, comment-only lines, and bare `pass` are not counted.
    _, res = rpc(cfg, "save_project", {"p_code": student, "p_content": "# a comment\npass\n\nprint('real')", "p_base_version": 3, "p_session": "s1", "p_is_milestone": True})
    check("save v4 (mixed content) ok", res.get("ok") and res.get("version") == 4, str(res))
    _, res = rpc(cfg, "project_history", {"p_code": student})
    v4 = next((v for v in res.get("versions", []) if v.get("version") == 4), None)
    check("history counts only meaningful lines (1 of 4)", v4 is not None and v4.get("line_count") == 1, str(v4))

    # unknown code rejected
    _, res = rpc(cfg, "save_project", {"p_code": "definitely-not-a-real-code-xyz", "p_content": "x", "p_base_version": 0, "p_session": "s1"})
    check("unknown code rejected", res.get("ok") is False and res.get("error") == "unknown_code", str(res))

    # bad teacher code rejected (class-scoped: ownership check fails)
    _, res = rpc(cfg, "teacher_roster", {"p_teacher_code": "nope-not-a-teacher", "p_class_id": class_id})
    check("bad teacher code rejected", res.get("ok") is False and res.get("error") == "bad_teacher_code", str(res))

    # roster includes our student (no codes leaked)
    _, res = rpc(cfg, "teacher_roster", {"p_teacher_code": cfg["teacher"], "p_class_id": class_id})
    rids = [r.get("project_id") for r in res.get("roster", [])] if res.get("ok") else []
    check("roster lists the student", project_id in rids, str(res)[:200])
    check("roster leaks no codes", res.get("ok") and all("student_code" not in r for r in res.get("roster", [])), "")
    # roster carries each student's latest meaningful line count (v4 content = 1 meaningful line)
    row = next((r for r in res.get("roster", []) if r.get("project_id") == project_id), None)
    check("roster row has meaningful line_count", row is not None and row.get("line_count") == 1, str(row))

    # reprint reveals our code (decrypted with the teacher code)
    _, res = rpc(cfg, "reprint_codes", {"p_teacher_code": cfg["teacher"], "p_class_id": class_id})
    codes = {c.get("project_id"): c.get("student_code") for c in res.get("cards", [])} if res.get("ok") else {}
    check("reprint returns our plaintext code", codes.get(project_id) == student, str(codes.get(project_id)))

    # read-only lock: teacher locks -> save rejected server-side + load/roster report it; unlock -> saves work
    _, res = rpc(cfg, "set_readonly", {"p_teacher_code": cfg["teacher"], "p_project_id": project_id, "p_readonly": True})
    check("set_readonly lock ok", res.get("ok") is True and res.get("readonly") is True, str(res))
    _, res = rpc(cfg, "save_project", {"p_code": student, "p_content": "print('x')", "p_base_version": 4, "p_session": "s1"})
    check("save rejected while locked", res.get("ok") is False and res.get("error") == "readonly", str(res))
    _, res = rpc(cfg, "load_project", {"p_code": student})
    check("load reports readonly", res.get("readonly") is True, str(res))
    _, res = rpc(cfg, "teacher_roster", {"p_teacher_code": cfg["teacher"], "p_class_id": class_id})
    row = next((r for r in res.get("roster", []) if r.get("project_id") == project_id), None)
    check("roster row shows readonly", row is not None and row.get("readonly") is True, str(row))
    _, res = rpc(cfg, "set_readonly", {"p_teacher_code": "nope-not-a-teacher", "p_project_id": project_id, "p_readonly": False})
    check("set_readonly rejects a bad teacher code", res.get("ok") is False, str(res))
    _, res = rpc(cfg, "set_readonly", {"p_teacher_code": cfg["teacher"], "p_project_id": project_id, "p_readonly": False})
    check("set_readonly unlock ok", res.get("ok") is True and res.get("readonly") is False, str(res))
    _, res = rpc(cfg, "save_project", {"p_code": student, "p_content": "print('unlocked')", "p_base_version": 4, "p_session": "s1"})
    check("save works after unlock", res.get("ok") is True, str(res))

    # assigned flag (controls whether a no-work code gets a progress-pack page)
    _, res = rpc(cfg, "set_assigned", {"p_teacher_code": cfg["teacher"], "p_project_id": project_id, "p_assigned": True})
    check("set_assigned ok", res.get("ok") is True and res.get("assigned") is True, str(res))
    _, res = rpc(cfg, "teacher_roster", {"p_teacher_code": cfg["teacher"], "p_class_id": class_id})
    arow = next((r for r in res.get("roster", []) if r.get("project_id") == project_id), None)
    check("roster row shows assigned", arow is not None and arow.get("assigned") is True, str(arow))
    _, res = rpc(cfg, "set_assigned", {"p_teacher_code": "nope-not-a-teacher", "p_project_id": project_id, "p_assigned": False})
    check("set_assigned rejects a bad teacher code", res.get("ok") is False, str(res))
    _, res = rpc(cfg, "set_assigned", {"p_teacher_code": cfg["teacher"], "p_project_id": project_id, "p_assigned": False})
    check("set_assigned clear ok", res.get("ok") is True and res.get("assigned") is False, str(res))

    # mark_complete
    if class_project_id:
        _, res = rpc(cfg, "mark_complete", {"p_teacher_code": cfg["teacher"], "p_class_project_id": class_project_id})
        check("mark_complete ok", res.get("ok") is True, str(res))

    # ---- multi-class RPCs (0003): teacher entity, class creation, bulk anonymous codes ----
    _, res = rpc(cfg, "teacher_classes", {"p_teacher_code": cfg["teacher"]})
    check("teacher_classes ok", res.get("ok") and isinstance(res.get("classes"), list), str(res)[:200])

    _, res = rpc(cfg, "create_class", {
        "p_teacher_code": cfg["teacher"], "p_name": "ITest Class " + rand[:6],
        "p_school": None, "p_project_slug": cfg["slug"]})
    check("create_class ok", res.get("ok") and res.get("class_id"), str(res))
    new_class_id = res.get("class_id") if isinstance(res, dict) else None

    # rename_class
    _, res = rpc(cfg, "rename_class", {"p_teacher_code": cfg["teacher"], "p_class_id": new_class_id, "p_name": "  ITest Renamed " + rand[:4] + "  "})
    check("rename_class ok (trimmed)", res.get("ok") is True and res.get("name") == "ITest Renamed " + rand[:4], str(res))
    _, res = rpc(cfg, "rename_class", {"p_teacher_code": cfg["teacher"], "p_class_id": new_class_id, "p_name": "   "})
    check("rename_class rejects a blank name", res.get("ok") is False and res.get("error") == "bad_name", str(res))
    _, res = rpc(cfg, "rename_class", {"p_teacher_code": "nope-not-a-teacher", "p_class_id": new_class_id, "p_name": "Hacked"})
    check("rename_class rejects a bad teacher code", res.get("ok") is False, str(res))

    # Pool of 5 candidates, ask for 3: server should land exactly 3 from the pool (the extras
    # are spares for collisions).
    bulk_pool = ["itbulk-" + rand[:6] + "-" + s for s in ("aaa", "bbb", "ccc", "ddd", "eee")]
    _, res = rpc(cfg, "add_students_bulk", {
        "p_teacher_code": cfg["teacher"], "p_class_id": new_class_id,
        "p_project_slug": cfg["slug"], "p_count": 3, "p_codes": bulk_pool})
    added = res.get("added", []) if res.get("ok") else []
    check("add_students_bulk lands exactly count from the pool",
          res.get("ok") and len(added) == 3 and set(added).issubset(bulk_pool), str(res))
    check("add_students_bulk reports remaining capacity", res.get("remaining") == 197, str(res))

    _, res = rpc(cfg, "teacher_roster", {"p_teacher_code": cfg["teacher"], "p_class_id": new_class_id})
    roster = res.get("roster", []) if res.get("ok") else []
    check("new class roster has 3 nameless students",
          len(roster) == 3 and all(r.get("display_name") is None for r in roster), str(res)[:200])

    _, res = rpc(cfg, "teacher_roster", {"p_teacher_code": "nope-not-a-teacher", "p_class_id": new_class_id})
    check("class-scoped roster rejects a bad teacher code", res.get("ok") is False, str(res))

    # optional cleanup with service role
    if cfg["service"]:
        if project_id:
            st, res = rpc(cfg, "delete_student", {"p_project_id": project_id}, key=cfg["service"])
            check("cleanup delete_student", res.get("ok") is True, f"{st} {res}")
        if new_class_id:
            # Deleting the class cascades class_projects -> projects (the bulk students).
            check("cleanup delete test class", rest_delete(cfg, "classes", new_class_id), "")
    else:
        print("  (no SUPABASE_SERVICE_KEY: leaving test rows in place)")

    print(f"\nsupabase-itest: {PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
