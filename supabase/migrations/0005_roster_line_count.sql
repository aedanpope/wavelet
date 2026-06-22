-- Project Storage v2: teacher roster shows each student's "lines you wrote".
-- Return the meaningful line count of each student's LATEST content (current_state) so the
-- dashboard can subtract the project's starter baseline (computed client-side with the same
-- definition, project-source.js) and show the net, matching the student History view.
-- Append-only (re-runnable); meaningful_line_count() comes from 0004. Also makes the roster
-- order deterministic (named students alphabetical, then blank-name students by created_at,
-- with id as a final tiebreaker) so the row numbering is stable across refreshes.

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
      'line_count', coalesce(meaningful_line_count(cs.content), 0))
      order by p.display_name asc nulls last, p.created_at asc, p.id asc)
    from projects p
    join class_projects cp on cp.id = p.class_project_id
    left join current_state cs on cs.project_id = p.id
    where cp.class_id = p_class_id), '[]'::jsonb));
end;
$$;
