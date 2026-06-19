-- Project Storage v2 — RPC functions (step 2b).
-- Design: design_docs/PROJECT_STORAGE_V2.md §12.6 (API surface), §12.5 (auth at rest),
-- §12.2/§12.3 (write model + hard-source-of-truth contract).
--
-- All access to the locked tables (0001_init.sql) is through these SECURITY DEFINER
-- functions. The code-as-capability model: the caller passes a code as an argument and the
-- function authorises internally. Student + teacher functions are granted to anon; owner
-- functions only to service_role.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Canonicalise a typed code the same way code-words.js canonical() does: lowercase, runs of
-- non-letters become single dashes, trim dashes. So "Brave Otter Oak" -> "brave-otter-oak".
create or replace function normalize_code(p_code text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_code, '')), '[^a-z]+', '-', 'g'));
$$;

-- Keyed hash of a code for lookup/storage. HMAC-SHA256 with the pepper from app_secret, so
-- a DB dump alone cannot brute-force the low-entropy codes (§12.5).
create or replace function hash_code(p_code text)
returns text language sql security definer set search_path = public, extensions as $$
  select encode(
    hmac(normalize_code(p_code), (select pepper from app_secret where id), 'sha256'),
    'hex'
  );
$$;

-- Resolve a teacher code to its class id, or null.
create or replace function class_for_teacher(p_teacher_code text)
returns uuid language sql security definer set search_path = public, extensions as $$
  select id from classes where teacher_code_hash = hash_code(p_teacher_code);
$$;

-- ---------------------------------------------------------------------------
-- Student RPCs (granted to anon)
-- ---------------------------------------------------------------------------

-- Resume: load the latest state for a code. Returns display_name (for the "is this you?"
-- confirmation) and the current content/version, or {found:false}.
create or replace function load_project(p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proj projects%rowtype;
  v_state current_state%rowtype;
begin
  select * into v_proj from projects where student_code_hash = hash_code(p_code);
  if not found then
    return jsonb_build_object('found', false);
  end if;
  select * into v_state from current_state where project_id = v_proj.id;
  return jsonb_build_object(
    'found', true,
    'project_id', v_proj.id,
    'display_name', v_proj.display_name,
    'version', coalesce(v_state.version, 0),
    'content', v_state.content,          -- null if never saved yet
    'last_saved_at', v_proj.last_saved_at
  );
end;
$$;

-- Save: overwrite current_state and append a snapshot in one transaction. A save is durable
-- only on the {ok:true} return (§12.3). `conflict` is true when another session advanced the
-- project since p_base_version, so the client can surface "also edited on another laptop"
-- (the write still succeeds; nothing is lost, history holds both — §12.2).
create or replace function save_project(
  p_code text,
  p_content text,
  p_base_version integer,
  p_session text,
  p_is_milestone boolean default false
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proj projects%rowtype;
  v_new_version integer;
  v_conflict boolean;
begin
  select * into v_proj from projects where student_code_hash = hash_code(p_code) for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_code');
  end if;

  v_conflict := (v_proj.current_version <> p_base_version)
                and (v_proj.last_writer is distinct from p_session);
  v_new_version := v_proj.current_version + 1;

  insert into current_state (project_id, content, version, updated_at)
  values (v_proj.id, p_content, v_new_version, now())
  on conflict (project_id)
    do update set content = excluded.content, version = excluded.version, updated_at = now();

  insert into snapshots (project_id, version, content, writer_session, is_milestone)
  values (v_proj.id, v_new_version, p_content, p_session, coalesce(p_is_milestone, false));

  update projects
    set current_version = v_new_version, last_writer = p_session, last_saved_at = now()
    where id = v_proj.id;

  return jsonb_build_object(
    'ok', true,
    'version', v_new_version,
    'saved_at', now(),
    'conflict', v_conflict
  );
end;
$$;

-- History metadata for the student-facing version browser (§6). Content fetched separately.
create or replace function project_history(p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proj projects%rowtype;
begin
  select * into v_proj from projects where student_code_hash = hash_code(p_code);
  if not found then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object('found', true, 'versions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'version', s.version, 'created_at', s.created_at, 'is_milestone', s.is_milestone)
      order by s.version desc)
    from snapshots s where s.project_id = v_proj.id), '[]'::jsonb));
end;
$$;

