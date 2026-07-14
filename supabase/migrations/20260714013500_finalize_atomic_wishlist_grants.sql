-- The atomic wishlist RPCs were created in the preceding migration. Remove the
-- temporary direct-write compatibility grants only after those replacements
-- exist, so a partial migration run never leaves the wishlist unwritable.

revoke insert, update, delete on table public.lista_desejos from authenticated;
