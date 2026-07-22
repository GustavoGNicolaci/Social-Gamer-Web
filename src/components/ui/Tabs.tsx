import { useRef, type KeyboardEvent } from 'react'

export interface TabItem {
  id: string
  label: string
  panelId: string
  disabled?: boolean
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  className?: string
}

export function Tabs({ items, value, onChange, ariaLabel, className = '' }: TabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    const enabledItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled)
    if (enabledItems.length === 0) return
    const enabledIndex = enabledItems.findIndex(({ index }) => index === currentIndex)
    if (enabledIndex < 0) return

    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? enabledItems.length - 1
        : (enabledIndex + (event.key === 'ArrowRight' ? 1 : -1) + enabledItems.length) % enabledItems.length
    const next = enabledItems[nextIndex]
    onChange(next.item.id)
    refs.current[next.index]?.focus()
  }

  return (
    <div className={`ui-tabs${className ? ` ${className}` : ''}`} role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={element => { refs.current[index] = element }}
          type="button"
          id={item.id}
          className={`ui-tab${value === item.id ? ' is-active' : ''}`}
          role="tab"
          aria-selected={value === item.id}
          aria-controls={item.panelId}
          tabIndex={value === item.id ? 0 : -1}
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
          onKeyDown={event => handleKeyDown(event, index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
