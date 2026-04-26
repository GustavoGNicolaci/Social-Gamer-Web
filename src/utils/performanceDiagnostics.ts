type PerformanceLogContext = Record<string, string | number | boolean | null | undefined>

const PERFORMANCE_STORAGE_KEY = 'sg_perf'

export function getPerformanceNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }

  return Date.now()
}

export function isPerformanceDiagnosticsEnabled() {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(PERFORMANCE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function logPerformanceTiming(
  label: string,
  durationMs: number,
  context: PerformanceLogContext = {}
) {
  if (!isPerformanceDiagnosticsEnabled()) return

  console.debug(`[perf] ${label}: ${durationMs.toFixed(1)}ms`, context)
}
