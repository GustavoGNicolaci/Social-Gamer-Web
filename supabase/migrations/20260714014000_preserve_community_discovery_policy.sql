-- Preserve the current production discovery contract: active communities are
-- visible in listings, while their members, posts and private media remain
-- protected by their own RLS policies and private authorization helpers.

drop policy if exists "Comunidades visiveis" on public.comunidades;

create policy "Comunidades visiveis"
on public.comunidades
for select
to anon, authenticated
using (deleted_at is null);
