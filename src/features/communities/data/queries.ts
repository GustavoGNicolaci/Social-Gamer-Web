import { supabase } from '../../../supabase-client'
import { logClientError } from '../../../utils/clientLogging'
import { isSupabasePermissionError } from '../../../utils/supabaseErrors'
import {
  COMMUNITY_SELECT,
  normalizeCommunity,
  normalizeCommunityCreationQuota,
  normalizeCommunityError,
  resolveRelation,
} from './mappers'
import {
  getCurrentUserJoinRequestStatuses,
  getCurrentUserRoles,
} from './membership'
import type {
  CommunityCreationQuota,
  CommunityListFilters,
  CommunityRow,
  CommunitySummary,
  CreateCommunityInput,
  PaginatedServiceResult,
  Relation,
  ServiceResult,
  UpdateCommunityInput,
} from './types'

export async function getCommunities(
  filters: CommunityListFilters = {},
  currentUserId?: string | null
): Promise<PaginatedServiceResult<CommunitySummary[]>> {
  try {
    const pageSize = Math.min(Math.max(filters.pageSize || filters.limit || 48, 1), 100)
    const page = Math.max(filters.page || 1, 1)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    let query = supabase
      .from('comunidades')
      .select(COMMUNITY_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    const search = filters.search?.trim()
    if (search) {
      const safeSearch = search.replaceAll('%', '\\%').replaceAll('_', '\\_')
      query = query.or(`nome.ilike.%${safeSearch}%,descricao.ilike.%${safeSearch}%`)
    }

    if (filters.tipo) query = query.eq('tipo', filters.tipo)
    if (filters.categoria) query = query.eq('categoria', filters.categoria)
    if (filters.gameId) query = query.eq('jogo_id', filters.gameId)

    const { data, error, count } = await query

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar as comunidades.'),
        totalCount: null,
      }
    }

    const rows = (data || []) as CommunityRow[]
    const [roles, requests] = await Promise.all([
      getCurrentUserRoles(rows.map(row => row.id), currentUserId),
      getCurrentUserJoinRequestStatuses(rows.map(row => row.id), currentUserId),
    ])

    return {
      data: rows.map(row =>
        normalizeCommunity(row, roles.get(row.id) || null, requests.get(row.id) || null)
      ),
      error: null,
      totalCount: count,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar as comunidades.'),
      totalCount: null,
    }
  }
}

export async function getCommunityTypeOptions(): Promise<ServiceResult<string[]>> {
  try {
    const { data, error } = await supabase
      .from('comunidades')
      .select('tipo')
      .not('tipo', 'is', null)
      .order('tipo', { ascending: true })
      .limit(500)

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar os temas das comunidades.'),
      }
    }

    const options = Array.from(
      new Set(
        ((data || []) as Array<{ tipo: string | null }>)
          .map(row => row.tipo?.trim())
          .filter((value): value is string => Boolean(value))
      )
    )

    return {
      data: options,
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar os temas das comunidades.'),
    }
  }
}

export async function getCommunityCreationQuota(
  userId?: string | null
): Promise<ServiceResult<CommunityCreationQuota>> {
  if (!userId) {
    return {
      data: normalizeCommunityCreationQuota(0),
      error: null,
    }
  }

  try {
    const { data, error } = await supabase.rpc('get_community_creation_quota')

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data
      const createdCount =
        row && typeof row === 'object' && 'created_count' in row
          ? row.created_count as number | string | null
          : 0

      return {
        data: normalizeCommunityCreationQuota(createdCount),
        error: null,
      }
    }

    logClientError('community.creationQuota.rpcFallback', error)

    const fallbackResponse = await supabase
      .from('comunidades')
      .select('id', { count: 'exact', head: true })
      .eq('lider_id', userId)

    return {
      data: normalizeCommunityCreationQuota(fallbackResponse.count || 0),
      error: fallbackResponse.error
        ? normalizeCommunityError(fallbackResponse.error, 'Nao foi possivel verificar o limite de comunidades.')
        : null,
    }
  } catch (error) {
    return {
      data: normalizeCommunityCreationQuota(0),
      error: normalizeCommunityError(error, 'Erro inesperado ao verificar o limite de comunidades.'),
    }
  }
}

