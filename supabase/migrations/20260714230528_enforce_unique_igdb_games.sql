-- Keep one catalog row per objective IGDB identity. Title-based uniqueness is
-- intentionally avoided because remakes and ports may share a title.
do $$
begin
  if exists (
    select 1
    from public.jogos
    where (metadados -> 'igdb') ->> 'id' is not null
    group by (metadados -> 'igdb') ->> 'id'
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'duplicate IGDB games exist; run the catalog cleanup before applying this migration';
  end if;
end;
$$;

create unique index if not exists jogos_igdb_id_unique_idx
  on public.jogos (((metadados -> 'igdb') ->> 'id'))
  where (metadados -> 'igdb') ->> 'id' is not null;

comment on index public.jogos_igdb_id_unique_idx is
  'Prevents concurrent imports from creating more than one game for the same IGDB id.';
