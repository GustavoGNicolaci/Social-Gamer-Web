begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'public-profile@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'private-profile@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'friends-profile@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'viewer-profile@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.usuarios (
  id,
  username,
  nome_completo,
  avatar_path,
  bio,
  configuracoes_privacidade
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'public_profile_fixture',
    'Public Profile',
    'public/avatar.webp',
    'Public bio',
    '{"top5_jogos":[{"posicao":1,"jogo_id":101}]}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'private_profile_fixture',
    'Private Profile',
    'private/avatar.webp',
    'Private bio',
    '{"perfil_privado":true,"top5_jogos":[{"posicao":1,"jogo_id":202}]}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'friends_profile_fixture',
    'Friends Profile',
    'friends/avatar.webp',
    'Friends bio',
    '{"somente_amigos":true,"top5_jogos":[{"posicao":1,"jogo_id":303}]}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'viewer_profile_fixture',
    'Viewer Profile',
    'viewer/avatar.webp',
    'Viewer bio',
    '{}'::jsonb
  );

insert into public.seguidores (seguidor_id, seguido_id)
values
  ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');

select ok(
  has_column_privilege('anon', 'public.usuarios', 'id', 'select'),
  'anonymous users can select a public identity column'
);
select ok(
  not has_column_privilege('anon', 'public.usuarios', 'bio', 'select'),
  'anonymous users cannot select profile bio directly'
);
select ok(
  not has_column_privilege('authenticated', 'public.usuarios', 'configuracoes_privacidade', 'select'),
  'authenticated users cannot select privacy settings directly'
);
select ok(
  not has_table_privilege('anon', 'public.seguidores', 'select'),
  'anonymous users cannot enumerate follower rows'
);
select ok(
  has_table_privilege('authenticated', 'public.seguidores', 'select'),
  'authenticated users retain RLS-scoped follower reads'
);
select ok(
  not has_function_privilege('anon', 'public.get_my_profile()', 'execute'),
  'get_my_profile is not executable anonymously'
);
select ok(
  has_function_privilege('authenticated', 'public.get_my_profile()', 'execute'),
  'get_my_profile is executable by authenticated users'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (
    select profile.bio
    from public.get_public_profile_by_username('public_profile_fixture') as profile
  ),
  'Public bio',
  'public profile bio is returned anonymously'
);
select results_eq(
  $$
    select profile.bio, profile.top_five_entries, profile.can_view_restricted_content
    from public.get_public_profile_by_username('private_profile_fixture') as profile
  $$,
  $$ values (null::text, '[]'::jsonb, false) $$,
  'private profile fields are masked anonymously'
);
select is(
  (
    select count(*)
    from public.get_profile_connections(
      '10000000-0000-0000-0000-000000000002',
      'following'
    )
  ),
  0::bigint,
  'private connections are hidden from anonymous users'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
set local role authenticated;

select is(
  (
    select profile.bio
    from public.get_public_profile_by_username('friends_profile_fixture') as profile
  ),
  'Friends bio',
  'mutual friends can view friends-only profile fields'
);
select is(
  (select profile.bio from public.get_my_profile() as profile),
  'Viewer bio',
  'authenticated users can read their own complete profile'
);
select results_eq(
  $$
    select state.is_following, state.followers_count, state.following_count
    from public.get_profile_follow_state(
      '10000000-0000-0000-0000-000000000001'
    ) as state
  $$,
  $$ values (true, 2::bigint, 0::bigint) $$,
  'follow state returns aggregate counts and the current user state'
);
select results_eq(
  $$
    select relationship.user_id, relationship.is_following, relationship.is_mutual_friend
    from public.get_follow_relationship_map(array[
      '10000000-0000-0000-0000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000003'::uuid
    ]) as relationship
    order by relationship.user_id
  $$,
  $$
    values
      ('10000000-0000-0000-0000-000000000001'::uuid, true, false),
      ('10000000-0000-0000-0000-000000000003'::uuid, true, true)
  $$,
  'relationship map exposes only booleans for requested users'
);
select is(
  (select count(*) from public.seguidores),
  3::bigint,
  'follower table RLS exposes only relationships involving the current user'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select results_eq(
  $$
    select connection.id
    from public.get_profile_connections(
      '10000000-0000-0000-0000-000000000001',
      'followers'
    ) as connection
    order by connection.id
  $$,
  $$
    values
      ('10000000-0000-0000-0000-000000000002'::uuid),
      ('10000000-0000-0000-0000-000000000004'::uuid)
  $$,
  'public profile connections remain available through the safe projection'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select results_eq(
  $$
    select connection.id
    from public.get_profile_connections(
      '10000000-0000-0000-0000-000000000002',
      'following'
    ) as connection
  $$,
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid) $$,
  'profile owner can view their private connection list'
);

select * from finish();
rollback;
