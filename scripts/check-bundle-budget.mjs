import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const BASELINE_BYTES = 677_356
const MAX_INITIAL_JS_BYTES = 711_224
const ROUTE_BUDGETS = [
  {
    manifestKey: 'src/pages/ProfilePage.tsx',
    label: 'ProfilePage',
    baselineBytes: 98_496,
    maxBytes: 103_421,
  },
  {
    manifestKey: 'src/pages/GameDetailsPage.tsx',
    label: 'GameDetailsPage',
    baselineBytes: 43_972,
    maxBytes: 46_171,
    acceptedReason:
      'Paginação real de reviews/comentários, resolução de deep links, fallback de RPC e proteção contra respostas obsoletas ficam restritos ao chunk lazy da rota.',
  },
  {
    manifestKey: 'src/pages/CommunityDetailsPage.tsx',
    label: 'CommunityDetailsPage',
    baselineBytes: 47_174,
    maxBytes: 49_533,
    acceptedReason:
      'Controllers com proteção de corrida, paginação de membros/comentários, âncoras e compensação segura de mídia ficam restritos ao chunk lazy da rota.',
  },
]
const manifestPath = path.join(process.cwd(), 'dist', '.vite', 'manifest.json')

async function readManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('Manifest do build não encontrado. Execute `npm run build` antes de `npm run check:bundle`.')
    }

    throw error
  }
}

function getInitialJavaScriptFiles(manifest) {
  const entryKeys = Object.entries(manifest)
    .filter(([, chunk]) => chunk.isEntry)
    .map(([key]) => key)

  if (entryKeys.length === 0) {
    throw new Error('O manifest do Vite não contém uma entrada de aplicação.')
  }

  const visitedChunks = new Set()
  const initialJavaScriptFiles = new Set()

  function visit(chunkKey) {
    if (visitedChunks.has(chunkKey)) {
      return
    }

    const chunk = manifest[chunkKey]
    if (!chunk) {
      throw new Error(`Chunk estático ausente no manifest: ${chunkKey}`)
    }

    visitedChunks.add(chunkKey)

    if (chunk.file?.endsWith('.js')) {
      initialJavaScriptFiles.add(chunk.file)
    }

    for (const importedChunkKey of chunk.imports ?? []) {
      visit(importedChunkKey)
    }
  }

  for (const entryKey of entryKeys) {
    visit(entryKey)
  }

  return [...initialJavaScriptFiles].sort()
}

const manifest = await readManifest()
const initialJavaScriptFiles = getInitialJavaScriptFiles(manifest)
const fileSizes = await Promise.all(
  initialJavaScriptFiles.map(async (file) => ({
    file,
    bytes: (await stat(path.join(process.cwd(), 'dist', file))).size,
  })),
)
const totalBytes = fileSizes.reduce((total, file) => total + file.bytes, 0)
const deltaBytes = totalBytes - BASELINE_BYTES
const deltaPercent = (deltaBytes / BASELINE_BYTES) * 100
const failures = []

console.log(`JavaScript inicial: ${totalBytes.toLocaleString('pt-BR')} bytes`)
console.log(`Baseline: ${BASELINE_BYTES.toLocaleString('pt-BR')} bytes`)
console.log(`Variação: ${deltaBytes >= 0 ? '+' : ''}${deltaBytes.toLocaleString('pt-BR')} bytes (${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(2)}%)`)
console.log(`Limite: ${MAX_INITIAL_JS_BYTES.toLocaleString('pt-BR')} bytes`)

if (totalBytes > MAX_INITIAL_JS_BYTES) {
  failures.push(
    `JavaScript inicial excedeu o budget em ${(totalBytes - MAX_INITIAL_JS_BYTES).toLocaleString('pt-BR')} bytes.`,
  )
} else {
  console.log(`Budget aprovado com ${(MAX_INITIAL_JS_BYTES - totalBytes).toLocaleString('pt-BR')} bytes de margem.`)
}

for (const routeBudget of ROUTE_BUDGETS) {
  const chunk = manifest[routeBudget.manifestKey]

  if (!chunk?.file?.endsWith('.js')) {
    failures.push(`Chunk de ${routeBudget.label} ausente no manifest: ${routeBudget.manifestKey}`)
    continue
  }

  const routeBytes = (await stat(path.join(process.cwd(), 'dist', chunk.file))).size
  const routeDeltaBytes = routeBytes - routeBudget.baselineBytes
  const routeDeltaPercent = (routeDeltaBytes / routeBudget.baselineBytes) * 100

  console.log('')
  console.log(`${routeBudget.label}: ${routeBytes.toLocaleString('pt-BR')} bytes`)
  console.log(`Baseline: ${routeBudget.baselineBytes.toLocaleString('pt-BR')} bytes`)
  console.log(`Variação: ${routeDeltaBytes >= 0 ? '+' : ''}${routeDeltaBytes.toLocaleString('pt-BR')} bytes (${routeDeltaPercent >= 0 ? '+' : ''}${routeDeltaPercent.toFixed(2)}%)`)
  console.log(`Limite: ${routeBudget.maxBytes.toLocaleString('pt-BR')} bytes`)

  if (routeBytes > routeBudget.maxBytes) {
    const exceededBytes = routeBytes - routeBudget.maxBytes

    if (routeBudget.acceptedReason) {
      console.warn(
        `Guardrail excedido em ${exceededBytes.toLocaleString('pt-BR')} bytes; exceção documentada: ${routeBudget.acceptedReason}`,
      )
    } else {
      failures.push(
        `${routeBudget.label} excedeu o budget em ${exceededBytes.toLocaleString('pt-BR')} bytes.`,
      )
    }
  } else {
    console.log(`Budget aprovado com ${(routeBudget.maxBytes - routeBytes).toLocaleString('pt-BR')} bytes de margem.`)
  }
}

if (failures.length > 0) {
  console.error('\nFalha no budget de bundle:')

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exitCode = 1
}
