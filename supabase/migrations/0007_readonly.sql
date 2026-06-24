-- Project Storage v2: per-student read-only lock. A teacher can lock a student's project from
-- the dashboard; while locked, the student can open and run it but saves are rejected
-- server-side (the student page also shows view-only, but this RPC is the real guard).
-- Append-only; re-runnable. Builds on 0002 (load/save), 0004 (meaningful_line_count),
-- 0005 (roster line_count), and the teacher/class model in 0003.

alter table projects add column if not exists readonly boolean not null default false;

-- load_project: expose the readonly flag so the student page can enter view-only mode.
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
    'content', v_state.content,
    'last_saved_at', v_proj.last_saved_at,
    'readonly', v_proj.readonly
  );
end;
$$;

-- save_project: reject writes to a locked project. Otherwise identical to 0002.
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
  v_last_snap timestamptz;
begin
  if octet_length(coalesce(p_content, '')) > 262144 then
    return jsonb_build_object('ok', false, 'error', 'too_large');
  end if;

  select * into v_proj from projects where student_code_hash = hash_code(p_code) for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_code');
  end if;
  if v_proj.readonly then
    return jsonb_build_object('ok', false, 'error', 'readonly');
  end if;

  v_conflict := (v_proj.current_version <> p_base_version)
                and (v_proj.last_writer is distinct from p_session);
  v_new_version := v_proj.current_version + 1;

  insert into current_state (project_id, content, version, updated_at)
  values (v_proj.id, p_content, v_new_version, now())
  on conflict (project_id)
    do update set content = excluded.content, version = excluded.version, updated_at = now();

  select max(created_at) into v_last_snap from snapshots where project_id = v_proj.id;
  if coalesce(p_is_milestone, false)
     or v_last_snap is null
     or v_last_snap < now() - interval '5 seconds' then
    insert into snapshots (project_id, version, content, writer_session, is_milestone)
    values (v_proj.id, v_new_version, p_content, p_session, coalesce(p_is_milestone, false));
  end if;

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

-- Teacher sets/clears the lock on one of their students' projects. Authorised by the same
-- ownership join used elsewhere: the update only matches when the project's class belongs to
-- the teacher identified by the code.
create or replace function set_readonly(p_teacher_code text, p_project_id uuid, p_readonly boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  update projects p
    set readonly = coalesce(p_readonly, false)
    from class_projects cp, classes c
    where p.id = p_project_id
      and cp.id = p.class_project_id
      and c.id = cp.class_id
      and c.teacher_id = teacher_for(p_teacher_code);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'readonly', coalesce(p_readonly, false));
end;
$$;

-- teacher_roster: include each student's readonly flag (otherwise identical to 0005).
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
      'completed_at', cp.completed_at,
      'line_count', coalesce(meaningful_line_count(cs.content), 0),
      'readonly', p.readonly)
      order by p.display_name asc nulls last, p.created_at asc, p.id asc)
    from projects p
    join class_projects cp on cp.id = p.class_project_id
    left join current_state cs on cs.project_id = p.id
    where cp.class_id = p_class_id), '[]'::jsonb));
end;
$$;

revoke all on function set_readonly(text, uuid, boolean) from public;
grant execute on function set_readonly(text, uuid, boolean) to anon, authenticated;
