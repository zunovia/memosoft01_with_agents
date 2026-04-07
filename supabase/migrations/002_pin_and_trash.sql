-- Add pinning and soft-delete to notes
-- Run in Supabase SQL Editor

alter table public.notes
  add column if not exists pinned boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists notes_pinned_idx on public.notes(pinned) where pinned = true;
create index if not exists notes_deleted_at_idx on public.notes(deleted_at);
