import { deleteStorageFiles } from '../../../services/storageService'
import { supabase } from '../../../supabase-client'
import { logClientError } from '../../../utils/clientLogging'
import { isSupabasePermissionError } from '../../../utils/supabaseErrors'
import {
  normalizeCommunity,
  normalizeCommunityError,
  normalizeReport,
  REPORT_SELECT,
} from './mappers'
import { getCurrentUserRoles } from './membership'
import type {
  CommunityMediaCleanupResult,
  CommunityPostingPermission,
  CommunityReport,
  CommunityReportReason,
  CommunityReportsOptions,
  CommunityReportStatus,
  CommunityReportTargetType,
  CommunityRow,
  CommunitySummary,
  ReportRow,
  ServiceResult,
  UpdateCommunityModeratedInput,
} from './types'

export async function updateCommunityModeratedDetails(
  input: UpdateCommunityModeratedInput
): Promise<ServiceResult<CommunitySummary | null>> {
  const { data, error } = await supabase.rpc('editar_comunidade_moderavel', {
    p_comunidade_id: input.comunidadeId,
    p_descricao: input.descricao || null,
    p_banner_path: input.bannerPath || null,
    p_regras: input.regras || null,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel editar a comunidade.'),
    }
  }

  const currentRole = await getCurrentUserRoles([input.comunidadeId], input.currentUserId)
  return {
    data: normalizeCommunity(data as CommunityRow, currentRole.get(input.comunidadeId) || null, null),
    error: null,
  }
}

export async function updateCommunityPostingPermission(
  communityId: string,
  permission: CommunityPostingPermission
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('alterar_permissao_postagem', {
    p_comunidade_id: communityId,
    p_permissao: permission,
  })

  return {
    data: null,
    error: error
      ? normalizeCommunityError(error, 'Nao foi possivel alterar quem pode postar.')
      : null,
  }
}

async function getCommunityMediaPaths(communityId: string) {
  const mediaPaths = new Set<string>()
  const { data: communityRow, error: communityError } = await supabase
    .from('comunidades')
    .select('banner_path')
    .eq('id', communityId)
    .maybeSingle()

  if (!communityError && communityRow?.banner_path) {
    mediaPaths.add(communityRow.banner_path)
  }

  if (communityError && !isSupabasePermissionError(communityError)) {
    logClientError('community.mediaCleanup.banner.load', communityError)
  }

  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('comunidade_posts')
      .select('imagem_path')
      .eq('comunidade_id', communityId)
      .not('imagem_path', 'is', null)
      .is('deleted_at', null)
      .range(from, from + pageSize - 1)

    if (error) {
      if (!isSupabasePermissionError(error)) {
        logClientError('community.mediaCleanup.posts.load', error)
      }
      break
    }

    ;((data || []) as Array<{ imagem_path: string | null }>).forEach(row => {
      if (row.imagem_path) mediaPaths.add(row.imagem_path)
    })

    if (!data || data.length < pageSize) break
    from += pageSize
  }

  return Array.from(mediaPaths)
}

async function cleanupCommunityMediaPaths(
  paths: Array<string | null | undefined>
): Promise<CommunityMediaCleanupResult> {
  const cleanupResult = await deleteStorageFiles(paths)
  return {
    deletedPaths: cleanupResult.deletedPaths,
    failedPaths: cleanupResult.failedPaths,
  }
}

export async function deleteCommunity(
  communityId: string
): Promise<ServiceResult<CommunityMediaCleanupResult>> {
  const mediaPaths = await getCommunityMediaPaths(communityId)
  const { error } = await supabase.rpc('excluir_comunidade', {
    p_comunidade_id: communityId,
  })

  if (error) {
    return {
      data: { deletedPaths: [], failedPaths: [] },
      error: normalizeCommunityError(error, 'Nao foi possivel excluir a comunidade.'),
    }
  }

  const cleanupResult = await cleanupCommunityMediaPaths(mediaPaths)

  return {
    data: cleanupResult,
    error: null,
  }
}

export async function submitCommunityReport(input: {
  communityId: string
  targetType: CommunityReportTargetType
  targetId: string
  reason: CommunityReportReason
  description?: string | null
}): Promise<ServiceResult<CommunityReport | null>> {
  const { data, error } = await supabase.rpc('criar_denuncia_comunidade', {
    p_comunidade_id: input.communityId,
    p_tipo_conteudo: input.targetType,
    p_conteudo_id: input.targetId,
    p_motivo: input.reason,
    p_descricao: input.description || null,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel registrar a denuncia.'),
    }
  }

  return {
    data: data ? normalizeReport(data as ReportRow) : null,
    error: null,
  }
}

export async function getCommunityReports(
  communityId: string,
  options: CommunityReportsOptions = {}
): Promise<ServiceResult<CommunityReport[]>> {
  try {
    let query = supabase
      .from('comunidade_denuncias')
      .select(REPORT_SELECT)
      .eq('comunidade_id', communityId)
      .order('created_at', { ascending: false })

    if (options.status && options.status !== 'all') query = query.eq('status', options.status)

    const { data, error } = await query

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar as denuncias.'),
      }
    }

    return {
      data: ((data || []) as ReportRow[]).map(normalizeReport),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar denuncias.'),
    }
  }
}

export async function updateCommunityReportStatus(
  reportId: string,
  status: CommunityReportStatus
): Promise<ServiceResult<CommunityReport | null>> {
  const { data, error } = await supabase.rpc('atualizar_status_denuncia_comunidade', {
    p_denuncia_id: reportId,
    p_status: status,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel atualizar a denuncia.'),
    }
  }

  return {
    data: data ? normalizeReport(data as ReportRow) : null,
    error: null,
  }
}
