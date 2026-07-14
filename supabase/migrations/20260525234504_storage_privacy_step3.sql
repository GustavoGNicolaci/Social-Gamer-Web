-- Step 3: storage privacy and community post media bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-post-media',
  'community-post-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
where id = 'user-uploads';

-- Consolidate user-uploads policies.
drop policy if exists "Remocao autenticada no proprio prefixo" on storage.objects;
drop policy if exists "Users can delete their own files" on storage.objects;
drop policy if exists "Atualizacao autenticada no proprio prefixo" on storage.objects;
drop policy if exists user_uploads_delete_own_folder on storage.objects;
drop policy if exists user_uploads_delete_own_objects on storage.objects;
drop policy if exists user_uploads_insert_own_folder on storage.objects;
drop policy if exists user_uploads_insert_own_objects on storage.objects;
drop policy if exists user_uploads_select_own_objects on storage.objects;
drop policy if exists user_uploads_update_own_folder on storage.objects;
drop policy if exists user_uploads_update_own_objects on storage.objects;

create policy user_uploads_select_own_objects
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
);

create policy user_uploads_insert_own_objects
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp', 'gif']::text[])
);

create policy user_uploads_update_own_objects
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
)
with check (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp', 'gif']::text[])
);

create policy user_uploads_delete_own_objects
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
);

-- Community post media is private and served through signed URLs gated by RLS.
drop policy if exists community_post_media_select_visible on storage.objects;
drop policy if exists community_post_media_insert_own_objects on storage.objects;
drop policy if exists community_post_media_update_own_objects on storage.objects;
drop policy if exists community_post_media_delete_own_objects on storage.objects;

create policy community_post_media_select_visible
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'community-post-media'
  and (
    (storage.foldername(name))[1] = ((select auth.uid())::text)
    or exists (
      select 1
      from public.comunidade_posts p
      where p.imagem_path = ('community-post-media/' || name)
        and p.deleted_at is null
        and public.can_ver_conteudo_comunidade(p.comunidade_id, (select auth.uid()))
    )
  )
);

create policy community_post_media_insert_own_objects
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-post-media'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
  and (storage.foldername(name))[2] = 'community-posts'
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp', 'gif']::text[])
);

create policy community_post_media_update_own_objects
on storage.objects
for update
to authenticated
using (
  bucket_id = 'community-post-media'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
  and (storage.foldername(name))[2] = 'community-posts'
)
with check (
  bucket_id = 'community-post-media'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
  and (storage.foldername(name))[2] = 'community-posts'
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp', 'gif']::text[])
);

create policy community_post_media_delete_own_objects
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-post-media'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
  and (storage.foldername(name))[2] = 'community-posts'
);;
