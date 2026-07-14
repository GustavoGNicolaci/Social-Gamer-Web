alter function public.comunidade_comentarios_count_trigger() set search_path = public;
alter function public.comunidade_membros_count_trigger() set search_path = public;
alter function public.comunidade_posts_count_trigger() set search_path = public;
alter function public.comunidade_reacoes_count_trigger() set search_path = public;

alter function public.normalize_avaliacao_metadata() set search_path = public;
alter function public.normalize_avaliacao_write() set search_path = public;
alter function public.normalize_comentario_metadata() set search_path = public;
alter function public.normalize_comentario_write() set search_path = public;

alter function public.prevent_self_like_on_review() set search_path = public;
alter function public.prevent_self_review_like() set search_path = public;

alter function public.set_atualizado_em() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.touch_updated_at() set search_path = public;

alter function public.sync_avaliacao_curtidas_count() set search_path = public;
alter function public.sync_avaliacao_like_count() set search_path = public;;
