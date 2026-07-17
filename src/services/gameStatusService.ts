import { supabase } from '../supabase-client'
import type {
  Database,
  GameStatusValue as SupabaseGameStatusValue,
  StatusJogoRow,
} from '../types/supabase'
import { getPerformanceNow, logPerformanceTiming } from '../utils/performanceDiagnostics'
import type { CatalogGamePreview } from './gameCatalogService'
import { normalizeGamePreview } from './gameAdapter'

export type GameStatusValue = SupabaseGameStatusValue
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

type ProfileGameStatusPageRow =
  Database['public']['Functions']['get_profile_game_status_page']['Returns'][number]

export const STATUS_VALUES: GameStatusValue[] = [
  'jogando',
  'zerado',
  'dropado',
  'planejando',
  'pausado',
]
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

function normalizeStatusValue(value: string | null | undefined): GameStatusValue {
  const normalizedValue = value?.trim().toLowerCase() || ''

  if (STATUS_VALUES.includes(normalizedValue as GameStatusValue)) {
    return normalizedValue as GameStatusValue
  }

  return 'jogando'
}

function validateSaveGameStatusParams({
  userId,
  gameId,
  status,
}: SaveGameStatusParams): GameStatusError | null {
  if (!userId.trim()) {
    return {
      message: 'Nao foi possivel identificar o usuario do status.',
    }
  }

  if (!Number.isInteger(gameId) || gameId <= 0) {
    return {
      message: 'Nao foi possivel identificar o jogo do status.',
    }
  }

  if (!STATUS_VALUES.includes(status as GameStatusValue)) {
    return {
      message: 'Escolha um status valido para salvar o jogo no perfil.',
    }
  }

  return null
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

function isCompleteStatusRow<T extends StatusJogoRow | GameStatusEntry>(
  row: T
): row is T & GameStatusEntry {
  return Boolean(
    row.id &&
      row.usuario_id &&
      row.jogo_id &&
      typeof row.status === 'string' &&
      STATUS_VALUES.includes(row.status as GameStatusValue)
  )
}

function normalizeStatusRow(row: StatusJogoRow | GameStatusEntry): GameStatusEntry {
  return {
    id: row.id,
    usuario_id: row.usuario_id || '',
    jogo_id: row.jogo_id || 0,
    status: normalizeStatusValue(row.status),
    created_at: row.created_at || null,
    favorito: Boolean(row.favorito),
  }
}

function normalizeStatusRelationRow(row: GameStatusRelationRow): GameStatusItem {
  return {
    ...normalizeStatusRow(row),
    jogo: resolveStatusGame(row.jogo),
  }
}

function normalizeProfileGameStatusPageRow(row: ProfileGameStatusPageRow): GameStatusItem {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    jogo_id: row.jogo_id,
    status: normalizeStatusValue(row.status),
    created_at: row.created_at,
    favorito: Boolean(row.favorito),
    jogo: normalizeGamePreview({
      id: row.jogo_id,
      titulo: row.game_title,
      capa_url: row.game_cover_url,
      desenvolvedora: row.game_developer,
      generos: row.game_genres,
      data_lancamento: row.game_release_date,
      plataformas: row.game_platforms,
    }),
  }
}

