import { supabase } from '../../../supabase-client'
import { logClientError } from '../../../utils/clientLogging'
import { isSupabasePermissionError } from '../../../utils/supabaseErrors'
import {
  JOIN_REQUEST_SELECT,
  normalizeCommunityError,
  normalizeJoinRequest,
  normalizeMember,
  normalizeNumber,
  normalizeSearch,
} from './mappers'
import type {
  CommunityJoinAction,
  CommunityJoinRequest,
  CommunityJoinRequestStatus,
  CommunityMember,
  CommunityMembersOptions,
  CommunityRole,
  JoinRequestRow,
  MemberPageRow,
  PaginatedServiceResult,
  ServiceResult,
} from './types'

export async function getCurrentUserRoles(
  communityIds: string[],
  currentUserId?: string | null
): Promise<Map<string, CommunityRole>> {
  const roles = new Map<string, CommunityRole>()
  const uniqueIds = Array.from(new Set(communityIds.filter(Boolean)))

  if (!currentUserId || uniqueIds.length === 0) return roles

  const { data, error } = await supabase
    .from('comunidade_membros')
    .select('comunidade_id, cargo')
    .eq('usuario_id', currentUserId)
    .in('comunidade_id', uniqueIds)

  if (error) {
    logClientError('community.roles.load', error)
    return roles
  }

  ;((data || []) as Array<{ comunidade_id: string; cargo: CommunityRole }>).forEach(row => {
    roles.set(row.comunidade_id, row.cargo)
  })

  return roles
}

export async function getCurrentUserJoinRequestStatuses(
  communityIds: string[],
  currentUserId?: string | null
): Promise<Map<string, CommunityJoinRequestStatus>> {
  const requests = new Map<string, CommunityJoinRequestStatus>()
  const uniqueIds = Array.from(new Set(communityIds.filter(Boolean)))

  if (!currentUserId || uniqueIds.length === 0) return requests

  const { data, error } = await supabase
    .from('comunidade_solicitacoes_entrada')
    .select('comunidade_id, status, created_at')
    .eq('usuario_id', currentUserId)
    .in('comunidade_id', uniqueIds)
    .order('created_at', { ascending: false })

  if (error) {
    logClientError('community.joinRequests.status.load', error)
    return requests
  }

  ;((data || []) as Array<{ comunidade_id: string; status: CommunityJoinRequestStatus }>).forEach(row => {
    if (!requests.has(row.comunidade_id)) {
      requests.set(row.comunidade_id, row.status)
    }
  })

  return requests
}

export async function getCommunityMembers(
  communityId: string,
  options: CommunityMembersOptions = {}
): Promise<PaginatedServiceResult<CommunityMember[]>> {
  try {
    const limit = Math.min(Math.max(options.limit || 50, 1), 250)
    const offset = Math.max(options.offset || 0, 0)
    const { data, error } = await supabase.rpc('get_community_members_page', {
      p_community_id: communityId,
      p_search: normalizeSearch(options.search) || null,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      return {
        data: [],
        error: isSupabasePermissionError(error)
          ? null
          : normalizeCommunityError(error, 'Nao foi possivel carregar os membros.'),
        totalCount: null,
      }
    }

    const rows = (data || []) as MemberPageRow[]
    const members = rows.map(row => normalizeMember({
      comunidade_id: row.comunidade_id,
      usuario_id: row.usuario_id,
      cargo: row.cargo,
      entrou_em: row.entrou_em,
      atualizado_em: row.atualizado_em,
      usuario: {
        id: row.user_id,
        username: row.username || '',
        nome_completo: row.nome_completo,
        avatar_path: row.avatar_path,
      },
    }))

    return {
      data: members,
      error: null,
      totalCount: rows.length > 0 ? normalizeNumber(rows[0].total_count) : 0,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar os membros.'),
      totalCount: null,
    }
  }
}

export async function joinCommunity(
  communityId: string
): Promise<ServiceResult<CommunityJoinAction>> {
  const { data, error } = await supabase.rpc('entrar_comunidade', {
    p_comunidade_id: communityId,
  })

  return {
    data: (data as CommunityJoinAction) || 'joined',
    error: error ? normalizeCommunityError(error, 'Nao foi possivel entrar na comunidade.') : null,
  }
}

export async function leaveCommunity(communityId: string): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('sair_comunidade', {
    p_comunidade_id: communityId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel sair da comunidade.') : null,
  }
}

export async function cancelCommunityJoinRequest(
  requestId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('cancelar_solicitacao_comunidade', {
    p_solicitacao_id: requestId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel cancelar a solicitacao.') : null,
  }
}

export async function getCommunityJoinRequests(
  communityId: string,
  status: CommunityJoinRequestStatus | 'all' = 'pendente'
): Promise<ServiceResult<CommunityJoinRequest[]>> {
  try {
    let query = supabase
      .from('comunidade_solicitacoes_entrada')
      .select(JOIN_REQUEST_SELECT)
      .eq('comunidade_id', communityId)
      .order('created_at', { ascending: false })

    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar as solicitacoes.'),
      }
    }

    return {
      data: ((data || []) as JoinRequestRow[]).map(normalizeJoinRequest),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar as solicitacoes.'),
    }
  }
}

export async function approveCommunityJoinRequest(
  requestId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('aprovar_solicitacao_comunidade', {
    p_solicitacao_id: requestId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel aprovar a solicitacao.') : null,
  }
}

export async function rejectCommunityJoinRequest(
  requestId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('recusar_solicitacao_comunidade', {
    p_solicitacao_id: requestId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel recusar a solicitacao.') : null,
  }
}

export async function updateCommunityMemberRole(
  communityId: string,
  userId: string,
  role: Exclude<CommunityRole, 'lider'>
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('alterar_cargo_membro', {
    p_comunidade_id: communityId,
    p_usuario_id: userId,
    p_cargo: role,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel alterar o cargo.') : null,
  }
}

export async function removeCommunityMember(
  communityId: string,
  userId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('expulsar_membro', {
    p_comunidade_id: communityId,
    p_usuario_id: userId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel expulsar o membro.') : null,
  }
}

export async function transferCommunityLeadership(
  communityId: string,
  nextLeaderId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('transferir_lideranca', {
    p_comunidade_id: communityId,
    p_novo_lider_id: nextLeaderId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel transferir a lideranca.') : null,
  }
}
