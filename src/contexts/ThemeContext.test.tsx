import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeContext'
import { applyInitialTheme, THEME_STORAGE_KEY } from './theme'

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme()
  return <button type="button" onClick={toggleTheme}>{theme}</button>
}

beforeEach(() => {
  window.localStorage.clear()
  document.body.className = ''
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  })
})

afterEach(cleanup)

describe('theme', () => {
  it('applies a stored theme before rendering and preserves the storage key', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')

    expect(applyInitialTheme()).toBe('light')
    expect(document.body).toHaveClass('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('toggles the shared theme without changing its public persistence contract', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'dark' }))

    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument()
    expect(document.body).toHaveClass('light')
    expect(window.localStorage.getItem('social-gamer-theme')).toBe('light')
  })
})
