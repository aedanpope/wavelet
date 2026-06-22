-- Project Storage v2: "lines you wrote" should count meaningful code only.
-- The history view shows a net line count (a snapshot's count minus the starter file's). If
-- that count includes blank lines, comment-only (#...) lines, and bare `pass` placeholders,
-- a student who deletes the commented-out scaffolding and `pass` stubs and writes real code
-- can show as "+1 line". So define line count as MEANINGFUL lines only, in both places that
-- produce one: here (each snapshot, server-side) and the client's starter-file baseline
-- (project.js meaningfulLineCount, kept in sync with this).
--
-- Append-only migration (supersedes 0002's project_history line_count). Re-runnable.

-- Count "meaningful" lines: non-blank, not a comment-only (#...) line, not a bare `pass`.
-- (Inline comments like `x = 1  # note` still count: only whole-line comments are dropped.)
create or replace function meaningful_line_count(p_content text)
returns integer language sql immutable set search_path = public as $$
  select count(*)::int
  from unnest(string_to_array(coalesce(p_content, ''), E'\n')) as line
  where btrim(line, E' \t\r') <> ''
    and left(btrim(line, E' \t\r'), 1) <> '#'
    and btrim(line, E' \t\r') <> 'pass';
$$;
revoke all on function meaningful_line_count(text) from public;

-- Re-scope project_history's line_count to meaningful lines (otherwise unchanged from 0002).
create or replace function project_history(p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_proj projects%rowtype;
begin
  select * into v_proj from projects where student_code_hash = hash_code(p_code);
  if not found then
    return jsonb_build_object('found', false);
  end if;
  -- line_count = meaningful lines only; the client subtracts the starter file's meaningful
  -- count (it knows projectDef) to show "lines you wrote".
  return jsonb_build_object('found', true, 'versions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'version', s.version, 'created_at', s.created_at, 'is_milestone', s.is_milestone,
      'line_count', meaningful_line_count(s.content))
      order by s.version desc)
    from snapshots s where s.project_id = v_proj.id), '[]'::jsonb));
end;
$$;
