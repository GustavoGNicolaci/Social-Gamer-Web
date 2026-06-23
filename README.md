# Social Gamer Web

Aplicacao Vite + React + TypeScript integrada ao Supabase para catalogo social de jogos, perfis, reviews, comunidades, notificacoes e upload de imagens.

## Requisitos

- Node.js compativel com Vite 7.
- Projeto Supabase configurado com Auth, Database, Storage e Edge Functions.
- Variaveis de ambiente baseadas em `.env.example`.

## Setup local

```bash
npm install
cp .env.example .env
npm run dev
```

Configure no `.env`:

- `VITE_SUPABASE_URL`: URL publica do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: anon key publica usada pelo frontend.

As variaveis sem prefixo `VITE_` em `.env.example` sao para Edge Functions e nao devem ser expostas ao bundle do navegador.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

## Supabase

Os artefatos versionados ficam em:

- `supabase/migrations`: alteracoes de schema, policies, grants e indices.
- `supabase/functions/delete-own-account`: Edge Function de exclusao de conta.

Antes de aplicar migrations em producao, rode em staging e revise:

- grants de funcoes `SECURITY DEFINER`;
- policies de `usuarios`, especialmente exposicao de `bio` e `configuracoes_privacidade`;
- unicidade de `status_jogo(usuario_id, jogo_id)`;
- triggers de contagem em curtidas de reviews;
- buckets `user-uploads` e `community-post-media`.

## Deploy na Vercel

O arquivo `vercel.json` redireciona todas as rotas para `index.html`, necessario para o `BrowserRouter` funcionar em refresh direto de rotas como `/games/:id`, `/u/:username` e `/comunidades/:id`.

Checklist minimo antes do deploy:

- Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no projeto Vercel.
- Aplicar migrations revisadas no Supabase.
- Publicar a Edge Function `delete-own-account` com `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
- Conferir redirect URLs do Supabase Auth para o dominio final.
- Ativar leaked password protection no Supabase Auth.
- Rodar `npm run lint` e `npm run build`.
