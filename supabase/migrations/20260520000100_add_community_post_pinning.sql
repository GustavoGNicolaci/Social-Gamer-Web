alter table public.comunidade_posts
  add column if not exists fixado boolean not null default false,
  add column if not exists fixado_em timestamptz,
  add column if not exists fixado_por uuid references public.usuarios(id) on delete set null;

create index if not exists comunidade_posts_feed_fixacao_idx
  on public.comunidade_posts (comunidade_id, fixado desc, fixado_em asc, created_at desc)
  where deleted_at is null;

create or replace function public.usuario_pode_moderar_comunidade(p_comunidade_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.comunidades c
    where c.id = p_comunidade_id
      and c.lider_id = auth.uid()
  )
  or exists (
    select 1
    from public.comunidade_membros cm
    where cm.comunidade_id = p_comunidade_id
      and cm.usuario_id = auth.uid()
      and cm.cargo in ('lider', 'admin')
  );
$$;

revoke all on function public.usuario_pode_moderar_comunidade(uuid) from public;
grant execute on function public.usuario_pode_moderar_comunidade(uuid) to authenticated;

create or replace function public.proteger_fixacao_post_comunidade()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.fixado is distinct from new.fixado
    or old.fixado_em is distinct from new.fixado_em
    or old.fixado_por is distinct from new.fixado_por
  then
    if auth.uid() is null and current_user in ('postgres', 'service_role', 'supabase_admin') then
      return new;
    end if;

    if not public.usuario_pode_moderar_comunidade(old.comunidade_id) then
      raise exception 'Apenas lideres e administradores podem alterar a fixacao de posts.'
        using errcode = '42501';
    end if;

    if new.fixado then
      new.fixado_em := coalesce(new.fixado_em, now());
      new.fixado_por := coalesce(new.fixado_por, auth.uid());
    else
      new.fixado_em := null;
      new.fixado_por := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_fixacao_post_comunidade on public.comunidade_posts;

create trigger proteger_fixacao_post_comunidade
before update of fixado, fixado_em, fixado_por on public.comunidade_posts
for each row
execute function public.proteger_fixacao_post_comunidade();

create or replace function public.alterar_fixacao_post_comunidade(
  p_post_id uuid,
  p_fixado boolean
)
returns public.comunidade_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post public.comunidade_posts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado obrigatorio.'
      using errcode = '42501';
  end if;

  select *
    into v_post
  from public.comunidade_posts
  where id = p_post_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Post nao encontrado.'
      using errcode = 'P0002';
  end if;

  if not public.usuario_pode_moderar_comunidade(v_post.comunidade_id) then
    raise exception 'Apenas lideres e administradores podem fixar posts.'
      using errcode = '42501';
  end if;

  update public.comunidade_posts
  set
    fixado = coalesce(p_fixado, false),
    fixado_em = case
      when coalesce(p_fixado, false) then coalesce(v_post.fixado_em, now())
      else null
    end,
    fixado_por = case
      when coalesce(p_fixado, false) then coalesce(v_post.fixado_por, v_user_id)
      else null
    end,
    updated_at = now()
  where id = p_post_id
  returning * into v_post;

  return v_post;
end;
$$;

revoke all on function public.alterar_fixacao_post_comunidade(uuid, boolean) from public;
grant execute on function public.alterar_fixacao_post_comunidade(uuid, boolean) to authenticated;
