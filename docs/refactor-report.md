# Relatório da refatoração progressiva

## Escopo e garantias

Esta rodada foi executada de forma incremental, preservando rotas, contratos
públicos, classes CSS, IDs de deep links, traduções e fachadas existentes.

- Nenhum arquivo ou funcionalidade foi removido.
- Nenhum dado do catálogo foi apagado.
- Nenhuma migration foi aplicada ao projeto remoto.
- Nenhuma policy, função, secret ou configuração remota foi alterada.
- Docker não foi utilizado.
- Nenhuma dependência nova de runtime foi adicionada.

## Resumo das mudanças

As páginas e serviços mais concentrados foram divididos por domínio, mantendo
os caminhos antigos como fachadas de compatibilidade:

| Alvo | Antes | Depois | Responsabilidade atual |
| --- | ---: | ---: | --- |
| `ProfilePage.tsx` | 2.444 linhas | 925 linhas | rota, abas e composição |
| `GameDetailsPage.tsx` | 2.343 linhas | 174 linhas | composição da página |
| `CommunityDetailsPage.tsx` | 1.514 linhas | 1.128 linhas | orquestração das áreas da comunidade |
| `communityService.ts` | 1.816 linhas | 95 linhas | fachada compatível |
| `AuthContext.tsx` | 960 linhas | 422 linhas | estado público do provider |

Foram criadas as áreas `app`, `features` e `integrations`, sem uma movimentação
geral do projeto e sem quebrar imports existentes.

## Nova estrutura

```text
src/
  app/
    AppProviders.tsx
    AppRouter.tsx
  features/
    auth/
      data/
      domain/
    catalog/
      components/
      hooks/
    communities/
      components/
      data/
      domain/
      hooks/
    notifications/
      data/
      domain/
    profile/
      hooks/
    reviews/
      components/
      domain/
      hooks/
  integrations/
    supabase/
      client.ts
  pages/                    # rotas e composição
  services/                 # fachadas compatíveis

supabase/
  functions/
  migrations/
  tests/

scripts/
  check-bundle-budget.mjs
  check-supabase-contracts.mjs

docs/
  refactor-baseline/
```

## Arquivos criados

### Composição e integração

- `src/app/AppProviders.tsx`
- `src/app/AppRouter.tsx`
- `src/integrations/supabase/client.ts`

### Autenticação

- `src/features/auth/domain/types.ts`
- `src/features/auth/data/loginOperations.ts`
- `src/features/auth/data/passwordOperations.ts`
- `src/features/auth/data/profileRepository.ts`
- `src/features/auth/data/registrationOperations.ts`
- `src/features/auth/data/sessionRepository.ts`
- Testes colocados ao lado de cada módulo de dados.

### Perfil e catálogo

- Hooks específicos em `src/features/profile/hooks/`.
- `ProfileGameStatusGrid.tsx`, `ProfileWishlistGrid.tsx` e
  `profileGameStatusView.ts`.
- `GameDetailsOverview.tsx` e `GameDetailsUserActions.tsx`.
- `useGameStatusAction.ts` e `useGameWishlistAction.ts`.
- Testes de caracterização das páginas, seções, grids, hooks e guards.

### Reviews

- `GameReviewsSection.tsx`
- `gameReviewState.ts`
- `reviewError.ts`
- `useGameReviewsController.ts`
- Testes de merge, reações otimistas, rollback, paginação, fallback e
  respostas obsoletas.

### Comunidades

- Componentes específicos para feed, membros, participação, configurações e
  moderação em `src/features/communities/components/`.
- Queries, mapeadores, membership, posts, moderação e tipos em
  `src/features/communities/data/`.
- Controllers específicos em `src/features/communities/hooks/`.
- Testes colocados ao lado dos módulos e componentes.

### Notificações

- `src/features/notifications/domain/types.ts`
- `src/features/notifications/data/notificationRepository.ts`
- Testes do repositório.

### Guardrails e documentação

- `scripts/check-bundle-budget.mjs`
- `scripts/check-supabase-contracts.mjs`
- Screenshots e orçamento em `docs/refactor-baseline/`.
- Testes de caracterização de `ProfilePage`, `GameDetailsPage` e
  `CommunityDetailsPage`.

### Edge Functions

- `supabase/functions/delete-own-account/auth.ts`
- Testes Vitest e Deno da autenticação da exclusão.
- `deno.lock` nas quatro funções para resolução reproduzível.

### Migrations e contratos SQL

Foram criadas 11 migrations, na ordem:

1. `20260715015801_optimize_reaction_and_report_rls_initplans.sql`
2. `20260715015809_optimize_profile_state_rls_initplans.sql`
3. `20260715015816_optimize_community_rls_initplans.sql`
4. `20260715015823_relocate_pg_trgm_to_extensions.sql`
5. `20260715015830_add_paginated_game_review_read_models.sql`
6. `20260715015839_add_paginated_community_comment_read_models.sql`
7. `20260715015846_add_profile_game_status_page.sql`
8. `20260715015856_harden_community_membership_functions.sql`
9. `20260715015900_harden_community_content_functions.sql`
10. `20260715015903_harden_community_moderation_functions.sql`
11. `20260715015907_harden_notification_functions.sql`

Cada grupo possui um contrato pgTAP correspondente em `supabase/tests/`.

## Arquivos removidos

Nenhum. Os candidatos antigos não foram removidos porque esta rodada não
concluiu evidência suficiente para exclusão conservadora.

## Componentes, hooks e serviços extraídos

- Perfil: resolução de rota/privacidade, edição, follow, denúncias, reviews,
  status e wishlist.
