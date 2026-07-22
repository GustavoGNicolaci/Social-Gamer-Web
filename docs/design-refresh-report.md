# Relatório do redesign — Social Gamer

**Data da revisão:** 21/07/2026  
**Escopo:** interface, experiência de uso, responsividade e acessibilidade visual

## Resultado

O Social Gamer recebeu uma identidade visual unificada nas 16 rotas existentes e
nos fluxos embutidos de catálogo, perfil, reviews, comunidades, notificações e
configurações. O redesign mantém a temática gamer/social, mas reduz ruído visual,
melhora a hierarquia de conteúdo e conecta as telas por meio dos mesmos tokens,
componentes e estados de interface.

Nesta rodada final também foram aplicados três ajustes de direção:

- a Home não usa amarelo em letras, números, notas, curtidas ou badges; o conteúdo
  textual usa foreground e acentos índigo/roxo;
- `Planejo jogar` deixou de ser uma escolha de status, pois a lista de desejos já
  representa essa intenção;
- o favorito da coleção de jogos passou a usar borda, faixa e sombra
  índigo/roxa, sem destaque amarelo.

Não foram adicionadas bibliotecas, dependências, fontes externas, migrations ou
alterações de backend. Supabase, banco, schema, RLS, Auth, Storage, Realtime,
Edge Functions, APIs externas e integrações permanecem inalterados.

## Páginas e fluxos analisados e redesenhados

| Área | Rotas/fluxos cobertos | Principais melhorias |
| --- | --- | --- |
| Home | `/` | Hero mais equilibrado, CTAs, estatísticas, rede, lançamentos, comunidades, atividade e reviews com densidade e estados consistentes. |
| Autenticação | `/login`, `/register`, `/esqueci-a-senha`, `/resetar-senha` | AuthShell responsivo, campos e mensagens uniformes, requisitos legíveis, estado ocupado e controle visual de senha. |
| Catálogo | `/games` | Cabeçalho compacto, filtros e gêneros acessíveis, cards legíveis, paginação, skeletons e grid fluido. |
| Jogo | `/games/:id` | Hierarquia entre capa, título e metadados, ações compactas, wishlist, status, comunidade, reviews e comentários. |
| Perfil | `/profile`, `/u/:username` | Hero, edição, privacidade, conexões, follow/report, Top 5, coleções, wishlist, reviews, comunidades e posts. |
| Comunidades | `/comunidades`, `/comunidades/:id` | Catálogo, busca, filtros, feed, posts, comentários, mídia, membros, participação, moderação e configurações. |
| Configurações | `/configuracoes/conta` | Organização em duas colunas no desktop, fluxo linear no mobile e danger zone separada. |
| Institucional | `/suporte`, `/sobre`, `/termos`, `/privacidade` | Template, leitura, espaçamento e navegação visual consistentes. |
| Sistema | `*`, falhas de renderização e carregamento de rotas | 404, Error Boundary, loading e mensagens de sistema integrados ao shell. |
| Navegação global | Navbar, busca, notificações, menus, tema e Footer | Organização de marca/navegação/ações, drawer mobile, popover/sheet e rodapé mais compacto. |

Também foram revisados os fluxos que não possuem rota própria: criação e edição
de reviews, comentários e reações, denúncias, status de jogos, favoritos,
wishlist, Top 5, follow, solicitações de comunidade, notificações e todos os
modais relacionados.

## Identidade visual e sistema de UI

A direção adotada foi **gamer sofisticado**: superfícies escuras em ameixa,
gradientes contidos e acentos frios. Elementos dourados deixaram de competir com
o conteúdo da Home e são reservados, quando necessários, a semânticas específicas
ou ambientação decorativa discreta.

### Paleta principal

| Papel | Escuro | Claro |
| --- | --- | --- |
| Fundo | `#0B0715` | `#F6F8FC` |
| Superfície principal | `#151022` | `#FFFFFF` |
| Texto principal | `#F4F2FB` | `#151827` |
| Índigo | `#667EEA` | `#5268D4` |
| Gradiente principal | índigo `#5268D4` → roxo `#6B4396` | índigo `#4E62D0` → roxo `#67458F` |
| Roxo de identidade | `#764BA2` como referência de marca | variação com contraste adequado em superfícies claras |

O sistema usa escala de espaçamento de 4/8 px, raios de 12/18/24 px, elevação
progressiva, foco visível e motion curto. Os tokens semânticos evitam cores
soltas por tela: `background`, `foreground`, `surface`, `card`, `primary`,
`border`, `muted`, `badge`, estados de feedback, sombras e focus ring.

