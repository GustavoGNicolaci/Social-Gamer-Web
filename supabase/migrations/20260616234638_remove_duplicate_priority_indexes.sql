-- Remove non-unique duplicate index.
-- The UNIQUE constraint avaliacao_curtidas_unique_like remains on (avaliacao_id, usuario_id).
DROP INDEX IF EXISTS public.avaliacao_curtidas_lookup_idx;

-- Remove non-unique duplicate index.
-- The UNIQUE constraint seguidores_unique_pair remains on (seguidor_id, seguido_id).
DROP INDEX IF EXISTS public.seguidores_seguidor_seguido_idx;
;
