import { describe, expect, it } from 'vitest'
import { normalizeGameDetails, normalizeGameListField, normalizeGameMedia, normalizeGamePreview } from './gameAdapter'

describe('game adapter', () => {
  it('normalizes legacy Portuguese and new English fields consistently', () => {
    expect(normalizeGamePreview({
      id: 7,
      titulo: 'Hades',
      capa_url: 'cover.jpg',
      desenvolvedora: 'Supergiant Games',
      generos: ['Action', 'Roguelike'],
      data_lancamento: '2020-09-17',
      plataformas: 'PC, Switch',
      igdb_id: 113112,
      nota_media_externa: 92,
    } as never)).toMatchObject({
      id: 7,
      title: 'Hades',
      titulo: 'Hades',
      developer: ['Supergiant Games'],
      platforms: ['PC', 'Switch'],
      igdbId: '113112',
    })
  })

  it('drops empty list values', () => {
    expect(normalizeGameListField('Action, , RPG')).toEqual(['Action', 'RPG'])
  })

  it('ignores media without a URL', () => {
    expect(normalizeGameMedia({ id: 1, tipo: 'cover', url: ' ' })).toBeNull()
  })

  it('selects the primary cover when normalizing details', () => {
    const details = normalizeGameDetails({
      id: 1,
      titulo: 'Celeste',
      media: [
        {
          id: 10,
          type: 'cover',
          url: 'cover.jpg',
          thumbnailUrl: null,
          provider: 'igdb',
          externalMediaId: null,
          width: null,
          height: null,
          order: 0,
          isPrimary: true,
        },
      ],
    })

    expect(details.coverMedia?.url).toBe('cover.jpg')
  })
})
