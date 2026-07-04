drop index if exists public.jogo_midias_provider_external_idx;

create unique index if not exists jogo_midias_jogo_provider_external_idx
  on public.jogo_midias (jogo_id, provider, external_media_id)
  where external_media_id is not null;
