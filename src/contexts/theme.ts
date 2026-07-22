export const THEME_STORAGE_KEY = 'social-gamer-theme'

export type SiteTheme = 'dark' | 'light'

function isSiteTheme(value: unknown): value is SiteTheme {
  return value === 'dark' || value === 'light'
}

export function getInitialTheme(): SiteTheme {
  if (typeof window !== 'undefined') {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (isSiteTheme(storedTheme)) return storedTheme
    } catch {
      // Storage is progressive enhancement; private browsing must still render.
    }

    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
  }

  if (typeof document !== 'undefined' && document.body.classList.contains('light')) {
    return 'light'
  }

  return 'dark'
}

export function applyTheme(theme: SiteTheme) {
  if (typeof document === 'undefined') return

  document.body.classList.toggle('light', theme === 'light')
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function applyInitialTheme() {
  const theme = getInitialTheme()
  applyTheme(theme)
  return theme
}
