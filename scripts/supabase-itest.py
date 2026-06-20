#!/usr/bin/env python3
"""Integration test for the Project Storage v2 RPCs against a live Supabase project.

Drives the real plpgsql functions (0002_rpc.sql) end to end: append_student -> load ->
save (incl. concurrency + size cap) -> history -> reprint -> mark_complete. The schema
can only be validated against a running Postgres, so this is the source of truth for the
RPC runtime (the migrations themselves only get syntax-checked offline).

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

    # append_student
    st, res = rpc(cfg, "append_student", {
        "p_teacher_code": cfg["teacher"], "p_project_slug": cfg["slug"],
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

    # unknown code rejected
    _, res = rpc(cfg, "save_project", {"p_code": "definitely-not-a-real-code-xyz", "p_content": "x", "p_base_version": 0, "p_session": "s1"})
    check("unknown code rejected", res.get("ok") is False and res.get("error") == "unknown_code", str(res))

    # bad teacher code rejected
    _, res = rpc(cfg, "teacher_roster", {"p_teacher_code": "nope-not-a-teacher"})
    check("bad teacher code rejected", res.get("ok") is False and res.get("error") == "bad_teacher_code", str(res))

    # roster includes our student (no codes leaked)
    _, res = rpc(cfg, "teacher_roster", {"p_teacher_code": cfg["teacher"]})
    rids = [r.get("project_id") for r in res.get("roster", [])] if res.get("ok") else []
    check("roster lists the student", project_id in rids, str(res)[:200])
    check("roster leaks no codes", res.get("ok") and all("student_code" not in r for r in res.get("roster", [])), "")

    # reprint reveals our code (decrypted with the teacher code)
    _, res = rpc(cfg, "reprint_codes", {"p_teacher_code": cfg["teacher"]})
    codes = {c.get("project_id"): c.get("student_code") for c in res.get("cards", [])} if res.get("ok") else {}
    check("reprint returns our plaintext code", codes.get(project_id) == student, str(codes.get(project_id)))

    # mark_complete
    if class_project_id:
        _, res = rpc(cfg, "mark_complete", {"p_teacher_code": cfg["teacher"], "p_class_project_id": class_project_id})
        check("mark_complete ok", res.get("ok") is True, str(res))

    # optional cleanup with service role
    if cfg["service"] and project_id:
        st, res = rpc(cfg, "delete_student", {"p_project_id": project_id}, key=cfg["service"])
        check("cleanup delete_student", res.get("ok") is True, f"{st} {res}")
    else:
        print("  (no SUPABASE_SERVICE_KEY: leaving test rows in place)")

    print(f"\nsupabase-itest: {PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