-- Fetch one historical snapshot's content (for restore/preview).
create or replace function project_version(p_code text, p_version integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proj projects%rowtype;
  v_content text;
begin
  select * into v_proj from projects where student_code_hash = hash_code(p_code);
  if not found then
    return jsonb_build_object('found', false);
  end if;
  select content into v_content from snapshots
    where project_id = v_proj.id and version = p_version
    order by id desc limit 1;
  if v_content is null then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object('found', true, 'version', p_version, 'content', v_content);
end;
$$;

-- ---------------------------------------------------------------------------
-- Teacher RPCs (granted to anon; gated by the teacher code)
-- ---------------------------------------------------------------------------

-- Add a student to the class for a project slug, minting their project instance. The code
-- is generated client-side with code-words.js and passed in; the server hashes it (lookup)
-- and encrypts it with the teacher code (reprint, §12.5). Returns {ok:false,'code_taken'}
-- on the rare hash collision so the client retries with a freshly generated code.
create or replace function append_student(
  p_teacher_code text,
  p_project_slug text,
  p_display_name text,
  p_student_code text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class uuid;
  v_cp uuid;
  v_id uuid;
begin
  v_class := class_for_teacher(p_teacher_code);
  if v_class is null then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;

  select id into v_cp from class_projects
    where class_id = v_class and project_slug = p_project_slug
    order by created_at limit 1;
  if v_cp is null then
    insert into class_projects (class_id, project_slug) values (v_class, p_project_slug)
      returning id into v_cp;
  end if;

  begin
    insert into projects (class_project_id, student_code_hash, student_code_enc, display_name)
    values (
      v_cp,
      hash_code(p_student_code),
      pgp_sym_encrypt(normalize_code(p_student_code), p_teacher_code),
      p_display_name
    )
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'code_taken');
  end;

  return jsonb_build_object('ok', true, 'project_id', v_id, 'class_project_id', v_cp);
end;
$$;

-- Roster for the dashboard: last-saved times etc. Deliberately NO codes (projection-safe,
-- §7); codes are revealed only via reprint_codes.
create or replace function teacher_roster(p_teacher_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class uuid;
begin
  v_class := class_for_teacher(p_teacher_code);
  if v_class is null then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;
  return jsonb_build_object('ok', true, 'roster', coalesce((
    select jsonb_agg(jsonb_build_object(
      'project_id', p.id,
      'display_name', p.display_name,
      'project_slug', cp.project_slug,
      'version', p.current_version,
      'last_saved_at', p.last_saved_at,
      'completed_at', cp.completed_at)
      order by p.display_name)
    from projects p join class_projects cp on cp.id = p.class_project_id
    where cp.class_id = v_class), '[]'::jsonb));
end;
$$;

-- Reveal the plaintext codes for reprinting cards. Decrypts each student_code_enc with the
-- teacher code (§12.5) — the teacher code is the only key that unlocks them.
create or replace function reprint_codes(p_teacher_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class uuid;
begin
  v_class := class_for_teacher(p_teacher_code);
  if v_class is null then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;
  return jsonb_build_object('ok', true, 'cards', coalesce((
    select jsonb_agg(jsonb_build_object(
      'project_id', p.id,
      'display_name', p.display_name,
      'student_code', pgp_sym_decrypt(p.student_code_enc, p_teacher_code))
      order by p.display_name)
    from projects p join class_projects cp on cp.id = p.class_project_id
    where cp.class_id = v_class), '[]'::jsonb));
end;
$$;

-- Mark a project run complete: starts the 12-month name-retention clock (§5).
create or replace function mark_complete(p_teacher_code text, p_class_project_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class uuid;
begin
  v_class := class_for_teacher(p_teacher_code);
  if v_class is null then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;
  update class_projects
    set completed_at = now(), name_clear_after = (now() + interval '12 months')::date
    where id = p_class_project_id and class_id = v_class;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner RPCs (service_role only)
-- ---------------------------------------------------------------------------

-- Mint a class + its first project run. The teacher code is generated by the owner with
-- code-words.js (teacher scheme) and passed in; stored hashed.
create or replace function mint_class(
  p_school text,
  p_name text,
  p_project_slug text,
  p_teacher_code text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class uuid;
  v_cp uuid;
begin
  insert into classes (school, name, teacher_code_hash)
    values (p_school, p_name, hash_code(p_teacher_code))
    returning id into v_class;
  insert into class_projects (class_id, project_slug) values (v_class, p_project_slug)
    returning id into v_cp;
  return jsonb_build_object('ok', true, 'class_id', v_class, 'class_project_id', v_cp);
end;
$$;

-- Owner data controls (§8): export and delete one student's project.
create or replace function export_student(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  return (
    select jsonb_build_object(
      'project_id', p.id,
      'display_name', p.display_name,
      'project_slug', cp.project_slug,
      'content', cs.content,
      'version', p.current_version,
      'last_saved_at', p.last_saved_at)
    from projects p
      join class_projects cp on cp.id = p.class_project_id
      left join current_state cs on cs.project_id = p.id
    where p.id = p_project_id);
end;
$$;

create or replace function delete_student(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from projects where id = p_project_id;   -- cascades current_state + snapshots
  return jsonb_build_object('ok', found);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: nothing is callable by default. Student + teacher functions to anon; owner to
-- service_role only. (normalize_code/hash_code/class_for_teacher are internal helpers; not
-- granted to anon, so they cannot be probed directly.)
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
  anon_fns text[] := array[
    'load_project(text)',
    'save_project(text, text, integer, text, boolean)',
    'project_history(text)',
    'project_version(text, integer)',
    'append_student(text, text, text, text)',
    'teacher_roster(text)',
    'reprint_codes(text)',
    'mark_complete(text, uuid)'
  ];
  owner_fns text[] := array[
    'mint_class(text, text, text, text)',
    'export_student(uuid)',
    'delete_student(uuid)'
  ];
begin
  -- Lock down every function this migration defines.
  foreach fn in array (anon_fns || owner_fns || array[
      'normalize_code(text)', 'hash_code(text)', 'class_for_teacher(text)']) loop
    execute format('revoke all on function %s from public', fn);
  end loop;
  foreach fn in array anon_fns loop
    execute format('grant execute on function %s to anon, authenticated', fn);
  end loop;
  foreach fn in array owner_fns loop
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