- Jogo: detalhes do catálogo, ações de status/wishlist e controller de reviews.
- Reviews: merge paginado, comentários paginados, deep links, reação otimista,
  rollback e erros do domínio.
- Comunidades: resumo, feed, membros, membership, configurações e moderação.
- Auth: sessão, login, cadastro, senha, perfil/provisionamento e exclusão.
- Notificações: tipos e repositório de dados.
- Supabase: cliente real em `integrations`; o caminho antigo permanece como
  fachada.

## Duplicações e acoplamentos removidos

- `communityService` deixou de misturar tipos, mapeamento, queries, mídia,
  membership e moderação.
- `AuthContext` deixou de implementar diretamente todas as operações de Auth.
- Estado e merge de reviews foram isolados do JSX da página.
- Composição de providers e rotas saiu de `App.tsx`.
- Tipos e acesso a notificações foram separados da fachada.
- Mensagens novas de erro de domínio são traduzidas nos consumidores.

## Melhorias de desempenho

- Conexões do perfil são carregadas progressivamente.
- Membros e comentários de comunidade usam paginação de servidor.
- Reviews carregam 3 itens inicialmente e páginas seguintes de 4.
- Comentários de review carregam 2 itens inicialmente e páginas seguintes de 4.
- Deep links resolvem âncoras sem baixar coleções completas.
- Status de jogos passa a ordenar no SQL antes de `LIMIT/OFFSET`.
- Requisições obsoletas e cliques duplicados são ignorados.
- Fallback legado só ocorre quando a RPC ainda não existe (`PGRST202` ou
  `42883`).

O JavaScript inicial ficou em 689.240 bytes, 1,75% acima da base e 21.984 bytes
abaixo do limite aprovado. Os chunks lazy de jogo e comunidade cresceram devido
à paginação e aos guards; as exceções estão justificadas em
`docs/refactor-baseline/bundle-budget.md`.

## Melhorias de segurança

- 22 policies foram reescritas para avaliar `(select auth.uid())` uma vez por
  statement, preservando a lógica de acesso.
- Novas RPCs possuem limites de entrada, desempates estáveis e grants
  explícitos.
- RPCs privilegiadas de comunidade e notificações possuem `search_path`
  endurecido e grants explícitos, preservando `service_role`.
- Leituras paginadas de reações retornam contagens e estado do usuário atual,
  não listas de identidades.
- `delete-own-account` revoga globalmente refresh tokens antes de apagar o
  usuário.
- A sessão temporária usada para validar senha sempre é encerrada em `finally`.
- Dependências das Edge Functions estão fixadas em
  `@supabase/supabase-js@2.110.5`.
- `verify_jwt` está declarado por função em `supabase/config.toml`.

O access token já emitido pode continuar válido até expirar. O projeto mantém
`jwt_expiry = 3600`, enquanto novos refreshes ficam impedidos após a exclusão.

## Dependências

- `@supabase/supabase-js`: fixada em `2.110.5` no npm e no Deno.
- `dotenv`: movida para `devDependencies`.
- Nenhuma dependência direta foi removida.
- Nenhuma dependência de runtime foi adicionada.
- Vitest, jsdom e Testing Library permanecem como dependências exclusivamente
  de desenvolvimento.

## Validações executadas

| Validação | Resultado |
| --- | --- |
| `npm run lint` | aprovado, sem warnings |
| `npm run typecheck` | aprovado |
| `npm run test` | 57 arquivos, 306 testes aprovados |
| Paridade PT/EN e chaves literais | 5 testes aprovados |
| `npm run build` | aprovado, Vite 7.3.6 |
| `npm run check:bundle` | aprovado; exceções lazy documentadas |
| `npm run check:supabase-static` | aprovado |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `git diff --check` | aprovado |
| `deno check` das quatro funções | aprovado após as alterações das funções |
| Teste Deno de exclusão | 3 testes aprovados |

Docker não foi usado. Por isso, `supabase db reset`, `db lint`, `db advisors` e
pgTAP contra um PostgreSQL local não foram executados.

## Pendências e limitações conhecidas

- As migrations foram revisadas estaticamente, mas ainda precisam do
  `--dry-run`, aplicação e smoke test no projeto remoto.
- Os contratos pgTAP não foram executados em um banco Supabase por decisão de
  não usar Docker.
- O total de comentários exibido em detalhes do jogo representa as reviews já
  paginadas; para um total global exato será necessária uma agregação específica
  na RPC.
- A ordenação SQL por título usa `lower(titulo)`, enquanto o navegador usava
  `localeCompare`; títulos acentuados podem ter ordem diferente entre locales.
- Testes funcionais SQL por papel (membro, moderador, líder e terceiro) dependem
  de um banco de teste.
- Reviews com grande volume devem ser medidas com
  `EXPLAIN (ANALYZE, BUFFERS)` antes de qualquer novo índice.
- A matriz visual completa autenticada/PT não pôde ser capturada por ausência de
  fixtures públicas; os contratos correspondentes estão cobertos por testes.
- “Leaked password protection” continua sendo uma configuração administrativa
  a ativar no Dashboard, quando disponível no plano.

## Sugestões futuras

1. Executar os smoke tests remotos descritos em `docs/supabase-apply.md`.
2. Manter o fallback das RPCs até confirmar o frontend em produção.
3. Adicionar ambiente de banco descartável em CI, sem exigir Docker na máquina
   de desenvolvimento.
4. Definir uma collation explícita para ordenação bilíngue de títulos.
5. Medir as RPCs de reviews antes de criar ou remover índices.
6. Completar a matriz visual com fixtures autenticadas.
7. Só então auditar e eventualmente remover arquivos candidatos sem referência.
