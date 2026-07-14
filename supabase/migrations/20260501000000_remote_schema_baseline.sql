-- Baseline reconstructed from read-only introspection of the linked project.
--
-- The project predates its migration history. This file intentionally contains
-- only the objects that already existed before the first tracked migration.
-- Later migrations continue to own catalog expansion and subsequent hardening.

create extension if not exists pg_trgm with schema public;

create schema if not exists private;
revoke all on schema private from public;

create type public.comunidade_cargo as enum ('lider', 'admin', 'membro');
create type public.comunidade_denuncia_motivo as enum (
  'spam', 'assedio_ou_ofensa', 'conteudo_improprio', 'informacao_enganosa',
  'discurso_de_odio', 'outro'
);
create type public.comunidade_denuncia_status as enum (
  'pending', 'under_review', 'resolved', 'dismissed'
);
create type public.comunidade_denuncia_tipo as enum ('post', 'comentario');
create type public.comunidade_permissao_postagem as enum (
  'todos_membros', 'somente_admins', 'somente_lider'
);
create type public.comunidade_reacao_tipo as enum ('curtida', 'dislike');
create type public.comunidade_solicitacao_status as enum (
  'pendente', 'aprovada', 'recusada', 'cancelada'
);
create type public.comunidade_visibilidade as enum ('publica', 'privada');
create type public.motivo_denuncia_conteudo as enum (
  'spam', 'assedio_ou_ofensa', 'conteudo_improprio', 'informacao_enganosa',
  'discurso_de_odio', 'outro'
);
create type public.motivo_denuncia_perfil as enum (
  'foto_ofensiva', 'nome_ofensivo', 'perfil_falso', 'spam',
  'assedio_ou_ofensa', 'conteudo_improprio', 'discurso_de_odio', 'outro'
);
create type public.status_denuncia_conteudo as enum (
  'pending', 'under_review', 'resolved', 'dismissed'
);
create type public.status_denuncia_perfil as enum (
  'pending', 'under_review', 'resolved', 'dismissed'
);
create type public.tipo_denuncia_conteudo as enum ('review', 'comment');

create sequence public.jogos_id_seq;

create table public.usuarios (
  id uuid not null,
  username text,
  nome_completo text,
  avatar_url text,
  bio text,
  data_cadastro timestamp with time zone default now(),
  configuracoes_privacidade jsonb,
  avatar_path text
);

create table public.jogos (
  id integer default nextval('public.jogos_id_seq'::regclass) not null,
  titulo text not null,
  capa_url text,
  desenvolvedora text,
  generos text[],
  data_lancamento date,
  descricao text,
  plataformas text[]
);

alter sequence public.jogos_id_seq owned by public.jogos.id;

create table public.avaliacoes (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  jogo_id integer not null,
  nota numeric(3,1) not null,
  texto_review text,
  curtidas integer default 0 not null,
  data_publicacao timestamp with time zone default now(),
  editado_em timestamp with time zone
);

create table public.comentarios (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  review_id uuid not null,
  texto text not null,
  data_comentario timestamp with time zone default now() not null,
  editado_em timestamp with time zone
);

create table public.avaliacao_curtidas (
  id uuid default gen_random_uuid() not null,
  avaliacao_id uuid not null,
  usuario_id uuid not null,
  criado_em timestamp with time zone default now() not null
);