As primitives internas consolidam os padrões sem substituir HTML nativo nem
alterar handlers: `Button`, `IconButton`, `Field`, `Surface`, `Badge`, `Tabs`,
`DialogShell`, `StatePanel`, `Skeleton`, `PageHeader` e `SectionHeader`.

O tema continua aceitando `dark` e `light`, preserva a chave
`social-gamer-theme` e é aplicado antes da primeira pintura para reduzir flash de
tema incorreto.

## Melhorias por contexto

### Desktop

- largura, colunas e ritmo vertical foram normalizados por página;
- Navbar separa marca, navegação, busca e ações sem comprimir os controles;
- catálogo e coleções aproveitam melhor a área útil sem alongar excessivamente
  os cards;
- detalhes de jogo, perfil, comunidades e configurações receberam hierarquia
  mais clara entre conteúdo primário, contexto e ações;
- notificações usam popover ancorado e os modais mantêm dimensões previsíveis;
- estados de loading, vazio e erro ocupam o mesmo espaço estrutural do conteúdo.

### Mobile e tablet

- os layouts foram preparados para 320 px, com dimensões fluidas, wrapping e
  `min-width: 0` nos pontos de contenção;
- o menu principal funciona como drawer, com fechamento por Escape, bloqueio de
  scroll, foco inicial e retorno do foco ao gatilho;
- filtros secundários de catálogo e comunidades migram para diálogo/sheet;
- capas mantêm proporção 2:3 e cards evitam a altura excessiva do layout anterior;
- abas de perfil/comunidade podem rolar horizontalmente sem cortar controles;
- Top 5, status, wishlist e feeds usam composições compactas;
- Footer, heroes e espaços entre seções foram reduzidos em telas estreitas;
- controles interativos mantêm alvo mínimo de 44 px.

### Acessibilidade visual e de interação

- skip link e landmark `<main>`;
- foco visível consistente e retorno ao gatilho em diálogos;
- Escape, trap de foco e scroll lock nos modais e menus relevantes;
- labels reais, relações ARIA e estados `aria-pressed` preservados ou ampliados;
- tabs e escala de review operáveis por teclado;
- diferença entre lido/não lido não depende apenas de cor;
- contraste orientado a WCAG AA e suporte a `prefers-reduced-motion`;
- textos longos e zoom de 200% tratados com wrapping e layouts fluidos.

## Ajustes finais de status e favoritos

O domínio continua aceitando o valor histórico `planejando`, mas a interface usa
uma lista interna de quatro valores selecionáveis: `jogando`, `zerado`, `dropado`
e `pausado`. Isso vale para detalhes do jogo, compositor, edição e filtros do
perfil.

Registros antigos em `planejando` continuam legíveis como **Status antigo**. O
usuário pode trocar o status ou remover o registro; ele não pode criar um novo
registro nesse estado e não ocorre conversão automática para wishlist. A Home
apresenta atividade legada com texto genérico, sem a expressão “planeja jogar”.

O favorito continua com o mesmo badge, `aria-pressed`, ordenação, persistência e
rollback. Apenas seu tratamento visual mudou de amarelo para índigo/roxo.

## Preservação funcional

- nenhuma rota existente foi renomeada ou removida; somente a rota curinga `*`
  foi adicionada para 404;
- query params, paginação, ranges, filtros, hashes e deep links foram mantidos;
- o catálogo preserva o contrato de 4/8/12/16/20 resultados por breakpoint;
- autenticação, redirects, confirmação por e-mail, validações e autocompletes não
  foram alterados;
- wishlist e `status_jogo` continuam fluxos e tabelas independentes;
- reviews mantêm escala 1–10, comentários, reações, denúncias e callbacks;
- comunidades preservam visibilidade, papéis, join/leave, solicitações, pin,
  salvos, denúncias, upload e moderação;
- notificações preservam Realtime, links, refresh e leitura;
- privacidade, idioma, senha e exclusão de conta mantêm os contratos existentes;
- não houve mudança de schema, RLS, migrations, chamadas de API ou integrações
  externas.

## Arquivos e grupos alterados

