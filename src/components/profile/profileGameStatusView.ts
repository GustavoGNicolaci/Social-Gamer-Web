import type { GameStatusValue } from '../../services/gameStatusService'

export interface ProfileGameStatusOption {
  value: GameStatusValue
  label: string
}

export function getProfileGameTitleInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}
