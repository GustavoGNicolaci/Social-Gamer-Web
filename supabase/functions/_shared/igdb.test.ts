import { describe, expect, it } from 'vitest'
import {
  excludedIgdbThemeClause,
  filterAllowedIgdbGames,
  hasBlockedIgdbTheme,
  type IgdbGame,
} from './igdb'

function game(overrides: Partial<IgdbGame> = {}): IgdbGame {
  return {
    id: 1,
    name: 'Example game',
    game_type: 0,
    themes: [],
    ...overrides,
  }
}

describe('IGDB catalog filters', () => {
  it('keeps supported game types without blocked themes', () => {
    expect(filterAllowedIgdbGames([game()])).toHaveLength(1)
  })

  it('rejects the IGDB erotic theme', () => {
    const eroticGame = game({ themes: [{ id: 42, name: 'Erotic' }] })

    expect(hasBlockedIgdbTheme(eroticGame)).toBe(true)
    expect(filterAllowedIgdbGames([eroticGame])).toEqual([])
    expect(excludedIgdbThemeClause).toBe('themes != (42)')
  })

  it('rejects unsupported game types', () => {
    expect(filterAllowedIgdbGames([game({ game_type: 3 })])).toEqual([])
  })

  it('deduplicates results by IGDB id', () => {
    const duplicate = game({ name: 'Duplicate response' })

    expect(filterAllowedIgdbGames([game(), duplicate])).toEqual([game()])
  })

  it('does not block a title solely because of its words', () => {
    const nonEroticTheme = game({
      name: 'Sex Education Simulator',
      themes: [{ id: 1, name: 'Action' }],
    })

    expect(filterAllowedIgdbGames([nonEroticTheme])).toEqual([nonEroticTheme])
  })
})