export async function getCommunityById(
  communityId: string,
  currentUserId?: string | null
): Promise<ServiceResult<CommunitySummary | null>> {
  try {
    const { data, error } = await supabase
      .from('comunidades')
      .select(COMMUNITY_SELECT)
      .eq('id', communityId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeCommunityError(error, 'Nao foi possivel carregar a comunidade.'),
      }
    }

    if (!data) return { data: null, error: null }

    const row = data as CommunityRow
    const [roles, requests] = await Promise.all([
      getCurrentUserRoles([row.id], currentUserId),
      getCurrentUserJoinRequestStatuses([row.id], currentUserId),
    ])

    return {
      data: normalizeCommunity(row, roles.get(row.id) || null, requests.get(row.id) || null),
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar a comunidade.'),
    }
  }
}

export async function createCommunity(
  input: CreateCommunityInput
): Promise<ServiceResult<CommunitySummary | null>> {
  const { data, error } = await supabase.rpc('criar_comunidade', {
    p_nome: input.nome,
    p_descricao: input.descricao || null,
    p_banner_path: input.bannerPath || null,
    p_tipo: input.tipo || null,
    p_jogo_id: input.jogoId || null,
    p_categoria: input.categoria || null,
    p_regras: input.regras || null,
    p_permissao_postagem: input.permissaoPostagem || 'todos_membros',
    p_visibilidade: input.visibilidade || 'publica',
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel criar a comunidade.'),
    }
  }

  const row = data as CommunityRow
  return {
    data: normalizeCommunity(row, 'lider', null),
    error: null,
  }
}

export async function updateCommunity(
  input: UpdateCommunityInput
): Promise<ServiceResult<CommunitySummary | null>> {
  const { data, error } = await supabase.rpc('editar_comunidade', {
    p_comunidade_id: input.comunidadeId,
    p_nome: input.nome,
    p_descricao: input.descricao || null,
    p_banner_path: input.bannerPath || null,
    p_tipo: input.tipo || null,
    p_jogo_id: input.jogoId || null,
    p_categoria: input.categoria || null,
    p_regras: input.regras || null,
    p_visibilidade: input.visibilidade || null,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel editar a comunidade.'),
    }
  }

  return {
    data: normalizeCommunity(data as CommunityRow, 'lider', null),
    error: null,
  }
}

export async function getCommunitiesByUserId(
  userId: string,
  currentUserId?: string | null
): Promise<ServiceResult<CommunitySummary[]>> {
  try {
    const { data, error } = await supabase
      .from('comunidade_membros')
      .select(`comunidade:comunidades(${COMMUNITY_SELECT})`)
      .eq('usuario_id', userId)
      .order('entrou_em', { ascending: false })

    if (error) {
      return {
        data: [],
        error: isSupabasePermissionError(error)
          ? null
          : normalizeCommunityError(error, 'Nao foi possivel carregar as comunidades do perfil.'),
      }
    }

    const communityRows = ((data || []) as Array<{ comunidade: Relation<CommunityRow> }>)
      .map(row => resolveRelation(row.comunidade))
      .filter((row): row is CommunityRow => Boolean(row))
    const [roles, requests] = await Promise.all([
      getCurrentUserRoles(communityRows.map(row => row.id), currentUserId),
      getCurrentUserJoinRequestStatuses(communityRows.map(row => row.id), currentUserId),
    ])

    return {
      data: communityRows.map(row =>
        normalizeCommunity(row, roles.get(row.id) || null, requests.get(row.id) || null)
      ),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar comunidades do perfil.'),
    }
  }
}
