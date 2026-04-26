import { supabase } from '../supabase-client'
import { getPerformanceNow, logPerformanceTiming } from '../utils/performanceDiagnostics'
import type { CatalogGamePreview } from './gameCatalogService'

export type GameStatusValue = 'jogando' | 'zerado' | 'dropado'
export type GameStatusSortValue = 'recent' | 'oldest' | 'favorites' | 'title'

export interface GameStatusError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface GameStatusEntry {
  id: string
  usuario_id: string
  jogo_id: number
  status: GameStatusValue
  created_at: string | null
  favorito: boolean
}

export type StatusGame = CatalogGamePreview

export interface GameStatusItem extends GameStatusEntry {
  jogo: StatusGame | null
}

export interface GameStatusPageOptions {
  page?: number
  pageSize?: number
  sort?: GameStatusSortValue
  statuses?: GameStatusValue[]
}

export interface ProfileQueryTimings {
  totalMs: number
  queryMs: number
  normalizeMs: number
  requestCount: number
  fallbackUsed?: boolean
}

interface ServiceResult<T> {
  data: T
  error: GameStatusError | null
}

interface PaginatedServiceResult<T> extends ServiceResult<T> {
  totalCount: number | null
  hasMore: boolean
  nextPage: number | null
  timings: ProfileQueryTimings
}

interface SaveGameStatusParams {
  userId: string
  gameId: number
  status: GameStatusValue
  favorito: boolean
}

interface DeleteGameStatusParams {
  userId: string
  statusId: string
}

type StatusGameRelation = StatusGame | StatusGame[] | null

interface GameStatusRelationRow extends GameStatusEntry {
  jogo: StatusGameRelation
}

const STATUS_VALUES: GameStatusValue[] = ['jogando', 'zerado', 'dropado']
const DEFAULT_STATUS_PAGE_SIZE = 12
const STATUS_GAME_SELECT = 'id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas'
const STATUS_RELATION_SELECT = `
  id,
  usuario_id,
  jogo_id,
  status,
  created_at,
  favorito,
  jogo:jogos (
    id,
    titulo,
    capa_url,
    desenvolvedora,
    generos,
    data_lancamento,
    plataformas
  )
`

