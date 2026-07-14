# Social Gamer Web

Social Gamer Web é uma SPA em Vite, React e TypeScript para uma rede social focada em jogos. O projeto permite explorar o catálogo, publicar reviews, acompanhar perfis, organizar wishlist e status de jogos, participar de comunidades, receber notificações e gerenciar a própria conta.

O frontend usa Supabase para Auth, Postgres, Storage, Realtime e Edge Functions. A interface funciona em português (`pt-BR`) e inglês (`en-US`) e oferece temas claro e escuro.

## Funcionalidades

- Catálogo de jogos com busca, filtros, ordenação, paginação e páginas de detalhes.
- Reviews com notas, comentários, reações e denúncias de conteúdo.
- Perfis com avatar, bio, Top 5, reviews, wishlist, status e conexões.
- Comunidades com membros, cargos, solicitações, posts, comentários, mídia e moderação.
- Home com lançamentos, comunidades, reviews, atividade social e estatísticas.
- Login, cadastro, recuperação e troca de senha e exclusão da própria conta.
- Notificações em tempo real por Supabase Realtime.
- Uploads para avatar, banners de comunidades e mídia de posts.
- Preferências persistidas de idioma e tema.

## Arquitetura atual

A aplicação continua organizada de forma predominantemente horizontal, enquanto a migração para features acontece de maneira progressiva. Não houve uma movimentação geral de arquivos.

```text
src/
  pages/                       # componentes de rota ainda existentes
  components/                  # componentes compartilhados e componentes legados
  contexts/                    # Auth, i18n, tema e notificações
  features/
    catalog/domain/            # regras locais do catálogo
    navigation/global-search/  # estado e comportamento da busca da navbar
    reviews/components/        # componentes específicos de reviews
    reviews/domain/            # tipos e normalização de erros de reviews
  services/                    # acesso a dados e contratos do frontend
  i18n/                        # dicionários e runtime pt-BR/en-US
  types/                       # tipos da aplicação e tipos gerados do Supabase
  utils/                       # utilitários transversais ainda existentes
  supabase-client.ts           # cliente público do navegador

supabase/
  config.toml                  # configuração do ambiente local
  migrations/                  # baseline reconciliada e mudanças incrementais
  functions/                   # Edge Functions e módulos compartilhados
  tests/                       # testes pgTAP do banco
  seed.sql                     # seed local intencionalmente vazio

scripts/                       # utilitários Node.js para manutenção IGDB
```

`pages`, `components`, `services` e `contexts` coexistem com `features`. Novas extrações devem permanecer específicas do domínio e só devem virar abstrações compartilhadas quando houver reutilização real.

O build usa lazy loading por rota e separação de vendors. `vercel.json` mantém o fallback de SPA necessário ao `BrowserRouter` em acessos diretos a rotas internas.

## Requisitos

- Node.js compatível com Vite 7 e NPM.
- Um projeto Supabase para executar o frontend contra um backend remoto.
- Supabase CLI e Docker para reconstruir e validar o backend localmente.
- Variáveis baseadas em `.env.example`.
- Credenciais Twitch/IGDB apenas para os fluxos que importam dados externos.

## Como rodar o frontend

No Windows/PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Preencha pelo menos as variáveis públicas usadas pelo navegador:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-ou-publishable
```

Depois execute:

```powershell
npm run dev
```

O Vite normalmente serve a aplicação em `http://localhost:5173/`. Para fixar host e porta durante uma verificação local:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, a aplicação interrompe a inicialização com um erro de configuração.

## Variáveis de ambiente e secrets

Variáveis com prefixo `VITE_` entram no bundle do navegador. Secrets e chaves privilegiadas nunca devem usar esse prefixo.

