-- Project Storage v2: drop the single-arg teacher RPC compat shims from 0003.
-- They existed only to keep the pre-multi-class dashboard working while the client moved to
-- the class-scoped RPCs (teacher_roster / reprint_codes / append_student now take a class_id,
-- PR #49). The client wrappers and the integration test now pass class_id everywhere, so the
-- shims (and the earliest_class helper they delegated through) are unused. Append-only;
-- re-runnable. The class-scoped overloads are untouched.

drop function if exists teacher_roster(text);
drop function if exists reprint_codes(text);
drop function if exists append_student(text, text, text, text);
drop function if exists earliest_class(text);
