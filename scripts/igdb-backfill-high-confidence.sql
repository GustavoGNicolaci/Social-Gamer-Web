begin;

with matches (
  jogo_id,
  external_id,
  igdb_slug,
  igdb_title,
  score,
  local_year,
  igdb_year
) as (
  values
    (1, '1877', 'cyberpunk-2077', 'Cyberpunk 2077', 96, 2020, 2020),
    (2, '119388', 'the-legend-of-zelda-tears-of-the-kingdom', 'The Legend of Zelda: Tears of the Kingdom', 86, 2023, 2023),
    (3, '119133', 'elden-ring', 'Elden Ring', 96, 2022, 2022),
    (4, '112875', 'god-of-war-ragnarok', 'God of War Ragnarök', 86, 2022, 2022),
    (5, '119171', 'baldurs-gate-iii', 'Baldur''s Gate III', 96, 2023, 2023),
    (6, '14593', 'hollow-knight', 'Hollow Knight', 96, 2017, 2017),
    (7, '17000', 'stardew-valley', 'Stardew Valley', 96, 2016, 2016),
    (8, '132181', 'resident-evil-4--1', 'Resident Evil 4', 80, 2023, 2023),
    (9, '113112', 'hades--1', 'Hades', 96, 2020, 2020),
    (10, '133236', 'final-fantasy-vii-rebirth', 'Final Fantasy VII Rebirth', 86, 2024, 2024),
    (11, '25076', 'red-dead-redemption-2', 'Red Dead Redemption 2', 96, 2018, 2018),
    (12, '1942', 'the-witcher-3-wild-hunt', 'The Witcher 3: Wild Hunt', 96, 2015, 2015),
    (13, '26758', 'super-mario-odyssey', 'Super Mario Odyssey', 86, 2017, 2017),
    (14, '114283', 'persona-5-royal', 'Persona 5 Royal', 86, 2019, 2019),
    (15, '103298', 'doom-eternal', 'Doom Eternal', 96, 2020, 2020),
    (16, '26226', 'celeste', 'Celeste', 96, 2018, 2018),
    (18, '36926', 'monster-hunter-world', 'Monster Hunter: World', 96, 2018, 2018),
    (19, '26472', 'disco-elysium', 'Disco Elysium', 96, 2019, 2019),
    (20, '109462', 'animal-crossing-new-horizons', 'Animal Crossing: New Horizons', 86, 2020, 2020),
    (21, '76882', 'sekiro-shadows-die-twice', 'Sekiro: Shadows Die Twice', 96, 2019, 2019),
    (22, '12517', 'undertale', 'Undertale', 86, 2015, 2015),
    (23, '75235', 'ghost-of-tsushima', 'Ghost of Tsushima', 96, 2020, 2020),
    (24, '37001', 'ori-and-the-will-of-the-wisps', 'Ori and the Will of the Wisps', 96, 2020, 2020),
    (25, '134584', 'returnal', 'Returnal', 96, 2021, 2021),
    (26, '135243', 'it-takes-two', 'It Takes Two', 96, 2021, 2021),
    (27, '15698', 'metroid-dread', 'Metroid Dread', 86, 2021, 2021),
    (28, '11208', 'nier-automata', 'NieR: Automata', 96, 2017, 2017),
    (29, '9061', 'cuphead', 'Cuphead', 96, 2017, 2017),
    (30, '19564', 'death-stranding', 'Death Stranding', 96, 2019, 2019)
),
upsert_external_ids as (
  insert into public.game_external_ids (
    jogo_id,
    provider,
    external_id,
    url,
    metadata,
    last_synced_at
  )
  select
    jogo_id,
    'igdb',
    external_id,
    'https://www.igdb.com/games/' || igdb_slug,
    jsonb_build_object(
      'slug', igdb_slug,
      'matched_title', igdb_title,
      'match_score', score,
      'match_confidence', 'high',
      'local_year', local_year,
      'igdb_year', igdb_year,
      'matched_by', 'scripts/igdb-match-dry-run.mjs'
    ),
    now()
  from matches
  on conflict (provider, external_id) do update
    set
      jogo_id = excluded.jogo_id,
      url = excluded.url,
      metadata = public.game_external_ids.metadata || excluded.metadata,
      last_synced_at = excluded.last_synced_at,
      updated_at = now()
    where public.game_external_ids.jogo_id = excluded.jogo_id
  returning jogo_id
)
update public.jogos as jogos
set
  slug = coalesce(jogos.slug, matches.igdb_slug),
  source_primary = 'igdb',
  status_importacao = case
    when jogos.status_importacao = 'imported' then jogos.status_importacao
    else 'pending'
  end,
  metadados = coalesce(jogos.metadados, '{}'::jsonb) || jsonb_build_object(
    'igdb_match',
    jsonb_build_object(
      'id', matches.external_id,
      'slug', matches.igdb_slug,
      'title', matches.igdb_title,
      'score', matches.score,
      'confidence', 'high',
      'local_year', matches.local_year,
      'igdb_year', matches.igdb_year
    )
  )
from matches
where jogos.id = matches.jogo_id
  and exists (
    select 1
    from upsert_external_ids
    where upsert_external_ids.jogo_id = jogos.id
  );

commit;
