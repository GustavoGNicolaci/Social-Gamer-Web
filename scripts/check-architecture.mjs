import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.app.json')

if (!configPath) {
  throw new Error('tsconfig.app.json não encontrado.')
}

function formatDiagnostics(diagnostics) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  })
}

const configResult = ts.readConfigFile(configPath, ts.sys.readFile)

if (configResult.error) {
  throw new Error(formatDiagnostics([configResult.error]))
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configResult.config,
  ts.sys,
  root,
  { noEmit: true },
  configPath,
)

if (parsedConfig.errors.length > 0) {
  throw new Error(formatDiagnostics(parsedConfig.errors))
}

function normalizePath(filePath) {
  return path.normalize(path.resolve(filePath))
}

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/')
}

function isProductionSource(filePath) {
  const normalized = normalizePath(filePath)
  const relative = path.relative(sourceRoot, normalized)

  return (
    relative !== ''
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
    && /\.(?:ts|tsx)$/.test(normalized)
    && !/\.d\.ts$/.test(normalized)
    && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(normalized)
    && !relative.startsWith(`test${path.sep}`)
  )
}

const productionFiles = parsedConfig.fileNames
  .map(normalizePath)
  .filter(isProductionSource)
  .sort()
const productionFileSet = new Set(productionFiles)
const program = ts.createProgram({
  rootNames: productionFiles,
  options: parsedConfig.options,
})
const moduleResolutionCache = ts.createModuleResolutionCache(
  root,
  (fileName) => fileName,
  parsedConfig.options,
)
const graph = new Map(productionFiles.map((fileName) => [fileName, new Set()]))
const boundaryFailures = []

function getModuleSpecifiers(sourceFile) {
  const specifiers = []

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text)
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    } else if (
      ts.isImportTypeNode(node)
      && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteralLike(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return specifiers
}

function resolveProductionImport(specifier, importer) {
  const resolution = ts.resolveModuleName(
    specifier,
    importer,
    parsedConfig.options,
    ts.sys,
    moduleResolutionCache,
  ).resolvedModule

  if (!resolution) {
    return null
  }

  const resolvedFile = normalizePath(resolution.resolvedFileName)
  return productionFileSet.has(resolvedFile) ? resolvedFile : null
}

function getSourceSegments(fileName) {
  return path
    .relative(sourceRoot, fileName)
    .split(path.sep)
    .filter(Boolean)
}

function getBoundaryViolation(importer, imported) {
  const importerSegments = getSourceSegments(importer)
  const importedSegments = getSourceSegments(imported)
  const importerIsDomain =
    importerSegments[0] === 'features' && importerSegments[2] === 'domain'
  const importerIsData =
    importerSegments[0] === 'features' && importerSegments[2] === 'data'
  const importerIsIntegration = importerSegments[0] === 'integrations'

  if (
    importerIsDomain
    && importedSegments.some((segment) =>
      ['services', 'pages', 'components', 'contexts'].includes(segment),
    )
  ) {
    return 'domain não pode depender de services, pages, components ou contexts'
  }

  if (
    importerIsData
    && importedSegments.some((segment) => ['pages', 'components'].includes(segment))
  ) {
    return 'data não pode depender de pages ou components'
  }

  if (
    importerIsIntegration
    && ['features', 'pages', 'components'].includes(importedSegments[0])
  ) {
    return 'integrations não pode depender de features, pages ou components'
  }

  return null
}

for (const fileName of productionFiles) {
  const sourceFile = program.getSourceFile(fileName)

  if (!sourceFile) {
    throw new Error(`TypeScript não carregou ${relativePath(fileName)}.`)
  }

  for (const specifier of getModuleSpecifiers(sourceFile)) {
    const importedFile = resolveProductionImport(specifier, fileName)

    if (!importedFile) {
      continue
    }

    graph.get(fileName).add(importedFile)
    const violation = getBoundaryViolation(fileName, importedFile)

    if (violation) {
      boundaryFailures.push(
        `${relativePath(fileName)} -> ${relativePath(importedFile)} (${violation})`,
      )
    }
  }
}

function findStronglyConnectedComponents() {
  let nextIndex = 0
  const indexes = new Map()
  const lowLinks = new Map()
  const stack = []
  const onStack = new Set()
  const components = []

  function connect(fileName) {
    indexes.set(fileName, nextIndex)
    lowLinks.set(fileName, nextIndex)
    nextIndex += 1
    stack.push(fileName)
    onStack.add(fileName)

    for (const dependency of graph.get(fileName)) {
      if (!indexes.has(dependency)) {
        connect(dependency)
        lowLinks.set(
          fileName,
          Math.min(lowLinks.get(fileName), lowLinks.get(dependency)),
        )
      } else if (onStack.has(dependency)) {
        lowLinks.set(
          fileName,
          Math.min(lowLinks.get(fileName), indexes.get(dependency)),
        )
      }
    }

    if (lowLinks.get(fileName) !== indexes.get(fileName)) {
      return
    }

    const component = []
    let currentFile

    do {
      currentFile = stack.pop()
      onStack.delete(currentFile)
      component.push(currentFile)
    } while (currentFile !== fileName)

    components.push(component)
  }

  for (const fileName of productionFiles) {
    if (!indexes.has(fileName)) {
      connect(fileName)
    }
  }

  return components
}

const cycles = findStronglyConnectedComponents()
  .filter(
    (component) =>
      component.length > 1
      || graph.get(component[0]).has(component[0]),
  )
  .map((component) => component.map(relativePath).sort())
  .sort((left, right) => left[0].localeCompare(right[0]))

if (cycles.length > 0 || boundaryFailures.length > 0) {
  console.error('Guardrail arquitetural reprovado.')

  if (cycles.length > 0) {
    console.error('\nCiclos de importação:')
    for (const cycle of cycles) {
      console.error(`- ${cycle.join(' <-> ')}`)
    }
  }

  if (boundaryFailures.length > 0) {
    console.error('\nDependências entre camadas não permitidas:')
    for (const failure of [...new Set(boundaryFailures)].sort()) {
      console.error(`- ${failure}`)
    }
  }

  process.exitCode = 1
} else {
  const edgeCount = [...graph.values()].reduce(
    (total, dependencies) => total + dependencies.size,
    0,
  )
  console.log(
    `Arquitetura aprovada: ${productionFiles.length} arquivos, ${edgeCount} dependências internas e nenhum ciclo.`,
  )
}
