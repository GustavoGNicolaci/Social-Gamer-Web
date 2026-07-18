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
| `ProfilePage.tsx` | 2.444 linhas | 783 linhas | rota, abas e composição |
| `GameDetailsPage.tsx` | 2.343 linhas | 174 linhas | composição da página |
| `CommunityDetailsPage.tsx` | 1.514 linhas | 638 linhas | orquestração das áreas da comunidade |
| `GamesPage.tsx` | 918 linhas | 154 linhas | composição do catálogo |
| `useGameReviewsController.ts` | 1.466 linhas | 773 linhas | contrato agregado dos controllers de reviews |
| `communityService.ts` | 1.816 linhas | 95 linhas | fachada compatível |
| `reviewService.ts` | 1.592 linhas | 38 linhas | fachada compatível |
| `reviewInteractionsService.ts` | 703 linhas | 24 linhas | fachada compatível |
| `gameStatusService.ts` | 830 linhas | 20 linhas | fachada compatível |
| `wishlistService.ts` | 521 linhas | 18 linhas | fachada compatível |
| `userService.ts` | 726 linhas | 22 linhas | fachada compatível |
| `storageService.ts` | 688 linhas | 30 linhas | fachada compatível |
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
      data/
      domain/
      hooks/
      services/
    communities/
      components/
      data/
      domain/
      hooks/
    notifications/
      data/
      domain/
    profile/
      data/
      domain/
      hooks/
    reviews/
      components/
      data/
      domain/
      hooks/
  integrations/
    supabase/
      client.ts
      storage/
  pages/                    # rotas e composição
  services/                 # fachadas compatíveis

supabase/
  functions/
  migrations/
  tests/

scripts/
  check-architecture.mjs
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
- `ProfileStatusToolbar.tsx`, `ProfileStatusComposer.tsx`,
  `ProfileTopFiveEditor.tsx`, `ProfileStateCard.tsx` e
  `ProfileContentTabs.tsx`.
- `useProfileStatusSectionController.ts`,
  `useProfileWishlistReorderController.ts` e
  `useProfileTopFiveController.ts`.
- Domínio e repositórios separados para status, wishlist, perfil público,
  conexões, busca e follow em `src/features/profile/`.
- `CatalogGameCard.tsx`, `CatalogPaginationControls.tsx`,
  `CatalogFiltersModal.tsx` e `CatalogGenresModal.tsx`.
- `useGamesCatalogController.ts`, domínio, gateway e orquestração local-first
  em `src/features/catalog/`.
- `GameDetailsOverview.tsx` e `GameDetailsUserActions.tsx`.
- `useGameStatusAction.ts` e `useGameWishlistAction.ts`.
- Testes de caracterização das páginas, seções, grids, hooks e guards.

### Reviews

- `GameReviewsSection.tsx`
- `gameReviewState.ts`
- `reviewError.ts`
- `useGameReviewsController.ts`
- `GameReviewCommentCard.tsx` e `GameReviewComments.tsx`.
- Controllers específicos de editor, feed, comentários, reações e denúncias.
- `gameReviewReadRepository.ts`, `profileReviewRepository.ts`,
  `reviewMutationRepository.ts`, `reactionRepository.ts` e
  `contentReportRepository.ts`.
- Tipos, contratos, constantes e ordenadores em
  `src/features/reviews/domain/`.
- Testes de merge, reações otimistas, rollback, paginação, fallback e
  respostas obsoletas.

### Comunidades

- Componentes específicos para feed, membros, participação, configurações e
  moderação em `src/features/communities/components/`.
- Queries, mapeadores, membership, posts, moderação e tipos em
  `src/features/communities/data/`.
- `CommunityPostComments.tsx`.
- Controllers específicos de composer, feed, leitura de comentários e
  confirmações em `src/features/communities/hooks/`.
- Testes colocados ao lado dos módulos e componentes.

### Storage

- Paths e validação, uploads públicos, mídia privada, URLs assinadas e limpeza
  em `src/integrations/supabase/storage/`.
- A fachada `src/services/storageService.ts` preserva todos os 19 exports.

### Notificações

- `src/features/notifications/domain/types.ts`
- `src/features/notifications/data/notificationRepository.ts`
- Testes do repositório.

### Guardrails e documentação

- `scripts/check-bundle-budget.mjs`
- `scripts/check-architecture.mjs`
- `scripts/check-supabase-contracts.mjs`
- Screenshots e orçamento em `docs/refactor-baseline/`.
- Testes de caracterização de `ProfilePage`, `GameDetailsPage` e
  `CommunityDetailsPage`.

### Edge Functions

- `supabase/functions/delete-own-account/auth.ts`
- Testes Vitest e Deno da autenticação da exclusão.
- `deno.lock` nas quatro funções para resolução reproduzível.

### Migrations e contratos SQL

Foram criadas 13 migrations, na ordem:

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
12. `20260718001827_optimize_remaining_report_select_rls_initplans.sql`
13. `20260718001830_add_game_review_overview_summary.sql`

As 11 primeiras já estão aplicadas no projeto remoto. As duas últimas foram
criadas localmente nesta rodada e ainda aguardam o dry-run e a aplicação pelo
usuário. Cada grupo possui um contrato pgTAP correspondente em
`supabase/tests/`.

## Arquivos removidos

Nenhum. Os candidatos antigos não foram removidos porque esta rodada não
concluiu evidência suficiente para exclusão conservadora.

## Componentes, hooks e serviços extraídos

- Perfil: resolução de rota/privacidade, edição, follow, denúncias, reviews,
  status, wishlist e Top 5, com toolbar, composer, editor, tabs e controllers
  específicos.
