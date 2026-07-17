# Aplicação no Supabase sem Docker

Este procedimento não usa Docker. Ele conecta a CLI diretamente ao projeto
remoto `apwkscpcjfmkfbqarguh`. Nenhum destes comandos foi executado durante a
refatoração.

## 1. Antes de alterar o projeto remoto

1. Confirme que há backup recente ou Point-in-Time Recovery no Dashboard.
2. Atualize a Supabase CLI.
3. Execute os comandos a partir da raiz do repositório.
4. Não prossiga se o `--dry-run` listar migrations além das esperadas neste
   documento.

```powershell
supabase login
supabase link --project-ref apwkscpcjfmkfbqarguh
supabase migration list --linked
```

## 2. Configurar secrets antes do deploy das funções

O valor de um secret já salvo não pode ser recuperado pela CLI. Este comando
mostra apenas os nomes:

```powershell
supabase secrets list --project-ref apwkscpcjfmkfbqarguh
```

Se o `GAME_CATALOG_SYNC_SECRET` foi perdido, gere outro e rotacione:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Guarde o resultado em um gerenciador de senhas. Não use a anon key, a
service-role key ou a chave da DeepL como sync secret.

Configure primeiro as origens autorizadas. Isso é necessário para evitar o 403
sem `Access-Control-Allow-Origin` no localhost e na Vercel:

```powershell
supabase secrets set --project-ref apwkscpcjfmkfbqarguh CORS_ALLOWED_ORIGINS="https://social-gamer-web.vercel.app,http://localhost:5173,http://127.0.0.1:5173"
```

Configure as credenciais externas usando os valores reais:

```powershell
supabase secrets set --project-ref apwkscpcjfmkfbqarguh IGDB_CLIENT_ID="SEU_CLIENT_ID" IGDB_CLIENT_SECRET="SEU_CLIENT_SECRET"
supabase secrets set --project-ref apwkscpcjfmkfbqarguh GAME_CATALOG_SYNC_SECRET="SEU_SEGREDO_GERADO" DEEPL_API_KEY="SUA_CHAVE_DEEPL"
```

- `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`: aplicativo no portal de
  desenvolvedores da Twitch/IGDB.
- `DEEPL_API_KEY`: chave da conta DeepL API.
- `GAME_CATALOG_SYNC_SECRET`: segredo aleatório criado por você; ele não vem de
  uma API externa.

Depois confira somente a presença dos nomes:

```powershell
supabase secrets list --project-ref apwkscpcjfmkfbqarguh
```

## 3. Revisar as migrations pendentes

As 11 migrations novas esperadas, nesta ordem, são:

```text
20260715015801_optimize_reaction_and_report_rls_initplans
20260715015809_optimize_profile_state_rls_initplans
20260715015816_optimize_community_rls_initplans
20260715015823_relocate_pg_trgm_to_extensions
20260715015830_add_paginated_game_review_read_models
20260715015839_add_paginated_community_comment_read_models
20260715015846_add_profile_game_status_page
20260715015856_harden_community_membership_functions
20260715015900_harden_community_content_functions
20260715015903_harden_community_moderation_functions
20260715015907_harden_notification_functions
```

Faça o dry-run:

```powershell
supabase db push --linked --dry-run
```

Se aparecer qualquer migration anterior não reconhecida, não execute o push.
Revise primeiro a saída de `supabase migration list --linked`. Não use
`migration repair` apenas para fazer a lista ficar verde.

## 4. Aplicar as migrations

Somente depois de confirmar o dry-run:

```powershell
supabase db push --linked
supabase migration list --linked
```

O push aplica todas as migrations pendentes em ordem. Não é necessário colar
cada arquivo no SQL Editor.

## 5. Fazer deploy das Edge Functions

As quatro funções devem ser publicadas porque a versão exata do Supabase JS foi
fixada em seus `deno.json`. As duas funções públicas validam autorização dentro
do próprio contrato indicado:

```powershell
supabase functions deploy game-catalog --project-ref apwkscpcjfmkfbqarguh --no-verify-jwt
supabase functions deploy search-import-games --project-ref apwkscpcjfmkfbqarguh
supabase functions deploy game-catalog-sync --project-ref apwkscpcjfmkfbqarguh --no-verify-jwt
supabase functions deploy delete-own-account --project-ref apwkscpcjfmkfbqarguh
```

- `game-catalog`: público, somente leitura.
- `search-import-games`: exige JWT de usuário.
- `game-catalog-sync`: servidor para servidor; exige
  `GAME_CATALOG_SYNC_SECRET`.
- `delete-own-account`: exige JWT de usuário e validação de senha.

## 6. Validar CORS antes do frontend

Teste o preflight local:

```powershell
curl.exe -i -X OPTIONS "https://apwkscpcjfmkfbqarguh.supabase.co/functions/v1/game-catalog" -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,apikey,content-type"
```

O esperado é status `204` e:

```text
Access-Control-Allow-Origin: http://localhost:5173
```

Repita com a origem hospedada:

```powershell
curl.exe -i -X OPTIONS "https://apwkscpcjfmkfbqarguh.supabase.co/functions/v1/game-catalog" -H "Origin: https://social-gamer-web.vercel.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,apikey,content-type"
```

## 7. Smoke tests obrigatórios

Antes do deploy do frontend, valide:

1. Página de detalhes de jogo anônima no localhost e na Vercel.
2. Busca local do catálogo; importação externa somente após login.
3. Reviews públicas, “mostrar mais”, comentários, reações e deep links.
4. Perfil público/amigos/privado; status e wishlist.
5. Comunidade pública/privada; membros, comentários e moderação.
6. Login, recuperação, troca de senha e uma exclusão usando conta de teste.
7. Notificações, Realtime e mídia privada.
8. PT/EN, temas e tamanhos desktop/mobile.

Para testar uma sincronização mínima sem expor o secret no navegador:

```powershell
$env:GAME_CATALOG_SYNC_SECRET="SEU_SEGREDO_GERADO"
curl.exe -i -X POST "https://apwkscpcjfmkfbqarguh.supabase.co/functions/v1/game-catalog-sync" -H "Authorization: Bearer $env:GAME_CATALOG_SYNC_SECRET" -H "Content-Type: application/json" --data "{\"limit\":1}"
Remove-Item Env:GAME_CATALOG_SYNC_SECRET
```

## 8. Configuração administrativa

No Dashboard, ative “Leaked password protection” em Authentication quando a
opção estiver disponível no plano. Mantenha a expiração do JWT em 3.600
segundos.

## 9. Deploy do frontend

Faça o deploy somente após os smoke tests:

```powershell
vercel --prod
```

Se o projeto já é publicado automaticamente por Git, use o fluxo habitual em
vez desse comando.

Mantenha os fallbacks de RPC no frontend até confirmar em produção que as novas
funções aparecem no cache de schema da Data API. Eles só são acionados para
`PGRST202` e `42883`.