| Grupo | Arquivos/áreas principais |
| --- | --- |
| Tokens e base global | `index.html`, `src/index.css`, `src/App.css`, `src/App.tsx`, `src/main.tsx` |
| Shell, rotas e tema | `src/app/AppProviders.tsx`, `src/app/AppRouter.tsx`, `src/contexts/ThemeContext.tsx`, `src/contexts/theme.ts`, `src/components/system/` |
| Primitives de UI | `src/components/ui/` |
| Navegação global | `src/components/navbar/`, `src/components/notifications/`, `src/components/footer/` |
| Home | `src/pages/HomePage.tsx`, `src/pages/HomePage.css`, `src/components/home/`, `src/services/homeService.ts` |
| Autenticação | `src/components/auth/`, `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`, `src/pages/ForgotPasswordPage.tsx`, `src/pages/ResetPasswordPage.tsx` |
| Catálogo e jogo | `src/pages/GamesPage.*`, `src/pages/GameDetailsPage.*`, `src/features/catalog/components/`, `src/features/catalog/hooks/useGamesCatalogController.ts` |
| Perfil e coleções | `src/pages/ProfilePage.css`, `src/components/profile/`, `src/features/profile/domain/gameStatus.ts`, `src/features/profile/hooks/`, `src/services/gameStatusService.ts` |
| Reviews e comentários | `src/features/reviews/components/`, `src/components/reviews/` |
| Comunidades | `src/pages/CommunitiesPage.*`, `src/pages/CommunityDetailsPage.*`, `src/components/communities/`, `src/features/communities/` |
| Configurações e institucional | `src/pages/AccountSettingsPage.*`, `src/pages/SupportPage.*`, `src/pages/InstitutionalPage.tsx`, `src/pages/NotFoundPage.tsx` |
| Imagens e acessibilidade | `src/components/GameCoverImage.tsx`, `src/components/RatingCircle.*` |
| Idiomas | `src/i18n/locales/pt-BR.ts`, `src/i18n/locales/en-US.ts` |
| Testes de caracterização/UI | testes novos ou atualizados em `src/app/`, `src/contexts/`, `src/components/`, `src/features/` e `src/pages/` |

Os artefatos temporários do design anterior criados nesta rodada foram
excluídos: baselines `.codex-baseline*`, `baseline-original-temp`, builds antigos
em `public/` e imagens `before-*`. A documentação histórica versionada em
`docs/refactor-baseline/` e `docs/refactor-report.md` foi preservada.

## Capturas do redesign atual

As capturas abaixo são sanitizadas e mostram apenas o estado atual:

| Área | Desktop | Mobile |
| --- | --- | --- |
| Home claro | [desktop](assets/design-refresh/home-desktop-light.jpg) | [320 px](assets/design-refresh/home-mobile-320-light.jpg) |
| Home escuro | [desktop](assets/design-refresh/home-desktop-dark.jpg) | [390 px](assets/design-refresh/home-mobile-390-dark.jpg) |
| Autenticação | [desktop claro](assets/design-refresh/auth-desktop-light.jpg) | [320 px claro](assets/design-refresh/auth-mobile-320-light.jpg) |
| Catálogo | [desktop claro](assets/design-refresh/catalog-desktop-light.jpg) | [320 px claro](assets/design-refresh/catalog-mobile-320-light.jpg) |
| Detalhes do jogo | [desktop claro](assets/design-refresh/game-desktop-light.jpg) | [320 px claro](assets/design-refresh/game-mobile-320-light.jpg) |
| Perfil/coleções | [desktop claro](assets/design-refresh/profile-collections-desktop-light.jpg) | [320 px claro](assets/design-refresh/profile-collections-mobile-320-light.jpg) |
| Comunidades | [desktop claro](assets/design-refresh/communities-desktop-light.jpg) | [320 px claro](assets/design-refresh/communities-mobile-320-light.jpg) |
| Configurações claro | [desktop](assets/design-refresh/settings-desktop-light.jpg) | [320 px](assets/design-refresh/settings-mobile-320-light.jpg) |
| Configurações escuro | [desktop](assets/design-refresh/settings-desktop-dark.jpg) | [390 px](assets/design-refresh/settings-mobile-390-dark.jpg) |

## Validação automatizada

Todas as verificações abaixo foram executadas novamente depois dos ajustes
finais de cor, status legado, testes e limpeza dos artefatos temporários.

| Verificação | Comando | Resultado desta rodada |
| --- | --- | --- |
| Lint | `npm run lint` | Aprovado, sem erros ou avisos |
| TypeScript | `npm run typecheck` | Aprovado |
| Testes | `npm run test` | 78 arquivos e 412 testes aprovados |
| Build de produção | `npm run build` | Aprovado; 2.057 módulos transformados |
| Arquitetura | `npm run check:architecture` | Aprovado; 207 arquivos, 673 dependências internas e nenhum ciclo |
| Orçamento de bundle | `npm run check:bundle` | Aprovado; JavaScript inicial dentro do limite e exceções lazy documentadas para Perfil, Jogo e Comunidade |
| Contratos estáticos Supabase | `npm run check:supabase-static` | Aprovado; migrations e contratos pgTAP encontrados |
| Integridade do diff | `git diff --check` | Aprovado; apenas avisos informativos de conversão LF/CRLF do Git |