function normalizeGameStatusError(error: unknown, fallbackMessage: string): GameStatusError {
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

function normalizeStatusValue(value: string): GameStatusValue {
  const normalizedValue = value.trim().toLowerCase()

  if (STATUS_VALUES.includes(normalizedValue as GameStatusValue)) {
    return normalizedValue as GameStatusValue
  }

  return 'jogando'
}

function normalizePageOptions(options: GameStatusPageOptions = {}) {
  const page = Math.max(0, options.page || 0)
  const pageSize = Math.min(Math.max(1, options.pageSize || DEFAULT_STATUS_PAGE_SIZE), 48)
  const from = page * pageSize
  const to = from + pageSize - 1
  const statuses = Array.from(
    new Set(
      (options.statuses || []).filter((status): status is GameStatusValue =>
        STATUS_VALUES.includes(status)
      )
    )
  )

  return {
    page,
    pageSize,
    from,
    to,
    sort: options.sort || 'recent',
    statuses,
  }
}

function resolveStatusGame(game: StatusGameRelation) {
  if (Array.isArray(game)) return game[0] || null
  return game
}

function normalizeStatusRow(row: GameStatusEntry): GameStatusEntry {
  return {
    ...row,
    status: normalizeStatusValue(row.status),
    favorito: Boolean(row.favorito),
  }
}

function normalizeStatusRelationRow(row: GameStatusRelationRow): GameStatusItem {
  return {
    ...normalizeStatusRow(row),
    jogo: resolveStatusGame(row.jogo),
  }
}

function sortStatusItemsByDisplayOrder(items: GameStatusItem[], sort: GameStatusSortValue) {
  return [...items].sort((leftItem, rightItem) => {
    const leftTitle = leftItem.jogo?.titulo || ''
    const rightTitle = rightItem.jogo?.titulo || ''
    const leftTimestamp = leftItem.created_at ? new Date(leftItem.created_at).getTime() || 0 : 0
    const rightTimestamp = rightItem.created_at ? new Date(rightItem.created_at).getTime() || 0 : 0

    if (sort === 'title') {
      const titleDelta = leftTitle.localeCompare(rightTitle, 'pt-BR')
      if (titleDelta !== 0) return titleDelta
    }

    if (sort === 'favorites') {
      if (leftItem.favorito !== rightItem.favorito) return leftItem.favorito ? -1 : 1
      return rightTimestamp - leftTimestamp
    }

    if (sort === 'oldest') {
      return leftTimestamp - rightTimestamp
    }

    return rightTimestamp - leftTimestamp
  })
}

function createEmptyStatusPageResult(
  timings: ProfileQueryTimings,
  error: GameStatusError | null = null
): PaginatedServiceResult<GameStatusItem[]> {
  return {
    data: [],
    error,
    totalCount: error ? null : 0,
    hasMore: false,
    nextPage: null,
    timings: {
      ...timings,
      totalMs: timings.totalMs || 0,
    },
  }
}

function buildPageMetadata(totalCount: number | null, page: number, pageSize: number, itemCount: number) {
  const loadedCount = page * pageSize + itemCount
  const hasMore = totalCount === null ? itemCount === pageSize : loadedCount < totalCount

  return {
    totalCount,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
  }
}

async function getGameStatusesPageWithFallback(
  userId: string,
  options: ReturnType<typeof normalizePageOptions>,
  timings: ProfileQueryTimings
): Promise<PaginatedServiceResult<GameStatusItem[]>> {
  const fallbackStartedAt = getPerformanceNow()
  let statusQuery = supabase
    .from('status_jogo')
    .select('id, usuario_id, jogo_id, status, created_at, favorito', { count: 'exact' })
    .eq('usuario_id', userId)

  if (options.statuses.length > 0) {
    statusQuery = statusQuery.in('status', options.statuses)
  }

  if (options.sort === 'oldest') {
    statusQuery = statusQuery.order('created_at', { ascending: true, nullsFirst: false })
  } else if (options.sort === 'favorites') {
    statusQuery = statusQuery
      .order('favorito', { ascending: false })
      .order('created_at', { ascending: false, nullsFirst: false })
  } else {
    statusQuery = statusQuery.order('created_at', { ascending: false, nullsFirst: false })
  }

  const { data: statusRows, error: statusError, count } = await statusQuery.range(options.from, options.to)
  timings.requestCount += 1
  timings.queryMs += getPerformanceNow() - fallbackStartedAt

  if (statusError) {
    timings.totalMs = timings.queryMs + timings.normalizeMs
    return createEmptyStatusPageResult(
      timings,
      normalizeGameStatusError(statusError, 'Nao foi possivel carregar os status dos jogos.')
    )
  }

  const normalizedStatusRows = ((statusRows || []) as GameStatusEntry[]).map(normalizeStatusRow)

  if (normalizedStatusRows.length === 0) {
    timings.totalMs = timings.queryMs + timings.normalizeMs
    return {
      ...createEmptyStatusPageResult(timings),
      totalCount: count || 0,
    }
  }

  const gameIds = Array.from(new Set(normalizedStatusRows.map(row => row.jogo_id)))
  const gamesStartedAt = getPerformanceNow()
  const { data: gameRows, error: gameError } = await supabase
    .from('jogos')
    .select(STATUS_GAME_SELECT)
    .in('id', gameIds)
  timings.requestCount += 1
  timings.queryMs += getPerformanceNow() - gamesStartedAt

  if (gameError) {
    timings.totalMs = timings.queryMs + timings.normalizeMs
    return createEmptyStatusPageResult(
      timings,
      normalizeGameStatusError(gameError, 'Nao foi possivel carregar os jogos com status.')
    )
  }

  const normalizeStartedAt = getPerformanceNow()
  const gamesById = new Map<number, StatusGame>()

  ;((gameRows || []) as StatusGame[]).forEach(game => {
    gamesById.set(game.id, game)
  })

  const items = sortStatusItemsByDisplayOrder(
    normalizedStatusRows.map(item => ({
      ...item,
      jogo: gamesById.get(item.jogo_id) || null,
    })),
    options.sort
  )
  timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
  timings.totalMs = timings.queryMs + timings.normalizeMs

  return {
    data: items,
    error: null,
    ...buildPageMetadata(count, options.page, options.pageSize, items.length),
    timings,
  }
}

export async function getGameStatusesPageByUserId(
  userId: string,
  pageOptions: GameStatusPageOptions = {}
): Promise<PaginatedServiceResult<GameStatusItem[]>> {
  const options = normalizePageOptions(pageOptions)
  const startedAt = getPerformanceNow()
  const timings: ProfileQueryTimings = {
    totalMs: 0,
    queryMs: 0,
    normalizeMs: 0,
    requestCount: 0,
  }

  try {
    let query = supabase
      .from('status_jogo')
      .select(STATUS_RELATION_SELECT, { count: 'exact' })
      .eq('usuario_id', userId)

    if (options.statuses.length > 0) {
      query = query.in('status', options.statuses)
    }

    if (options.sort === 'oldest') {
      query = query.order('created_at', { ascending: true, nullsFirst: false })
    } else if (options.sort === 'favorites') {
      query = query
        .order('favorito', { ascending: false })
        .order('created_at', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false, nullsFirst: false })
    }

    const queryStartedAt = getPerformanceNow()
    const { data, error, count } = await query.range(options.from, options.to)
    timings.requestCount += 1
    timings.queryMs += getPerformanceNow() - queryStartedAt

    if (error) {
      const fallbackTimings: ProfileQueryTimings = {
        ...timings,
        fallbackUsed: true,
      }
      const fallbackResult = await getGameStatusesPageWithFallback(userId, options, fallbackTimings)
      fallbackResult.timings.totalMs = getPerformanceNow() - startedAt
      logPerformanceTiming('profile.status.page', fallbackResult.timings.totalMs, {
        userId,
        page: options.page,
        pageSize: options.pageSize,
        sort: options.sort,
        statuses: options.statuses.join(',') || 'all',
        requestCount: fallbackResult.timings.requestCount,
        fallbackUsed: true,
        hasError: Boolean(fallbackResult.error),
      })
      return fallbackResult
    }

    const normalizeStartedAt = getPerformanceNow()
    const items = sortStatusItemsByDisplayOrder(
      ((data || []) as GameStatusRelationRow[]).map(normalizeStatusRelationRow),
      options.sort
    )
    timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
    timings.totalMs = getPerformanceNow() - startedAt

    const result: PaginatedServiceResult<GameStatusItem[]> = {
      data: items,
      error: null,
      ...buildPageMetadata(count, options.page, options.pageSize, items.length),
      timings,
    }

    logPerformanceTiming('profile.status.page', timings.totalMs, {
      userId,
      page: options.page,
      pageSize: options.pageSize,
      sort: options.sort,
      statuses: options.statuses.join(',') || 'all',
      requestCount: timings.requestCount,
      fallbackUsed: false,
      totalCount: result.totalCount,
      itemCount: result.data.length,
    })

    return result
  } catch (error) {
    timings.totalMs = getPerformanceNow() - startedAt
    logPerformanceTiming('profile.status.page', timings.totalMs, {
      userId,
      page: options.page,
      pageSize: options.pageSize,
      sort: options.sort,
      statuses: options.statuses.join(',') || 'all',
      requestCount: timings.requestCount,
      hasError: true,
    })

    return createEmptyStatusPageResult(
      timings,
      normalizeGameStatusError(error, 'Erro inesperado ao carregar os status dos jogos.')
    )
  }
}

