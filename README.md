# Social Gamer Web

Social Gamer Web e uma aplicacao Vite + React + TypeScript para uma rede social focada em jogos. O projeto permite explorar um catalogo de jogos, criar reviews, acompanhar perfis, montar lista de desejos, marcar status de jogos, participar de comunidades, receber notificacoes e gerenciar a propria conta.

O frontend roda no navegador e usa o Supabase como backend para autenticacao, banco de dados, storage, realtime e Edge Functions. O catalogo de jogos e enriquecido com dados externos da IGDB, com cache no Supabase e suporte opcional a traducao de descricoes.

## Funcionalidades

- Catalogo de jogos com busca, filtros por genero, plataforma e desenvolvedora, ordenacao e paginas de detalhes.
- Reviews de jogos com notas, comentarios, curtidas, descurtidas e denuncias de conteudo.
- Perfis publicos com avatar, bio, reviews, top 5, lista de desejos, status de jogos e conexoes entre usuarios.
- Comunidades com criacao, membros, cargos, solicitacoes de entrada, posts, comentarios, imagens, fixacao e denuncias.
- Home com lancamentos, comunidades ativas, reviews em alta, atividade de usuarios seguidos e estatisticas da plataforma.
- Autenticacao com login, cadastro, recuperacao de senha, troca de senha e exclusao da propria conta.
- Notificacoes em tempo real via Supabase Realtime.
- Upload de imagens para avatar, banners de comunidades e midias de posts.
- Interface em `pt-BR` e `en-US`, com persistencia da preferencia de idioma.
- Tema claro/escuro salvo no navegador.

## Arquitetura

- `src/`: aplicacao React, paginas, componentes, contextos, i18n, servicos e cliente Supabase.
- `src/services/`: camada de acesso aos dados do Supabase, Edge Functions, Storage e regras de negocio do frontend.
- `src/contexts/AuthContext.tsx`: estado de sessao, perfil, login, cadastro, reset de senha e exclusao de conta.
- `supabase/migrations/`: alteracoes de schema, RLS, grants, indices, funcoes SQL, views, catalogo, cache e traducoes.
- `supabase/functions/`: Edge Functions usadas pelo frontend e por fluxos administrativos do projeto.
- `scripts/`: utilitarios Node.js para auditar e hidratar dados do catalogo IGDB.
- `vercel.json`: rewrite de SPA para o `BrowserRouter` funcionar em refresh direto de rotas internas.

## Requisitos

- Node.js compativel com Vite 7.
- NPM instalado.
- Um projeto Supabase configurado com Auth, Database, Storage, Realtime e Edge Functions.
- Variaveis de ambiente baseadas em `.env.example`.
- Credenciais da IGDB/Twitch para recursos de catalogo que importam dados externos.

## Como rodar em localhost

O localhost roda o frontend Vite na sua maquina, mas ele ainda depende de um projeto Supabase valido. Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, a aplicacao interrompe a inicializacao com erro de ambiente.

