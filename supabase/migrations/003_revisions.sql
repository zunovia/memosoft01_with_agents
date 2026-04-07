create table if not exists public.note_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists note_revisions_note_idx on public.note_revisions(note_id, created_at desc);
alter table public.note_revisions enable row level security;
create policy "own revisions" on public.note_revisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