export async function getGameStatusesByUserId(
  userId: string
): Promise<ServiceResult<GameStatusItem[]>> {
  try {
    const { data: statusRows, error: statusError } = await supabase
      .from('status_jogo')
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .eq('usuario_id', userId)

    if (statusError) {
      return {
        data: [],
        error: normalizeGameStatusError(statusError, 'Nao foi possivel carregar os status dos jogos.'),
      }
    }

    const normalizedStatusRows = ((statusRows || []) as GameStatusEntry[]).map(row => ({
      ...row,
      status: normalizeStatusValue(row.status),
      favorito: Boolean(row.favorito),
    }))

    if (normalizedStatusRows.length === 0) {
      return {
        data: [],
        error: null,
      }
    }

    const gameIds = Array.from(new Set(normalizedStatusRows.map(row => row.jogo_id)))

    const { data: gameRows, error: gameError } = await supabase
      .from('jogos')
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
      .in('id', gameIds)

    if (gameError) {
      return {
        data: [],
        error: normalizeGameStatusError(gameError, 'Nao foi possivel carregar os jogos com status.'),
      }
    }

    const gamesById = new Map<number, StatusGame>()

    ;((gameRows || []) as StatusGame[]).forEach(game => {
      gamesById.set(game.id, game)
    })

    return {
      data: normalizedStatusRows.map(item => ({
        ...item,
        jogo: gamesById.get(item.jogo_id) || null,
      })),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeGameStatusError(error, 'Erro inesperado ao carregar os status dos jogos.'),
    }
  }
}

