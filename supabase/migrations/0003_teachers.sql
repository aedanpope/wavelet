-- Project Storage v2 — teacher entity + multi-class (step 7a).
-- Separates the teacher from the class: a teacher (owner-minted) owns many classes, all
-- unlocked by ONE teacher code. That code stays the key that decrypts their students' codes
-- (pgp_sym), so relocating it from classes to teachers keeps existing codes working.
-- Design: design_docs/PROJECT_STORAGE_V2.md §3.4 (teachers), §7 (dashboard).
--
-- Re-runnable: paste into the SQL editor (or supabase db push). The backfill is guarded so a
-- second run is a no-op. Supersedes parts of 0002 (class_for_teacher / mint_class are dropped;
-- the teacher RPCs gain class-scoped overloads, with the old signatures kept as thin shims
-- that resolve the teacher's earliest class so the pre-multi-class dashboard keeps working).

-- ---------------------------------------------------------------------------
-- 1. Teachers. Owner-minted; teacher_code_hash is the login key (keyed HMAC, §12.5).
-- ---------------------------------------------------------------------------
create table if not exists teachers (
  id                uuid primary key default gen_random_uuid(),
  school            text,
  name              text,
  teacher_code_hash text not null unique,
  created_at        timestamptz not null default now()
);
alter table teachers enable row level security;
revoke all on teachers from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Hang classes off a teacher, backfilling from the old per-class teacher code.
-- ---------------------------------------------------------------------------
alter table classes add column if not exists teacher_id uuid references teachers(id) on delete cascade;

-- Guarded so it only runs while the legacy column still exists (idempotent re-runs).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes' and column_name = 'teacher_code_hash'
  ) then
    -- Each existing class's teacher code becomes a teacher (dedup if any were shared)...
    insert into teachers (school, name, teacher_code_hash)
      select school, name, teacher_code_hash from classes where teacher_code_hash is not null
      on conflict (teacher_code_hash) do nothing;
    -- ...then link every class to it.
    update classes c set teacher_id = t.id
      from teachers t
      where c.teacher_id is null and t.teacher_code_hash = c.teacher_code_hash;
  end if;
end $$;

alter table classes alter column teacher_id set not null;
alter table classes drop column if exists teacher_code_hash;
create index if not exists classes_teacher_idx on classes (teacher_id);

-- ---------------------------------------------------------------------------
-- 3. Helpers (internal; not granted to anon).
-- ---------------------------------------------------------------------------
create or replace function teacher_for(p_teacher_code text)
returns uuid language sql security definer set search_path = public, extensions as $$
  select id from teachers where teacher_code_hash = hash_code(p_teacher_code);
$$;

-- True when p_class_id belongs to the teacher identified by the code.
create or replace function class_owned_by(p_teacher_code text, p_class_id uuid)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (
    select 1 from classes where id = p_class_id and teacher_id = teacher_for(p_teacher_code)
  );
$$;

-- class_for_teacher referenced the now-dropped column; the teacher RPCs use teacher_for instead.
drop function if exists class_for_teacher(text);

-- ---------------------------------------------------------------------------
-- 4. Teacher RPCs: class listing, class creation, bulk anonymous codes.
-- ---------------------------------------------------------------------------

-- List the teacher's classes (for the dashboard class picker), with a student count each.
create or replace function teacher_classes(p_teacher_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_teacher uuid;
begin
  v_teacher := teacher_for(p_teacher_code);
  if v_teacher is null then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;
  return jsonb_build_object(
    'ok', true,
    'teacher', (select jsonb_build_object('name', name, 'school', school) from teachers where id = v_teacher),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'class_id', c.id,
        'name', c.name,
        'school', c.school,
        'created_at', c.created_at,
        'student_count', (
          select count(*) from projects p
          join class_projects cp on cp.id = p.class_project_id
          where cp.class_id = c.id))
        order by c.created_at)
      from classes c where c.teacher_id = v_teacher), '[]'::jsonb));
end;
$$;

