import { supabase } from '../../../supabase-client'
import type { StatusJogoRow } from '../../../types/supabase'
import { getPerformanceNow, logPerformanceTiming } from '../../../utils/performanceDiagnostics'
import {
  buildGameStatusPageMetadata,
  createEmptyGameStatusPageResult,
  normalizeGameStatusPageOptions,
  sortStatusItemsByDisplayOrder,
  type GameStatusItem,
  type GameStatusPageOptions,
  type NormalizedGameStatusPageOptions,
  type PaginatedServiceResult,
  type ProfileQueryTimings,
  type ServiceResult,
  type StatusGame,
} from '../domain/gameStatus'
import {
  isCompleteStatusRow,
  isMissingProfileGameStatusPageRpc,
  normalizeGameStatusError,
  normalizeProfileGameStatusPageRow,
  normalizeStatusRelationRow,
  normalizeStatusRow,
  type GameStatusRelationRow,
  type ProfileGameStatusPageRow,
} from './gameStatusMappers'

const STATUS_GAME_SELECT =
  'id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas'
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

async function getGameStatusesPageWithFallback(
  userId: string,
  options: NormalizedGameStatusPageOptions,
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

  const statusResponse =
    options.sort === 'title' ? await statusQuery : await statusQuery.range(options.from, options.to)
  const { data: statusRows, error: statusError, count } = statusResponse
  timings.requestCount += 1
  timings.queryMs += getPerformanceNow() - fallbackStartedAt

  if (statusError) {
    timings.totalMs = timings.queryMs + timings.normalizeMs
    return createEmptyGameStatusPageResult(
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
      ...createEmptyGameStatusPageResult(timings),
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
    return createEmptyGameStatusPageResult(
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
  const items =
    options.sort === 'title' ? sortedItems.slice(options.from, options.to + 1) : sortedItems
  timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
  timings.totalMs = timings.queryMs + timings.normalizeMs

  return {
    data: items,
    error: null,
    ...buildGameStatusPageMetadata(count, options.page, options.pageSize, items.length),
    timings,
  }
}

async function getGameStatusesPageFromLegacyQuery(
  userId: string,
  options: NormalizedGameStatusPageOptions,
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
  const response =
    options.sort === 'title' ? await query : await query.range(options.from, options.to)
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
  const items =
    options.sort === 'title' ? sortedItems.slice(options.from, options.to + 1) : sortedItems
  timings.normalizeMs += getPerformanceNow() - normalizeStartedAt

  return {
    data: items,
    error: null,
    ...buildGameStatusPageMetadata(count, options.page, options.pageSize, items.length),
    timings,
  }
}

export async function getGameStatusesPageByUserId(
  userId: string,
  pageOptions: GameStatusPageOptions = {}
): Promise<PaginatedServiceResult<GameStatusItem[]>> {
  const options = normalizeGameStatusPageOptions(pageOptions)
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
        const fallbackResult = await getGameStatusesPageFromLegacyQuery(userId, options, timings)
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
      const result = createEmptyGameStatusPageResult(timings, normalizedError)
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
      ...buildGameStatusPageMetadata(totalCount, options.page, options.pageSize, items.length),
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

    return createEmptyGameStatusPageResult(
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
        error: normalizeGameStatusError(
          statusError,
          'Nao foi possivel carregar os status dos jogos.'
        ),
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
      .select(STATUS_GAME_SELECT)
      .in('id', gameIds)

    if (gameError) {
      return {
        data: [],
        error: normalizeGameStatusError(
          gameError,
          'Nao foi possivel carregar os jogos com status.'
        ),
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
): Promise<ServiceResult<import('../domain/gameStatus').GameStatusEntry | null>> {
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
      return { data: null, error: null }
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
      error: normalizeGameStatusError(
        error,
        'Erro inesperado ao carregar o status deste jogo.'
      ),
    }
  }
}