export async function getGameStatusEntry(
  userId: string,
  gameId: number
): Promise<ServiceResult<GameStatusEntry | null>> {
  try {
    const { data, error } = await supabase
      .from('status_jogo')
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .eq('usuario_id', userId)
      .eq('jogo_id', gameId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeGameStatusError(error, 'Nao foi possivel carregar o status deste jogo.'),
      }
    }

    if (!data) {
      return {
        data: null,
        error: null,
      }
    }

    const entry = data as GameStatusEntry

    return {
      data: {
        ...entry,
        status: normalizeStatusValue(entry.status),
        favorito: Boolean(entry.favorito),
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Erro inesperado ao carregar o status deste jogo.'),
    }
  }
}


export async function saveGameStatus({
  userId,
  gameId,
  status,
  favorito,
}: SaveGameStatusParams): Promise<ServiceResult<GameStatusEntry | null>> {
  try {
    const { data: existingEntry, error: existingError } = await supabase
      .from('status_jogo')
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .eq('usuario_id', userId)
      .eq('jogo_id', gameId)
      .maybeSingle()

    if (existingError) {
      return {
        data: null,
        error: normalizeGameStatusError(existingError, 'Nao foi possivel verificar o status atual do jogo.'),
      }
    }

    if (existingEntry) {
      const { data, error } = await supabase
        .from('status_jogo')
        .update({
          status,
          favorito,
        })
        .eq('id', existingEntry.id)
        .eq('usuario_id', userId)
        .select('id, usuario_id, jogo_id, status, created_at, favorito')
        .single()

      if (error) {
        return {
          data: null,
          error: normalizeGameStatusError(error, 'Nao foi possivel atualizar o status deste jogo.'),
        }
      }

      return {
        data: {
          ...(data as GameStatusEntry),
          status: normalizeStatusValue((data as GameStatusEntry).status),
          favorito: Boolean((data as GameStatusEntry).favorito),
        },
        error: null,
      }
    }

    const { data, error } = await supabase
      .from('status_jogo')
      .insert({
        usuario_id: userId,
        jogo_id: gameId,
        status,
        favorito,
        created_at: new Date().toISOString(),
      })
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .single()

    if (error) {
      return {
        data: null,
        error: normalizeGameStatusError(error, 'Nao foi possivel criar o status deste jogo.'),
      }
    }

    return {
      data: {
        ...(data as GameStatusEntry),
        status: normalizeStatusValue((data as GameStatusEntry).status),
        favorito: Boolean((data as GameStatusEntry).favorito),
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Erro inesperado ao salvar o status deste jogo.'),
    }
  }
}

export async function deleteGameStatus({
  userId,
  statusId,
}: DeleteGameStatusParams): Promise<ServiceResult<null>> {
  try {
    const { data, error } = await supabase
      .from('status_jogo')
      .delete()
      .eq('id', statusId)
      .eq('usuario_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeGameStatusError(error, 'Nao foi possivel remover este jogo do perfil.'),
      }
    }

    if (!data) {
      return {
        data: null,
        error: {
          message:
            'Nenhum status foi removido. Verifique as policies DELETE da tabela status_jogo no Supabase.',
        },
      }
    }

    return {
      data: null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Erro inesperado ao remover este jogo do perfil.'),
    }
  }
}