A cobertura adicionada ou ampliada inclui tema, Navbar/drawer, primitives,
diálogos e foco, tabs por teclado, autenticação, Home, catálogo, detalhes do jogo,
perfil/status legado, reviews, comunidades, notificações, configurações, 404 e
Error Boundary.

### Inspeção visual desta rodada

- Home e perfil público foram conferidos nos temas claro e escuro em 320×800 e
  1440×900;
- 390×844, 768×1024 e 1024×768 também foram verificados quanto a overflow e
  controles cortados;
- Home, Login, Cadastro, Recuperação, Catálogo, um jogo conhecido, perfil
  público, Comunidades, Configurações e 404 foram abertos em desktop e mobile;
- o jogo conhecido e o perfil público concluíram o carregamento sem Error
  Boundary;
- não houve overflow horizontal de página nem erro/aviso novo no console;
- os números da Home usam o texto padrão nos dois temas, e as abas horizontais
  do perfil permanecem roláveis de forma intencional no mobile.

Os fluxos que exigem sessão, escrita, e-mail, Realtime ou papéis diferentes não
foram acionados no ambiente público sem credenciais. Eles permanecem cobertos
por testes automatizados e pelo roteiro manual abaixo para staging.

## Roteiro de teste manual

Executar em `320×800`, `390×844`, `768×1024`, `1024×768` e `1440×900`, nos
temas claro/escuro, idiomas pt-BR/en-US, teclado, zoom de 200% e reduced motion.

- [ ] Abrir a Home e confirmar ausência de texto/número amarelo.
- [ ] Testar Login, Cadastro, Esqueci a senha e Reset de senha.
- [ ] Verificar login/logout e persistência do tema.
- [ ] Abrir o catálogo, usar busca, ordenação, filtros, ranges e paginação.
- [ ] Abrir um jogo conhecido, wishlist, status e o deep link `#game-community`.
- [ ] Confirmar somente quatro novos status: Jogando, Zerado, Dropado e Pausado.
- [ ] Abrir um registro legado `planejando`, trocar seu status e removê-lo.
- [ ] Abrir perfil próprio e público; testar edição, conexões, follow e report.
- [ ] Testar favorito, ordenação, Top 5, wishlist e rollback; confirmar destaque
  índigo/roxo.
- [ ] Criar/editar review; testar nota 1–10, comentários, reações e denúncia.
- [ ] Abrir comunidades públicas/privadas com papéis distintos; testar posts,
  comentários, participação, pin, salvos e moderação conforme permissão.
- [ ] Abrir notificações, marcar como lida e validar links/refresh.
- [ ] Testar privacidade, idioma, senha e danger zone em Configurações.
- [ ] Forçar uma rota inexistente e validar 404 com Navbar/Footer disponíveis.
- [ ] Verificar todos os diálogos por teclado: foco inicial, Tab/Shift+Tab,
  Escape e retorno do foco.
- [ ] Confirmar zero overflow horizontal, controles cortados ou novos erros de
  console em mobile e desktop.

Os fluxos autenticados devem ser verificados em ambiente local/staging com contas
descartáveis, relações entre usuários, comunidades públicas/privadas e papéis
diferentes. Nenhuma credencial deve ser incluída no repositório.

## Limitações e baseline conhecido

- Um erro já observado ao abrir determinado jogo a partir do catálogo depende do
  dado/integração externa e não foi alterado nem mascarado pelo redesign. A
  validação de detalhes deve usar um jogo conhecido da fixture.
- A inspeção visual pública não substitui os testes manuais autenticados de
  persistência, permissões, e-mail e Realtime em staging.
- Capturas são evidência representativa do layout; não substituem a matriz de
  breakpoints, teclado, zoom e idiomas.

## Recomendações futuras

- manter uma rotina de regressão visual para os breakpoints documentados;
- ampliar testes end-to-end autenticados com fixtures descartáveis e papéis de
  comunidade distintos;
- medir contraste, foco, zoom e leitores de tela em CI;
- acompanhar Core Web Vitals e orçamento de bundle conforme novas telas forem
  adicionadas;
- documentar as primitives e tokens em um catálogo interno de componentes;
- revisar periodicamente regras CSS legadas restantes e removê-las somente após
  confirmar ausência de consumidores;
- validar textos longos e estados vazios com dados reais em ambos os idiomas.