No Windows/PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Abra o arquivo `.env` e preencha pelo menos:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-ou-publishable
```

Depois inicie o servidor local:

```powershell
npm run dev
```

Abra a URL mostrada pelo Vite no terminal. Normalmente sera:

```text
http://localhost:5173/
```

ou:

```text
http://127.0.0.1:5173/
```

Se a porta `5173` estiver ocupada, o Vite pode escolher outra porta. Use sempre a URL impressa no terminal.

Para forcar host e porta durante um teste local:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

## Variaveis de ambiente

As variaveis com prefixo `VITE_` sao expostas ao bundle do navegador. Variaveis sem esse prefixo devem ser usadas apenas em scripts locais confiaveis, Edge Functions ou secrets do Supabase.

| Variavel | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL publica do projeto Supabase usada pelo frontend. |
| `VITE_SUPABASE_ANON_KEY` | Chave anon/publishable usada pelo frontend. |
| `SUPABASE_URL` | URL do Supabase usada por Edge Functions e scripts. |
| `SUPABASE_ANON_KEY` | Chave anon/publishable usada por Edge Functions quando precisam validar usuarios. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privilegiada para Edge Functions e scripts administrativos. Nunca exponha no frontend. |
| `IGDB_CLIENT_ID` | Client ID Twitch/IGDB para buscar e importar jogos. |
| `IGDB_CLIENT_SECRET` | Client secret Twitch/IGDB para gerar token de acesso da IGDB. |
| `DEEPL_API_KEY` | Opcional. Usada pela Edge Function `game-catalog` para traduzir descricoes de jogos. |
| `DEEPL_API_URL` | Opcional. Sobrescreve a URL da API DeepL quando necessario. |

Regra de seguranca: nunca coloque `SUPABASE_SERVICE_ROLE_KEY`, `IGDB_CLIENT_SECRET` ou `DEEPL_API_KEY` em variaveis `VITE_`.

## Scripts

| Comando | Descricao |
| --- | --- |
| `npm run dev` | Inicia o Vite em modo desenvolvimento. |
| `npm run build` | Executa `tsc -b` e gera o build de producao com Vite. |
| `npm run lint` | Roda ESLint no projeto. |
| `npm run preview` | Serve localmente o build gerado para conferencia. |
| `npm run igdb:match:dry-run` | Procura possiveis correspondencias IGDB para jogos manuais sem alterar dados. |
| `npm run igdb:hydrate:pending` | Lista jogos pendentes de hidratacao IGDB; use `-- --apply` para aplicar. |

Exemplos:

```powershell
npm run lint
npm run build
npm run preview
npm run igdb:match:dry-run -- --limit=30
npm run igdb:hydrate:pending -- --limit=20
npm run igdb:hydrate:pending -- --game-id=123 --apply
```

## Supabase

Os artefatos versionados do Supabase ficam em `supabase/`.

### Migrations

As migrations mantem schema, RLS, grants, funcoes, views e estruturas auxiliares do catalogo. Elas incluem:

- Fundacao do catalogo externo: slugs, busca textual, entidades de genero/plataforma/empresa, midias, estatisticas e integracoes.
- Cache backend-only para respostas de catalogo/search da IGDB.
- Tabela backend-only para traducoes de textos de jogos.
- Policies e grants para leitura publica do catalogo e acesso restrito a dados privados.

Antes de aplicar migrations em producao, valide em staging e revise RLS, grants, funcoes `SECURITY DEFINER`, buckets e impacto em dados existentes.

### Edge Functions

- `delete-own-account`: valida o usuario autenticado, confirma senha e username, limpa dados/storage da conta e remove o usuario do Supabase Auth.
- `game-catalog`: fornece catalogo, busca, detalhes e facetas; importa dados da IGDB, atualiza entidades relacionadas, usa cache e pode traduzir descricoes com DeepL.
- `search-import-games`: permite buscar jogos na IGDB e importar resultados para o catalogo, exigindo usuario autenticado.

Configure secrets no Supabase para as Edge Functions conforme necessario:

```powershell
supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_ANON_KEY=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set IGDB_CLIENT_ID=...
supabase secrets set IGDB_CLIENT_SECRET=...
supabase secrets set DEEPL_API_KEY=...
```

Nem toda funcao precisa de todos os secrets, mas `SUPABASE_SERVICE_ROLE_KEY` e credenciais IGDB devem ficar somente no ambiente seguro do Supabase.

## Catalogo IGDB

O catalogo usa a IGDB como fonte externa principal. A Edge Function `game-catalog` pode buscar listas, resultados de pesquisa e detalhes, salvar jogos no Supabase e reutilizar resultados por cache.

Os scripts em `scripts/` ajudam na manutencao:

- `igdb-match-dry-run.mjs`: compara jogos manuais com candidatos IGDB e mostra confianca da correspondencia sem alterar dados.
- `igdb-hydrate-pending.mjs`: hidrata jogos marcados como pendentes, preenchendo metadados, entidades relacionadas e midias. Por padrao roda em dry-run; use `--apply` para gravar.

## Deploy na Vercel

O arquivo `vercel.json` redireciona todas as rotas para `index.html`, necessario para o `BrowserRouter` funcionar quando o usuario acessa diretamente rotas como `/games/:id`, `/u/:username`, `/comunidades/:id`, `/resetar-senha` e paginas institucionais.

Checklist minimo antes do deploy:

- Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no projeto Vercel.
- Aplicar migrations revisadas no Supabase.
- Publicar as Edge Functions usadas pelo ambiente.
- Configurar secrets das Edge Functions no Supabase.
- Conferir redirect URLs do Supabase Auth para o dominio final e para o fluxo de reset de senha.
- Conferir buckets `user-uploads` e `community-post-media`.
- Ativar protecoes de Auth adequadas, como leaked password protection.
- Rodar `npm run lint` e `npm run build`.

## Solucao de problemas local

- Erro `Missing VITE_SUPABASE_URL` ou `Missing VITE_SUPABASE_ANON_KEY`: confira se `.env` existe, se as variaveis foram preenchidas e reinicie `npm run dev`.
- Tela carrega mas dados falham: confira RLS, migrations aplicadas, grants e URL/chave do Supabase.
- Busca de catalogo sem resultados externos: confira `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` nos secrets da Edge Function ou no `.env` dos scripts.
- Porta ocupada: rode `npm run dev -- --host 127.0.0.1 --port 5173` ou use a porta alternativa mostrada pelo Vite.
