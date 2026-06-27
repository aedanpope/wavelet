-- Project Storage v2: let a teacher rename one of their classes from the dashboard.
-- Append-only; re-runnable.

create or replace function rename_class(p_teacher_code text, p_class_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if coalesce(btrim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;
  update classes set name = btrim(p_name)
    where id = p_class_id and teacher_id = teacher_for(p_teacher_code);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'name', btrim(p_name));
end;
$$;

revoke all on function rename_class(text, uuid, text) from public;
grant execute on function rename_class(text, uuid, text) to anon, authenticated;
