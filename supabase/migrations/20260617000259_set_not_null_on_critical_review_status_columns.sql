do $$
begin
  if exists (
    select 1
    from public.avaliacoes
    where usuario_id is null
       or jogo_id is null
       or nota is null
       or nota < 1
       or nota > 10
  ) then
    raise exception 'Abortado: public.avaliacoes possui valores nulos ou invalidos nas colunas criticas.';
  end if;

  if exists (
    select 1
    from public.status_jogo
    where usuario_id is null
       or jogo_id is null
       or status is null
       or status not in ('jogando', 'zerado', 'dropado', 'planejando', 'pausado')
  ) then
    raise exception 'Abortado: public.status_jogo possui valores nulos ou invalidos nas colunas criticas.';
  end if;
end $$;

alter table public.avaliacoes
  alter column usuario_id set not null,
  alter column jogo_id set not null,
  alter column nota set not null;

alter table public.status_jogo
  alter column usuario_id set not null,
  alter column jogo_id set not null,
  alter column status set not null;;
