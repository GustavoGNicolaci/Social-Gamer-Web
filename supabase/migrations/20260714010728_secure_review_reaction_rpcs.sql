-- Expose reaction aggregates without exposing the identities behind reactions.
-- Mutations stay atomic and derive the acting user exclusively from auth.uid().

create or replace function public.get_review_reaction_summaries(
  p_review_ids uuid[] default '{}'::uuid[],
  p_comment_ids uuid[] default '{}'::uuid[]
)
returns table (
  content_type text,
  content_id uuid,
  curtidas integer,
  dislikes integer,
  liked_by_current_user boolean,
  disliked_by_current_user boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_requested_count integer :=
    coalesce(cardinality(p_review_ids), 0) + coalesce(cardinality(p_comment_ids), 0);
begin
  if v_requested_count > 500 then
    raise exception 'reaction_summary_limit_exceeded'
      using errcode = '22023';
  end if;

  return query
  with requested_reviews as (
    select distinct requested.content_id
    from unnest(coalesce(p_review_ids, '{}'::uuid[])) as requested(content_id)
    where requested.content_id is not null
  ),
  valid_reviews as (
    select requested.content_id
    from requested_reviews as requested
    join public.avaliacoes as review
      on review.id = requested.content_id
  ),
  review_reactions as (
    select
      reaction.content_id,
      count(*) filter (where reaction.kind = 'like')::integer as curtidas,
      count(*) filter (where reaction.kind = 'dislike')::integer as dislikes,
      bool_or(
        reaction.kind = 'like'
        and v_user_id is not null
        and reaction.user_id = v_user_id
      ) as liked_by_current_user,
      bool_or(
        reaction.kind = 'dislike'
        and v_user_id is not null
        and reaction.user_id = v_user_id
      ) as disliked_by_current_user
    from (
      select
        likes.avaliacao_id as content_id,
        likes.usuario_id as user_id,
        'like'::text as kind
      from public.avaliacao_curtidas as likes
      join requested_reviews as requested
        on requested.content_id = likes.avaliacao_id

      union all

      select
        dislikes.avaliacao_id as content_id,
        dislikes.usuario_id as user_id,
        'dislike'::text as kind
      from public.avaliacao_deslikes as dislikes
      join requested_reviews as requested
        on requested.content_id = dislikes.avaliacao_id
    ) as reaction
    group by reaction.content_id
  ),
  requested_comments as (
    select distinct requested.content_id
    from unnest(coalesce(p_comment_ids, '{}'::uuid[])) as requested(content_id)
    where requested.content_id is not null
  ),
  valid_comments as (
    select requested.content_id
    from requested_comments as requested
    join public.comentarios as comment
      on comment.id = requested.content_id
  ),
  comment_reactions as (
    select
      reaction.content_id,
      count(*) filter (where reaction.kind = 'like')::integer as curtidas,
      count(*) filter (where reaction.kind = 'dislike')::integer as dislikes,
      bool_or(
        reaction.kind = 'like'
        and v_user_id is not null
        and reaction.user_id = v_user_id
      ) as liked_by_current_user,
      bool_or(
        reaction.kind = 'dislike'
        and v_user_id is not null
        and reaction.user_id = v_user_id
      ) as disliked_by_current_user
    from (
      select
        likes.comentario_id as content_id,
        likes.usuario_id as user_id,
        'like'::text as kind
      from public.comentario_curtidas as likes
      join requested_comments as requested
        on requested.content_id = likes.comentario_id

      union all

      select
        dislikes.comentario_id as content_id,
        dislikes.usuario_id as user_id,
        'dislike'::text as kind
      from public.comentario_deslikes as dislikes
      join requested_comments as requested
        on requested.content_id = dislikes.comentario_id
    ) as reaction
    group by reaction.content_id
  )
  select
    'review'::text as content_type,
    review.content_id,
    coalesce(summary.curtidas, 0)::integer as curtidas,
    coalesce(summary.dislikes, 0)::integer as dislikes,
    coalesce(summary.liked_by_current_user, false) as liked_by_current_user,
    coalesce(summary.disliked_by_current_user, false) as disliked_by_current_user
  from valid_reviews as review
  left join review_reactions as summary
    on summary.content_id = review.content_id

  union all

  select
    'comment'::text as content_type,
    comment.content_id,
    coalesce(summary.curtidas, 0)::integer as curtidas,
    coalesce(summary.dislikes, 0)::integer as dislikes,
    coalesce(summary.liked_by_current_user, false) as liked_by_current_user,
    coalesce(summary.disliked_by_current_user, false) as disliked_by_current_user
  from valid_comments as comment
  left join comment_reactions as summary
    on summary.content_id = comment.content_id;
end;
$function$;

create or replace function public.toggle_review_reaction(
  p_content_type text,
  p_content_id uuid,
  p_reaction text
)
returns table (
  reaction_status text,
  curtidas integer,
  dislikes integer,
  liked_by_current_user boolean,
  disliked_by_current_user boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_author_id uuid;
  v_has_reaction boolean;
  v_reaction_status text;
  v_curtidas integer;
  v_dislikes integer;
  v_liked_by_current_user boolean;
  v_disliked_by_current_user boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated'
      using errcode = '28000';
  end if;

  if p_content_id is null then
    raise exception 'content_id_required'
      using errcode = '22023';
  end if;

  if p_content_type is null or p_content_type not in ('review', 'comment') then
    raise exception 'invalid_content_type'
      using errcode = '22023';
  end if;

  if p_reaction is null or p_reaction not in ('like', 'dislike') then
    raise exception 'invalid_reaction'
      using errcode = '22023';
  end if;

  if p_content_type = 'review' then
    select review.usuario_id
    into v_author_id
    from public.avaliacoes as review
    where review.id = p_content_id
    for update;

    if not found then
      raise exception 'review_not_found'
        using errcode = 'P0002';
    end if;

    if v_author_id = v_user_id then
      raise exception 'self_reaction_not_allowed'
        using errcode = '42501';
    end if;

    if p_reaction = 'like' then
      select exists (
        select 1
        from public.avaliacao_curtidas as likes
        where likes.avaliacao_id = p_content_id
          and likes.usuario_id = v_user_id
      ) into v_has_reaction;

      if v_has_reaction then
        delete from public.avaliacao_curtidas
        where avaliacao_id = p_content_id
          and usuario_id = v_user_id;
        v_reaction_status := 'unliked';
      else
        delete from public.avaliacao_deslikes
        where avaliacao_id = p_content_id
          and usuario_id = v_user_id;

        insert into public.avaliacao_curtidas (avaliacao_id, usuario_id)
        values (p_content_id, v_user_id)
        on conflict do nothing;
        v_reaction_status := 'liked';
      end if;
    else
      select exists (
        select 1
        from public.avaliacao_deslikes as dislikes
        where dislikes.avaliacao_id = p_content_id
          and dislikes.usuario_id = v_user_id
      ) into v_has_reaction;

      if v_has_reaction then
        delete from public.avaliacao_deslikes
        where avaliacao_id = p_content_id
          and usuario_id = v_user_id;
        v_reaction_status := 'undisliked';
      else
        delete from public.avaliacao_curtidas
        where avaliacao_id = p_content_id
          and usuario_id = v_user_id;

        insert into public.avaliacao_deslikes (avaliacao_id, usuario_id)
        values (p_content_id, v_user_id)
        on conflict do nothing;
        v_reaction_status := 'disliked';
      end if;
    end if;

    select count(*)::integer
    into v_curtidas
    from public.avaliacao_curtidas as likes
    where likes.avaliacao_id = p_content_id;

    select count(*)::integer
    into v_dislikes
    from public.avaliacao_deslikes as dislikes
    where dislikes.avaliacao_id = p_content_id;

    select exists (
      select 1
      from public.avaliacao_curtidas as likes
      where likes.avaliacao_id = p_content_id
        and likes.usuario_id = v_user_id
    ) into v_liked_by_current_user;

    select exists (
      select 1
      from public.avaliacao_deslikes as dislikes
      where dislikes.avaliacao_id = p_content_id
        and dislikes.usuario_id = v_user_id
    ) into v_disliked_by_current_user;
  else
    select comment.usuario_id
    into v_author_id
    from public.comentarios as comment
    where comment.id = p_content_id
    for update;

    if not found then
      raise exception 'comment_not_found'
        using errcode = 'P0002';
    end if;

    if v_author_id = v_user_id then
      raise exception 'self_reaction_not_allowed'
        using errcode = '42501';
    end if;

    if p_reaction = 'like' then
      select exists (
        select 1
        from public.comentario_curtidas as likes
        where likes.comentario_id = p_content_id
          and likes.usuario_id = v_user_id
      ) into v_has_reaction;

      if v_has_reaction then
        delete from public.comentario_curtidas
        where comentario_id = p_content_id
          and usuario_id = v_user_id;
        v_reaction_status := 'unliked';
      else
        delete from public.comentario_deslikes
        where comentario_id = p_content_id
          and usuario_id = v_user_id;

        insert into public.comentario_curtidas (comentario_id, usuario_id)
        values (p_content_id, v_user_id)
        on conflict do nothing;
        v_reaction_status := 'liked';
      end if;
    else
      select exists (
        select 1
        from public.comentario_deslikes as dislikes
        where dislikes.comentario_id = p_content_id
          and dislikes.usuario_id = v_user_id
      ) into v_has_reaction;

      if v_has_reaction then
        delete from public.comentario_deslikes
        where comentario_id = p_content_id
          and usuario_id = v_user_id;
        v_reaction_status := 'undisliked';
      else
        delete from public.comentario_curtidas
        where comentario_id = p_content_id
          and usuario_id = v_user_id;

        insert into public.comentario_deslikes (comentario_id, usuario_id)
        values (p_content_id, v_user_id)
        on conflict do nothing;
        v_reaction_status := 'disliked';
      end if;
    end if;

    select count(*)::integer
    into v_curtidas
    from public.comentario_curtidas as likes
    where likes.comentario_id = p_content_id;

    select count(*)::integer
    into v_dislikes
    from public.comentario_deslikes as dislikes
    where dislikes.comentario_id = p_content_id;

    select exists (
      select 1
      from public.comentario_curtidas as likes
      where likes.comentario_id = p_content_id
        and likes.usuario_id = v_user_id
    ) into v_liked_by_current_user;

    select exists (
      select 1
      from public.comentario_deslikes as dislikes
      where dislikes.comentario_id = p_content_id
        and dislikes.usuario_id = v_user_id
    ) into v_disliked_by_current_user;
  end if;

  return query
  select
    v_reaction_status,
    v_curtidas,
    v_dislikes,
    v_liked_by_current_user,
    v_disliked_by_current_user;
end;
$function$;

-- Reaction identities are no longer public. Authenticated users may inspect only
-- their own rows, which keeps existing own-row insert/delete flows compatible.
drop policy if exists avaliacao_curtidas_select_public on public.avaliacao_curtidas;
drop policy if exists avaliacao_curtidas_select_own on public.avaliacao_curtidas;
create policy avaliacao_curtidas_select_own
on public.avaliacao_curtidas for select
to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists avaliacao_deslikes_select_public on public.avaliacao_deslikes;
drop policy if exists avaliacao_deslikes_select_own on public.avaliacao_deslikes;
create policy avaliacao_deslikes_select_own
on public.avaliacao_deslikes for select
to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists comentario_curtidas_select_public on public.comentario_curtidas;
drop policy if exists comentario_curtidas_select_own on public.comentario_curtidas;
create policy comentario_curtidas_select_own
on public.comentario_curtidas for select
to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists comentario_deslikes_select_public on public.comentario_deslikes;
drop policy if exists comentario_deslikes_select_own on public.comentario_deslikes;
create policy comentario_deslikes_select_own
on public.comentario_deslikes for select
to authenticated
using (usuario_id = (select auth.uid()));

revoke select on table
  public.avaliacao_curtidas,
  public.avaliacao_deslikes,
  public.comentario_curtidas,
  public.comentario_deslikes
from public, anon;

grant select, insert, delete on table
  public.avaliacao_curtidas,
  public.avaliacao_deslikes,
  public.comentario_curtidas,
  public.comentario_deslikes
to authenticated;

revoke all privileges on function public.get_review_reaction_summaries(uuid[], uuid[])
from public, anon, authenticated;
grant execute on function public.get_review_reaction_summaries(uuid[], uuid[])
to anon, authenticated;

revoke all privileges on function public.toggle_review_reaction(text, uuid, text)
from public, anon, authenticated;
grant execute on function public.toggle_review_reaction(text, uuid, text)
to authenticated;

comment on function public.get_review_reaction_summaries(uuid[], uuid[]) is
  'Returns aggregate review/comment reaction state without exposing reacting user identities.';
comment on function public.toggle_review_reaction(text, uuid, text) is
  'Atomically toggles the authenticated user reaction after server-side ownership validation.';
