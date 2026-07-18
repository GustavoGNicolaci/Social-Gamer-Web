import { supabase } from '../../../supabase-client'
import {
  normalizeReviewError,
  type ReviewError,
} from '../domain/reviewError'
import type {
  CurrentUserReportSummary,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../domain/reviewInteractions'

interface ServiceResult<T> {
  data: T
  error: ReviewError | null
}

interface ContentReportRow {
  id: string
  tipo_conteudo: ReportTargetType
  avaliacao_id: string | null
  comentario_id: string | null
  motivo: ReportReason
  descricao: string | null
  status: ReportStatus
  created_at: string
}

interface SubmitContentReportParams {
  userId: string
  targetType: ReportTargetType
  targetId: string
  targetAuthorId?: string
  reason: ReportReason
  description?: string
}

interface SubmitContentReportResult {
  status: 'created' | 'already_exists' | 'error'
  data: CurrentUserReportSummary | null
  error: ReviewError | null
}

interface DeleteContentReportParams {
  userId: string
  reportId: string
}

interface DeleteContentReportResult {
  status: 'deleted' | 'error'
  error: ReviewError | null
}

interface ContentReportMaps {
  reportsByReviewId: Map<string, CurrentUserReportSummary>
  reportsByCommentId: Map<string, CurrentUserReportSummary>
}

const CONTENT_REPORT_SELECT = `
  id,
  tipo_conteudo,
  avaliacao_id,
  comentario_id,
  motivo,
  descricao,
  status,
  created_at
`

export const REPORT_REASON_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'assedio_ou_ofensa', label: 'Assedio ou ofensa' },
  { value: 'conteudo_improprio', label: 'Conteudo improprio' },
  { value: 'informacao_enganosa', label: 'Informacao enganosa' },
  { value: 'discurso_de_odio', label: 'Discurso de odio' },
  { value: 'outro', label: 'Outro' },
]

export const REPORT_REASON_LABELS: Record<ReportReason, string> =
  REPORT_REASON_OPTIONS.reduce(
    (labels, option) => ({
      ...labels,
      [option.value]: option.label,
    }),
    {} as Record<ReportReason, string>
  )

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pendente',
  under_review: 'Em analise',
  resolved: 'Resolvida',
  dismissed: 'Arquivada',
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function normalizeReportSummary(row: ContentReportRow): CurrentUserReportSummary {
  return {
    id: row.id,
    targetType: row.tipo_conteudo,
    reason: row.motivo,
    description: row.descricao,
    status: row.status,
    createdAt: row.created_at,
  }
}

