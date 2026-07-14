begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

select ok(
  not has_schema_privilege('anon', 'public', 'create'),
  'anonymous users cannot create objects in the exposed schema'
);
select ok(
  not has_schema_privilege('authenticated', 'public', 'create'),
  'authenticated users cannot shadow objects in the exposed schema'
);
select ok(
  has_schema_privilege('authenticated', 'public', 'usage'),
  'authenticated users can resolve explicitly granted public APIs'
);
select ok(
  has_schema_privilege('anon', 'private', 'usage'),
  'RLS can resolve private authorization helpers for anonymous requests'
);
select ok(
  has_function_privilege(
    'anon',
    'private.can_ver_conteudo_comunidade(uuid,uuid)',
    'execute'
  ),
  'community visibility policies can execute their private helper'
);
select ok(
  has_function_privilege(
    'authenticated',
    'private.is_comunidade_moderador(uuid,uuid)',
    'execute'
  ),
  'community moderation policies can execute their private helper'
);
select ok(
  has_function_privilege(
    'anon',
    'private.can_view_profile_restricted_content(uuid,uuid)',
    'execute'
  ),
  'profile privacy policies can execute their private helper'
);

select ok(
  not has_table_privilege('anon', 'public.avaliacao_curtidas', 'select'),
  'anonymous users cannot enumerate review reaction identities'
);
select ok(
  not has_table_privilege('authenticated', 'public.avaliacao_curtidas', 'select'),
  'authenticated users also use aggregate RPCs instead of reaction identities'
);
select ok(
  not has_table_privilege('anon', 'public.seguidores', 'select'),
  'anonymous users cannot enumerate follower rows'
);
select ok(
  has_column_privilege('authenticated', 'public.seguidores', 'seguido_id', 'insert'),
  'authenticated users can create a follow relationship'
);
select ok(
  not has_column_privilege('authenticated', 'public.seguidores', 'data_inicio', 'insert'),
  'follow timestamps are assigned by the database'
);
select ok(
  not has_column_privilege('anon', 'public.usuarios', 'bio', 'select'),
  'anonymous users cannot select profile bio directly'
);
select ok(
  not has_table_privilege('anon', 'public.jogos', 'update'),
  'anonymous catalog access is read only'
);
select ok(
  has_column_privilege('authenticated', 'public.avaliacoes', 'nota', 'update'),
  'review authors can update the score used by the edit flow'
);
select ok(
  not has_column_privilege('authenticated', 'public.avaliacoes', 'curtidas', 'update'),
  'review authors cannot forge aggregate like counters'
);
select ok(
  not has_column_privilege('authenticated', 'public.avaliacoes', 'data_publicacao', 'insert'),
  'review publication time is assigned by the database'
);
select ok(
  not has_column_privilege('authenticated', 'public.comentarios', 'texto', 'update'),
  'comment updates stay disabled until an edit flow exists'
);
select ok(
  has_column_privilege('authenticated', 'public.status_jogo', 'status', 'update'),
  'game status owners can use the existing status edit flow'
);
select ok(
  not has_column_privilege('authenticated', 'public.status_jogo', 'jogo_id', 'update'),
  'game status owners cannot move an existing row to another game'
);
select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'update'),
  'notifications are changed only through authorized RPCs'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ),
  'notifications are included in the Realtime publication'
);
select is(
  (
    select relation.relreplident
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'notifications'
  ),
  'f'::"char",
  'notifications use the same FULL replica identity as the linked project'
);
select ok(
  not has_column_privilege('authenticated', 'public.denuncias_conteudo', 'status', 'insert'),
  'content reporters cannot choose a moderation status'
);
select ok(
  not has_column_privilege('authenticated', 'public.denuncias_conteudo', 'created_at', 'insert'),
  'content report timestamps are assigned by the database'
);
select ok(
  not has_column_privilege('authenticated', 'public.denuncias_perfil', 'status', 'insert'),
  'profile reporters cannot choose a moderation status'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.denuncias_perfil',
    'nome_usuario_denunciado',
    'insert'
  ),
  'reported profile names are assigned by the trusted trigger'
);
select ok(
  not has_table_privilege('authenticated', 'public.game_import_attempts', 'select'),
  'the external import quota ledger is backend only'
);
select ok(
  not has_table_privilege('authenticated', 'public.lista_desejos', 'insert'),
  'wishlist inserts are available only through the atomic RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.lista_desejos', 'update'),
  'wishlist priority updates are available only through the atomic RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.lista_desejos', 'delete'),
  'wishlist deletes are available only through the atomic RPC'
);
select ok(
  has_function_privilege(
    'anon',
    'public.get_review_reaction_summaries(uuid[],uuid[])',
    'execute'
  ),
  'anonymous users can request aggregate reaction summaries'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.toggle_review_reaction(text,uuid,text)',
    'execute'
  ),
  'anonymous users cannot mutate reactions'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.toggle_review_reaction(text,uuid,text)',
    'execute'
  ),
  'authenticated users can use the atomic reaction mutation'
);
select ok(
  has_function_privilege('authenticated', 'public.add_own_wishlist_item(integer)', 'execute'),
  'authenticated users can add their own wishlist item atomically'
);
select ok(
  not has_function_privilege('anon', 'public.add_own_wishlist_item(integer)', 'execute'),
  'anonymous users cannot add wishlist items'
);
select ok(
  has_function_privilege('authenticated', 'public.reorder_own_wishlist(uuid[])', 'execute'),
  'authenticated users can atomically reorder their own wishlist'
);
select ok(
  has_function_privilege('authenticated', 'public.remove_own_wishlist_item(uuid)', 'execute'),
  'authenticated users can atomically remove their own wishlist item'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_game_import_attempt(uuid,text,integer,integer)',
    'execute'
  ),
  'the Edge backend can reserve an external import attempt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.reserve_game_import_attempt(uuid,text,integer,integer)',
    'execute'
  ),
  'browser users cannot bypass the Edge import quota contract'
);
select ok(
  has_function_privilege(
    'anon',
    'public.get_community_members_page(uuid,text,integer,integer)',
    'execute'
  ),
  'public communities can expose the authorized member projection'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.can_ver_conteudo_comunidade(uuid,uuid)',
    'execute'
  ),
  'internal community authorization helpers are not public RPCs'
);
select ok(
  not has_function_privilege('anon', 'public.normalize_avaliacao_write()', 'execute'),
  'trigger-only review normalization cannot be called as an anonymous RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.admin_cleanup_unused_catalog_games(integer[])',
    'execute'
  ),
  'the backend service role can execute the guarded catalog cleanup'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_cleanup_unused_catalog_games(integer[])',
    'execute'
  ),
  'anonymous users cannot execute catalog cleanup'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_cleanup_unused_catalog_games(integer[])',
    'execute'
  ),
  'authenticated users cannot execute catalog cleanup'
);
select ok(
  not (
    select procedure.prosecdef
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.admin_cleanup_unused_catalog_games(integer[])'::regprocedure
  ),
  'catalog cleanup runs with the service role privileges instead of SECURITY DEFINER'
);

select * from finish();
rollback;