create table public.avaliacao_deslikes (
  id uuid default gen_random_uuid() not null,
  avaliacao_id uuid not null,
  usuario_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.comentario_curtidas (
  id uuid default gen_random_uuid() not null,
  comentario_id uuid not null,
  usuario_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.comentario_deslikes (
  id uuid default gen_random_uuid() not null,
  comentario_id uuid not null,
  usuario_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.seguidores (
  id uuid default gen_random_uuid() not null,
  seguidor_id uuid not null,
  seguido_id uuid not null,
  data_inicio timestamp with time zone default now() not null
);

create table public.lista_desejos (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  jogo_id integer not null,
  adicionado_em timestamp with time zone default now() not null,
  prioridade integer default 1 not null
);

create table public.status_jogo (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  jogo_id integer not null,
  status text not null,
  created_at timestamp with time zone default now(),
  favorito boolean
);

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  actor_id uuid,
  type text not null,
  title text not null,
  message text,
  entity_type text,
  entity_id text,
  link text,
  metadata jsonb default '{}'::jsonb not null,
  dedupe_key text,
  is_read boolean default false not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table public.comunidades (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  descricao text,
  banner_path text,
  tipo text,
  jogo_id integer,
  categoria text,
  regras text,
  permissao_postagem public.comunidade_permissao_postagem
    default 'todos_membros'::public.comunidade_permissao_postagem not null,
  lider_id uuid not null,
  membros_count integer default 0 not null,
  posts_count integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  visibilidade public.comunidade_visibilidade
    default 'publica'::public.comunidade_visibilidade not null
);

create table public.comunidade_membros (
  comunidade_id uuid not null,
  usuario_id uuid not null,
  cargo public.comunidade_cargo default 'membro'::public.comunidade_cargo not null,
  entrou_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table public.comunidade_posts (
  id uuid default gen_random_uuid() not null,
  comunidade_id uuid not null,
  autor_id uuid not null,
  texto text,
  imagem_path text,
  curtidas_count integer default 0 not null,
  dislikes_count integer default 0 not null,
  comentarios_count integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  fixado boolean default false not null,
  fixado_em timestamp with time zone,
  fixado_por uuid
);

create table public.comunidade_post_comentarios (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null,
  comunidade_id uuid not null,
  autor_id uuid not null,
  texto text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

create table public.comunidade_post_reacoes (
  post_id uuid not null,
  usuario_id uuid not null,
  tipo public.comunidade_reacao_tipo not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.comunidade_post_salvos (
  post_id uuid not null,
  usuario_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.comunidade_solicitacoes_entrada (
  id uuid default gen_random_uuid() not null,
  comunidade_id uuid not null,
  usuario_id uuid not null,
  status public.comunidade_solicitacao_status
    default 'pendente'::public.comunidade_solicitacao_status not null,
  decidido_por uuid,
  decidido_em timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.comunidade_denuncias (
  id uuid default gen_random_uuid() not null,
  comunidade_id uuid not null,
  denunciante_id uuid not null,
  tipo_conteudo public.comunidade_denuncia_tipo not null,
  post_id uuid,
  comentario_id uuid,
  motivo public.comunidade_denuncia_motivo not null,
  descricao text,
  status public.comunidade_denuncia_status
    default 'pending'::public.comunidade_denuncia_status not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.denuncias_conteudo (
  id uuid default gen_random_uuid() not null,
  denunciante_id uuid not null,
  tipo_conteudo public.tipo_denuncia_conteudo not null,
  avaliacao_id uuid,
  comentario_id uuid,
  motivo public.motivo_denuncia_conteudo not null,
  descricao text,
  status public.status_denuncia_conteudo
    default 'pending'::public.status_denuncia_conteudo not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.denuncias_perfil (
  id uuid default gen_random_uuid() not null,
  denunciante_id uuid not null,
  usuario_denunciado_id uuid not null,
  nome_usuario_denunciado text not null,
  motivo public.motivo_denuncia_perfil not null,
  descricao text,
  status public.status_denuncia_perfil
    default 'pending'::public.status_denuncia_perfil not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.usuarios add constraint usuarios_pkey primary key (id);
alter table public.jogos add constraint jogos_pkey primary key (id);
alter table public.avaliacoes add constraint avaliacoes_pkey primary key (id);
alter table public.comentarios add constraint comentarios_pkey primary key (id);
alter table public.avaliacao_curtidas add constraint avaliacao_curtidas_pkey primary key (id);
alter table public.avaliacao_deslikes add constraint avaliacao_deslikes_pkey primary key (id);
alter table public.comentario_curtidas add constraint comentario_curtidas_pkey primary key (id);
alter table public.comentario_deslikes add constraint comentario_deslikes_pkey primary key (id);
alter table public.seguidores add constraint seguidores_pkey primary key (id);
alter table public.lista_desejos add constraint lista_desejos_pkey primary key (id);
alter table public.status_jogo add constraint status_jogo_pkey primary key (id);
alter table public.notifications add constraint notifications_pkey primary key (id);
alter table public.comunidades add constraint comunidades_pkey primary key (id);
alter table public.comunidade_membros add constraint comunidade_membros_pkey
  primary key (comunidade_id, usuario_id);
alter table public.comunidade_posts add constraint comunidade_posts_pkey primary key (id);
alter table public.comunidade_post_comentarios add constraint comunidade_post_comentarios_pkey
  primary key (id);
alter table public.comunidade_post_reacoes add constraint comunidade_post_reacoes_pkey
  primary key (post_id, usuario_id);
alter table public.comunidade_post_salvos add constraint comunidade_post_salvos_pkey
  primary key (post_id, usuario_id);
alter table public.comunidade_solicitacoes_entrada
  add constraint comunidade_solicitacoes_entrada_pkey primary key (id);
alter table public.comunidade_denuncias add constraint comunidade_denuncias_pkey primary key (id);
alter table public.denuncias_conteudo add constraint denuncias_conteudo_pkey primary key (id);
alter table public.denuncias_perfil add constraint denuncias_perfil_pkey primary key (id);

alter table public.usuarios add constraint usuarios_username_key unique (username);
alter table public.avaliacoes add constraint avaliacoes_usuario_id_jogo_id_key
  unique (usuario_id, jogo_id);
alter table public.avaliacao_curtidas add constraint avaliacao_curtidas_unique_like
  unique (avaliacao_id, usuario_id);
alter table public.seguidores add constraint seguidores_unique_pair
  unique (seguidor_id, seguido_id);
alter table public.lista_desejos add constraint lista_desejos_usuario_jogo_key
  unique (usuario_id, jogo_id);

alter table public.avaliacoes add constraint avaliacoes_nota_range_check
  check (nota >= 1::numeric and nota <= 10::numeric);
alter table public.seguidores add constraint seguidores_self_follow_check
  check (seguidor_id <> seguido_id);
alter table public.lista_desejos add constraint lista_desejos_prioridade_check
  check (prioridade >= 1);
alter table public.status_jogo add constraint status_jogo_status_check
  check (status = any (array['jogando', 'zerado', 'dropado', 'planejando', 'pausado']::text[]));
alter table public.comunidades add constraint comunidades_nome_len
  check (char_length(btrim(nome)) between 3 and 80);
alter table public.comunidades add constraint comunidades_descricao_len
  check (descricao is null or char_length(descricao) <= 600);
alter table public.comunidades add constraint comunidades_tipo_len
  check (tipo is null or char_length(tipo) <= 80);
alter table public.comunidades add constraint comunidades_categoria_len
  check (categoria is null or char_length(categoria) <= 80);
alter table public.comunidades add constraint comunidades_regras_len
  check (regras is null or char_length(regras) <= 3000);
alter table public.comunidades add constraint comunidades_membros_count_check
  check (membros_count >= 0);
alter table public.comunidades add constraint comunidades_posts_count_check
  check (posts_count >= 0);
alter table public.comunidade_posts add constraint comunidade_posts_conteudo_check
  check (
    nullif(btrim(coalesce(texto, '')), '') is not null
    or nullif(btrim(coalesce(imagem_path, '')), '') is not null
  );
alter table public.comunidade_posts add constraint comunidade_posts_texto_len
  check (texto is null or char_length(texto) <= 4000);
alter table public.comunidade_posts add constraint comunidade_posts_curtidas_count_check
  check (curtidas_count >= 0);
alter table public.comunidade_posts add constraint comunidade_posts_dislikes_count_check
  check (dislikes_count >= 0);
alter table public.comunidade_posts add constraint comunidade_posts_comentarios_count_check
  check (comentarios_count >= 0);
alter table public.comunidade_post_comentarios
  add constraint comunidade_post_comentarios_texto_len
  check (char_length(btrim(texto)) between 1 and 1200);
alter table public.comunidade_denuncias add constraint comunidade_denuncias_alvo_check
  check (
    (tipo_conteudo = 'post' and post_id is not null and comentario_id is null)
    or (tipo_conteudo = 'comentario' and comentario_id is not null and post_id is null)
  );
alter table public.denuncias_conteudo add constraint denuncias_conteudo_target_check
  check (
    (tipo_conteudo = 'review' and avaliacao_id is not null and comentario_id is null)
    or (tipo_conteudo = 'comment' and comentario_id is not null and avaliacao_id is null)
  );
alter table public.denuncias_perfil add constraint denuncias_perfil_self_report_check
  check (denunciante_id <> usuario_denunciado_id);

alter table public.usuarios add constraint usuarios_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
alter table public.avaliacoes add constraint avaliacoes_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.avaliacoes add constraint avaliacoes_jogo_id_fkey
  foreign key (jogo_id) references public.jogos(id) on delete cascade;
alter table public.comentarios add constraint comentarios_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.comentarios add constraint comentarios_review_id_fkey
  foreign key (review_id) references public.avaliacoes(id) on delete cascade;
alter table public.avaliacao_curtidas add constraint avaliacao_curtidas_avaliacao_id_fkey
  foreign key (avaliacao_id) references public.avaliacoes(id) on delete cascade;
alter table public.avaliacao_curtidas add constraint avaliacao_curtidas_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.avaliacao_deslikes add constraint avaliacao_deslikes_avaliacao_id_fkey
  foreign key (avaliacao_id) references public.avaliacoes(id) on delete cascade;
alter table public.avaliacao_deslikes add constraint avaliacao_deslikes_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.comentario_curtidas add constraint comentario_curtidas_comentario_id_fkey
  foreign key (comentario_id) references public.comentarios(id) on delete cascade;
alter table public.comentario_curtidas add constraint comentario_curtidas_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.comentario_deslikes add constraint comentario_deslikes_comentario_id_fkey
  foreign key (comentario_id) references public.comentarios(id) on delete cascade;
alter table public.comentario_deslikes add constraint comentario_deslikes_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.seguidores add constraint seguidores_seguidor_id_fkey
  foreign key (seguidor_id) references public.usuarios(id) on delete cascade;
alter table public.seguidores add constraint seguidores_seguido_id_fkey
  foreign key (seguido_id) references public.usuarios(id) on delete cascade;
alter table public.lista_desejos add constraint lista_desejos_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.lista_desejos add constraint lista_desejos_jogo_id_fkey
  foreign key (jogo_id) references public.jogos(id) on delete cascade;
alter table public.status_jogo add constraint status_jogo_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.status_jogo add constraint status_jogo_jogo_id_fkey
  foreign key (jogo_id) references public.jogos(id) on delete cascade;
alter table public.notifications add constraint notifications_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.notifications add constraint notifications_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.comunidades add constraint comunidades_lider_id_fkey
  foreign key (lider_id) references public.usuarios(id) on delete restrict;
alter table public.comunidades add constraint comunidades_jogo_id_fkey
  foreign key (jogo_id) references public.jogos(id) on delete set null;
alter table public.comunidade_membros add constraint comunidade_membros_comunidade_id_fkey
  foreign key (comunidade_id) references public.comunidades(id) on delete cascade;
alter table public.comunidade_membros add constraint comunidade_membros_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.comunidade_posts add constraint comunidade_posts_comunidade_id_fkey
  foreign key (comunidade_id) references public.comunidades(id) on delete cascade;
alter table public.comunidade_posts add constraint comunidade_posts_autor_id_fkey
  foreign key (autor_id) references public.usuarios(id) on delete cascade;
alter table public.comunidade_posts add constraint comunidade_posts_fixado_por_fkey
  foreign key (fixado_por) references public.usuarios(id) on delete set null;
alter table public.comunidade_post_comentarios
  add constraint comunidade_post_comentarios_post_id_fkey
  foreign key (post_id) references public.comunidade_posts(id) on delete cascade;
alter table public.comunidade_post_comentarios
  add constraint comunidade_post_comentarios_comunidade_id_fkey
  foreign key (comunidade_id) references public.comunidades(id) on delete cascade;
alter table public.comunidade_post_comentarios
  add constraint comunidade_post_comentarios_autor_id_fkey
  foreign key (autor_id) references public.usuarios(id) on delete cascade;
alter table public.comunidade_post_reacoes add constraint comunidade_post_reacoes_post_id_fkey
  foreign key (post_id) references public.comunidade_posts(id) on delete cascade;
alter table public.comunidade_post_reacoes add constraint comunidade_post_reacoes_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.comunidade_post_salvos add constraint comunidade_post_salvos_post_id_fkey
  foreign key (post_id) references public.comunidade_posts(id) on delete cascade;
alter table public.comunidade_post_salvos add constraint comunidade_post_salvos_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.comunidade_solicitacoes_entrada
  add constraint comunidade_solicitacoes_entrada_comunidade_id_fkey
  foreign key (comunidade_id) references public.comunidades(id) on delete cascade;
alter table public.comunidade_solicitacoes_entrada
  add constraint comunidade_solicitacoes_entrada_usuario_id_fkey
  foreign key (usuario_id) references public.usuarios(id) on delete cascade;
alter table public.comunidade_solicitacoes_entrada
  add constraint comunidade_solicitacoes_entrada_decidido_por_fkey
  foreign key (decidido_por) references public.usuarios(id) on delete set null;
alter table public.comunidade_denuncias add constraint comunidade_denuncias_comunidade_id_fkey
  foreign key (comunidade_id) references public.comunidades(id) on delete cascade;
alter table public.comunidade_denuncias add constraint comunidade_denuncias_denunciante_id_fkey
  foreign key (denunciante_id) references public.usuarios(id) on delete cascade;
alter table public.comunidade_denuncias add constraint comunidade_denuncias_post_id_fkey
  foreign key (post_id) references public.comunidade_posts(id) on delete cascade;
alter table public.comunidade_denuncias add constraint comunidade_denuncias_comentario_id_fkey
  foreign key (comentario_id) references public.comunidade_post_comentarios(id) on delete cascade;
alter table public.denuncias_conteudo add constraint denuncias_conteudo_denunciante_id_fkey
  foreign key (denunciante_id) references public.usuarios(id) on delete cascade;
alter table public.denuncias_conteudo add constraint denuncias_conteudo_avaliacao_id_fkey
  foreign key (avaliacao_id) references public.avaliacoes(id) on delete cascade;
alter table public.denuncias_conteudo add constraint denuncias_conteudo_comentario_id_fkey
  foreign key (comentario_id) references public.comentarios(id) on delete cascade;
alter table public.denuncias_perfil add constraint denuncias_perfil_denunciante_id_fkey
  foreign key (denunciante_id) references public.usuarios(id) on delete cascade;
alter table public.denuncias_perfil add constraint denuncias_perfil_usuario_denunciado_id_fkey
  foreign key (usuario_denunciado_id) references public.usuarios(id) on delete cascade;

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
  select cm.cargo::text
  from public.comunidade_membros cm
  where cm.comunidade_id = p_comunidade_id
    and cm.usuario_id = p_usuario_id
  limit 1;
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
  select exists (
    select 1
    from public.comunidade_membros cm
    where cm.comunidade_id = p_comunidade_id
      and cm.usuario_id = p_usuario_id
  );
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
  select coalesce(public.get_comunidade_cargo(p_comunidade_id, p_usuario_id) = 'lider', false);
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
  select coalesce(
    public.get_comunidade_cargo(p_comunidade_id, p_usuario_id) in ('lider', 'admin'),
    false
  );
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
  select exists (
    select 1
    from public.comunidades c
    where c.id = p_comunidade_id
      and c.deleted_at is null
      and (
        c.visibilidade = 'publica'
        or public.is_comunidade_membro(c.id, p_usuario_id)
      )
  );
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

create or replace function public.comunidade_membros_count_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comunidades
    set membros_count = membros_count + 1
    where id = new.comunidade_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.comunidades
    set membros_count = greatest(membros_count - 1, 0)
    where id = old.comunidade_id;
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.comunidade_posts_count_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.deleted_at is null then
    update public.comunidades set posts_count = posts_count + 1 where id = new.comunidade_id;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.comunidades
      set posts_count = greatest(posts_count - 1, 0)
      where id = new.comunidade_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.comunidades set posts_count = posts_count + 1 where id = new.comunidade_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' and old.deleted_at is null then
    update public.comunidades
    set posts_count = greatest(posts_count - 1, 0)
    where id = old.comunidade_id;
    return old;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.comunidade_comentarios_count_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.deleted_at is null then
    update public.comunidade_posts
    set comentarios_count = comentarios_count + 1
    where id = new.post_id;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.comunidade_posts
      set comentarios_count = greatest(comentarios_count - 1, 0)
      where id = new.post_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.comunidade_posts
      set comentarios_count = comentarios_count + 1
      where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' and old.deleted_at is null then
    update public.comunidade_posts
    set comentarios_count = greatest(comentarios_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.comunidade_reacoes_count_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comunidade_posts
    set
      curtidas_count = curtidas_count + case when new.tipo = 'curtida' then 1 else 0 end,
      dislikes_count = dislikes_count + case when new.tipo = 'dislike' then 1 else 0 end
    where id = new.post_id;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.tipo <> new.tipo then
      update public.comunidade_posts
      set
        curtidas_count = greatest(
          curtidas_count - case when old.tipo = 'curtida' then 1 else 0 end
          + case when new.tipo = 'curtida' then 1 else 0 end,
          0
        ),
        dislikes_count = greatest(
          dislikes_count - case when old.tipo = 'dislike' then 1 else 0 end
          + case when new.tipo = 'dislike' then 1 else 0 end,
          0
        )
      where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.comunidade_posts
    set
      curtidas_count = greatest(
        curtidas_count - case when old.tipo = 'curtida' then 1 else 0 end,
        0
      ),
      dislikes_count = greatest(
        dislikes_count - case when old.tipo = 'dislike' then 1 else 0 end,
        0
      )
    where id = old.post_id;
    return old;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.normalize_avaliacao_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.texto_review := nullif(btrim(coalesce(new.texto_review, '')), '');
  new.curtidas := coalesce(new.curtidas, 0);
  new.data_publicacao := coalesce(new.data_publicacao, now());
  if tg_op = 'UPDATE' then new.editado_em := now(); end if;
  return new;
end;
$$;

create or replace function public.normalize_avaliacao_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.texto_review := nullif(btrim(coalesce(new.texto_review, '')), '');
  new.curtidas := coalesce(new.curtidas, 0);
  if tg_op = 'INSERT' then
    new.data_publicacao := coalesce(new.data_publicacao, now());
    new.editado_em := null;
  else
    new.editado_em := now();
  end if;
  return new;
end;
$$;

create or replace function public.normalize_comentario_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.texto := btrim(coalesce(new.texto, ''));
  new.data_comentario := coalesce(new.data_comentario, now());
  if new.texto = '' then raise exception 'O comentario nao pode ser vazio.'; end if;
  if tg_op = 'UPDATE' then new.editado_em := now(); end if;
  return new;
end;
$$;

create or replace function public.normalize_comentario_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.texto := btrim(coalesce(new.texto, ''));
  if new.texto = '' then raise exception 'O comentario nao pode ser vazio.'; end if;
  if tg_op = 'INSERT' then
    new.data_comentario := coalesce(new.data_comentario, now());
    new.editado_em := null;
  else
    new.editado_em := now();
  end if;
  return new;
end;
$$;

create or replace function public.prevent_self_like_on_review()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  review_author_id uuid;
begin
  select usuario_id into review_author_id
  from public.avaliacoes
  where id = new.avaliacao_id;
  if review_author_id is not null and review_author_id = new.usuario_id then
    raise exception 'O autor da review nao pode curtir a propria review.';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_self_review_like()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  review_author_id uuid;
begin
  select usuario_id into review_author_id
  from public.avaliacoes
  where id = new.avaliacao_id;
  if review_author_id is null then raise exception 'Review nao encontrada para a curtida.'; end if;
  if new.usuario_id = review_author_id then
    raise exception 'Voce nao pode curtir a propria review.';
  end if;
  return new;
end;
$$;

create or replace function public.set_atualizado_em()
returns trigger language plpgsql set search_path = public
as $$ begin new.atualizado_em = now(); return new; end; $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function public.sync_avaliacao_curtidas_count()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_review_id uuid;
begin
  target_review_id := coalesce(new.avaliacao_id, old.avaliacao_id);
  update public.avaliacoes
  set curtidas = (
    select count(*) from public.avaliacao_curtidas where avaliacao_id = target_review_id
  )
  where id = target_review_id;
  return coalesce(new, old);
end;
$$;

create or replace function public.sync_avaliacao_like_count()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_review_id uuid;
begin
  target_review_id := case when tg_op = 'DELETE' then old.avaliacao_id else new.avaliacao_id end;
  update public.avaliacoes
  set curtidas = (
    select count(*) from public.avaliacao_curtidas where avaliacao_id = target_review_id
  )
  where id = target_review_id;
  if tg_op = 'UPDATE' and old.avaliacao_id is distinct from new.avaliacao_id then
    update public.avaliacoes
    set curtidas = (
      select count(*) from public.avaliacao_curtidas where avaliacao_id = old.avaliacao_id
    )
    where id = old.avaliacao_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger comunidade_membros_count
after insert or delete on public.comunidade_membros
for each row execute function public.comunidade_membros_count_trigger();

create trigger comunidade_membros_set_updated_at
before update on public.comunidade_membros
for each row execute function public.set_atualizado_em();

create trigger comunidade_posts_count
after insert or delete or update of deleted_at on public.comunidade_posts
for each row execute function public.comunidade_posts_count_trigger();

create trigger comunidade_posts_set_updated_at
before update on public.comunidade_posts
for each row execute function public.set_updated_at();

create trigger comunidade_comentarios_count
after insert or delete or update of deleted_at on public.comunidade_post_comentarios
for each row execute function public.comunidade_comentarios_count_trigger();

create trigger comunidade_comentarios_set_updated_at
before update on public.comunidade_post_comentarios
for each row execute function public.set_updated_at();

create trigger comunidade_reacoes_count
after insert or delete or update of tipo on public.comunidade_post_reacoes
for each row execute function public.comunidade_reacoes_count_trigger();

create trigger comunidade_reacoes_set_updated_at
before update on public.comunidade_post_reacoes
for each row execute function public.set_updated_at();

create trigger trg_comunidade_solicitacoes_touch
before update on public.comunidade_solicitacoes_entrada
for each row execute function public.touch_updated_at();

create trigger trg_comunidade_denuncias_touch
before update on public.comunidade_denuncias
for each row execute function public.touch_updated_at();

create trigger avaliacoes_normalize_metadata
before insert or update on public.avaliacoes
for each row execute function public.normalize_avaliacao_metadata();

create trigger avaliacoes_normalize_write
before insert or update on public.avaliacoes
for each row execute function public.normalize_avaliacao_write();

create trigger comentarios_normalize_metadata
before insert or update on public.comentarios
for each row execute function public.normalize_comentario_metadata();

create trigger comentarios_normalize_write
before insert or update on public.comentarios
for each row execute function public.normalize_comentario_write();

create trigger avaliacao_curtidas_prevent_self_like
before insert or update on public.avaliacao_curtidas
for each row execute function public.prevent_self_like_on_review();

alter table public.usuarios enable row level security;
alter table public.jogos enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.comentarios enable row level security;
alter table public.avaliacao_curtidas enable row level security;
alter table public.avaliacao_deslikes enable row level security;
alter table public.comentario_curtidas enable row level security;
alter table public.comentario_deslikes enable row level security;
alter table public.seguidores enable row level security;
alter table public.lista_desejos enable row level security;
alter table public.status_jogo enable row level security;
alter table public.notifications enable row level security;
alter table public.comunidades enable row level security;
alter table public.comunidade_membros enable row level security;
alter table public.comunidade_posts enable row level security;
alter table public.comunidade_post_comentarios enable row level security;
alter table public.comunidade_post_reacoes enable row level security;
alter table public.comunidade_post_salvos enable row level security;
alter table public.comunidade_solicitacoes_entrada enable row level security;
alter table public.comunidade_denuncias enable row level security;
alter table public.denuncias_conteudo enable row level security;
alter table public.denuncias_perfil enable row level security;

create policy "Anyone can view games"
on public.jogos for select
to public
using (true);

create policy lista_desejos_public_read
on public.lista_desejos for select
to anon, authenticated
using (true);

create policy lista_desejos_insert_own
on public.lista_desejos for insert
to authenticated
with check ((select auth.uid()) = usuario_id);

create policy lista_desejos_update_own
on public.lista_desejos for update
to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

create policy lista_desejos_delete_own
on public.lista_desejos for delete
to authenticated
using ((select auth.uid()) = usuario_id);

create policy status_jogo_public_read
on public.status_jogo for select
to anon, authenticated
using (true);

create policy status_jogo_insert_own
on public.status_jogo for insert
to authenticated
with check ((select auth.uid()) = usuario_id);

create policy status_jogo_update_own
on public.status_jogo for update
to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

create policy status_jogo_delete_own
on public.status_jogo for delete
to authenticated
using ((select auth.uid()) = usuario_id);

create policy notifications_select_own
on public.notifications for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Comunidades visiveis"
on public.comunidades for select
to anon, authenticated
using (deleted_at is null);

create policy "Membros visiveis conforme comunidade"
on public.comunidade_membros for select
to anon, authenticated
using (public.can_ver_conteudo_comunidade(comunidade_id, (select auth.uid())));

create policy "Posts visiveis conforme comunidade"
on public.comunidade_posts for select
to anon, authenticated
using (
  deleted_at is null
  and public.can_ver_conteudo_comunidade(comunidade_id, (select auth.uid()))
);

create policy "Comentarios visiveis conforme comunidade"
on public.comunidade_post_comentarios for select
to anon, authenticated
using (
  deleted_at is null
  and public.can_ver_conteudo_comunidade(comunidade_id, (select auth.uid()))
);

create policy "Reacoes proprias visiveis"
on public.comunidade_post_reacoes for select
to authenticated
using (usuario_id = (select auth.uid()));

create policy "Salvos proprios visiveis"
on public.comunidade_post_salvos for select
to authenticated
using (usuario_id = (select auth.uid()));

create policy "Solicitacoes visiveis para autor ou moderador"
on public.comunidade_solicitacoes_entrada for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or public.is_comunidade_moderador(comunidade_id, (select auth.uid()))
);

create policy "Denuncias visiveis para denunciante ou moderador"
on public.comunidade_denuncias for select
to authenticated
using (
  denunciante_id = (select auth.uid())
  or public.is_comunidade_moderador(comunidade_id, (select auth.uid()))
);

create policy avaliacao_curtidas_select_public
on public.avaliacao_curtidas for select
to anon, authenticated
using (true);

create policy avaliacao_curtidas_insert_own
on public.avaliacao_curtidas for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and not exists (
    select 1
    from public.avaliacoes avaliacao
    where avaliacao.id = avaliacao_id
      and avaliacao.usuario_id = (select auth.uid())
  )
);

create policy avaliacao_curtidas_delete_own
on public.avaliacao_curtidas for delete
to authenticated
using (usuario_id = (select auth.uid()));

create policy avaliacao_deslikes_select_public
on public.avaliacao_deslikes for select
to anon, authenticated
using (true);

create policy avaliacao_deslikes_insert_own
on public.avaliacao_deslikes for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and not exists (
    select 1
    from public.avaliacoes avaliacao
    where avaliacao.id = avaliacao_id
      and avaliacao.usuario_id = (select auth.uid())
  )
);

create policy avaliacao_deslikes_delete_own
on public.avaliacao_deslikes for delete
to authenticated
using (usuario_id = (select auth.uid()));

create policy comentario_curtidas_select_public
on public.comentario_curtidas for select
to anon, authenticated
using (true);

create policy comentario_curtidas_insert_own
on public.comentario_curtidas for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and not exists (
    select 1
    from public.comentarios comentario
    where comentario.id = comentario_id
      and comentario.usuario_id = (select auth.uid())
  )
);

create policy comentario_curtidas_delete_own
on public.comentario_curtidas for delete
to authenticated
using (usuario_id = (select auth.uid()));

create policy comentario_deslikes_select_public
on public.comentario_deslikes for select
to anon, authenticated
using (true);

create policy comentario_deslikes_insert_own
on public.comentario_deslikes for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and not exists (
    select 1
    from public.comentarios comentario
    where comentario.id = comentario_id
      and comentario.usuario_id = (select auth.uid())
  )
);

create policy comentario_deslikes_delete_own
on public.comentario_deslikes for delete
to authenticated
using (usuario_id = (select auth.uid()));

create policy denuncias_conteudo_select_own
on public.denuncias_conteudo for select
to authenticated
using (denunciante_id = (select auth.uid()));

create policy denuncias_conteudo_insert_own
on public.denuncias_conteudo for insert
to authenticated
with check (denunciante_id = (select auth.uid()));

create policy denuncias_conteudo_delete_own
on public.denuncias_conteudo for delete
to authenticated
using (denunciante_id = (select auth.uid()));

create policy denuncias_perfil_select_own
on public.denuncias_perfil for select
to authenticated
using (denunciante_id = (select auth.uid()));

create policy denuncias_perfil_insert_own
on public.denuncias_perfil for insert
to authenticated
with check (
  denunciante_id = (select auth.uid())
  and denunciante_id <> usuario_denunciado_id
);

create policy denuncias_perfil_delete_own
on public.denuncias_perfil for delete
to authenticated
using (denunciante_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-uploads',
  'user-uploads',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
