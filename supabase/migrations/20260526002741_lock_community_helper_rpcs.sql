create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

create or replace function private.get_comunidade_cargo(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cm.cargo::text
  from public.comunidade_membros cm
  where cm.comunidade_id = p_comunidade_id
    and cm.usuario_id = p_usuario_id
  limit 1;
$$;

create or replace function private.is_comunidade_membro(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comunidade_membros cm
    where cm.comunidade_id = p_comunidade_id
      and cm.usuario_id = p_usuario_id
  );
$$;

create or replace function private.is_comunidade_lider(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.get_comunidade_cargo(p_comunidade_id, p_usuario_id) = 'lider', false);
$$;

create or replace function private.is_comunidade_moderador(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.get_comunidade_cargo(p_comunidade_id, p_usuario_id) in ('lider', 'admin'), false);
$$;

create or replace function private.can_ver_conteudo_comunidade(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comunidades c
    where c.id = p_comunidade_id
      and c.deleted_at is null
      and (
        c.visibilidade = 'publica'
        or private.is_comunidade_membro(c.id, p_usuario_id)
      )
  );
$$;

create or replace function private.can_user_post_comunidade(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comunidades c
    join public.comunidade_membros cm
      on cm.comunidade_id = c.id
     and cm.usuario_id = p_usuario_id
    where c.id = p_comunidade_id
      and c.deleted_at is null
      and (
        c.permissao_postagem = 'todos_membros'
        or (c.permissao_postagem = 'somente_admins' and cm.cargo in ('lider', 'admin'))
        or (c.permissao_postagem = 'somente_lider' and cm.cargo = 'lider')
      )
  );
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.get_comunidade_cargo(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.is_comunidade_membro(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.is_comunidade_lider(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.is_comunidade_moderador(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.can_ver_conteudo_comunidade(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.can_user_post_comunidade(uuid, uuid) to anon, authenticated, service_role;

create or replace function public.get_comunidade_cargo(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.get_comunidade_cargo(p_comunidade_id, p_usuario_id);
$$;

create or replace function public.is_comunidade_membro(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_comunidade_membro(p_comunidade_id, p_usuario_id);
$$;

create or replace function public.is_comunidade_lider(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_comunidade_lider(p_comunidade_id, p_usuario_id);
$$;

create or replace function public.is_comunidade_moderador(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_comunidade_moderador(p_comunidade_id, p_usuario_id);
$$;

create or replace function public.can_ver_conteudo_comunidade(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_ver_conteudo_comunidade(p_comunidade_id, p_usuario_id);
$$;

create or replace function public.can_user_post_comunidade(
  p_comunidade_id uuid,
  p_usuario_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_user_post_comunidade(p_comunidade_id, p_usuario_id);
$$;

set local search_path = public, extensions;

do $$
declare
  v_function record;
  v_definition text;
begin
  for v_function in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname not in (
        'get_comunidade_cargo',
        'is_comunidade_membro',
        'is_comunidade_lider',
        'is_comunidade_moderador',
        'can_ver_conteudo_comunidade',
        'can_user_post_comunidade'
      )
      and (
        p.prosrc like '%public.get_comunidade_cargo%'
        or p.prosrc like '%public.is_comunidade_membro%'
        or p.prosrc like '%public.is_comunidade_lider%'
        or p.prosrc like '%public.is_comunidade_moderador%'
        or p.prosrc like '%public.can_ver_conteudo_comunidade%'
        or p.prosrc like '%public.can_user_post_comunidade%'
      )
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_definition := replace(v_definition, 'public.get_comunidade_cargo', 'private.get_comunidade_cargo');
    v_definition := replace(v_definition, 'public.is_comunidade_membro', 'private.is_comunidade_membro');
    v_definition := replace(v_definition, 'public.is_comunidade_lider', 'private.is_comunidade_lider');
    v_definition := replace(v_definition, 'public.is_comunidade_moderador', 'private.is_comunidade_moderador');
    v_definition := replace(v_definition, 'public.can_ver_conteudo_comunidade', 'private.can_ver_conteudo_comunidade');
    v_definition := replace(v_definition, 'public.can_user_post_comunidade', 'private.can_user_post_comunidade');
    execute v_definition;
  end loop;
end $$;

alter policy "Denuncias visiveis para denunciante ou moderador"
  on public.comunidade_denuncias
  using ((denunciante_id = auth.uid()) or private.is_comunidade_moderador(comunidade_id, auth.uid()));

alter policy "Membros visiveis conforme comunidade"
  on public.comunidade_membros
  using (private.can_ver_conteudo_comunidade(comunidade_id, (select auth.uid())));

alter policy "Comentarios visiveis conforme comunidade"
  on public.comunidade_post_comentarios
  using ((deleted_at is null) and private.can_ver_conteudo_comunidade(comunidade_id, (select auth.uid())));

alter policy "Posts visiveis conforme comunidade"
  on public.comunidade_posts
  using ((deleted_at is null) and private.can_ver_conteudo_comunidade(comunidade_id, (select auth.uid())));

alter policy "Solicitacoes visiveis para autor ou moderador"
  on public.comunidade_solicitacoes_entrada
  using ((usuario_id = auth.uid()) or private.is_comunidade_moderador(comunidade_id, auth.uid()));

alter policy "Comunidades visiveis"
  on public.comunidades
  using (private.can_ver_conteudo_comunidade(id, (select auth.uid())));

alter policy "community_post_media_delete_own_objects"
  on storage.objects
  using (
    bucket_id = 'community-post-media'
    and (
      (((storage.foldername(name))[1] = (select auth.uid())::text) and ((storage.foldername(name))[2] = 'community-posts'))
      or exists (
        select 1
        from public.comunidade_posts p
        where p.imagem_path = ('community-post-media/' || name)
          and private.is_comunidade_moderador(p.comunidade_id, (select auth.uid()))
      )
    )
  );

alter policy "community_post_media_select_visible"
  on storage.objects
  using (
    bucket_id = 'community-post-media'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text)
      or exists (
        select 1
        from public.comunidade_posts p
        where p.imagem_path = ('community-post-media/' || name)
          and p.deleted_at is null
          and private.can_ver_conteudo_comunidade(p.comunidade_id, (select auth.uid()))
      )
    )
  );

alter policy "user_uploads_delete_own_objects"
  on storage.objects
  using (
    bucket_id = 'user-uploads'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text)
      or (
        ((storage.foldername(name))[2] = 'community-posts')
        and exists (
          select 1
          from public.comunidade_posts p
          where p.imagem_path = any (array[name, 'user-uploads/' || name])
            and private.is_comunidade_moderador(p.comunidade_id, (select auth.uid()))
        )
      )
      or (
        ((storage.foldername(name))[2] = 'communities')
        and exists (
          select 1
          from public.comunidades c
          where c.banner_path = any (array[name, 'user-uploads/' || name])
            and private.is_comunidade_lider(c.id, (select auth.uid()))
        )
      )
    )
  );

revoke execute on function public.get_comunidade_cargo(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_comunidade_membro(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_comunidade_lider(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_comunidade_moderador(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_ver_conteudo_comunidade(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_user_post_comunidade(uuid, uuid) from public, anon, authenticated;
