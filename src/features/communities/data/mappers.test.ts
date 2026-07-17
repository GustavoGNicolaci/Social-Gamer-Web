import { describe, expect, it } from 'vitest'
import {
  mergeCommunityComments,
  normalizeCommunityCommentReadRow,
  normalizeCommunity,
  normalizeCommunityError,
  normalizePost,
  normalizeReport,
} from './mappers'
import {
  COMMUNITY_CREATION_LIMIT_ERROR_CODE,
  type CommunityPostComment,
  type CommunityCommentReadRow,
  type CommunityRow,
  type PostRow,
  type ReportRow,
} from './types'

describe('community data mappers', () => {
  it('preserves community defaults, relation mapping and posting capabilities', () => {
    const row: CommunityRow = {
      id: 'community-1',
      nome: 'RPG Brasil',
      descricao: null,
      banner_path: null,
      tipo: 'RPG',
      jogo_id: 10,
      categoria: 'rpg',
      regras: null,
      permissao_postagem: 'somente_admins',
      visibilidade: null,
      lider_id: 'leader-1',
      membros_count: '12',
      posts_count: null,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-02T00:00:00.000Z',
      jogo: [{ id: 10, titulo: 'Game', capa_url: 'cover.webp' }],
      lider: [{
        id: 'leader-1',
        username: 'leader',
        nome_completo: 'Community Leader',
        avatar_path: null,
      }],
    }

    expect(normalizeCommunity(row, 'admin', 'pendente')).toEqual({
      id: 'community-1',
      nome: 'RPG Brasil',
      descricao: null,
      banner_path: null,
      tipo: 'RPG',
      jogo_id: 10,
      categoria: 'rpg',
      regras: null,
      permissao_postagem: 'somente_admins',
      visibilidade: 'publica',
      lider_id: 'leader-1',
      membros_count: 12,
      posts_count: 0,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-02T00:00:00.000Z',
      jogo: { id: 10, titulo: 'Game', capa_url: 'cover.webp' },
      lider: {
        id: 'leader-1',
        username: 'leader',
        nome_completo: 'Community Leader',
        avatar_path: null,
      },
      currentUserRole: 'admin',
      currentUserJoinRequestStatus: 'pendente',
      canPost: true,
      canViewContent: true,
    })
  })

  it('preserves post interaction state, media resolution and capabilities', () => {
    const row: PostRow = {
      id: 'post-1',
      comunidade_id: 'community-1',
      autor_id: 'author-1',
      texto: 'Post',
      imagem_path: 'posts/image.webp',
      curtidas_count: '4',
      dislikes_count: 2,
      comentarios_count: null,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
      fixado: true,
      fixado_em: '2026-07-02T00:00:00.000Z',
      fixado_por: 'moderator-1',
      autor: {
        id: 'author-1',
        username: 'author',
        nome_completo: null,
        avatar_path: null,
      },
    }
    const comment: CommunityPostComment = {
      id: 'comment-1',
      post_id: 'post-1',
      comunidade_id: 'community-1',
      autor_id: 'commenter-1',
      texto: 'Comment',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
      autor: null,
    }

    const result = normalizePost(
      row,
      new Map([['post-1', [comment]]]),
      new Map([['post-1', 'curtida']]),
      new Set(['post-1']),
      new Map([['posts/image.webp', 'https://signed.example/image.webp']]),
      'moderator-1',
      'admin'
    )

    expect(result).toMatchObject({
      curtidas_count: 4,
      dislikes_count: 2,
      comentarios_count: 0,
      imagem_url: 'https://signed.example/image.webp',
      comentarios: [comment],
      currentUserReaction: 'curtida',
      savedByCurrentUser: true,
      canInteract: true,
      canDelete: true,
      canPin: true,
    })
  })

  it('preserves report target projection and creation-limit error normalization', () => {
    const row: ReportRow = {
      id: 'report-1',
      comunidade_id: 'community-1',
      denunciante_id: 'reporter-1',
      tipo_conteudo: 'comentario',
      post_id: null,
      comentario_id: 'comment-1',
      motivo: 'spam',
      descricao: null,
      status: 'pending',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
      comentario: {
        id: 'comment-1',
        texto: 'Reported comment',
        autor_id: 'author-1',
        created_at: '2026-06-30T00:00:00.000Z',
        autor: {
          id: 'author-1',
          username: 'author',
          nome_completo: null,
          avatar_path: null,
        },
      },
    }

    expect(normalizeReport(row)).toMatchObject({
      targetText: 'Reported comment',
      targetImagePath: null,
      targetAuthor: { id: 'author-1', username: 'author' },
      targetCreatedAt: '2026-06-30T00:00:00.000Z',
    })
    expect(normalizeCommunityError(
      { code: 'P0001', message: 'Community creation limit reached' },
      'fallback'
    )).toMatchObject({
      code: COMMUNITY_CREATION_LIMIT_ERROR_CODE,
      message: COMMUNITY_CREATION_LIMIT_ERROR_CODE,
    })
  })

  it('normalizes flat comment read models and merges pages without duplicates', () => {
    const row: CommunityCommentReadRow = {
      post_id: 'post-1',
      id: 'comment-2',
      comunidade_id: 'community-1',
      autor_id: 'author-2',
      texto: 'Second comment',
      created_at: '2026-07-02T00:00:00.000Z',
      updated_at: '2026-07-02T00:00:00.000Z',
      author_username: 'second',
      author_name: 'Second Author',
      author_avatar_path: 'avatars/second.webp',
      total_count: '4',
    }
    const normalized = normalizeCommunityCommentReadRow(row)
    const first: CommunityPostComment = {
      ...normalized,
      id: 'comment-1',
      texto: 'First comment',
      created_at: '2026-07-01T00:00:00.000Z',
    }
    const updatedSecond = { ...normalized, texto: 'Updated second comment' }

    expect(normalized.autor).toEqual({
      id: 'author-2',
      username: 'second',
      nome_completo: 'Second Author',
      avatar_path: 'avatars/second.webp',
    })
    expect(mergeCommunityComments([normalized], [first, updatedSecond])).toEqual([
      first,
      updatedSecond,
    ])
  })
})
