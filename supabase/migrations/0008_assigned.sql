-- Project Storage v2: per-student "assigned" flag. Marks a code that was actually handed to a
-- real student, vs a spare code that was never used. The progress pack prints a page for any
-- student who is assigned OR has saved work, so a kid who didn't submit still gets a (blank)
-- page while unused spare codes are skipped. Append-only; re-runnable.

alter table projects add column if not exists assigned boolean not null default false;

-- Teacher marks/clears "assigned" on one of their students' projects (same ownership join as
-- set_readonly: the update only matches a project in a class the teacher owns).
create or replace function set_assigned(p_teacher_code text, p_project_id uuid, p_assigned boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  update projects p
    set assigned = coalesce(p_assigned, false)
    from class_projects cp, classes c
    where p.id = p_project_id
      and cp.id = p.class_project_id
      and c.id = cp.class_id
      and c.teacher_id = teacher_for(p_teacher_code);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'assigned', coalesce(p_assigned, false));
end;
$$;

-- teacher_roster: include the assigned flag (otherwise identical to 0007).
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
      'readonly', p.readonly,
      'assigned', p.assigned)
      order by p.display_name asc nulls last, p.created_at asc, p.id asc)
    from projects p
    join class_projects cp on cp.id = p.class_project_id
    left join current_state cs on cs.project_id = p.id
    where cp.class_id = p_class_id), '[]'::jsonb));
end;
$$;

revoke all on function set_assigned(text, uuid, boolean) from public;
grant execute on function set_assigned(text, uuid, boolean) to anon, authenticated;
