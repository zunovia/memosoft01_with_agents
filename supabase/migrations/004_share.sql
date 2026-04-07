alter table public.notes
  add column if not exists share_token text unique;
create index if not exists notes_share_token_idx on public.notes(share_token) where share_token is not null;

-- public read policy via share_token (no auth)
create policy "public read via share_token" on public.notes
  for select using (share_token is not null and deleted_at is null);