- Catálogo: card, paginação, filtros, gêneros, controller, gateway e
  orquestração local-first.
- Jogo: detalhes do catálogo, ações de status/wishlist e composição de reviews.
- Reviews: leituras de jogo/perfil, mutações, comentários, reações, denúncias,
  merge paginado, deep links, rollback e erros traduzidos.
- Comunidades: resumo, feed, membros, membership, configurações, moderação,
  composer, confirmações e leitura de comentários.
- Auth: sessão, login, cadastro, senha, perfil/provisionamento e exclusão.
- Notificações: tipos e repositório de dados.
- Supabase: cliente e Storage reais em `integrations`; os caminhos antigos
  permanecem como fachadas.

## Duplicações e acoplamentos removidos

- `communityService` deixou de misturar tipos, mapeamento, queries, mídia,
  membership e moderação.
- `reviewService` e `reviewInteractionsService` deixaram de concentrar leitura,
  escrita, reação, denúncia, mapeamento e tipos; não existe mais ciclo entre as
  implementações de reviews.
- Catálogo, status, wishlist, usuário e Storage agora separam domínio, leitura,
  mutação e integração, enquanto as fachadas preservam seus exports.
- `AuthContext` deixou de implementar diretamente todas as operações de Auth.
- Estado, merge, edição, comentários, reações e denúncias de reviews foram
  isolados do JSX e do controller agregado.
- Composição de providers e rotas saiu de `App.tsx`.
- Tipos e acesso a notificações foram separados da fachada.
- Mensagens novas de erro de domínio são traduzidas nos consumidores.
- O guardrail TypeScript detecta ciclos, imports dinâmicos e `ImportTypeNode`,
  além das dependências proibidas entre camadas.

## Melhorias de desempenho

- Conexões do perfil são carregadas progressivamente.
- Membros e comentários de comunidade usam paginação de servidor.
- Reviews carregam 3 itens inicialmente e páginas seguintes de 4.
- Comentários de review carregam 2 itens inicialmente e páginas seguintes de 4.
- Deep links resolvem âncoras sem baixar coleções completas.
- Status de jogos passa a ordenar no SQL antes de `LIMIT/OFFSET`.
- O catálogo calcula labels de plataforma/desenvolvedora uma vez por card e não
  retorna campos sem consumidores.
- A nova RPC de overview entrega contagem e média globais de reviews, além do
  total exato de comentários, sem baixar comentários ou identidades.
- Requisições obsoletas e cliques duplicados são ignorados.
- Fallback legado só ocorre quando a RPC ainda não existe (`PGRST202` ou
  `42883`).

O JavaScript inicial ficou em 686.987 bytes, 1,42% acima da base e 24.237 bytes
abaixo do limite aprovado. `GamesPage` ficou em 15.559 bytes, 35 bytes abaixo
de seu teto. Os chunks lazy de perfil, jogo e comunidade cresceram devido às
extrações, paginação e guards; as exceções estão justificadas em
`docs/refactor-baseline/bundle-budget.md`.

## Melhorias de segurança

- 22 policies já aplicadas avaliam `(select auth.uid())` uma vez por statement;
  as duas policies restantes estão versionadas na migration pendente, sempre
  preservando `TO authenticated` e a lógica de proprietário.
- Novas RPCs possuem limites de entrada, desempates estáveis e grants
  explícitos.
- `get_game_review_overview(integer)` é `STABLE`, `SECURITY INVOKER`, usa
  `search_path=''`, não expõe identidades e possui grants explícitos para
  `anon`, `authenticated` e `service_role`.
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
| `npm run test` | 64 arquivos, 376 testes aprovados |
| Paridade PT/EN e chaves literais | 5 testes aprovados |
| `npm run build` | aprovado, Vite 7.3.6 |
| `npm run check:bundle` | aprovado; inicial +1,42%, `GamesPage` +4,77% e exceções lazy documentadas |
| `npm run check:architecture` | 192 arquivos, 642 dependências internas e nenhum ciclo |
| `npm run check:supabase-static` | aprovado |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `git diff --check` | aprovado |
| Navegador desktop/mobile | home e quatro rotas afetadas sem overlay, erro de console ou overflow |
| Tema claro/escuro | alternância pela interface aprovada e preferência restaurada |
| `deno check` das quatro funções | aprovado na etapa anterior; nenhuma Edge Function mudou nesta rodada |
| Teste Deno de exclusão | 3 testes aprovados na etapa anterior |

Docker não foi usado. Por isso, `supabase db reset`, `db lint`, `db advisors` e
pgTAP contra um PostgreSQL local não foram executados.

## Pendências e limitações conhecidas

- As migrations foram revisadas estaticamente, mas ainda precisam do
  `--dry-run`, aplicação e smoke test no projeto remoto.
- Os contratos pgTAP não foram executados em um banco Supabase por decisão de
  não usar Docker.
- Até a migration de overview ser aplicada, o frontend usa o fallback legado e
  soma apenas os totais já carregados. Depois da RPC, o total é global e exato.
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
2. Manter o fallback da nova RPC por uma versão após confirmar o frontend em
   produção.
3. Adicionar ambiente de banco descartável em CI, sem exigir Docker na máquina
   de desenvolvimento.
4. Definir uma collation explícita para ordenação bilíngue de títulos.
5. Medir as RPCs de reviews antes de criar ou remover índices.
6. Completar a matriz visual com fixtures autenticadas.
7. Só então auditar e eventualmente remover arquivos candidatos sem referência.
