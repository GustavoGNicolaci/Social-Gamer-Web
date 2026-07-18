import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const migrationsDirectory = path.join(root, 'supabase', 'migrations')
const testsDirectory = path.join(root, 'supabase', 'tests')

function assertContract(condition, message) {
  if (!condition) throw new Error(message)
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8')
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length
}

async function checkPolicyMigration(fileName, expectedPolicies) {
  const source = await read(path.join('supabase', 'migrations', fileName))
  const policyCount = countMatches(source, /\balter\s+policy\b/gi)
  const executableSource = source.replace(/--.*$/gm, '')
  const sourceWithoutInitplans = executableSource.replace(
    /\(\s*select\s+auth\.uid\(\)\s*\)/gi,
    '',
  )

  assertContract(
    policyCount === expectedPolicies,
    `${fileName}: esperado ${expectedPolicies} ALTER POLICY; encontrado ${policyCount}.`,
  )
  assertContract(
    !/\bauth\.uid\(\)/i.test(sourceWithoutInitplans),
    `${fileName}: chamada auth.uid() fora do initplan esperado.`,
  )
}

async function checkHardeningMigration(fileName, expectedFunctions) {
  const source = await read(path.join('supabase', 'migrations', fileName))
  const executableSource = source.replace(/--.*$/gm, '')
  const alterCount = countMatches(
    executableSource,
    /\balter\s+function\b[^;]+\bset\s+search_path\s*=\s*''\s*;/gi,
  )
  const revokeCount = countMatches(executableSource, /\brevoke\s+all\s+on\s+function\b/gi)
  const grantCount = countMatches(executableSource, /\bgrant\s+execute\s+on\s+function\b/gi)

  assertContract(
    !/\bcreate\s+or\s+replace\s+function\b/i.test(executableSource),
    `${fileName}: hardening não deve reescrever corpos de funções.`,
  )
  assertContract(
    alterCount === expectedFunctions,
    `${fileName}: esperado ${expectedFunctions} search_path vazio; encontrado ${alterCount}.`,
  )
  assertContract(
    revokeCount === expectedFunctions,
    `${fileName}: esperado ${expectedFunctions} REVOKE; encontrado ${revokeCount}.`,
  )
  assertContract(
    grantCount === expectedFunctions,
    `${fileName}: esperado ${expectedFunctions} GRANT; encontrado ${grantCount}.`,
  )
  assertContract(
    countMatches(
      executableSource,
      /\bto\s+authenticated\s*,\s*service_role\s*;/gi,
    ) === expectedFunctions,
    `${fileName}: grants devem preservar authenticated e service_role explicitamente.`,
  )
}

