-- Supabase schema for Obsidian-like note app
-- Run this in Supabase SQL Editor

-- ============ NOTES ============
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  content text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_updated_at_idx on public.notes(updated_at desc);
create index if not exists notes_tags_idx on public.notes using gin(tags);

-- Full-text search
alter table public.notes
  add column if not exists fts tsvector
  generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) stored;
create index if not exists notes_fts_idx on public.notes using gin(fts);

-- ============ LINKS (wiki-link graph) ============
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_note_id uuid not null references public.notes(id) on delete cascade,
  target_note_id uuid not null references public.notes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source_note_id, target_note_id)
);

create index if not exists links_user_id_idx on public.links(user_id);
create index if not exists links_source_idx on public.links(source_note_id);
create index if not exists links_target_idx on public.links(target_note_id);

-- ============ API KEYS ============
create table if not exists public.api_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_anthropic_key text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);

-- ============ ANALYSES (AI history) ============
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_note_ids uuid[] not null default '{}',
  types text[] not null default '{}',
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists analyses_user_id_idx on public.analyses(user_id);

-- ============ RLS ============
alter table public.notes enable row level security;
alter table public.links enable row level security;
alter table public.api_keys enable row level security;
alter table public.analyses enable row level security;

drop policy if exists "notes_owner" on public.notes;
create policy "notes_owner" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "links_owner" on public.links;
create policy "links_owner" on public.links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "api_keys_owner" on public.api_keys;
create policy "api_keys_owner" on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "analyses_owner" on public.analyses;
create policy "analyses_owner" on public.analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger for notes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();
