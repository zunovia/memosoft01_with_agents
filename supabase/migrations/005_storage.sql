-- Create a public bucket for note attachments
insert into storage.buckets (id, name, public)
values ('note-attachments', 'note-attachments', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder (user_id prefix)
create policy "users upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "public read note attachments" on storage.objects
  for select using (bucket_id = 'note-attachments');