async function checkReadModelMigration({
  fileName,
  functions,
  security,
  testFile,
  testPlan,
}) {
  const source = await read(path.join('supabase', 'migrations', fileName))
  const executableSource = source.replace(/--.*$/gm, '')
  const testSource = await read(path.join('supabase', 'tests', testFile))

  for (const functionName of functions) {
    assertContract(
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`, 'i')
        .test(executableSource),
      `${fileName}: função ${functionName} ausente.`,
    )
  }

  assertContract(
    countMatches(executableSource, new RegExp(`security\\s+${security}`, 'gi')) === functions.length,
    `${fileName}: SECURITY ${security.toUpperCase()} divergente da allowlist.`,
  )
  assertContract(
    countMatches(executableSource, /\bset\s+search_path\s*=\s*''/gi) === functions.length,
    `${fileName}: toda RPC deve declarar search_path vazio.`,
  )
  assertContract(
    countMatches(executableSource, /\brevoke\s+all(?:\s+privileges)?\s+on\s+function\b/gi) === functions.length,
    `${fileName}: toda RPC deve revogar o grant padrão.`,
  )
  assertContract(
    countMatches(executableSource, /\bgrant\s+execute\s+on\s+function\b/gi) === functions.length,
    `${fileName}: toda RPC deve ter grant explícito.`,
  )
  assertContract(
    new RegExp(`select\\s+plan\\(\\s*${testPlan}\\s*\\)`, 'i').test(testSource),
    `${testFile}: plano pgTAP esperado é ${testPlan}.`,
  )
  assertContract(/\brollback\s*;/i.test(testSource), `${testFile}: teste deve terminar em rollback.`)
}

await checkPolicyMigration(
  '20260715015801_optimize_reaction_and_report_rls_initplans.sql',
  12,
)
await checkPolicyMigration(
  '20260715015809_optimize_profile_state_rls_initplans.sql',
  7,
)
await checkPolicyMigration(
  '20260715015816_optimize_community_rls_initplans.sql',
  3,
)
await checkPolicyMigration(
  '20260718001827_optimize_remaining_report_select_rls_initplans.sql',
  2,
)
const remainingReportPolicyMigration = await read(
  path.join(
    'supabase',
    'migrations',
    '20260718001827_optimize_remaining_report_select_rls_initplans.sql',
  ),
)
for (const [policyName, tableName] of [
  ['denuncias_conteudo_select_own', 'denuncias_conteudo'],
  ['denuncias_perfil_select_own', 'denuncias_perfil'],
]) {
  const policyPattern = new RegExp(
    `alter\\s+policy\\s+${policyName}\\s+on\\s+public\\.${tableName}`
      + `\\s+to\\s+authenticated\\s+using\\s*\\(\\s*\\(\\s*select\\s+auth\\.uid\\(\\)\\s*\\)`
      + `\\s*=\\s*denunciante_id\\s*\\)\\s*;`,
    'i',
  )
  assertContract(
    policyPattern.test(remainingReportPolicyMigration),
    `${policyName}: deve preservar TO authenticated e a comparação de proprietário.`,
  )
}

const pgTrgmMigration = await read(
  path.join('supabase', 'migrations', '20260715015823_relocate_pg_trgm_to_extensions.sql'),
)
assertContract(
  /alter\s+extension\s+pg_trgm\s+set\s+schema\s+extensions/i.test(pgTrgmMigration),
  'Migration pg_trgm não move a extensão para extensions.',
)
assertContract(
  /jogos_titulo_trgm_idx/i.test(pgTrgmMigration) && !/drop\s+index/i.test(pgTrgmMigration),
  'Migration pg_trgm deve validar e preservar jogos_titulo_trgm_idx.',
)
assertContract(/\bend\s*;\s*\$\$\s*;/i.test(pgTrgmMigration), 'Bloco DO de pg_trgm está incompleto.')

await checkReadModelMigration({
  fileName: '20260715015830_add_paginated_game_review_read_models.sql',
  functions: ['get_game_reviews_page', 'get_review_comments_page', 'get_game_review_anchor'],
  security: 'definer',
  testFile: 'game_review_read_models.sql',
  testPlan: 32,
})
await checkReadModelMigration({
  fileName: '20260715015839_add_paginated_community_comment_read_models.sql',
  functions: [
    'get_community_post_comment_previews',
    'get_community_post_comments_page',
    'get_community_comment_anchor',
  ],
  security: 'invoker',
  testFile: 'community_comment_read_models.sql',
  testPlan: 22,
})
await checkReadModelMigration({
  fileName: '20260715015846_add_profile_game_status_page.sql',
  functions: ['get_profile_game_status_page'],
  security: 'invoker',
  testFile: 'profile_game_status_page.sql',
  testPlan: 21,
})
await checkReadModelMigration({
  fileName: '20260718001830_add_game_review_overview_summary.sql',
  functions: ['get_game_review_overview'],
  security: 'invoker',
  testFile: 'game_review_overview_summary.sql',
  testPlan: 15,
})

const gameReviewOverviewMigration = await read(
  path.join(
    'supabase',
    'migrations',
    '20260718001830_add_game_review_overview_summary.sql',
  ),
)
assertContract(
  /\breturns\s+table\s*\(\s*game_id\s+integer\s*,\s*review_count\s+bigint\s*,\s*average_rating\s+numeric\s*,\s*comment_count\s+bigint\s*\)/i
    .test(gameReviewOverviewMigration),
  'get_game_review_overview: DTO público divergente do contrato.',
)
assertContract(
  /\bgrant\s+execute\s+on\s+function\s+public\.get_game_review_overview\s*\(\s*integer\s*\)\s+to\s+anon\s*,\s*authenticated\s*,\s*service_role\s*;/i
    .test(gameReviewOverviewMigration),
  'get_game_review_overview: grants explícitos devem incluir anon, authenticated e service_role.',
)
assertContract(
  /\bp_game_id\s+is\s+null\s+or\s+p_game_id\s*<=\s*0\b/i
    .test(gameReviewOverviewMigration)
    && /\berrcode\s*=\s*'22023'/i.test(gameReviewOverviewMigration),
  'get_game_review_overview: IDs nulos ou não positivos devem falhar com SQLSTATE 22023.',
)
assertContract(
  /\breview\.data_publicacao\s+is\s+not\s+null\b/i
    .test(gameReviewOverviewMigration)
    && /\bjoin\s+public\.comentarios\b/i.test(gameReviewOverviewMigration),
  'get_game_review_overview: o resumo deve contar somente reviews publicadas e seus comentários.',
)

const gameReviewOverviewTest = await read(
  path.join('supabase', 'tests', 'game_review_overview_summary.sql'),
)
const gameReviewFixtureInsert = gameReviewOverviewTest.match(
  /\binsert\s+into\s+public\.avaliacoes\b[\s\S]*?;/i,
)?.[0] ?? ''
const gameReviewFixtureUserIds = new Set(
  [...gameReviewFixtureInsert.matchAll(
    /'24000000-0000-0000-0000-00000000000[1-3]'/g,
  )].map((match) => match[0]),
)

assertContract(
  gameReviewFixtureUserIds.size === 3,
  'game_review_overview_summary.sql: reviews da fixture devem respeitar a unicidade por usuário/jogo.',
)
assertContract(
  /\bdisable\s+trigger\s+avaliacoes_normalize_metadata\s*;/i
    .test(gameReviewOverviewTest)
    && /\bdisable\s+trigger\s+avaliacoes_normalize_write\s*;/i
      .test(gameReviewOverviewTest)
    && /\bupdate\s+public\.avaliacoes\s+set\s+data_publicacao\s*=\s*null\b/i
      .test(gameReviewOverviewTest)
    && /\benable\s+trigger\s+avaliacoes_normalize_metadata\s*;/i
      .test(gameReviewOverviewTest)
    && /\benable\s+trigger\s+avaliacoes_normalize_write\s*;/i
      .test(gameReviewOverviewTest),
  'game_review_overview_summary.sql: a linha não publicada deve contornar e restaurar somente os normalizadores da fixture.',
)

await checkHardeningMigration(
  '20260715015856_harden_community_membership_functions.sql',
  9,
)
await checkHardeningMigration(
  '20260715015900_harden_community_content_functions.sql',
  7,
)
await checkHardeningMigration(
  '20260715015903_harden_community_moderation_functions.sql',
  6,
)
await checkHardeningMigration(
  '20260715015907_harden_notification_functions.sql',
  2,
)

const config = await read(path.join('supabase', 'config.toml'))
for (const [functionName, verifyJwt] of [
  ['game-catalog', 'false'],
  ['search-import-games', 'true'],
  ['game-catalog-sync', 'false'],
  ['delete-own-account', 'true'],
]) {
  const sectionPattern = new RegExp(
    `\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt\\s*=\\s*${verifyJwt}(?:\\s|$)`,
  )
  assertContract(sectionPattern.test(config), `${functionName}: verify_jwt esperado é ${verifyJwt}.`)
}

for (const functionName of [
  'game-catalog',
  'search-import-games',
  'game-catalog-sync',
  'delete-own-account',
]) {
  const denoConfig = await read(
    path.join('supabase', 'functions', functionName, 'deno.json'),
  )
  assertContract(
    denoConfig.includes('npm:@supabase/supabase-js@2.110.5'),
    `${functionName}: versão Deno de supabase-js não está fixada em 2.110.5.`,
  )
}

console.log(`Contratos Supabase estáticos aprovados em ${migrationsDirectory}.`)
console.log(`Contratos pgTAP encontrados em ${testsDirectory}.`)
