-- Project Storage v2 — add a rough per-version line count to project_history (step 3d).
-- Re-runnable: create-or-replace, so paste it into the SQL editor (or supabase db push) and
-- it replaces the function in place; grants are preserved.
--
-- "Rough editable lines": non-blank lines that are not comments (#...) and not function-def
-- signatures (def ...:). That captures the student's editable bodies + setup/freestyle
-- (including starter code); it also counts the ~2 locked preamble lines, which is fine.

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
      'version', s.version,
      'created_at', s.created_at,
      'is_milestone', s.is_milestone,
      'line_count', (
        select count(*) from regexp_split_to_table(s.content, E'\n') as ln
        where btrim(ln) <> '' and left(btrim(ln), 1) <> '#' and btrim(ln) not like 'def %'
      ))
      order by s.version desc)
    from snapshots s where s.project_id = v_proj.id), '[]'::jsonb));
end;
$$;