export async function getCurrentUserContentReports(
  reviewIds: string[],
  commentIds: string[],
  currentUserId?: string | null
): Promise<ServiceResult<ContentReportMaps>> {
  const emptyResult: ContentReportMaps = {
    reportsByReviewId: new Map<string, CurrentUserReportSummary>(),
    reportsByCommentId: new Map<string, CurrentUserReportSummary>(),
  }

  if (!currentUserId || (reviewIds.length === 0 && commentIds.length === 0)) {
    return {
      data: emptyResult,
      error: null,
    }
  }

  try {
    const [reviewReportsResponse, commentReportsResponse] = await Promise.all([
      reviewIds.length > 0
        ? supabase
            .from('denuncias_conteudo')
            .select(CONTENT_REPORT_SELECT)
            .eq('denunciante_id', currentUserId)
            .eq('tipo_conteudo', 'review')
            .in('avaliacao_id', reviewIds)
        : Promise.resolve({ data: [], error: null }),
      commentIds.length > 0
        ? supabase
            .from('denuncias_conteudo')
            .select(CONTENT_REPORT_SELECT)
            .eq('denunciante_id', currentUserId)
            .eq('tipo_conteudo', 'comment')
            .in('comentario_id', commentIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (reviewReportsResponse.error || commentReportsResponse.error) {
      return {
        data: emptyResult,
        error: normalizeReviewError(
          reviewReportsResponse.error || commentReportsResponse.error,
          'Nao foi possivel carregar o estado das denuncias deste conteudo.'
        ),
      }
    }

    const reviewReports = (reviewReportsResponse.data || []) as ContentReportRow[]
    const commentReports = (commentReportsResponse.data || []) as ContentReportRow[]

    reviewReports.forEach(report => {
      if (!report.avaliacao_id) return
      emptyResult.reportsByReviewId.set(
        report.avaliacao_id,
        normalizeReportSummary(report)
      )
    })

    commentReports.forEach(report => {
      if (!report.comentario_id) return
      emptyResult.reportsByCommentId.set(
        report.comentario_id,
        normalizeReportSummary(report)
      )
    })

    return {
      data: emptyResult,
      error: null,
    }
  } catch (error) {
    return {
      data: emptyResult,
      error: normalizeReviewError(
        error,
        'Erro inesperado ao carregar o estado das denuncias deste conteudo.'
      ),
    }
  }
}

async function getExistingContentReport(
  userId: string,
  targetType: ReportTargetType,
  targetId: string
): Promise<ServiceResult<CurrentUserReportSummary | null>> {
  try {
    const query = supabase
      .from('denuncias_conteudo')
      .select(CONTENT_REPORT_SELECT)
      .eq('denunciante_id', userId)
      .eq('tipo_conteudo', targetType)
      .limit(1)

    const filteredQuery =
      targetType === 'review'
        ? query.eq('avaliacao_id', targetId)
        : query.eq('comentario_id', targetId)

    const { data, error } = await filteredQuery.maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel verificar a denuncia atual.'),
      }
    }

    return {
      data: data ? normalizeReportSummary(data as ContentReportRow) : null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao verificar a denuncia atual.'),
    }
  }
}

export async function submitContentReport({
  userId,
  targetType,
  targetId,
  targetAuthorId,
  reason,
  description,
}: SubmitContentReportParams): Promise<SubmitContentReportResult> {
  if (targetAuthorId && userId === targetAuthorId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Voce nao pode denunciar o proprio conteudo.',
      },
    }
  }

  const normalizedDescription = normalizeOptionalText(description)

  try {
    const { data, error } = await supabase
      .from('denuncias_conteudo')
      .insert({
        denunciante_id: userId,
        tipo_conteudo: targetType,
        avaliacao_id: targetType === 'review' ? targetId : null,
        comentario_id: targetType === 'comment' ? targetId : null,
        motivo: reason,
        descricao: normalizedDescription,
      })
      .select(CONTENT_REPORT_SELECT)
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        const existingReportResult = await getExistingContentReport(
          userId,
          targetType,
          targetId
        )

        return {
          status: 'already_exists',
          data: existingReportResult.data,
          error: existingReportResult.error,
        }
      }

      return {
        status: 'error',
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel registrar esta denuncia.'),
      }
    }

    return {
      status: 'created',
      data: data ? normalizeReportSummary(data as ContentReportRow) : null,
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao registrar esta denuncia.'),
    }
  }
}

export async function deleteContentReport({
  userId,
  reportId,
}: DeleteContentReportParams): Promise<DeleteContentReportResult> {
  if (!userId || !reportId) {
    return {
      status: 'error',
      error: {
        message: 'Nao foi possivel identificar a denuncia que voce deseja remover.',
      },
    }
  }

  try {
    const { data, error } = await supabase
      .from('denuncias_conteudo')
      .delete()
      .eq('id', reportId)
      .eq('denunciante_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        status: 'error',
        error: normalizeReviewError(error, 'Nao foi possivel remover esta denuncia.'),
      }
    }

    if (!data) {
      return {
        status: 'error',
        error: {
          message: 'Esta denuncia nao foi encontrada ou ja foi removida.',
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
      error: normalizeReviewError(error, 'Erro inesperado ao remover esta denuncia.'),
    }
  }
}

export type {
  CurrentUserReportSummary,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../domain/reviewInteractions'
