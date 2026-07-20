# Estado e verificação das migrations no Supabase sem Docker

Este documento registra o estado das migrations e o procedimento de verificação
do projeto remoto `apwkscpcjfmkfbqarguh`. A refatoração original não aplicou
migrations e não usou Docker.

Em 20/07/2026, uma consulta somente de leitura com
`supabase migration list --linked` confirmou que o histórico local e o remoto
estavam alinhados, incluindo:

```text
20260718001827_optimize_remaining_report_select_rls_initplans
20260718001830_add_game_review_overview_summary
```

Nenhuma Edge Function foi alterada nesta rodada, portanto não é necessário
executar `supabase functions deploy`.

## 1. Conferir o projeto e o histórico

Para reconfirmar o estado sem alterar o projeto remoto:

1. Execute os comandos na raiz do repositório.
2. Confirme que todas as linhas possuem os mesmos valores nas colunas `Local` e
   `Remote`.
3. Não use `migration repair` apenas para ocultar uma divergência.

```powershell
supabase login
supabase link --project-ref apwkscpcjfmkfbqarguh
supabase migration list --linked
```

As últimas linhas esperadas são:

```text
Local          Remote
20260718001827 20260718001827
20260718001830 20260718001830
```

## 2. Situação da aplicação

Não há migration local pendente no estado registrado em 20/07/2026. Portanto,
não é necessário executar `supabase db push --linked` apenas para reproduzir
esta verificação.

O primeiro arquivo apenas preserva as policies autenticadas de denúncias,
trocando `auth.uid()` por `(select auth.uid())`. O segundo adiciona a RPC pública
e somente-leitura `get_game_review_overview(integer)`.

Nenhum dado, tabela, índice, bucket ou configuração de Auth é removido.

Se uma consulta futura mostrar divergência, confirme backup ou Point-in-Time
Recovery, investigue a origem da diferença e revise um
`supabase db push --linked --dry-run` completo antes de autorizar qualquer
aplicação.

## 3. Comparar os tipos gerados

Para revalidar o contrato após a aplicação, gere os tipos remotos em um arquivo
temporário e compare com o contrato já versionado:

```powershell
supabase gen types typescript --linked --schema public | Set-Content -Encoding utf8 src/types/supabase.remote.ts
git diff --no-index -- src/types/supabase.ts src/types/supabase.remote.ts
Remove-Item -LiteralPath src/types/supabase.remote.ts
```

A assinatura esperada é:

```text
get_game_review_overview:
  Args: { p_game_id: number }
  Returns:
    game_id: number
    review_count: number
    average_rating: number | null
    comment_count: number
```

Diferenças em outros objetos indicam divergência do schema e devem ser
investigadas antes do deploy do frontend.

## 4. Validar policies e advisors

No Dashboard, abra **Database → Advisors** e atualize os advisors de
performance. O número esperado de avisos `auth_rls_initplan` é zero.

No SQL Editor, esta consulta deve mostrar as duas policies com um subselect em
`auth.uid()`:

```sql
select
  schemaname,
  tablename,
  policyname,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and (
    (tablename = 'denuncias_conteudo'
      and policyname = 'denuncias_conteudo_select_own')
    or
    (tablename = 'denuncias_perfil'
      and policyname = 'denuncias_perfil_select_own')
  )
order by tablename, policyname;
```

As três tabelas internas do catálogo sem policies permanecem sem grants
públicos. Os avisos de funções `SECURITY DEFINER` já cobertos pela allowlist e
os índices sem uso não devem ser alterados nesta aplicação.

## 5. Smoke tests

Antes de publicar o frontend:

1. Abra detalhes de um jogo sem login.
2. Confirme média, quantidade de reviews e total global de comentários.
3. Entre com uma conta de teste e repita a leitura.
4. Crie um comentário e confirme que o total aumenta após a atualização.
5. Teste paginação, reações e deep links `review-*` e `comment-*`.
6. Teste um jogo sem reviews: contagens zero e média vazia.
7. Confirme que catálogo, perfis e comunidades continuam carregando.
8. Verifique PT/EN, tema claro/escuro e mobile/desktop.

O frontend mantém fallback somente para `PGRST202` e `42883`. A RPC já está
registrada no histórico remoto; o fallback deve permanecer por uma versão para
compatibilidade com outros ambientes ou durante um rollback. No ambiente
atualizado, o total global exato vem da RPC.

## 6. Configuração administrativa

Ative **Leaked password protection** em Authentication quando a opção estiver
disponível no plano. Mantenha `jwt_expiry = 3600`.

Os secrets existentes (`CORS_ALLOWED_ORIGINS`, IGDB, DeepL e
`GAME_CATALOG_SYNC_SECRET`) e as quatro Edge Functions não precisam ser
alterados nesta rodada.

## 7. Publicar o frontend

Publique somente depois dos smoke tests:

```powershell
vercel --prod
```

Se o projeto usa deploy automático pelo Git, use o fluxo habitual. Mantenha o
fallback da nova RPC por uma versão após a confirmação em produção.
