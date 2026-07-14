-- Runtime objects reconstructed from read-only introspection of the linked project.
--
-- This migration intentionally runs after the catalog migrations because some of
-- the functions below delete or reference tables introduced by those migrations.
-- It does not introduce new behavior: function bodies, triggers, indexes and
-- grants mirror the linked project at the time of reconciliation.

-- Community membership, moderation and interaction RPCs.
CREATE OR REPLACE FUNCTION public.alterar_cargo_membro(p_comunidade_id uuid, p_usuario_id uuid, p_cargo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not private.is_comunidade_lider(p_comunidade_id, auth.uid()) then
    raise exception 'Apenas o lider pode alterar cargos.';
  end if;

  if p_usuario_id = auth.uid() then
    raise exception 'O lider nao pode alterar o proprio cargo por esta acao.';
  end if;

  update public.comunidade_membros
  set cargo = case
        when p_cargo = 'admin' then 'admin'::public.comunidade_cargo
        else 'membro'::public.comunidade_cargo
      end,
      atualizado_em = now()
  where comunidade_id = p_comunidade_id
    and usuario_id = p_usuario_id
    and cargo <> 'lider';
end;
$function$;

CREATE OR REPLACE FUNCTION public.alterar_fixacao_post_comunidade(p_post_id uuid, p_fixado boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_post record;
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select post.id, post.comunidade_id
    into v_post
  from public.comunidade_posts post
  where post.id = p_post_id
    and post.deleted_at is null;

  if not found then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  if not public.usuario_pode_moderar_comunidade(v_post.comunidade_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if coalesce(p_fixado, false) then
    update public.comunidade_posts
    set
      fixado = true,
      fixado_em = now(),
      fixado_por = v_usuario_id
    where id = p_post_id;
  else
    update public.comunidade_posts
    set
      fixado = false,
      fixado_em = null,
      fixado_por = null
    where id = p_post_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.alterar_permissao_postagem(p_comunidade_id uuid, p_permissao comunidade_permissao_postagem)
 RETURNS comunidades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_comunidade public.comunidades;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not private.is_comunidade_moderador(p_comunidade_id, v_user_id) then
    raise exception 'moderator_required';
  end if;

  update public.comunidades
    set permissao_postagem = p_permissao
    where id = p_comunidade_id
      and deleted_at is null
    returning * into v_comunidade;

  if v_comunidade.id is null then
    raise exception 'community_not_found';
  end if;

  return v_comunidade;
end;
$function$;

CREATE OR REPLACE FUNCTION public.alterar_permissao_postagem(p_comunidade_id uuid, p_permissao text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not private.is_comunidade_moderador(p_comunidade_id, auth.uid()) then
    raise exception 'Apenas lideres e administradores podem alterar quem posta.';
  end if;

  update public.comunidades
  set permissao_postagem = case p_permissao
      when 'somente_admins' then 'somente_admins'::public.comunidade_permissao_postagem
      when 'somente_lider' then 'somente_lider'::public.comunidade_permissao_postagem
      else 'todos_membros'::public.comunidade_permissao_postagem
    end,
    updated_at = now()
  where id = p_comunidade_id
    and deleted_at is null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.alternar_post_salvo(p_post_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_post record;
  v_exists boolean;
begin
  select id, comunidade_id
  into v_post
  from public.comunidade_posts
  where id = p_post_id
    and deleted_at is null;

  if v_user_id is null or v_post.id is null or not private.is_comunidade_membro(v_post.comunidade_id, v_user_id) then
    raise exception 'Apenas membros podem salvar posts.';
  end if;

  select exists (
    select 1 from public.comunidade_post_salvos
    where post_id = p_post_id and usuario_id = v_user_id
  ) into v_exists;

  if v_exists then
    delete from public.comunidade_post_salvos
    where post_id = p_post_id and usuario_id = v_user_id;
    return false;
  end if;

  insert into public.comunidade_post_salvos (post_id, usuario_id)
  values (p_post_id, v_user_id)
  on conflict (post_id, usuario_id) do nothing;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.alternar_reacao_post(p_post_id uuid, p_tipo text)
 RETURNS TABLE(curtidas_count integer, dislikes_count integer, reacao_atual text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_post record;
  v_current text;
begin
  select id, comunidade_id
  into v_post
  from public.comunidade_posts
  where id = p_post_id
    and deleted_at is null;

  if v_user_id is null or v_post.id is null or not private.is_comunidade_membro(v_post.comunidade_id, v_user_id) then
    raise exception 'Apenas membros podem reagir.';
  end if;

  select tipo::text into v_current
  from public.comunidade_post_reacoes
  where post_id = p_post_id
    and usuario_id = v_user_id;

  if v_current = p_tipo then
    delete from public.comunidade_post_reacoes
    where post_id = p_post_id
      and usuario_id = v_user_id;
  else
    insert into public.comunidade_post_reacoes (post_id, usuario_id, tipo)
    values (
      p_post_id,
      v_user_id,
      case
        when p_tipo = 'dislike' then 'dislike'::public.comunidade_reacao_tipo
        else 'curtida'::public.comunidade_reacao_tipo
      end
    )
    on conflict (post_id, usuario_id)
    do update set tipo = excluded.tipo;
  end if;

  return query
  select p.curtidas_count::integer,
         p.dislikes_count::integer,
         r.tipo::text
  from public.comunidade_posts p
  left join public.comunidade_post_reacoes r
    on r.post_id = p.id and r.usuario_id = v_user_id
  where p.id = p_post_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_comunidade(p_solicitacao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_solicitacao public.comunidade_solicitacoes_entrada;
begin
  select *
  into v_solicitacao
  from public.comunidade_solicitacoes_entrada
  where id = p_solicitacao_id
    and status = 'pendente'
  for update;

  if v_solicitacao.id is null then
    raise exception 'Solicitacao nao encontrada.';
  end if;

  if not private.is_comunidade_moderador(v_solicitacao.comunidade_id, auth.uid()) then
    raise exception 'Apenas lideres e administradores podem aprovar solicitacoes.';
  end if;

  insert into public.comunidade_membros (comunidade_id, usuario_id, cargo)
  values (v_solicitacao.comunidade_id, v_solicitacao.usuario_id, 'membro')
  on conflict (comunidade_id, usuario_id) do nothing;

  update public.comunidade_solicitacoes_entrada
  set status = 'aprovada',
      decidido_por = auth.uid(),
      decidido_em = now()
  where id = p_solicitacao_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.atualizar_status_denuncia_comunidade(p_denuncia_id uuid, p_status comunidade_denuncia_status)
 RETURNS comunidade_denuncias
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_denuncia public.comunidade_denuncias;
begin
  select *
  into v_denuncia
  from public.comunidade_denuncias
  where id = p_denuncia_id;

  if v_denuncia.id is null then
    raise exception 'Denuncia nao encontrada.';
  end if;

  if not private.is_comunidade_moderador(v_denuncia.comunidade_id, auth.uid()) then
    raise exception 'Apenas lideres e administradores podem atualizar denuncias.';
  end if;

  update public.comunidade_denuncias
  set status = p_status,
      updated_at = now()
  where id = p_denuncia_id
  returning * into v_denuncia;

  return v_denuncia;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_solicitacao_comunidade(p_solicitacao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.comunidade_solicitacoes_entrada
  set status = 'cancelada',
      decidido_em = now(),
      decidido_por = auth.uid()
  where id = p_solicitacao_id
    and usuario_id = auth.uid()
    and status = 'pendente';
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_comentario_comunidade(p_post_id uuid, p_texto text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_post record;
  v_comentario_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado e obrigatorio.';
  end if;

  if length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'Informe um comentario.';
  end if;

  select id, comunidade_id
  into v_post
  from public.comunidade_posts
  where id = p_post_id
    and deleted_at is null;

  if v_post.id is null then
    raise exception 'Post nao encontrado.';
  end if;

  if not private.is_comunidade_membro(v_post.comunidade_id, v_user_id) then
    raise exception 'Apenas membros podem comentar.';
  end if;

  insert into public.comunidade_post_comentarios (post_id, comunidade_id, autor_id, texto)
  values (p_post_id, v_post.comunidade_id, v_user_id, trim(p_texto))
  returning id into v_comentario_id;

  return v_comentario_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_comunidade(p_nome text, p_descricao text DEFAULT NULL::text, p_banner_path text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_jogo_id bigint DEFAULT NULL::bigint, p_categoria text DEFAULT NULL::text, p_regras text DEFAULT NULL::text, p_permissao_postagem text DEFAULT 'todos_membros'::text, p_visibilidade comunidade_visibilidade DEFAULT 'publica'::comunidade_visibilidade)
 RETURNS comunidades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_comunidade public.comunidades;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado e obrigatorio.';
  end if;

  if length(trim(coalesce(p_nome, ''))) < 3 then
    raise exception 'Informe um nome com pelo menos 3 caracteres.';
  end if;

  insert into public.comunidades (
    nome,
    descricao,
    banner_path,
    tipo,
    jogo_id,
    categoria,
    regras,
    permissao_postagem,
    visibilidade,
    lider_id
  )
  values (
    trim(p_nome),
    nullif(trim(coalesce(p_descricao, '')), ''),
    nullif(trim(coalesce(p_banner_path, '')), ''),
    nullif(trim(coalesce(p_tipo, '')), ''),
    p_jogo_id,
    nullif(trim(coalesce(p_categoria, '')), ''),
    nullif(trim(coalesce(p_regras, '')), ''),
    case p_permissao_postagem
      when 'somente_admins' then 'somente_admins'::public.comunidade_permissao_postagem
      when 'somente_lider' then 'somente_lider'::public.comunidade_permissao_postagem
      else 'todos_membros'::public.comunidade_permissao_postagem
    end,
    coalesce(p_visibilidade, 'publica'),
    v_user_id
  )
  returning * into v_comunidade;

  insert into public.comunidade_membros (comunidade_id, usuario_id, cargo)
  values (v_comunidade.id, v_user_id, 'lider')
  on conflict (comunidade_id, usuario_id) do update
    set cargo = 'lider',
        atualizado_em = now();

  return v_comunidade;
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_comunidade(p_nome text, p_descricao text DEFAULT NULL::text, p_banner_path text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_jogo_id integer DEFAULT NULL::integer, p_categoria text DEFAULT NULL::text, p_regras text DEFAULT NULL::text, p_permissao_postagem comunidade_permissao_postagem DEFAULT 'todos_membros'::comunidade_permissao_postagem)
 RETURNS comunidades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_comunidade public.comunidades;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.comunidades (
    nome,
    descricao,
    banner_path,
    tipo,
    jogo_id,
    categoria,
    regras,
    permissao_postagem,
    lider_id
  )
  values (
    btrim(p_nome),
    nullif(btrim(coalesce(p_descricao, '')), ''),
    nullif(btrim(coalesce(p_banner_path, '')), ''),
    nullif(btrim(coalesce(p_tipo, '')), ''),
    p_jogo_id,
    nullif(btrim(coalesce(p_categoria, '')), ''),
    nullif(btrim(coalesce(p_regras, '')), ''),
    coalesce(p_permissao_postagem, 'todos_membros'),
    v_user_id
  )
  returning * into v_comunidade;

  insert into public.comunidade_membros (comunidade_id, usuario_id, cargo)
  values (v_comunidade.id, v_user_id, 'lider');

  select * into v_comunidade from public.comunidades where id = v_comunidade.id;
  return v_comunidade;
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_denuncia_comunidade(p_comunidade_id uuid, p_tipo_conteudo comunidade_denuncia_tipo, p_conteudo_id uuid, p_motivo comunidade_denuncia_motivo, p_descricao text DEFAULT NULL::text)
 RETURNS comunidade_denuncias
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_denuncia public.comunidade_denuncias;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado e obrigatorio.';
  end if;

  if not private.is_comunidade_membro(p_comunidade_id, v_user_id) then
    raise exception 'Apenas membros podem denunciar conteudos desta comunidade.';
  end if;

  if p_tipo_conteudo = 'post' then
    if not exists (
      select 1 from public.comunidade_posts
      where id = p_conteudo_id
        and comunidade_id = p_comunidade_id
        and deleted_at is null
    ) then
      raise exception 'Post nao encontrado.';
    end if;

    insert into public.comunidade_denuncias (
      comunidade_id,
      denunciante_id,
      tipo_conteudo,
      post_id,
      motivo,
      descricao
    )
    values (
      p_comunidade_id,
      v_user_id,
      'post',
      p_conteudo_id,
      p_motivo,
      nullif(trim(coalesce(p_descricao, '')), '')
    )
    on conflict (denunciante_id, post_id) where tipo_conteudo = 'post' and post_id is not null
    do update set updated_at = public.comunidade_denuncias.updated_at
    returning * into v_denuncia;
  else
    if not exists (
      select 1 from public.comunidade_post_comentarios
      where id = p_conteudo_id
        and comunidade_id = p_comunidade_id
        and deleted_at is null
    ) then
      raise exception 'Comentario nao encontrado.';
    end if;

    insert into public.comunidade_denuncias (
      comunidade_id,
      denunciante_id,
      tipo_conteudo,
      comentario_id,
      motivo,
      descricao
    )
    values (
      p_comunidade_id,
      v_user_id,
      'comentario',
      p_conteudo_id,
      p_motivo,
      nullif(trim(coalesce(p_descricao, '')), '')
    )
    on conflict (denunciante_id, comentario_id) where tipo_conteudo = 'comentario' and comentario_id is not null
    do update set updated_at = public.comunidade_denuncias.updated_at
    returning * into v_denuncia;
  end if;

  return v_denuncia;
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_post_comunidade(p_comunidade_id uuid, p_texto text DEFAULT NULL::text, p_imagem_path text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_cargo text;
  v_permissao text;
  v_post_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado e obrigatorio.';
  end if;

  if nullif(trim(coalesce(p_texto, '')), '') is null and nullif(trim(coalesce(p_imagem_path, '')), '') is null then
    raise exception 'Informe texto ou imagem para publicar.';
  end if;

  select private.get_comunidade_cargo(p_comunidade_id, v_user_id), c.permissao_postagem::text
  into v_cargo, v_permissao
  from public.comunidades c
  where c.id = p_comunidade_id
    and c.deleted_at is null;

  if v_cargo is null then
    raise exception 'Apenas membros podem publicar.';
  end if;

  if v_permissao = 'somente_lider' and v_cargo <> 'lider' then
    raise exception 'Apenas o lider pode publicar nesta comunidade.';
  end if;

  if v_permissao = 'somente_admins' and v_cargo not in ('lider', 'admin') then
    raise exception 'Apenas lideres e administradores podem publicar nesta comunidade.';
  end if;

  insert into public.comunidade_posts (comunidade_id, autor_id, texto, imagem_path)
  values (
    p_comunidade_id,
    v_user_id,
    nullif(trim(coalesce(p_texto, '')), ''),
    nullif(trim(coalesce(p_imagem_path, '')), '')
  )
  returning id into v_post_id;

  return v_post_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.editar_comunidade(p_comunidade_id uuid, p_nome text, p_descricao text DEFAULT NULL::text, p_banner_path text DEFAULT NULL::text, p_tipo text DEFAULT NULL::text, p_jogo_id bigint DEFAULT NULL::bigint, p_categoria text DEFAULT NULL::text, p_regras text DEFAULT NULL::text, p_visibilidade comunidade_visibilidade DEFAULT NULL::comunidade_visibilidade)
 RETURNS comunidades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_comunidade public.comunidades;
begin
  if not private.is_comunidade_lider(p_comunidade_id, auth.uid()) then
    raise exception 'Apenas o lider pode editar todas as informacoes da comunidade.';
  end if;

  update public.comunidades
  set nome = trim(p_nome),
      descricao = nullif(trim(coalesce(p_descricao, '')), ''),
      banner_path = nullif(trim(coalesce(p_banner_path, '')), ''),
      tipo = nullif(trim(coalesce(p_tipo, '')), ''),
      jogo_id = p_jogo_id,
      categoria = nullif(trim(coalesce(p_categoria, '')), ''),
      regras = nullif(trim(coalesce(p_regras, '')), ''),
      visibilidade = coalesce(p_visibilidade, visibilidade),
      updated_at = now()
  where id = p_comunidade_id
    and deleted_at is null
  returning * into v_comunidade;

  if v_comunidade.id is null then
    raise exception 'Comunidade nao encontrada.';
  end if;

  return v_comunidade;
end;
$function$;

CREATE OR REPLACE FUNCTION public.editar_comunidade_moderavel(p_comunidade_id uuid, p_descricao text DEFAULT NULL::text, p_banner_path text DEFAULT NULL::text, p_regras text DEFAULT NULL::text)
 RETURNS comunidades
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_comunidade public.comunidades;
begin
  if not private.is_comunidade_moderador(p_comunidade_id, auth.uid()) then
    raise exception 'Apenas lideres e administradores podem editar estes dados.';
  end if;

  update public.comunidades
  set descricao = nullif(trim(coalesce(p_descricao, '')), ''),
      banner_path = nullif(trim(coalesce(p_banner_path, '')), ''),
      regras = nullif(trim(coalesce(p_regras, '')), ''),
      updated_at = now()
  where id = p_comunidade_id
    and deleted_at is null
  returning * into v_comunidade;

  if v_comunidade.id is null then
    raise exception 'Comunidade nao encontrada.';
  end if;

  return v_comunidade;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_community_creation_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  active_filter text := '';
  owned_count integer := 0;
begin
  if new.lider_id is null then
    return new;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comunidades'
      and column_name = 'deleted_at'
  ) then
    active_filter := 'and c.deleted_at is null';
  end if;

  execute format(
    'select count(*)::integer from public.comunidades c where c.lider_id = $1 %s',
    active_filter
  )
  into owned_count
  using new.lider_id;

  if owned_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'SG_COMMUNITY_LIMIT_REACHED',
      detail = 'The authenticated profile has reached the limit of 3 created communities.',
      hint = 'Delete an existing community before creating a new one.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.entrar_comunidade(p_comunidade_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_visibilidade public.comunidade_visibilidade;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado e obrigatorio.';
  end if;

  select visibilidade
  into v_visibilidade
  from public.comunidades
  where id = p_comunidade_id
    and deleted_at is null;

  if v_visibilidade is null then
    raise exception 'Comunidade nao encontrada.';
  end if;

  if private.is_comunidade_membro(p_comunidade_id, v_user_id) then
    return 'already_member';
  end if;

  if v_visibilidade = 'privada' then
    insert into public.comunidade_solicitacoes_entrada (comunidade_id, usuario_id, status)
    values (p_comunidade_id, v_user_id, 'pendente')
    on conflict (comunidade_id, usuario_id) where status = 'pendente'
    do update set updated_at = now();

    return 'requested';
  end if;

  insert into public.comunidade_membros (comunidade_id, usuario_id, cargo)
  values (p_comunidade_id, v_user_id, 'membro')
  on conflict (comunidade_id, usuario_id) do nothing;

  return 'joined';
end;
$function$;

CREATE OR REPLACE FUNCTION public.excluir_comentario_comunidade(p_comentario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_comentario record;
begin
  select id, comunidade_id, autor_id
  into v_comentario
  from public.comunidade_post_comentarios
  where id = p_comentario_id
    and deleted_at is null;

  if v_comentario.id is null then
    return;
  end if;

  if v_comentario.autor_id <> auth.uid() and not private.is_comunidade_moderador(v_comentario.comunidade_id, auth.uid()) then
    raise exception 'Sem permissao para excluir este comentario.';
  end if;

  update public.comunidade_post_comentarios
  set deleted_at = now(),
      updated_at = now()
  where id = p_comentario_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.excluir_post_comunidade(p_post_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_post record;
begin
  select id, comunidade_id, autor_id
  into v_post
  from public.comunidade_posts
  where id = p_post_id
    and deleted_at is null;

  if v_post.id is null then
    return;
  end if;

  if v_post.autor_id <> auth.uid() and not private.is_comunidade_moderador(v_post.comunidade_id, auth.uid()) then
    raise exception 'Sem permissao para excluir este post.';
  end if;

  update public.comunidade_posts
  set deleted_at = now(),
      updated_at = now()
  where id = p_post_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.expulsar_membro(p_comunidade_id uuid, p_usuario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not private.is_comunidade_moderador(p_comunidade_id, auth.uid()) then
    raise exception 'Apenas lideres e administradores podem expulsar membros.';
  end if;

  delete from public.comunidade_membros
  where comunidade_id = p_comunidade_id
    and usuario_id = p_usuario_id
    and cargo = 'membro';
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_community_creation_quota()
 RETURNS TABLE(created_count integer, limit_count integer, remaining_count integer, can_create boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_user_id uuid := auth.uid();
  active_filter text := '';
  owned_count integer := 0;
begin
  if current_user_id is null then
    return query select 0, 3, 0, false;
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comunidades'
      and column_name = 'deleted_at'
  ) then
    active_filter := 'and c.deleted_at is null';
  end if;

  execute format(
    'select count(*)::integer from public.comunidades c where c.lider_id = $1 %s',
    active_filter
  )
  into owned_count
  using current_user_id;

  return query
    select
      owned_count,
      3,
      greatest(3 - owned_count, 0),
      owned_count < 3;
end;
$function$;

CREATE OR REPLACE FUNCTION public.proteger_fixacao_post_comunidade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.fixado is distinct from old.fixado
    or new.fixado_em is distinct from old.fixado_em
    or new.fixado_por is distinct from old.fixado_por then
    if auth.uid() is null or not public.usuario_pode_moderar_comunidade(old.comunidade_id) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recusar_solicitacao_comunidade(p_solicitacao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_solicitacao public.comunidade_solicitacoes_entrada;
begin
  select *
  into v_solicitacao
  from public.comunidade_solicitacoes_entrada
  where id = p_solicitacao_id
    and status = 'pendente'
  for update;

  if v_solicitacao.id is null then
    raise exception 'Solicitacao nao encontrada.';
  end if;

  if not private.is_comunidade_moderador(v_solicitacao.comunidade_id, auth.uid()) then
    raise exception 'Apenas lideres e administradores podem recusar solicitacoes.';
  end if;

  update public.comunidade_solicitacoes_entrada
  set status = 'recusada',
      decidido_por = auth.uid(),
      decidido_em = now()
  where id = p_solicitacao_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sair_comunidade(p_comunidade_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_cargo text;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado e obrigatorio.';
  end if;

  select private.get_comunidade_cargo(p_comunidade_id, v_user_id)
  into v_cargo;

  if v_cargo = 'lider' then
    raise exception 'Transfira a lideranca antes de sair da comunidade.';
  end if;

  delete from public.comunidade_membros
  where comunidade_id = p_comunidade_id
    and usuario_id = v_user_id
    and cargo <> 'lider';

  update public.comunidade_solicitacoes_entrada
  set status = 'cancelada',
      decidido_por = v_user_id,
      decidido_em = now()
  where comunidade_id = p_comunidade_id
    and usuario_id = v_user_id
    and status = 'pendente';
end;
$function$;

CREATE OR REPLACE FUNCTION public.solicitar_entrada_comunidade(p_comunidade_id uuid)
 RETURNS comunidade_solicitacoes_entrada
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_solicitacao public.comunidade_solicitacoes_entrada;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado e obrigatorio.';
  end if;

  if private.is_comunidade_membro(p_comunidade_id, v_user_id) then
    raise exception 'Voce ja participa desta comunidade.';
  end if;

  insert into public.comunidade_solicitacoes_entrada (comunidade_id, usuario_id, status)
  values (p_comunidade_id, v_user_id, 'pendente')
  on conflict (comunidade_id, usuario_id) where status = 'pendente'
  do update set updated_at = now()
  returning * into v_solicitacao;

  return v_solicitacao;
end;
$function$;

CREATE OR REPLACE FUNCTION public.transferir_lideranca(p_comunidade_id uuid, p_novo_lider_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lider_atual uuid := auth.uid();
begin
  if not private.is_comunidade_lider(p_comunidade_id, v_lider_atual) then
    raise exception 'Apenas o lider pode transferir lideranca.';
  end if;

  if not private.is_comunidade_membro(p_comunidade_id, p_novo_lider_id) then
    raise exception 'O novo lider precisa ser membro da comunidade.';
  end if;

  update public.comunidade_membros
  set cargo = 'admin',
      atualizado_em = now()
  where comunidade_id = p_comunidade_id
    and usuario_id = v_lider_atual;

  update public.comunidade_membros
  set cargo = 'lider',
      atualizado_em = now()
  where comunidade_id = p_comunidade_id
    and usuario_id = p_novo_lider_id;

  update public.comunidades
  set lider_id = p_novo_lider_id,
      updated_at = now()
  where id = p_comunidade_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.usuario_pode_moderar_comunidade(p_comunidade_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.comunidades comunidade
    where comunidade.id = p_comunidade_id
      and comunidade.lider_id = auth.uid()
  )
  or exists (
    select 1
    from public.comunidade_membros membro
    where membro.comunidade_id = p_comunidade_id
      and membro.usuario_id = auth.uid()
      and membro.cargo in ('lider', 'admin')
  );
$function$;

-- Notification creation, fan-out and read-state functions.
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_actor_id uuid, p_type text, p_title text, p_message text DEFAULT NULL::text, p_entity_type text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_link text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_dedupe_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_notification_id uuid;
begin
  if p_user_id is null or p_type is null or p_title is null then
    return null;
  end if;

  if p_actor_id is not null and p_actor_id = p_user_id then
    return null;
  end if;

  if p_dedupe_key is not null then
    select id
      into v_notification_id
      from public.notifications
      where user_id = p_user_id
        and dedupe_key = p_dedupe_key
      limit 1;

    if v_notification_id is not null then
      return v_notification_id;
    end if;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    title,
    message,
    entity_type,
    entity_id,
    link,
    metadata,
    dedupe_key
  )
  values (
    p_user_id,
    p_actor_id,
    p_type,
    p_title,
    p_message,
    p_entity_type,
    p_entity_id,
    p_link,
    coalesce(p_metadata, '{}'::jsonb),
    p_dedupe_key
  )
  returning id into v_notification_id;

  return v_notification_id;
exception
  when unique_violation then
    select id
      into v_notification_id
      from public.notifications
      where user_id = p_user_id
        and dedupe_key = p_dedupe_key
      limit 1;

    return v_notification_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_comment_like_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_comment_author_id uuid;
  v_review_id uuid;
  v_game_id integer;
  v_game_title text;
  v_actor_username text;
begin
  select c.usuario_id, c.review_id, a.jogo_id, j.titulo
    into v_comment_author_id, v_review_id, v_game_id, v_game_title
    from public.comentarios c
    left join public.avaliacoes a on a.id = c.review_id
    left join public.jogos j on j.id = a.jogo_id
    where c.id = new.comentario_id;

  select username
    into v_actor_username
    from public.usuarios
    where id = new.usuario_id;

  perform public.create_notification(
    v_comment_author_id,
    new.usuario_id,
    'comment_liked',
    'Seu comentario recebeu uma curtida',
    '@' || coalesce(v_actor_username, 'usuario') || ' curtiu seu comentario' ||
      case when v_game_title is not null then ' em ' || v_game_title else '' end || '.',
    'comment',
    new.comentario_id::text,
    case when v_game_id is not null then '/games/' || v_game_id::text || '#comment-' || new.comentario_id::text else null end,
    jsonb_build_object('comment_id', new.comentario_id, 'review_id', v_review_id, 'game_id', v_game_id, 'game_title', v_game_title),
    'comment_liked:' || new.comentario_id::text || ':' || new.usuario_id::text
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_community_member_removed_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_community_name text;
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null or v_actor_id = old.usuario_id then
    return old;
  end if;

  select nome
    into v_community_name
    from public.comunidades
    where id = old.comunidade_id;

  perform public.create_notification(
    old.usuario_id,
    v_actor_id,
    'community_member_removed',
    'Voce foi removido de uma comunidade',
    'Voce foi removido de ' || coalesce(v_community_name, 'uma comunidade') || '.',
    'community',
    old.comunidade_id::text,
    '/comunidades/' || old.comunidade_id::text,
    jsonb_build_object('community_id', old.comunidade_id, 'community_name', v_community_name),
    'community_member_removed:' || old.comunidade_id::text || ':' || old.usuario_id::text || ':' || extract(epoch from now())::text
  );

  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_community_member_role_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_community_name text;
  v_actor_id uuid;
begin
  if old.cargo is not distinct from new.cargo then
    return new;
  end if;

  v_actor_id := auth.uid();

  select nome
    into v_community_name
    from public.comunidades
    where id = new.comunidade_id;

  perform public.create_notification(
    new.usuario_id,
    v_actor_id,
    'community_role_changed',
    'Cargo alterado na comunidade',
    'Seu cargo em ' || coalesce(v_community_name, 'uma comunidade') || ' agora e ' || new.cargo || '.',
    'community',
    new.comunidade_id::text,
    '/comunidades/' || new.comunidade_id::text,
    jsonb_build_object('community_id', new.comunidade_id, 'community_name', v_community_name, 'role', new.cargo, 'previous_role', old.cargo),
    'community_role_changed:' || new.comunidade_id::text || ':' || new.usuario_id::text || ':' || new.cargo || ':' || extract(epoch from now())::text
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_community_post_comment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_post_author_id uuid;
  v_community_name text;
  v_actor_username text;
begin
  select p.autor_id, c.nome
    into v_post_author_id, v_community_name
    from public.comunidade_posts p
    left join public.comunidades c on c.id = p.comunidade_id
    where p.id = new.post_id;

  select username
    into v_actor_username
    from public.usuarios
    where id = new.autor_id;

  perform public.create_notification(
    v_post_author_id,
    new.autor_id,
    'community_post_commented',
    'Novo comentario no seu post',
    '@' || coalesce(v_actor_username, 'usuario') || ' comentou no seu post' ||
      case when v_community_name is not null then ' em ' || v_community_name else '' end || '.',
    'community_comment',
    new.id::text,
    '/comunidades/' || new.comunidade_id::text || '#community-comment-' || new.id::text,
    jsonb_build_object('comment_id', new.id, 'post_id', new.post_id, 'community_id', new.comunidade_id, 'community_name', v_community_name),
    'community_post_commented:' || new.id::text
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_community_post_like_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_post_author_id uuid;
  v_community_id uuid;
  v_community_name text;
  v_actor_username text;
begin
  if new.tipo <> 'curtida' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.tipo is not distinct from new.tipo then
    return new;
  end if;

  select p.autor_id, p.comunidade_id, c.nome
    into v_post_author_id, v_community_id, v_community_name
    from public.comunidade_posts p
    left join public.comunidades c on c.id = p.comunidade_id
    where p.id = new.post_id;

  select username
    into v_actor_username
    from public.usuarios
    where id = new.usuario_id;

  perform public.create_notification(
    v_post_author_id,
    new.usuario_id,
    'community_post_liked',
    'Seu post recebeu uma curtida',
    '@' || coalesce(v_actor_username, 'usuario') || ' curtiu seu post' ||
      case when v_community_name is not null then ' em ' || v_community_name else '' end || '.',
    'community_post',
    new.post_id::text,
    case when v_community_id is not null then '/comunidades/' || v_community_id::text || '#post-' || new.post_id::text else null end,
    jsonb_build_object('post_id', new.post_id, 'community_id', v_community_id, 'community_name', v_community_name),
    'community_post_liked:' || new.post_id::text || ':' || new.usuario_id::text
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_follower_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_username text;
begin
  select username
    into v_actor_username
    from public.usuarios
    where id = new.seguidor_id;

  perform public.create_notification(
    new.seguido_id,
    new.seguidor_id,
    'new_follower',
    'Novo seguidor',
    '@' || coalesce(v_actor_username, 'usuario') || ' comecou a seguir voce.',
    'user',
    new.seguidor_id::text,
    case when v_actor_username is not null then '/u/' || v_actor_username else null end,
    jsonb_build_object('follower_id', new.seguidor_id),
    'new_follower:' || new.seguidor_id::text
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_private_community_accepted_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_community_name text;
begin
  if new.status <> 'aprovada' or old.status is not distinct from new.status then
    return new;
  end if;

  select nome
    into v_community_name
    from public.comunidades
    where id = new.comunidade_id;

  perform public.create_notification(
    new.usuario_id,
    new.decidido_por,
    'private_community_accepted',
    'Solicitacao aceita',
    'Sua entrada na comunidade ' || coalesce(v_community_name, 'privada') || ' foi aprovada.',
    'community',
    new.comunidade_id::text,
    '/comunidades/' || new.comunidade_id::text,
    jsonb_build_object('community_id', new.comunidade_id, 'community_name', v_community_name, 'join_request_id', new.id),
    'private_community_accepted:' || new.id::text
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_review_comment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_review_author_id uuid;
  v_game_id integer;
  v_game_title text;
  v_actor_username text;
begin
  select a.usuario_id, a.jogo_id, j.titulo
    into v_review_author_id, v_game_id, v_game_title
    from public.avaliacoes a
    left join public.jogos j on j.id = a.jogo_id
    where a.id = new.review_id;

  select username
    into v_actor_username
    from public.usuarios
    where id = new.usuario_id;

  perform public.create_notification(
    v_review_author_id,
    new.usuario_id,
    'review_commented',
    'Novo comentario na sua review',
    '@' || coalesce(v_actor_username, 'usuario') || ' comentou na sua review' ||
      case when v_game_title is not null then ' de ' || v_game_title else '' end || '.',
    'comment',
    new.id::text,
    case when v_game_id is not null then '/games/' || v_game_id::text || '#comment-' || new.id::text else null end,
    jsonb_build_object('comment_id', new.id, 'review_id', new.review_id, 'game_id', v_game_id, 'game_title', v_game_title),
    'review_commented:' || new.id::text
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_review_like_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_review_author_id uuid;
  v_game_id integer;
  v_game_title text;
  v_actor_username text;
begin
  select a.usuario_id, a.jogo_id, j.titulo
    into v_review_author_id, v_game_id, v_game_title
    from public.avaliacoes a
    left join public.jogos j on j.id = a.jogo_id
    where a.id = new.avaliacao_id;

  select username
    into v_actor_username
    from public.usuarios
    where id = new.usuario_id;

  perform public.create_notification(
    v_review_author_id,
    new.usuario_id,
    'review_liked',
    'Sua review recebeu uma curtida',
    '@' || coalesce(v_actor_username, 'usuario') || ' curtiu sua review' ||
      case when v_game_title is not null then ' de ' || v_game_title else '' end || '.',
    'review',
    new.avaliacao_id::text,
    case when v_game_id is not null then '/games/' || v_game_id::text || '#review-' || new.avaliacao_id::text else null end,
    jsonb_build_object('review_id', new.avaliacao_id, 'game_id', v_game_id, 'game_title', v_game_title),
    'review_liked:' || new.avaliacao_id::text || ':' || new.usuario_id::text
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.notifications
     set is_read = true,
         read_at = coalesce(read_at, now())
   where user_id = auth.uid()
     and is_read = false;

  get diagnostics v_count = row_count;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
 RETURNS notifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_notification public.notifications;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.notifications
     set is_read = true,
         read_at = coalesce(read_at, now())
   where id = p_notification_id
     and user_id = auth.uid()
   returning * into v_notification;

  return v_notification;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_review_like_counter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target_review_id uuid;
begin
  target_review_id := coalesce(new.avaliacao_id, old.avaliacao_id);

  update public.avaliacoes
  set curtidas = (
    select count(*)::int
    from public.avaliacao_curtidas
    where avaliacao_id = target_review_id
  )
  where id = target_review_id;

  return coalesce(new, old);
end;
$function$;

-- Account deletion, report metadata and RLS guardrail functions.
CREATE OR REPLACE FUNCTION public.admin_delete_account_data(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owned_community record;
  next_leader_id uuid;
  transferred_at timestamptz;
begin
  if target_user_id is null then
    raise exception 'target_user_id_required' using errcode = '22023';
  end if;

  delete from public.comunidades
  where lider_id = target_user_id
    and deleted_at is not null;

  for owned_community in
    select id, nome
    from public.comunidades
    where lider_id = target_user_id
      and deleted_at is null
    order by created_at asc, id asc
  loop
    next_leader_id := null;

    select cm.usuario_id
    into next_leader_id
    from public.comunidade_membros cm
    where cm.comunidade_id = owned_community.id
      and cm.usuario_id <> target_user_id
      and cm.cargo = 'admin'::public.comunidade_cargo
    order by cm.atualizado_em asc, cm.entrou_em asc, cm.usuario_id asc
    limit 1;

    if next_leader_id is null then
      raise exception 'community_leadership_transfer_required'
        using
          errcode = 'P0001',
          detail = format('Community %s has no admin available to receive leadership.', owned_community.id),
          hint = 'Promote at least one member to admin before deleting the leader account.';
    end if;

    transferred_at := now();

    update public.comunidade_membros
    set cargo = 'lider'::public.comunidade_cargo,
        atualizado_em = transferred_at
    where comunidade_id = owned_community.id
      and usuario_id = next_leader_id;

    update public.comunidades
    set lider_id = next_leader_id,
        updated_at = transferred_at
    where id = owned_community.id;

    delete from public.comunidade_membros
    where comunidade_id = owned_community.id
      and usuario_id = target_user_id;
  end loop;

  if to_regclass('public.denuncias_perfil') is not null then
    execute 'delete from public.denuncias_perfil where denunciante_id = $1 or usuario_denunciado_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.denuncias_conteudo') is not null then
    execute 'delete from public.denuncias_conteudo where denunciante_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.denuncias_conteudo') is not null
     and to_regclass('public.comentarios') is not null then
    execute 'delete from public.denuncias_conteudo dc using public.comentarios c where dc.comentario_id = c.id and c.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.denuncias_conteudo') is not null
     and to_regclass('public.comentarios') is not null
     and to_regclass('public.avaliacoes') is not null then
    execute 'delete from public.denuncias_conteudo dc using public.comentarios c, public.avaliacoes a where dc.comentario_id = c.id and c.review_id = a.id and a.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.denuncias_conteudo') is not null
     and to_regclass('public.avaliacoes') is not null then
    execute 'delete from public.denuncias_conteudo dc using public.avaliacoes a where dc.avaliacao_id = a.id and a.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.comentario_curtidas') is not null then
    execute 'delete from public.comentario_curtidas where usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.comentario_deslikes') is not null then
    execute 'delete from public.comentario_deslikes where usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.comentario_curtidas') is not null
     and to_regclass('public.comentarios') is not null then
    execute 'delete from public.comentario_curtidas cc using public.comentarios c where cc.comentario_id = c.id and c.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.comentario_deslikes') is not null
     and to_regclass('public.comentarios') is not null then
    execute 'delete from public.comentario_deslikes cd using public.comentarios c where cd.comentario_id = c.id and c.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.comentario_curtidas') is not null
     and to_regclass('public.comentarios') is not null
     and to_regclass('public.avaliacoes') is not null then
    execute 'delete from public.comentario_curtidas cc using public.comentarios c, public.avaliacoes a where cc.comentario_id = c.id and c.review_id = a.id and a.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.comentario_deslikes') is not null
     and to_regclass('public.comentarios') is not null
     and to_regclass('public.avaliacoes') is not null then
    execute 'delete from public.comentario_deslikes cd using public.comentarios c, public.avaliacoes a where cd.comentario_id = c.id and c.review_id = a.id and a.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.comentarios') is not null
     and to_regclass('public.avaliacoes') is not null then
    execute 'delete from public.comentarios c using public.avaliacoes a where c.review_id = a.id and a.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.comentarios') is not null then
    execute 'delete from public.comentarios where usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.avaliacao_curtidas') is not null then
    execute 'delete from public.avaliacao_curtidas where usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.avaliacao_deslikes') is not null then
    execute 'delete from public.avaliacao_deslikes where usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.avaliacao_curtidas') is not null
     and to_regclass('public.avaliacoes') is not null then
    execute 'delete from public.avaliacao_curtidas ac using public.avaliacoes a where ac.avaliacao_id = a.id and a.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.avaliacao_deslikes') is not null
     and to_regclass('public.avaliacoes') is not null then
    execute 'delete from public.avaliacao_deslikes ad using public.avaliacoes a where ad.avaliacao_id = a.id and a.usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.avaliacoes') is not null then
    execute 'delete from public.avaliacoes where usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.seguidores') is not null then
    execute 'delete from public.seguidores where seguidor_id = $1 or seguido_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.lista_desejos') is not null then
    execute 'delete from public.lista_desejos where usuario_id = $1'
      using target_user_id;
  end if;

  if to_regclass('public.status_jogo') is not null then
    execute 'delete from public.status_jogo where usuario_id = $1'
      using target_user_id;
  end if;

  delete from public.usuarios
  where id = target_user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'storage'
AS $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.denuncias_perfil
  where denunciante_id = current_user_id
     or usuario_denunciado_id = current_user_id;

  delete from public.denuncias_conteudo
  where denunciante_id = current_user_id;

  delete from public.denuncias_conteudo dc
  using public.comentarios c
  where dc.comentario_id = c.id
    and c.usuario_id = current_user_id;

  delete from public.denuncias_conteudo dc
  using public.comentarios c,
        public.avaliacoes a
  where dc.comentario_id = c.id
    and c.review_id = a.id
    and a.usuario_id = current_user_id;

  delete from public.denuncias_conteudo dc
  using public.avaliacoes a
  where dc.avaliacao_id = a.id
    and a.usuario_id = current_user_id;

  delete from public.comentario_curtidas
  where usuario_id = current_user_id;

  delete from public.comentario_deslikes
  where usuario_id = current_user_id;

  delete from public.comentario_curtidas cc
  using public.comentarios c
  where cc.comentario_id = c.id
    and c.usuario_id = current_user_id;

  delete from public.comentario_deslikes cd
  using public.comentarios c
  where cd.comentario_id = c.id
    and c.usuario_id = current_user_id;

  delete from public.comentario_curtidas cc
  using public.comentarios c,
        public.avaliacoes a
  where cc.comentario_id = c.id
    and c.review_id = a.id
    and a.usuario_id = current_user_id;

  delete from public.comentario_deslikes cd
  using public.comentarios c,
        public.avaliacoes a
  where cd.comentario_id = c.id
    and c.review_id = a.id
    and a.usuario_id = current_user_id;

  delete from public.comentarios c
  using public.avaliacoes a
  where c.review_id = a.id
    and a.usuario_id = current_user_id;

  delete from public.comentarios
  where usuario_id = current_user_id;

  delete from public.avaliacao_curtidas
  where usuario_id = current_user_id;

  delete from public.avaliacao_deslikes
  where usuario_id = current_user_id;

  delete from public.avaliacao_curtidas ac
  using public.avaliacoes a
  where ac.avaliacao_id = a.id
    and a.usuario_id = current_user_id;

  delete from public.avaliacao_deslikes ad
  using public.avaliacoes a
  where ad.avaliacao_id = a.id
    and a.usuario_id = current_user_id;

  delete from public.avaliacoes
  where usuario_id = current_user_id;

  delete from public.seguidores
  where seguidor_id = current_user_id
     or seguido_id = current_user_id;

  delete from public.lista_desejos
  where usuario_id = current_user_id;

  delete from public.status_jogo
  where usuario_id = current_user_id;

  delete from storage.objects
  where bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = current_user_id::text;

  delete from public.usuarios
  where id = current_user_id;

  delete from auth.users
  where id = current_user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.preencher_nome_usuario_denunciado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resolved_display_name text;
begin
  select coalesce(nullif(btrim(nome_completo), ''), username)
    into resolved_display_name
  from public.usuarios
  where id = new.usuario_denunciado_id;

  if resolved_display_name is null then
    raise exception 'Usuario denunciado nao encontrado.'
      using errcode = '23503';
  end if;

  new.nome_usuario_denunciado := resolved_display_name;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- Runtime triggers not owned by earlier migrations.
drop trigger if exists avaliacao_curtidas_review_like_notification on public.avaliacao_curtidas;
CREATE TRIGGER avaliacao_curtidas_review_like_notification AFTER INSERT ON public.avaliacao_curtidas FOR EACH ROW EXECUTE FUNCTION handle_review_like_notification();

drop trigger if exists sync_review_like_counter on public.avaliacao_curtidas;
CREATE TRIGGER sync_review_like_counter AFTER INSERT OR DELETE ON public.avaliacao_curtidas FOR EACH ROW EXECUTE FUNCTION sync_review_like_counter();

drop trigger if exists comentario_curtidas_comment_like_notification on public.comentario_curtidas;
CREATE TRIGGER comentario_curtidas_comment_like_notification AFTER INSERT ON public.comentario_curtidas FOR EACH ROW EXECUTE FUNCTION handle_comment_like_notification();

drop trigger if exists comentarios_review_comment_notification on public.comentarios;
CREATE TRIGGER comentarios_review_comment_notification AFTER INSERT ON public.comentarios FOR EACH ROW EXECUTE FUNCTION handle_review_comment_notification();

drop trigger if exists comunidade_membros_removed_notification on public.comunidade_membros;
CREATE TRIGGER comunidade_membros_removed_notification AFTER DELETE ON public.comunidade_membros FOR EACH ROW EXECUTE FUNCTION handle_community_member_removed_notification();

drop trigger if exists comunidade_membros_role_notification on public.comunidade_membros;
CREATE TRIGGER comunidade_membros_role_notification AFTER UPDATE ON public.comunidade_membros FOR EACH ROW EXECUTE FUNCTION handle_community_member_role_notification();

drop trigger if exists comunidade_post_comentarios_notification on public.comunidade_post_comentarios;
CREATE TRIGGER comunidade_post_comentarios_notification AFTER INSERT ON public.comunidade_post_comentarios FOR EACH ROW EXECUTE FUNCTION handle_community_post_comment_notification();

drop trigger if exists comunidade_post_reacoes_like_notification on public.comunidade_post_reacoes;
CREATE TRIGGER comunidade_post_reacoes_like_notification AFTER INSERT OR UPDATE ON public.comunidade_post_reacoes FOR EACH ROW EXECUTE FUNCTION handle_community_post_like_notification();

drop trigger if exists comunidade_posts_proteger_fixacao_trigger on public.comunidade_posts;
CREATE TRIGGER comunidade_posts_proteger_fixacao_trigger BEFORE UPDATE OF fixado, fixado_em, fixado_por ON public.comunidade_posts FOR EACH ROW EXECUTE FUNCTION proteger_fixacao_post_comunidade();

drop trigger if exists comunidade_solicitacoes_accepted_notification on public.comunidade_solicitacoes_entrada;
CREATE TRIGGER comunidade_solicitacoes_accepted_notification AFTER UPDATE ON public.comunidade_solicitacoes_entrada FOR EACH ROW EXECUTE FUNCTION handle_private_community_accepted_notification();

drop trigger if exists community_creation_limit_before_insert on public.comunidades;
CREATE TRIGGER community_creation_limit_before_insert BEFORE INSERT ON public.comunidades FOR EACH ROW EXECUTE FUNCTION enforce_community_creation_limit();

drop trigger if exists comunidades_set_updated_at on public.comunidades;
CREATE TRIGGER comunidades_set_updated_at BEFORE UPDATE ON public.comunidades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists preencher_nome_usuario_denunciado_before_insert on public.denuncias_perfil;
CREATE TRIGGER preencher_nome_usuario_denunciado_before_insert BEFORE INSERT ON public.denuncias_perfil FOR EACH ROW EXECUTE FUNCTION preencher_nome_usuario_denunciado();

drop trigger if exists seguidores_new_follower_notification on public.seguidores;
CREATE TRIGGER seguidores_new_follower_notification AFTER INSERT ON public.seguidores FOR EACH ROW EXECUTE FUNCTION handle_new_follower_notification();

-- Keep the remote guardrail that enables RLS for newly-created public tables.
drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- Non-constraint indexes that existed remotely before reconciliation.
-- Existing catalog indexes are owned by their earlier migrations and are omitted here.
create index if not exists avaliacao_curtidas_avaliacao_id_idx ON public.avaliacao_curtidas USING btree (avaliacao_id);
create index if not exists avaliacao_curtidas_usuario_id_idx ON public.avaliacao_curtidas USING btree (usuario_id);
create index if not exists avaliacao_deslikes_avaliacao_id_idx ON public.avaliacao_deslikes USING btree (avaliacao_id);
create index if not exists avaliacao_deslikes_lookup_idx ON public.avaliacao_deslikes USING btree (avaliacao_id, usuario_id);
create unique index if not exists avaliacao_deslikes_unique_user_item_idx ON public.avaliacao_deslikes USING btree (avaliacao_id, usuario_id);
create index if not exists avaliacao_deslikes_usuario_id_idx ON public.avaliacao_deslikes USING btree (usuario_id);
create index if not exists avaliacoes_jogo_id_idx ON public.avaliacoes USING btree (jogo_id);
create index if not exists avaliacoes_usuario_id_idx ON public.avaliacoes USING btree (usuario_id);
create index if not exists idx_home_avaliacoes_jogo_data ON public.avaliacoes USING btree (jogo_id, data_publicacao DESC);
create index if not exists idx_home_avaliacoes_usuario_data ON public.avaliacoes USING btree (usuario_id, data_publicacao DESC);
create index if not exists comentario_curtidas_comentario_id_idx ON public.comentario_curtidas USING btree (comentario_id);
create index if not exists comentario_curtidas_lookup_idx ON public.comentario_curtidas USING btree (comentario_id, usuario_id);
create unique index if not exists comentario_curtidas_unique_user_item_idx ON public.comentario_curtidas USING btree (comentario_id, usuario_id);
create index if not exists comentario_curtidas_usuario_id_idx ON public.comentario_curtidas USING btree (usuario_id);
create index if not exists comentario_deslikes_comentario_id_idx ON public.comentario_deslikes USING btree (comentario_id);
create index if not exists comentario_deslikes_lookup_idx ON public.comentario_deslikes USING btree (comentario_id, usuario_id);
create unique index if not exists comentario_deslikes_unique_user_item_idx ON public.comentario_deslikes USING btree (comentario_id, usuario_id);
create index if not exists comentario_deslikes_usuario_id_idx ON public.comentario_deslikes USING btree (usuario_id);
create index if not exists comentarios_review_data_idx ON public.comentarios USING btree (review_id, data_comentario DESC);
create index if not exists comentarios_review_id_idx ON public.comentarios USING btree (review_id);
create index if not exists comentarios_usuario_id_idx ON public.comentarios USING btree (usuario_id);
create unique index if not exists idx_comunidade_denuncia_comentario_unica ON public.comunidade_denuncias USING btree (denunciante_id, comentario_id) WHERE ((tipo_conteudo = 'comentario'::comunidade_denuncia_tipo) AND (comentario_id IS NOT NULL));
create unique index if not exists idx_comunidade_denuncia_post_unica ON public.comunidade_denuncias USING btree (denunciante_id, post_id) WHERE ((tipo_conteudo = 'post'::comunidade_denuncia_tipo) AND (post_id IS NOT NULL));
create index if not exists idx_comunidade_denuncias_comentario_id ON public.comunidade_denuncias USING btree (comentario_id);
create index if not exists idx_comunidade_denuncias_comunidade_status ON public.comunidade_denuncias USING btree (comunidade_id, status, created_at DESC);
create index if not exists idx_comunidade_denuncias_denunciante ON public.comunidade_denuncias USING btree (denunciante_id, created_at DESC);
create index if not exists idx_comunidade_denuncias_post_id ON public.comunidade_denuncias USING btree (post_id);
create index if not exists comunidade_membros_cargo_idx ON public.comunidade_membros USING btree (comunidade_id, cargo);
create index if not exists comunidade_membros_comunidade_usuario_idx ON public.comunidade_membros USING btree (comunidade_id, usuario_id);
create index if not exists comunidade_membros_usuario_idx ON public.comunidade_membros USING btree (usuario_id);
create unique index if not exists comunidade_um_lider_unique ON public.comunidade_membros USING btree (comunidade_id) WHERE (cargo = 'lider'::comunidade_cargo);
create index if not exists comunidade_comentarios_autor_idx ON public.comunidade_post_comentarios USING btree (autor_id, created_at DESC);
create index if not exists comunidade_comentarios_post_idx ON public.comunidade_post_comentarios USING btree (post_id, created_at);
create index if not exists idx_comunidade_comentarios_post ON public.comunidade_post_comentarios USING btree (post_id, created_at) WHERE (deleted_at IS NULL);
create index if not exists idx_comunidade_post_comentarios_comunidade_id ON public.comunidade_post_comentarios USING btree (comunidade_id);
create index if not exists comunidade_reacoes_usuario_idx ON public.comunidade_post_reacoes USING btree (usuario_id);
create index if not exists comunidade_salvos_usuario_idx ON public.comunidade_post_salvos USING btree (usuario_id, created_at DESC);
create index if not exists comunidade_posts_autor_idx ON public.comunidade_posts USING btree (autor_id, created_at DESC);
create index if not exists comunidade_posts_comunidade_idx ON public.comunidade_posts USING btree (comunidade_id, created_at DESC);
create index if not exists comunidade_posts_feed_fixacao_idx ON public.comunidade_posts USING btree (comunidade_id, fixado DESC, fixado_em, created_at DESC) WHERE (deleted_at IS NULL);
create index if not exists idx_comunidade_posts_feed ON public.comunidade_posts USING btree (comunidade_id, created_at DESC) WHERE (deleted_at IS NULL);
create index if not exists idx_comunidade_posts_fixado_por ON public.comunidade_posts USING btree (fixado_por);
create unique index if not exists idx_comunidade_solicitacao_pendente_unica ON public.comunidade_solicitacoes_entrada USING btree (comunidade_id, usuario_id) WHERE (status = 'pendente'::comunidade_solicitacao_status);
create index if not exists idx_comunidade_solicitacoes_comunidade_status ON public.comunidade_solicitacoes_entrada USING btree (comunidade_id, status, created_at DESC);
create index if not exists idx_comunidade_solicitacoes_decidido_por ON public.comunidade_solicitacoes_entrada USING btree (decidido_por);
create index if not exists idx_comunidade_solicitacoes_usuario ON public.comunidade_solicitacoes_entrada USING btree (usuario_id, created_at DESC);
create index if not exists comunidades_categoria_idx ON public.comunidades USING btree (categoria);
create index if not exists comunidades_created_at_idx ON public.comunidades USING btree (created_at DESC);
create index if not exists comunidades_jogo_id_idx ON public.comunidades USING btree (jogo_id);
create unique index if not exists comunidades_nome_ativo_unique ON public.comunidades USING btree (lower(nome)) WHERE (deleted_at IS NULL);
create index if not exists comunidades_tipo_idx ON public.comunidades USING btree (tipo);
create index if not exists idx_comunidades_lider_id ON public.comunidades USING btree (lider_id);
create index if not exists idx_comunidades_visibilidade ON public.comunidades USING btree (visibilidade) WHERE (deleted_at IS NULL);
create index if not exists denuncias_conteudo_avaliacao_id_idx ON public.denuncias_conteudo USING btree (avaliacao_id) WHERE (avaliacao_id IS NOT NULL);
create index if not exists denuncias_conteudo_comentario_id_idx ON public.denuncias_conteudo USING btree (comentario_id) WHERE (comentario_id IS NOT NULL);
create index if not exists denuncias_conteudo_comentario_lookup_idx ON public.denuncias_conteudo USING btree (denunciante_id, tipo_conteudo, comentario_id) WHERE (comentario_id IS NOT NULL);
create index if not exists denuncias_conteudo_moderacao_idx ON public.denuncias_conteudo USING btree (tipo_conteudo, status, created_at DESC);
create index if not exists denuncias_conteudo_review_lookup_idx ON public.denuncias_conteudo USING btree (denunciante_id, tipo_conteudo, avaliacao_id) WHERE (avaliacao_id IS NOT NULL);
create unique index if not exists denuncias_conteudo_unique_comment_report_idx ON public.denuncias_conteudo USING btree (denunciante_id, comentario_id) WHERE ((tipo_conteudo = 'comment'::tipo_denuncia_conteudo) AND (comentario_id IS NOT NULL));
create unique index if not exists denuncias_conteudo_unique_review_report_idx ON public.denuncias_conteudo USING btree (denunciante_id, avaliacao_id) WHERE ((tipo_conteudo = 'review'::tipo_denuncia_conteudo) AND (avaliacao_id IS NOT NULL));
create index if not exists denuncias_perfil_denunciante_id_idx ON public.denuncias_perfil USING btree (denunciante_id);
create index if not exists denuncias_perfil_status_created_at_idx ON public.denuncias_perfil USING btree (status, created_at DESC);
create unique index if not exists denuncias_perfil_unique_report_idx ON public.denuncias_perfil USING btree (denunciante_id, usuario_denunciado_id);
create index if not exists denuncias_perfil_usuario_denunciado_id_idx ON public.denuncias_perfil USING btree (usuario_denunciado_id);
create index if not exists idx_home_jogos_data_lancamento ON public.jogos USING btree (data_lancamento DESC);
create index if not exists jogos_data_lancamento_idx ON public.jogos USING btree (data_lancamento DESC NULLS LAST);
create index if not exists jogos_titulo_trgm_idx ON public.jogos USING gin (titulo gin_trgm_ops);
create index if not exists idx_lista_desejos_jogo_id ON public.lista_desejos USING btree (jogo_id);
create index if not exists lista_desejos_usuario_prioridade_idx ON public.lista_desejos USING btree (usuario_id, prioridade, adicionado_em DESC);
create index if not exists notifications_actor_idx ON public.notifications USING btree (actor_id);
create index if not exists notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
create unique index if not exists notifications_user_dedupe_unique ON public.notifications USING btree (user_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);
create index if not exists notifications_user_unread_idx ON public.notifications USING btree (user_id, is_read, created_at DESC);
create index if not exists seguidores_seguido_id_idx ON public.seguidores USING btree (seguido_id);
create index if not exists seguidores_seguido_seguidor_idx ON public.seguidores USING btree (seguido_id, seguidor_id);
create index if not exists seguidores_seguidor_id_idx ON public.seguidores USING btree (seguidor_id);
create index if not exists idx_status_jogo_jogo_id ON public.status_jogo USING btree (jogo_id);
create index if not exists idx_status_jogo_usuario_created_at ON public.status_jogo USING btree (usuario_id, created_at DESC);
create index if not exists idx_status_jogo_usuario_jogo ON public.status_jogo USING btree (usuario_id, jogo_id);
create index if not exists idx_status_jogo_usuario_status_created_at ON public.status_jogo USING btree (usuario_id, status, created_at DESC);
create unique index if not exists status_jogo_usuario_jogo_unique_idx ON public.status_jogo USING btree (usuario_id, jogo_id);

-- Explicit function ACLs. PostgreSQL otherwise grants EXECUTE to PUBLIC by default.
-- These grants reproduce the linked project; security hardening can now be reviewed separately.
revoke all on function private.can_user_post_comunidade(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_user_post_comunidade(uuid, uuid) to anon, authenticated, service_role;
revoke all on function private.can_ver_conteudo_comunidade(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_ver_conteudo_comunidade(uuid, uuid) to anon, authenticated, service_role;
revoke all on function private.can_view_profile_restricted_content(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_view_profile_restricted_content(uuid, uuid) to anon, authenticated, service_role;
revoke all on function private.get_comunidade_cargo(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.get_comunidade_cargo(uuid, uuid) to anon, authenticated, service_role;
revoke all on function private.is_comunidade_lider(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_comunidade_lider(uuid, uuid) to anon, authenticated, service_role;
revoke all on function private.is_comunidade_membro(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_comunidade_membro(uuid, uuid) to anon, authenticated, service_role;
revoke all on function private.is_comunidade_moderador(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.is_comunidade_moderador(uuid, uuid) to anon, authenticated, service_role;
revoke all on function private.set_jogos_search_vector() from public, anon, authenticated, service_role;
revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_account_data(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_account_data(uuid) to service_role;
revoke all on function public.alterar_cargo_membro(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.alterar_cargo_membro(uuid, uuid, text) to authenticated, service_role;
revoke all on function public.alterar_fixacao_post_comunidade(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.alterar_fixacao_post_comunidade(uuid, boolean) to authenticated, service_role;
revoke all on function public.alterar_permissao_postagem(uuid, comunidade_permissao_postagem) from public, anon, authenticated, service_role;
grant execute on function public.alterar_permissao_postagem(uuid, comunidade_permissao_postagem) to authenticated, service_role;
revoke all on function public.alterar_permissao_postagem(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.alterar_permissao_postagem(uuid, text) to authenticated, service_role;
revoke all on function public.alternar_post_salvo(uuid) from public, anon, authenticated, service_role;
grant execute on function public.alternar_post_salvo(uuid) to authenticated, service_role;
revoke all on function public.alternar_reacao_post(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.alternar_reacao_post(uuid, text) to authenticated, service_role;
revoke all on function public.aprovar_solicitacao_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.aprovar_solicitacao_comunidade(uuid) to authenticated, service_role;
revoke all on function public.atualizar_status_denuncia_comunidade(uuid, comunidade_denuncia_status) from public, anon, authenticated, service_role;
grant execute on function public.atualizar_status_denuncia_comunidade(uuid, comunidade_denuncia_status) to authenticated, service_role;
revoke all on function public.can_user_post_comunidade(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_user_post_comunidade(uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.can_ver_conteudo_comunidade(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_ver_conteudo_comunidade(uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.cancelar_solicitacao_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancelar_solicitacao_comunidade(uuid) to authenticated, service_role;
revoke all on function public.comunidade_comentarios_count_trigger() from public, anon, authenticated, service_role;
grant execute on function public.comunidade_comentarios_count_trigger() to public, anon, authenticated, service_role;
revoke all on function public.comunidade_membros_count_trigger() from public, anon, authenticated, service_role;
grant execute on function public.comunidade_membros_count_trigger() to public, anon, authenticated, service_role;
revoke all on function public.comunidade_posts_count_trigger() from public, anon, authenticated, service_role;
grant execute on function public.comunidade_posts_count_trigger() to public, anon, authenticated, service_role;
revoke all on function public.comunidade_reacoes_count_trigger() from public, anon, authenticated, service_role;
grant execute on function public.comunidade_reacoes_count_trigger() to public, anon, authenticated, service_role;
revoke all on function public.create_notification(uuid, uuid, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.create_notification(uuid, uuid, text, text, text, text, text, text, jsonb, text) to service_role;
revoke all on function public.criar_comentario_comunidade(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.criar_comentario_comunidade(uuid, text) to authenticated, service_role;
revoke all on function public.criar_comunidade(text, text, text, text, bigint, text, text, text, comunidade_visibilidade) from public, anon, authenticated, service_role;
grant execute on function public.criar_comunidade(text, text, text, text, bigint, text, text, text, comunidade_visibilidade) to authenticated, service_role;
revoke all on function public.criar_comunidade(text, text, text, text, integer, text, text, comunidade_permissao_postagem) from public, anon, authenticated, service_role;
grant execute on function public.criar_comunidade(text, text, text, text, integer, text, text, comunidade_permissao_postagem) to authenticated, service_role;
revoke all on function public.criar_denuncia_comunidade(uuid, comunidade_denuncia_tipo, uuid, comunidade_denuncia_motivo, text) from public, anon, authenticated, service_role;
grant execute on function public.criar_denuncia_comunidade(uuid, comunidade_denuncia_tipo, uuid, comunidade_denuncia_motivo, text) to authenticated, service_role;
revoke all on function public.criar_post_comunidade(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.criar_post_comunidade(uuid, text, text) to authenticated, service_role;
revoke all on function public.delete_own_account() from public, anon, authenticated, service_role;
grant execute on function public.delete_own_account() to service_role;
revoke all on function public.editar_comunidade(uuid, text, text, text, text, bigint, text, text, comunidade_visibilidade) from public, anon, authenticated, service_role;
grant execute on function public.editar_comunidade(uuid, text, text, text, text, bigint, text, text, comunidade_visibilidade) to authenticated, service_role;
revoke all on function public.editar_comunidade_moderavel(uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.editar_comunidade_moderavel(uuid, text, text, text) to authenticated, service_role;
revoke all on function public.enforce_community_creation_limit() from public, anon, authenticated, service_role;
grant execute on function public.enforce_community_creation_limit() to service_role;
revoke all on function public.entrar_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.entrar_comunidade(uuid) to authenticated, service_role;
revoke all on function public.excluir_comentario_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.excluir_comentario_comunidade(uuid) to authenticated, service_role;
revoke all on function public.excluir_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.excluir_comunidade(uuid) to authenticated, service_role;
revoke all on function public.excluir_post_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.excluir_post_comunidade(uuid) to authenticated, service_role;
revoke all on function public.expulsar_membro(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.expulsar_membro(uuid, uuid) to authenticated, service_role;
revoke all on function public.get_catalog_facets(text) from public, anon, authenticated, service_role;
grant execute on function public.get_catalog_facets(text) to anon, authenticated, service_role;
revoke all on function public.get_community_creation_quota() from public, anon, authenticated, service_role;
grant execute on function public.get_community_creation_quota() to authenticated, service_role;
revoke all on function public.get_comunidade_cargo(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_comunidade_cargo(uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.get_home_active_communities(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_home_active_communities(integer, integer) to anon, authenticated, service_role;
revoke all on function public.get_home_featured_recent_reviewed_games(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_home_featured_recent_reviewed_games(integer, integer) to anon, authenticated, service_role;
revoke all on function public.get_home_following_activities(integer) from public, anon, authenticated, service_role;
grant execute on function public.get_home_following_activities(integer) to authenticated, service_role;
revoke all on function public.get_home_trending_reviews(integer, integer, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.get_home_trending_reviews(integer, integer, uuid[]) to anon, authenticated, service_role;
revoke all on function public.handle_comment_like_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_comment_like_notification() to service_role;
revoke all on function public.handle_community_member_removed_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_community_member_removed_notification() to service_role;
revoke all on function public.handle_community_member_role_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_community_member_role_notification() to service_role;
revoke all on function public.handle_community_post_comment_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_community_post_comment_notification() to service_role;
revoke all on function public.handle_community_post_like_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_community_post_like_notification() to service_role;
revoke all on function public.handle_new_follower_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_follower_notification() to service_role;
revoke all on function public.handle_private_community_accepted_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_private_community_accepted_notification() to service_role;
revoke all on function public.handle_review_comment_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_review_comment_notification() to service_role;
revoke all on function public.handle_review_like_notification() from public, anon, authenticated, service_role;
grant execute on function public.handle_review_like_notification() to service_role;
revoke all on function public.home_can_view_user_content(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.home_can_view_user_content(uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.is_comunidade_lider(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_comunidade_lider(uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.is_comunidade_membro(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_comunidade_membro(uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.is_comunidade_moderador(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_comunidade_moderador(uuid, uuid) to anon, authenticated, service_role;
revoke all on function public.mark_all_notifications_read() from public, anon, authenticated, service_role;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;
revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
revoke all on function public.normalize_avaliacao_metadata() from public, anon, authenticated, service_role;
grant execute on function public.normalize_avaliacao_metadata() to public, anon, authenticated, service_role;
revoke all on function public.normalize_avaliacao_write() from public, anon, authenticated, service_role;
grant execute on function public.normalize_avaliacao_write() to public, anon, authenticated, service_role;
revoke all on function public.normalize_comentario_metadata() from public, anon, authenticated, service_role;
grant execute on function public.normalize_comentario_metadata() to public, anon, authenticated, service_role;
revoke all on function public.normalize_comentario_write() from public, anon, authenticated, service_role;
grant execute on function public.normalize_comentario_write() to public, anon, authenticated, service_role;
revoke all on function public.preencher_nome_usuario_denunciado() from public, anon, authenticated, service_role;
grant execute on function public.preencher_nome_usuario_denunciado() to service_role;
revoke all on function public.prevent_self_like_on_review() from public, anon, authenticated, service_role;
grant execute on function public.prevent_self_like_on_review() to public, anon, authenticated, service_role;
revoke all on function public.prevent_self_review_like() from public, anon, authenticated, service_role;
grant execute on function public.prevent_self_review_like() to public, anon, authenticated, service_role;
revoke all on function public.proteger_fixacao_post_comunidade() from public, anon, authenticated, service_role;
grant execute on function public.proteger_fixacao_post_comunidade() to service_role;
revoke all on function public.recusar_solicitacao_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.recusar_solicitacao_comunidade(uuid) to authenticated, service_role;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
grant execute on function public.rls_auto_enable() to service_role;
revoke all on function public.sair_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.sair_comunidade(uuid) to authenticated, service_role;
revoke all on function public.search_catalog_games(text, text[], text[], text[], text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.search_catalog_games(text, text[], text[], text[], text, integer, integer) to anon, authenticated, service_role;
revoke all on function public.set_atualizado_em() from public, anon, authenticated, service_role;
grant execute on function public.set_atualizado_em() to public, anon, authenticated, service_role;
revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.set_updated_at() to public, anon, authenticated, service_role;
revoke all on function public.solicitar_entrada_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.solicitar_entrada_comunidade(uuid) to authenticated, service_role;
revoke all on function public.sync_avaliacao_curtidas_count() from public, anon, authenticated, service_role;
grant execute on function public.sync_avaliacao_curtidas_count() to public, anon, authenticated, service_role;
revoke all on function public.sync_avaliacao_like_count() from public, anon, authenticated, service_role;
grant execute on function public.sync_avaliacao_like_count() to public, anon, authenticated, service_role;
revoke all on function public.sync_review_like_counter() from public, anon, authenticated, service_role;
grant execute on function public.sync_review_like_counter() to service_role;
revoke all on function public.touch_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.touch_updated_at() to public, anon, authenticated, service_role;
revoke all on function public.transferir_lideranca(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.transferir_lideranca(uuid, uuid) to authenticated, service_role;
revoke all on function public.usuario_pode_moderar_comunidade(uuid) from public, anon, authenticated, service_role;
grant execute on function public.usuario_pode_moderar_comunidade(uuid) to anon, authenticated, service_role;

-- Explicit ACLs for the core tables defined by the reconstructed baseline.
-- RLS remains enabled and continues to decide which rows each role can access.
revoke all on table public.usuarios from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.usuarios to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.usuarios to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.usuarios to service_role;
revoke all on table public.jogos from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.jogos to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.jogos to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.jogos to service_role;
revoke all on table public.avaliacoes from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacoes to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacoes to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacoes to service_role;
revoke all on table public.comentarios from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentarios to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentarios to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentarios to service_role;
revoke all on table public.avaliacao_curtidas from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacao_curtidas to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacao_curtidas to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacao_curtidas to service_role;
revoke all on table public.avaliacao_deslikes from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacao_deslikes to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacao_deslikes to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.avaliacao_deslikes to service_role;
revoke all on table public.comentario_curtidas from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentario_curtidas to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentario_curtidas to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentario_curtidas to service_role;
revoke all on table public.comentario_deslikes from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentario_deslikes to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentario_deslikes to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comentario_deslikes to service_role;
revoke all on table public.seguidores from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.seguidores to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.seguidores to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.seguidores to service_role;
revoke all on table public.lista_desejos from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.lista_desejos to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.lista_desejos to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.lista_desejos to service_role;
revoke all on table public.status_jogo from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.status_jogo to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.status_jogo to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.status_jogo to service_role;
revoke all on table public.notifications from public, anon, authenticated, service_role;
grant select on table public.notifications to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.notifications to service_role;
revoke all on table public.comunidades from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidades to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidades to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidades to service_role;
revoke all on table public.comunidade_membros from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_membros to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_membros to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_membros to service_role;
revoke all on table public.comunidade_posts from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_posts to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_posts to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_posts to service_role;
revoke all on table public.comunidade_post_comentarios from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_comentarios to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_comentarios to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_comentarios to service_role;
revoke all on table public.comunidade_post_reacoes from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_reacoes to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_reacoes to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_reacoes to service_role;
revoke all on table public.comunidade_post_salvos from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_salvos to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_salvos to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_post_salvos to service_role;
revoke all on table public.comunidade_solicitacoes_entrada from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_solicitacoes_entrada to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_solicitacoes_entrada to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_solicitacoes_entrada to service_role;
revoke all on table public.comunidade_denuncias from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_denuncias to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_denuncias to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.comunidade_denuncias to service_role;
revoke all on table public.denuncias_conteudo from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.denuncias_conteudo to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.denuncias_conteudo to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.denuncias_conteudo to service_role;
revoke all on table public.denuncias_perfil from public, anon, authenticated, service_role;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.denuncias_perfil to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.denuncias_perfil to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on table public.denuncias_perfil to service_role;

revoke all on sequence public.jogos_id_seq from public, anon, authenticated, service_role;
grant select, update, usage on sequence public.jogos_id_seq to anon, authenticated, service_role;