| Variável | Escopo e uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL pública do Supabase usada pelo frontend. |
| `VITE_SUPABASE_ANON_KEY` | Chave anon/publishable usada pelo frontend. |
| `SUPABASE_URL` | URL usada por Edge Functions e scripts. |
| `SUPABASE_ANON_KEY` | Chave anon/publishable usada pelas funções que validam usuários. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privilegiada, restrita às Edge Functions e scripts administrativos. |
| `CORS_ALLOWED_ORIGINS` | Lista separada por vírgulas ou linhas com origens de navegador permitidas. Não aceita `*`. |
| `CORS_ALLOW_LOCALHOST` | Libera origens loopback de forma explícita para desenvolvimento. Em produção, mantenha `false` ou remova. |
| `GAME_CATALOG_SYNC_SECRET` | Segredo longo usado para autenticar `game-catalog-sync` entre servidores. |
| `IGDB_CLIENT_ID` | Client ID Twitch/IGDB usado na importação. |
| `IGDB_CLIENT_SECRET` | Client secret Twitch/IGDB usado na importação. |
| `DEEPL_API_KEY` | Chave backend-only usada pela sincronização administrativa de traduções. |

As Edge Functions compartilham uma resolução de CORS que responde somente para origens configuradas. Chamadas entre servidores sem cabeçalho `Origin` continuam permitidas; isso não substitui a autenticação própria de cada endpoint.

## Scripts de qualidade

| Comando | Descrição |
| --- | --- |
| `npm run lint` | Executa ESLint em todo o projeto. |
| `npm run typecheck` | Executa `tsc -b` sem gerar o bundle de produção. |
| `npm run test` | Executa a suíte Vitest uma vez. |
| `npm run test:watch` | Executa Vitest em modo watch. |
| `npm run build` | Executa `tsc -b` e gera o build de produção com Vite. |
| `npm run preview` | Serve localmente o build já gerado. |
| `npm run igdb:match:dry-run` | Procura correspondências IGDB sem alterar dados. |
| `npm run igdb:hydrate:pending` | Lista jogos pendentes; `-- --apply` autoriza a gravação pelo script. |

