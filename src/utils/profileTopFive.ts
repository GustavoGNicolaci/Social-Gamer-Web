import { normalizePrivacySettings } from './profilePrivacy'

export type TopFivePosition = 1 | 2 | 3 | 4 | 5

export interface TopFiveStoredEntry {
  posicao: TopFivePosition
  jogo_id: number
}

export const TOP_FIVE_POSITIONS: TopFivePosition[] = [1, 2, 3, 4, 5]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizePosition(value: unknown): TopFivePosition | null {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value
  }

  return null
}

function normalizeGameId(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

export function normalizeTopFiveEntries(value: unknown): TopFiveStoredEntry[] {
  if (!Array.isArray(value)) return []

  const candidateEntries = value
    .filter(isPlainObject)
    .map(entry => {
      const posicao = normalizePosition(entry.posicao)
      const jogoId = normalizeGameId(entry.jogo_id)

      if (!posicao || !jogoId) return null

      return {
        posicao,
        jogo_id: jogoId,
      }
    })
    .filter((entry): entry is TopFiveStoredEntry => Boolean(entry))
    .sort((leftEntry, rightEntry) => leftEntry.posicao - rightEntry.posicao)

  const usedPositions = new Set<TopFivePosition>()
  const usedGameIds = new Set<number>()

  return candidateEntries.filter(entry => {
    if (usedPositions.has(entry.posicao) || usedGameIds.has(entry.jogo_id)) {
      return false
    }

    usedPositions.add(entry.posicao)
    usedGameIds.add(entry.jogo_id)
    return true
  })
}

export function getTopFiveEntriesFromPrivacySettings(
  value: Record<string, unknown> | null | undefined
) {
  return normalizeTopFiveEntries(normalizePrivacySettings(value).top5_jogos)
}

export function mergeTopFiveEntriesIntoPrivacySettings(
  currentSettings: Record<string, unknown> | null | undefined,
  nextEntries: TopFiveStoredEntry[]
) {
  const baseSettings = normalizePrivacySettings(currentSettings)

  return {
    ...baseSettings,
    top5_jogos: normalizeTopFiveEntries(nextEntries),
  }
}
