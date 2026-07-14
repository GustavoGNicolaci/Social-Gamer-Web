create or replace function public.admin_cleanup_unused_catalog_games(
  p_game_ids integer[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game_ids integer[];
  v_deleted_count integer := 0;
begin
  select coalesce(array_agg(distinct candidate.game_id order by candidate.game_id), '{}'::integer[])
  into v_game_ids
  from unnest(coalesce(p_game_ids, '{}'::integer[])) as candidate(game_id)
  where candidate.game_id is not null;

  if cardinality(v_game_ids) = 0 then
    return 0;
  end if;

  if cardinality(v_game_ids) > 5000 then
    raise exception using
      errcode = '22023',
      message = 'catalog cleanup accepts at most 5000 game ids';
  end if;

  -- The row lock also prevents a concurrent foreign-key reference from being
  -- inserted between the usage checks and the delete.
  perform game.id
  from public.jogos as game
  where game.id = any(v_game_ids)
  order by game.id
  for update;

  if exists (select 1 from public.avaliacoes where jogo_id = any(v_game_ids))
    or exists (select 1 from public.lista_desejos where jogo_id = any(v_game_ids))
    or exists (select 1 from public.status_jogo where jogo_id = any(v_game_ids))
    or exists (select 1 from public.comunidades where jogo_id = any(v_game_ids))
    or exists (select 1 from public.steam_owned_games where jogo_id = any(v_game_ids))
    or exists (select 1 from public.steam_app_achievements where jogo_id = any(v_game_ids))
    or exists (
      select 1
      from public.usuarios as user_profile
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(user_profile.configuracoes_privacidade -> 'top5_jogos') = 'array'
            then user_profile.configuracoes_privacidade -> 'top5_jogos'
          else '[]'::jsonb
        end
      ) as top_game(entry)
      where (top_game.entry ->> 'jogo_id') ~ '^[0-9]+$'
        and (top_game.entry ->> 'jogo_id')::integer = any(v_game_ids)
    ) then
    raise exception using
      errcode = '23503',
      message = 'catalog cleanup aborted because at least one game is in use';
  end if;

  delete from public.notifications as notification
  where (
      (notification.metadata ->> 'game_id') ~ '^[0-9]+$'
      and (notification.metadata ->> 'game_id')::integer = any(v_game_ids)
    )
    or (
      lower(coalesce(notification.entity_type, '')) in ('game', 'jogo')
      and notification.entity_id ~ '^[0-9]+$'
      and notification.entity_id::integer = any(v_game_ids)
    )
    or exists (
      select 1
      from unnest(v_game_ids) as candidate(game_id)
      where coalesce(notification.link, '') ~ ('^/games/' || candidate.game_id::text || '($|[/?#])')
    );

  delete from public.game_catalog_cache
  where provider = 'igdb';

  delete from public.jogos
  where id = any(v_game_ids);

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

comment on function public.admin_cleanup_unused_catalog_games(integer[]) is
  'Atomically removes unused catalog games selected by the backend cleanup audit.';

revoke all on function public.admin_cleanup_unused_catalog_games(integer[]) from public;
revoke all on function public.admin_cleanup_unused_catalog_games(integer[]) from anon, authenticated;
grant execute on function public.admin_cleanup_unused_catalog_games(integer[]) to service_role;
