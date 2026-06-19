-- Project Storage v2 — schema and security scaffolding (step 2a).
-- Design: design_docs/PROJECT_STORAGE_V2.md (§12.4 data model, §12.5 auth at rest).
--
-- Apply via the Supabase SQL editor, or with the Supabase CLI:
--   supabase db push      (reads supabase/migrations/*.sql in order)
--
-- This migration creates ONLY the tables and the security scaffolding. All access
-- happens through SECURITY DEFINER RPC functions added in a later migration; the tables
-- themselves are locked down (RLS on, no policies, no grants to anon), so a leaked
-- publishable/anon key cannot read or write them directly.

-- gen_random_uuid(), digest(), hmac(), pgp_sym_encrypt/decrypt (§12.5).
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Server-side pepper for keyed code hashing.
-- Student codes are low-entropy (65,536 for students), so a plain SHA-256 would be
-- trivially reversible from a DB dump. We instead store an HMAC keyed by a pepper that
-- lives only in this locked table (never exposed via the API), so a DB leak alone cannot
-- brute-force the codes. The owner seeds it once (see comment below).
-- ---------------------------------------------------------------------------
create table if not exists app_secret (
  id     boolean primary key default true check (id),   -- single-row guard
  pepper text not null
);

-- ---------------------------------------------------------------------------
-- Durable cohort: a class of students with a teacher. Persists across projects.
-- ---------------------------------------------------------------------------
create table if not exists classes (
  id                uuid primary key default gen_random_uuid(),
  school            text,
  name              text,
  -- Teacher code stored hashed (keyed HMAC, §12.5). UNIQUE so it is the lookup key.
  -- One shared code per cohort; many-to-many teacher access is by sharing it (§3.4).
  teacher_code_hash text not null unique,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- One row per project the class runs. A 2nd project later = a 2nd row here.
-- project_slug names the static project DEFINITION ('pixel-game' ->
-- projects/pixel-game.json); it is NOT a FK to the projects table below.
-- ---------------------------------------------------------------------------
create table if not exists class_projects (
  id               uuid primary key default gen_random_uuid(),
  class_id         uuid not null references classes(id) on delete cascade,
  project_slug     text not null,
  -- When student names auto-delete (12 months after completion, §5). Set by mark_complete.
  name_clear_after date,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- One student's project INSTANCE for one project run (code = one project, §3.2).
-- The code is stored twice (§12.5):
--   student_code_hash : keyed HMAC, for login lookup. UNIQUE + globally unique.
--   student_code_enc  : the code encrypted with the teacher code, for reprinting cards.
-- display_name lives here (separate from content); deletion just nulls it (§5).
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id                uuid primary key default gen_random_uuid(),
  class_project_id  uuid not null references class_projects(id) on delete cascade,
  student_code_hash text not null unique,
  student_code_enc  bytea not null,
  display_name      text,
  current_version   integer not null default 0,
  last_writer       text,          -- session token of the last writer (concurrency)
  last_saved_at     timestamptz,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Latest content, overwritten each save. No PII (FK only). Single-row read = resume.
-- ---------------------------------------------------------------------------
create table if not exists current_state (
  project_id uuid primary key references projects(id) on delete cascade,
  content    text not null,        -- the assembled .py (v1)
  version    integer not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Append-only history. No PII (FK only). Compacted to milestones after completion (P2).
-- ---------------------------------------------------------------------------
create table if not exists snapshots (
  id             bigserial primary key,
  project_id     uuid not null references projects(id) on delete cascade,
  version        integer not null,
  content        text not null,
  writer_session text,
  is_milestone   boolean not null default false,  -- Run-triggered snapshots survive compaction
  created_at     timestamptz not null default now()
);

create index if not exists snapshots_project_version_idx on snapshots (project_id, version);
create index if not exists projects_class_project_idx on projects (class_project_id);
create index if not exists class_projects_class_idx on class_projects (class_id);

-- ---------------------------------------------------------------------------
-- Lock everything down. RLS on + no policies means the anon/authenticated roles get
-- nothing through PostgREST; only SECURITY DEFINER functions (owned by the table owner,
-- added in the next migration) can touch these tables. Belt-and-suspenders: also revoke
-- table privileges from the API roles.
-- ---------------------------------------------------------------------------
alter table app_secret      enable row level security;
alter table classes         enable row level security;
alter table class_projects  enable row level security;
alter table projects        enable row level security;
alter table current_state   enable row level security;
alter table snapshots       enable row level security;

revoke all on app_secret, classes, class_projects, projects, current_state, snapshots
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- One-time owner setup (run once in the SQL editor with the service role, then delete the
-- statement so the literal secret is not left lying around):
--
--   insert into app_secret (pepper) values (encode(gen_random_bytes(32), 'hex'))
--   on conflict (id) do nothing;
--
-- After this, mint classes with the owner RPC (next migration) using the service-role key.
-- ---------------------------------------------------------------------------
