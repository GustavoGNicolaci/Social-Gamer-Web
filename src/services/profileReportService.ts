import { supabase } from '../supabase-client'

export interface ProfileReportError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export type ProfileReportReason =
  | 'foto_ofensiva'
  | 'nome_ofensivo'
  | 'perfil_falso'
  | 'spam'
  | 'assedio_ou_ofensa'
  | 'conteudo_improprio'
  | 'discurso_de_odio'
  | 'outro'

export type ProfileReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

export interface CurrentUserProfileReportSummary {
  id: string
  reportedUserId: string
  reportedUserDisplayName: string
  reason: ProfileReportReason
  description: string | null
  status: ProfileReportStatus
  createdAt: string
}

interface ServiceResult<T> {
  data: T
  error: ProfileReportError | null
}

interface ProfileReportRow {
  id: string
  usuario_denunciado_id: string
  nome_usuario_denunciado: string
  motivo: ProfileReportReason
  descricao: string | null
  status: ProfileReportStatus
  created_at: string
}

interface SubmitProfileReportParams {
  reporterId: string
  reportedUserId: string
  reason: ProfileReportReason
  description?: string
}

interface SubmitProfileReportResult {
  status: 'created' | 'already_exists' | 'error'
  data: CurrentUserProfileReportSummary | null
  error: ProfileReportError | null
}

interface DeleteProfileReportParams {
  reporterId: string
  reportId: string
}

interface DeleteProfileReportResult {
  status: 'deleted' | 'error'
  error: ProfileReportError | null
}

const PROFILE_REPORT_SELECT = `
  id,
  usuario_denunciado_id,
  nome_usuario_denunciado,
  motivo,
  descricao,
  status,
  created_at
`

export const PROFILE_REPORT_REASON_OPTIONS: Array<{
  value: ProfileReportReason
  label: string
}> = [
  { value: 'foto_ofensiva', label: 'Foto ofensiva' },
  { value: 'nome_ofensivo', label: 'Nome ofensivo' },
  { value: 'perfil_falso', label: 'Perfil falso' },
  { value: 'spam', label: 'Spam' },
  { value: 'assedio_ou_ofensa', label: 'Assedio ou ofensa' },
  { value: 'conteudo_improprio', label: 'Conteudo improprio' },
  { value: 'discurso_de_odio', label: 'Discurso de odio' },
  { value: 'outro', label: 'Outro' },
]

export const PROFILE_REPORT_REASON_LABELS: Record<ProfileReportReason, string> =
  PROFILE_REPORT_REASON_OPTIONS.reduce(
    (labels, option) => ({
      ...labels,
      [option.value]: option.label,
    }),
    {} as Record<ProfileReportReason, string>
  )

export const PROFILE_REPORT_STATUS_LABELS: Record<ProfileReportStatus, string> = {
  pending: 'Pendente',
  under_review: 'Em analise',
  resolved: 'Resolvida',
  dismissed: 'Arquivada',
}

function normalizeProfileReportError(
  error: unknown,
  fallbackMessage: string
): ProfileReportError {
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    const details =
      'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    return { code, message, details, hint }
  }

  return { message: fallbackMessage }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function normalizeProfileReportSummary(row: ProfileReportRow): CurrentUserProfileReportSummary {
  return {
    id: row.id,
    reportedUserId: row.usuario_denunciado_id,
    reportedUserDisplayName: row.nome_usuario_denunciado,
    reason: row.motivo,
    description: row.descricao,
    status: row.status,
    createdAt: row.created_at,
  }
}

async function getExistingProfileReport(
  reporterId: string,
  reportedUserId: string
): Promise<ServiceResult<CurrentUserProfileReportSummary | null>> {
  try {
    const { data, error } = await supabase
      .from('denuncias_perfil')
      .select(PROFILE_REPORT_SELECT)
      .eq('denunciante_id', reporterId)
      .eq('usuario_denunciado_id', reportedUserId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeProfileReportError(
          error,
          'Nao foi possivel verificar a denuncia atual deste perfil.'
        ),
      }
    }

    return {
      data: data ? normalizeProfileReportSummary(data as ProfileReportRow) : null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeProfileReportError(
        error,
        'Erro inesperado ao verificar a denuncia atual deste perfil.'
      ),
    }
  }
}

export async function getCurrentUserProfileReport(
  reporterId: string,
  reportedUserId: string
): Promise<ServiceResult<CurrentUserProfileReportSummary | null>> {
  if (!reporterId || !reportedUserId || reporterId === reportedUserId) {
    return {
      data: null,
      error: null,
    }
  }

  return getExistingProfileReport(reporterId, reportedUserId)
}

export async function submitProfileReport({
  reporterId,
  reportedUserId,
  reason,
  description,
}: SubmitProfileReportParams): Promise<SubmitProfileReportResult> {
  if (reporterId === reportedUserId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Voce nao pode denunciar o proprio perfil.',
      },
    }
  }

  try {
    const { data, error } = await supabase
      .from('denuncias_perfil')
      .insert({
        denunciante_id: reporterId,
        usuario_denunciado_id: reportedUserId,
        motivo: reason,
        descricao: normalizeOptionalText(description),
        created_at: new Date().toISOString(),
      })
      .select(PROFILE_REPORT_SELECT)
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        const existingReportResult = await getExistingProfileReport(reporterId, reportedUserId)

        return {
          status: 'already_exists',
          data: existingReportResult.data,
          error: existingReportResult.error,
        }
      }

      return {
        status: 'error',
        data: null,
        error: normalizeProfileReportError(error, 'Nao foi possivel registrar esta denuncia de perfil.'),
      }
    }

    return {
      status: 'created',
      data: data ? normalizeProfileReportSummary(data as ProfileReportRow) : null,
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeProfileReportError(
        error,
        'Erro inesperado ao registrar esta denuncia de perfil.'
      ),
    }
  }
}

export async function deleteProfileReport({
  reporterId,
  reportId,
}: DeleteProfileReportParams): Promise<DeleteProfileReportResult> {
  if (!reporterId || !reportId) {
    return {
      status: 'error',
      error: {
        message: 'Nao foi possivel identificar a denuncia que voce deseja remover.',
      },
    }
  }

  try {
    const { data, error } = await supabase
      .from('denuncias_perfil')
      .delete()
      .eq('id', reportId)
      .eq('denunciante_id', reporterId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        status: 'error',
        error: normalizeProfileReportError(error, 'Nao foi possivel remover esta denuncia de perfil.'),
      }
    }

    if (!data) {
      return {
        status: 'error',
        error: {
          message: 'Esta denuncia de perfil nao foi encontrada ou ja foi removida.',
        },
      }
    }

    return {
      status: 'deleted',
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      error: normalizeProfileReportError(
        error,
        'Erro inesperado ao remover esta denuncia de perfil.'
      ),
    }
  }
}