function isMissingProfileGameStatusPageRpc(error: GameStatusError) {
  return error.code === 'PGRST202' || error.code === '42883'
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

async function updateSavedGameStatus(
  { userId, gameId, status, favorito }: SaveGameStatusParams,
  statusId?: string
): Promise<ServiceResult<GameStatusEntry | null>> {
  let updateQuery = supabase
    .from('status_jogo')
    .update({
      status,
      favorito,
    })
    .eq('usuario_id', userId)

  updateQuery = statusId
    ? updateQuery.eq('id', statusId)
    : updateQuery.eq('jogo_id', gameId)

  const { data, error } = await updateQuery
    .select('id, usuario_id, jogo_id, status, created_at, favorito')
    .single()

  if (error) {
    return {
      data: null,
      error: normalizeGameStatusError(error, 'Nao foi possivel atualizar o status deste jogo.'),
    }
  }

  if (!isCompleteStatusRow(data as StatusJogoRow)) {
    return {
      data: null,
      error: {
        message:
          'Nao foi possivel confirmar o status atualizado. Verifique as policies SELECT da tabela status_jogo.',
      },
    }
  }

  return {
    data: normalizeStatusRow(data as StatusJogoRow),
    error: null,
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

  const statusResponse = options.sort === 'title'
    ? await statusQuery
    : await statusQuery.range(options.from, options.to)
  const { data: statusRows, error: statusError, count } = statusResponse
  timings.requestCount += 1
  timings.queryMs += getPerformanceNow() - fallbackStartedAt

  if (statusError) {
    timings.totalMs = timings.queryMs + timings.normalizeMs
    return createEmptyStatusPageResult(
      timings,
      normalizeGameStatusError(statusError, 'Nao foi possivel carregar os status dos jogos.')
    )
  }

  const normalizedStatusRows = ((statusRows || []) as StatusJogoRow[])
    .filter(isCompleteStatusRow)
    .map(normalizeStatusRow)

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

  const sortedItems = sortStatusItemsByDisplayOrder(
    normalizedStatusRows.map(item => ({
      ...item,
      jogo: gamesById.get(item.jogo_id) || null,
    })),
    options.sort
  )
  const items = options.sort === 'title'
    ? sortedItems.slice(options.from, options.to + 1)
    : sortedItems
  timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
  timings.totalMs = timings.queryMs + timings.normalizeMs

  return {
    data: items,
    error: null,
    ...buildPageMetadata(count, options.page, options.pageSize, items.length),
    timings,
  }
}

async function getGameStatusesPageFromLegacyQuery(
  userId: string,
  options: ReturnType<typeof normalizePageOptions>,
  timings: ProfileQueryTimings
): Promise<PaginatedServiceResult<GameStatusItem[]>> {
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
  // This path is retained only while the remote project may not have the RPC.
  // PostgREST cannot sort parent rows globally by a nested title, so the title
  // fallback still loads the authorized set before slicing it in the client.
  const response = options.sort === 'title'
    ? await query
    : await query.range(options.from, options.to)
  const { data, error, count } = response
  timings.requestCount += 1
  timings.queryMs += getPerformanceNow() - queryStartedAt

  if (error) {
    return getGameStatusesPageWithFallback(userId, options, timings)
  }

  const normalizeStartedAt = getPerformanceNow()
  const sortedItems = sortStatusItemsByDisplayOrder(
    ((data || []) as GameStatusRelationRow[])
      .filter(isCompleteStatusRow)
      .map(normalizeStatusRelationRow),
    options.sort
  )
  const items = options.sort === 'title'
    ? sortedItems.slice(options.from, options.to + 1)
    : sortedItems
  timings.normalizeMs += getPerformanceNow() - normalizeStartedAt

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
    const queryStartedAt = getPerformanceNow()
    const { data, error } = await supabase.rpc('get_profile_game_status_page', {
      p_user_id: userId,
      p_statuses: options.statuses.length > 0 ? options.statuses : null,
      p_sort: options.sort,
      p_limit: options.pageSize,
      p_offset: options.from,
    })
    timings.requestCount += 1
    timings.queryMs += getPerformanceNow() - queryStartedAt

    if (error) {
      const normalizedError = normalizeGameStatusError(
        error,
        'Nao foi possivel carregar os status dos jogos.'
      )

      if (isMissingProfileGameStatusPageRpc(normalizedError)) {
        timings.fallbackUsed = true
        const fallbackResult = await getGameStatusesPageFromLegacyQuery(
          userId,
          options,
          timings
        )
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

      timings.totalMs = getPerformanceNow() - startedAt
      const result = createEmptyStatusPageResult(timings, normalizedError)
      logPerformanceTiming('profile.status.page', timings.totalMs, {
        userId,
        page: options.page,
        pageSize: options.pageSize,
        sort: options.sort,
        statuses: options.statuses.join(',') || 'all',
        requestCount: timings.requestCount,
        fallbackUsed: false,
        hasError: true,
      })
      return result
    }

    const normalizeStartedAt = getPerformanceNow()
    const rows = (data || []) as ProfileGameStatusPageRow[]
    const items = rows.map(normalizeProfileGameStatusPageRow)
    const totalCount = rows[0]?.total_count ?? (options.page === 0 ? 0 : null)
    timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
    timings.totalMs = getPerformanceNow() - startedAt

    const result: PaginatedServiceResult<GameStatusItem[]> = {
      data: items,
      error: null,
      ...buildPageMetadata(totalCount, options.page, options.pageSize, items.length),
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

    const normalizedStatusRows = ((statusRows || []) as StatusJogoRow[])
      .filter(isCompleteStatusRow)
      .map(normalizeStatusRow)

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

    return {
      data: isCompleteStatusRow(data as StatusJogoRow)
        ? normalizeStatusRow(data as StatusJogoRow)
        : null,
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
  const validationError = validateSaveGameStatusParams({ userId, gameId, status, favorito })

  if (validationError) {
    return {
      data: null,
      error: validationError,
    }
  }

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
      return await updateSavedGameStatus({ userId, gameId, status, favorito }, existingEntry.id)
    }

    const { data, error } = await supabase
      .from('status_jogo')
      .insert({
        usuario_id: userId,
        jogo_id: gameId,
        status,
        favorito,
      })
      .select('id, usuario_id, jogo_id, status, created_at, favorito')
      .single()

    if (error) {
      if (error.code === '23505') {
        return await updateSavedGameStatus({ userId, gameId, status, favorito })
      }

      return {
        data: null,
        error: normalizeGameStatusError(error, 'Nao foi possivel criar o status deste jogo.'),
      }
    }

    if (!isCompleteStatusRow(data as StatusJogoRow)) {
      return {
        data: null,
        error: {
          message:
            'Nao foi possivel confirmar o status criado. Verifique as policies SELECT da tabela status_jogo.',
        },
      }
    }

    return {
      data: normalizeStatusRow(data as StatusJogoRow),
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
