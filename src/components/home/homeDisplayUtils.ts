export function formatCompactDate(value: string | null | undefined, fallback = 'Agora') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

export function formatFullDate(value: string | null | undefined, fallback = 'Data nao informada') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR')
}

export function formatCount(value: number) {
  return value.toLocaleString('pt-BR')
}

export function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

export function getInitial(value: string, fallback = 'J') {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : fallback
}
