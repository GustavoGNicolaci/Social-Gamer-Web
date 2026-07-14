drop policy if exists "user_uploads_delete_own_objects" on storage.objects;

create policy "user_uploads_delete_own_objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-uploads'
  and (
    (storage.foldername(name))[1] = ((select auth.uid())::text)
    or (
      (storage.foldername(name))[2] = 'community-posts'
      and exists (
        select 1
        from public.comunidade_posts p
        where p.imagem_path in (name, 'user-uploads/' || name)
          and public.is_comunidade_moderador(p.comunidade_id, (select auth.uid()))
      )
    )
    or (
      (storage.foldername(name))[2] = 'communities'
      and exists (
        select 1
        from public.comunidades c
        where c.banner_path in (name, 'user-uploads/' || name)
          and public.is_comunidade_lider(c.id, (select auth.uid()))
      )
    )
  )
);

drop policy if exists "community_post_media_delete_own_objects" on storage.objects;

create policy "community_post_media_delete_own_objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-post-media'
  and (
    (
      (storage.foldername(name))[1] = ((select auth.uid())::text)
      and (storage.foldername(name))[2] = 'community-posts'
    )
    or exists (
      select 1
      from public.comunidade_posts p
      where p.imagem_path = 'community-post-media/' || name
        and public.is_comunidade_moderador(p.comunidade_id, (select auth.uid()))
    )
  )
);;
