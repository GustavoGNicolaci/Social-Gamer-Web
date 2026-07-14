/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { enUS } from './locales/en-US'
import { ptBR } from './locales/pt-BR'

describe('translation dictionaries', () => {
  it('keeps Portuguese and English keys in parity', () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(ptBR).sort())
  })

  it.each([
    ['pt-BR', ptBR],
    ['en-US', enUS],
  ])('does not contain empty values in %s', (_locale, dictionary) => {
    for (const [key, value] of Object.entries(dictionary)) {
      expect(key.trim()).not.toBe('')
      expect(value.trim(), key).not.toBe('')
    }
  })

  it('clarifies that profile privacy does not hide reviews from game pages', () => {
    expect(ptBR['settings.privacy.description']).toContain(
      'não torna privadas as reviews já publicadas nas páginas dos jogos'
    )
    expect(enUS['settings.privacy.description']).toContain(
      'does not make reviews already published on game pages private'
    )
  })

  it('keeps every literal translation key used by the application declared', () => {
    const sourceRoot = join(process.cwd(), 'src')
    const dictionaryKeys = new Set(Object.keys(ptBR))
    const unknownUsages: string[] = []

    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)

        if (entry.isDirectory()) {
          if (entry.name !== 'locales') visit(path)
          continue
        }

        if (!['.ts', '.tsx'].includes(extname(entry.name)) || entry.name.includes('.test.')) {
          continue
        }

        const source = readFileSync(path, 'utf8')
        const literalCallPattern = /\b(?:t|translate)\(\s*(['"`])([^'"`\r\n]+)\1/g

        for (const match of source.matchAll(literalCallPattern)) {
          const key = match[2]
          if (!key.includes('${') && !dictionaryKeys.has(key)) {
            unknownUsages.push(`${relative(sourceRoot, path)}: ${key}`)
          }
        }
      }
    }

    visit(sourceRoot)
    expect(unknownUsages).toEqual([])
  })
})
