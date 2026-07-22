import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  applyTheme,
  getInitialTheme,
  THEME_STORAGE_KEY,
  type SiteTheme,
} from './theme'

interface ThemeContextValue {
  theme: SiteTheme
  setTheme: (theme: SiteTheme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<SiteTheme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Theme persistence is progressive enhancement.
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme => (currentTheme === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