-- Create a class under the teacher (and, if a slug is given, its first project run). Capped so
-- a leaked teacher code can't create unbounded classes.
create or replace function create_class(
  p_teacher_code text,
  p_name text,
  p_school text,
  p_project_slug text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_teacher uuid;
  v_class uuid;
  v_cp uuid;
  v_count integer;
begin
  v_teacher := teacher_for(p_teacher_code);
  if v_teacher is null then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;
  select count(*) into v_count from classes where teacher_id = v_teacher;
  if v_count >= 100 then
    return jsonb_build_object('ok', false, 'error', 'too_many_classes');
  end if;
  insert into classes (school, name, teacher_id) values (p_school, p_name, v_teacher)
    returning id into v_class;
  if coalesce(p_project_slug, '') <> '' then
    insert into class_projects (class_id, project_slug) values (v_class, p_project_slug)
      returning id into v_cp;
  end if;
  return jsonb_build_object('ok', true, 'class_id', v_class, 'class_project_id', v_cp);
end;
$$;

-- Mint N anonymous students (no names) from client-generated codes. Skips hash collisions and
-- returns the codes actually added, so the client can top up any shortfall with fresh codes.
-- Names stay out of the database: the teacher pairs codes to the paper class list themselves.
create or replace function add_students_bulk(
  p_teacher_code text,
  p_class_id uuid,
  p_project_slug text,
  p_codes text[]
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cp uuid;
  v_count integer;
  v_code text;
  v_added text[] := '{}';
begin
  if not class_owned_by(p_teacher_code, p_class_id) then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;
  select id into v_cp from class_projects
    where class_id = p_class_id and project_slug = p_project_slug
    order by created_at limit 1;
  if v_cp is null then
    insert into class_projects (class_id, project_slug) values (p_class_id, p_project_slug)
      returning id into v_cp;
  end if;
  select count(*) into v_count from projects where class_project_id = v_cp;
  foreach v_code in array coalesce(p_codes, '{}') loop
    exit when v_count >= 200;  -- same per-project cap as append_student
    begin
      insert into projects (class_project_id, student_code_hash, student_code_enc, display_name)
      values (v_cp, hash_code(v_code), pgp_sym_encrypt(normalize_code(v_code), p_teacher_code), null);
      v_added := array_append(v_added, v_code);
      v_count := v_count + 1;
    exception when unique_violation then
      null;  -- collision: skip; client retries the shortfall
    end;
  end loop;
  return jsonb_build_object('ok', true, 'class_project_id', v_cp, 'added', to_jsonb(v_added));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Class-scoped versions of the existing teacher RPCs (take a class_id).
-- ---------------------------------------------------------------------------

create or replace function append_student(
  p_teacher_code text,
  p_class_id uuid,
  p_project_slug text,
  p_display_name text,
  p_student_code text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cp uuid;
  v_count integer;
  v_id uuid;
begin
  if not class_owned_by(p_teacher_code, p_class_id) then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;
  select id into v_cp from class_projects
    where class_id = p_class_id and project_slug = p_project_slug
    order by created_at limit 1;
  if v_cp is null then
    insert into class_projects (class_id, project_slug) values (p_class_id, p_project_slug)
      returning id into v_cp;
  end if;
  select count(*) into v_count from projects where class_project_id = v_cp;
  if v_count >= 200 then
    return jsonb_build_object('ok', false, 'error', 'class_full');
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

create or replace function teacher_roster(p_teacher_code text, p_class_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not class_owned_by(p_teacher_code, p_class_id) then
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
    where cp.class_id = p_class_id), '[]'::jsonb));
end;
$$;

create or replace function reprint_codes(p_teacher_code text, p_class_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not class_owned_by(p_teacher_code, p_class_id) then
    return jsonb_build_object('ok', false, 'error', 'bad_teacher_code');
  end if;
  return jsonb_build_object('ok', true, 'cards', coalesce((
    select jsonb_agg(jsonb_build_object(
      'project_id', p.id,
      'display_name', p.display_name,
      'student_code', pgp_sym_decrypt(p.student_code_enc, p_teacher_code))
      order by p.display_name)
    from projects p join class_projects cp on cp.id = p.class_project_id
    where cp.class_id = p_class_id), '[]'::jsonb));
end;
$$;

-- mark_complete already takes a class_project_id; re-scope its ownership check to the teacher.
create or replace function mark_complete(p_teacher_code text, p_class_project_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  update class_projects cp
    set completed_at = now(), name_clear_after = (now() + interval '12 months')::date
    from classes c
    where cp.id = p_class_project_id
      and cp.class_id = c.id
      and c.teacher_id = teacher_for(p_teacher_code);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Backward-compat shims: the pre-multi-class dashboard calls the single-arg teacher RPCs.
-- Keep them working by resolving the teacher's EARLIEST class and delegating. (PR2 switches the
-- dashboard to the class-scoped overloads; these can be dropped afterwards.)
-- ---------------------------------------------------------------------------

create or replace function earliest_class(p_teacher_code text)
returns uuid language sql security definer set search_path = public, extensions as $$
  select id from classes where teacher_id = teacher_for(p_teacher_code) order by created_at limit 1;
$$;

create or replace function teacher_roster(p_teacher_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class uuid := earliest_class(p_teacher_code);
begin
  if v_class is null then return jsonb_build_object('ok', false, 'error', 'bad_teacher_code'); end if;
  return teacher_roster(p_teacher_code, v_class);
end;
$$;

create or replace function reprint_codes(p_teacher_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class uuid := earliest_class(p_teacher_code);
begin
  if v_class is null then return jsonb_build_object('ok', false, 'error', 'bad_teacher_code'); end if;
  return reprint_codes(p_teacher_code, v_class);
end;
$$;

create or replace function append_student(
  p_teacher_code text,
  p_project_slug text,
  p_display_name text,
  p_student_code text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class uuid := earliest_class(p_teacher_code);
begin
  if v_class is null then return jsonb_build_object('ok', false, 'error', 'bad_teacher_code'); end if;
  return append_student(p_teacher_code, v_class, p_project_slug, p_display_name, p_student_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Owner RPC: mint a teacher (replaces mint_class; teachers self-serve classes now).
-- ---------------------------------------------------------------------------
drop function if exists mint_class(text, text, text, text);

create or replace function mint_teacher(p_school text, p_name text, p_teacher_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  insert into teachers (school, name, teacher_code_hash) values (p_school, p_name, hash_code(p_teacher_code))
    returning id into v_id;
  return jsonb_build_object('ok', true, 'teacher_id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'code_taken');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants. New anon RPCs + the new overloads; mint_teacher to service_role; helpers internal.
-- (create-or-replace preserved grants on the unchanged-signature shims from 0002.)
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
  anon_fns text[] := array[
    'teacher_classes(text)',
    'create_class(text, text, text, text)',
    'add_students_bulk(text, uuid, text, text[])',
    'append_student(text, uuid, text, text, text)',
    'teacher_roster(text, uuid)',
    'reprint_codes(text, uuid)'
  ];
  internal_fns text[] := array[
    'teacher_for(text)', 'class_owned_by(text, uuid)', 'earliest_class(text)'
  ];
begin
  foreach fn in array (anon_fns || internal_fns || array['mint_teacher(text, text, text)']) loop
    execute format('revoke all on function %s from public', fn);
  end loop;
  foreach fn in array anon_fns loop
    execute format('grant execute on function %s to anon, authenticated', fn);
  end loop;
  execute 'grant execute on function mint_teacher(text, text, text) to service_role';
end;
$$;
