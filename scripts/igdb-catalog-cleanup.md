# Saneamento seguro do catálogo IGDB

Este procedimento preserva o catálogo válido. Ele remove somente:

- cópias extras do mesmo `IGDB id`;
- jogos classificados pela IGDB com o tema erótico `42`.

Títulos iguais com IDs IGDB diferentes não são considerados duplicados, pois
podem representar remakes, ports ou edições legítimas.

## Pré-requisitos

- projeto correto vinculado pela Supabase CLI;
- variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `IGDB_CLIENT_ID` e
  `IGDB_CLIENT_SECRET` disponíveis apenas no ambiente backend;
- backup remoto confirmado;
- importações pausadas durante a janela curta de limpeza.

## 1. Dry-run

```powershell
npm run igdb:catalog:cleanup
```

O comando consulta o Supabase e a IGDB, mas não altera dados sem `--apply`.
Revise especialmente `protectedCandidates`, que precisa estar vazio.

## 2. Aplicação remota

Primeiro, publique o filtro que impede novas importações bloqueadas:

```powershell
supabase functions deploy search-import-games
```

Disponibilize temporariamente a RPC transacional de limpeza. Esse comando não
marca a migration como aplicada; ela será registrada pelo `db push` posterior:

```powershell
supabase db query --linked --file supabase/migrations/20260714230446_add_atomic_catalog_cleanup.sql
```

Execute novamente o dry-run imediatamente antes da limpeza. Se o plano estiver
correto e `protectedCandidates` continuar vazio:

```powershell
npm run igdb:catalog:cleanup -- --apply --confirm=CLEAN-IGDB-CATALOG
```

Por fim, registre as migrations e crie o índice único por ID IGDB:

```powershell
supabase db push
```

## 3. Verificação

```powershell
npm run igdb:catalog:cleanup
```

O resultado esperado é `duplicateGroups: 0`, `blockedThemeGroups: 0` e
`totalRowsToDelete: 0`.

Se a migration de unicidade detectar uma nova duplicata concorrente, ela aborta
sem criar o índice. Nesse caso, mantenha as importações pausadas, repita o
dry-run e a limpeza, e execute `supabase db push` novamente.

## Reset completo

Não apague toda a tabela `jogos` enquanto não existir um importador batch por
ID. A importação atual é sob demanda e limitada; um reset completo deixaria a
biblioteca vazia. O saneamento acima entrega o mesmo objetivo sem reconstruir
os 958 registros válidos previstos.