Validação mínima antes de entregar uma mudança:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm audit --omit=dev
```

Os testes atuais usam Vitest, jsdom e Testing Library. Eles caracterizam Auth, privacidade e projeções de perfil, paridade das traduções, catálogo local-first, wishlist e status, reviews e reações, paginação de comunidades, Storage e busca global. O helper compartilhado de CORS também possui testes. Os testes SQL em `supabase/tests/` são executados separadamente pelo Supabase CLI.

## Supabase local e migrations

O diretório `supabase/` versiona a configuração local, a baseline reconciliada, migrations incrementais, buckets, Edge Functions e testes SQL. O objetivo é que mudanças no backend sejam revisáveis e reproduzíveis antes de qualquer aplicação remota.

`supabase/config.toml` declara, entre outros itens:

- Postgres local compatível com a versão principal do projeto;
- Auth e redirects locais;
- buckets `user-uploads` e `community-post-media`, com limites e MIME types;
- `verify_jwt` explícito para cada Edge Function;
- Deno 2 para o runtime local.

Para validar localmente, com Docker em execução:

```powershell
supabase start
supabase db reset
supabase db lint
supabase test db
```

Quando a versão instalada do CLI oferecer o comando, rode também os advisors antes de concluir uma migration:

```powershell
supabase db advisors
```

Para iniciar uma mudança de banco, crie primeiro um arquivo versionado:

```powershell
supabase migration new nome_descritivo
```

Revise SQL, RLS, grants, funções `SECURITY DEFINER`, triggers, Storage e compatibilidade do frontend; depois execute novamente reset, lint e testes locais. O projeto não executa `supabase db push` automaticamente. Qualquer atualização do histórico remoto ou aplicação em produção exige revisão e autorização explícitas.

## Contratos das Edge Functions

Cada função possui seu próprio `deno.json`, com dependências fixadas, e o código comum de CORS/IGDB fica em `supabase/functions/_shared/`.

- `game-catalog`: endpoint público somente de leitura. Consulta catálogo, busca, detalhes, facetas e traduções já armazenadas por RPCs seguras; não usa `service_role`, não importa jogos e não chama IGDB ou DeepL.
- `search-import-games`: endpoint autenticado. Só é chamado pelo frontend após uma busca local vazia, normaliza a consulta, limita a resposta a 10 jogos, reutiliza cache e aplica uma cota durável de até 10 tentativas externas por usuário por hora. Credenciais IGDB e `service_role` permanecem no backend.
- `game-catalog-sync`: endpoint administrativo entre servidores. Exige `GAME_CATALOG_SYNC_SECRET`, processa traduções de descrições já armazenadas e usa DeepL quando `DEEPL_API_KEY` está configurada. Não deve ser invocado pelo navegador.
- `delete-own-account`: endpoint autenticado para o fluxo de exclusão da própria conta.

Exemplo de configuração dos secrets no ambiente hospedado:

```powershell
supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_ANON_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set CORS_ALLOWED_ORIGINS=https://seu-dominio.example
supabase secrets set CORS_ALLOW_LOCALHOST=false
supabase secrets set GAME_CATALOG_SYNC_SECRET=...
supabase secrets set IGDB_CLIENT_ID=...
supabase secrets set IGDB_CLIENT_SECRET=...
supabase secrets set DEEPL_API_KEY=...
```

Nem toda função precisa de todos os secrets. Mantenha `SUPABASE_SERVICE_ROLE_KEY`, `GAME_CATALOG_SYNC_SECRET`, `IGDB_CLIENT_SECRET` e `DEEPL_API_KEY` exclusivamente em ambientes backend confiáveis.

## Manutenção do catálogo IGDB

O frontend pesquisa primeiro o catálogo local. A importação externa é um fallback autenticado e limitado, não uma responsabilidade do endpoint público.

Os scripts em `scripts/` apoiam a manutenção manual:

- `igdb-match-dry-run.mjs`: compara jogos manuais com candidatos IGDB e apresenta a confiança sem alterar dados.
- `igdb-hydrate-pending.mjs`: hidrata jogos pendentes com metadados e mídia. Por padrão opera em dry-run; grava somente com `--apply`.

Exemplos:

```powershell
npm run igdb:match:dry-run -- --limit=30
npm run igdb:hydrate:pending -- --limit=20
npm run igdb:hydrate:pending -- --game-id=123 --apply
```

## Deploy na Vercel

`vercel.json` redireciona as rotas da SPA para `index.html`, permitindo abrir diretamente caminhos como `/games/:id`, `/u/:username`, `/comunidades/:id` e `/resetar-senha`.

Checklist mínimo antes do deploy:

- definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel;
- validar migrations, RLS, grants e testes em ambiente local/staging;
- aplicar migrations e publicar Edge Functions somente após aprovação;
- configurar secrets e a allowlist CORS das Edge Functions;
- conferir redirect URLs do Supabase Auth para o domínio final;
- conferir os buckets `user-uploads` e `community-post-media`;
- avaliar e ativar proteções administrativas de Auth, como leaked password protection;
- executar lint, typecheck, testes, build e auditoria de produção.

## Solução de problemas

- `Missing VITE_SUPABASE_URL` ou `Missing VITE_SUPABASE_ANON_KEY`: confira o `.env` e reinicie o Vite.
- Dados indisponíveis no frontend: confira a URL/chave, migrations, grants e policies RLS do ambiente usado.
- Importação externa indisponível: confirme que existe uma sessão autenticada e verifique secrets IGDB, cota e logs de `search-import-games`.
- Sincronização administrativa rejeitada: confira `GAME_CATALOG_SYNC_SECRET` e faça a chamada sem expor o segredo ao navegador.
- Origem bloqueada: inclua a origem exata em `CORS_ALLOWED_ORIGINS`; não use wildcard.
- `supabase db reset` não inicia: confirme que Docker está disponível e que a stack local foi iniciada.
- Porta Vite ocupada: use outra porta ou fixe `--host 127.0.0.1 --port 5173`.
