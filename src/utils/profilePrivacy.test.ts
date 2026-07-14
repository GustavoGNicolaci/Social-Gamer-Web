import { describe, expect, it } from 'vitest'
import {
  canViewRestrictedProfile,
  getProfilePrivacyMode,
  mergeProfilePrivacyModeIntoPrivacySettings,
  normalizePrivacySettings,
} from './profilePrivacy'

describe('profile privacy rules', () => {
  it.each([
    [{}, 'public'],
    [{ perfil_privado: false, somente_amigos: false }, 'public'],
    [{ somente_amigos: true }, 'friends'],
    [{ perfil_privado: true, somente_amigos: true }, 'private'],
  ] as const)('normalizes %o to %s', (settings, expectedMode) => {
    expect(getProfilePrivacyMode(settings)).toBe(expectedMode)
  })

  it('allows everyone to view public content', () => {
    expect(canViewRestrictedProfile({ ownerId: 'owner', viewerId: null, privacyMode: 'public' })).toBe(true)
  })

  it('allows only the owner to view private content', () => {
    expect(canViewRestrictedProfile({ ownerId: 'owner', viewerId: 'owner', privacyMode: 'private' })).toBe(true)
    expect(canViewRestrictedProfile({ ownerId: 'owner', viewerId: 'viewer', privacyMode: 'private' })).toBe(false)
  })

  it('allows mutual friends to view friends-only content', () => {
    expect(canViewRestrictedProfile({ ownerId: 'owner', viewerId: 'friend', privacyMode: 'friends', isMutualFriend: true })).toBe(true)
    expect(canViewRestrictedProfile({ ownerId: 'owner', viewerId: 'follower', privacyMode: 'friends', isMutualFriend: false })).toBe(false)
  })

  it('preserves unrelated privacy settings when the mode changes', () => {
    expect(mergeProfilePrivacyModeIntoPrivacySettings({ idioma_interface: 'en-US', top_five: [1] }, 'friends')).toEqual({
      idioma_interface: 'en-US',
      top_five: [1],
      perfil_privado: false,
      somente_amigos: true,
    })
  })

  it('rejects arrays as privacy objects', () => {
    expect(normalizePrivacySettings([] as unknown as Record<string, unknown>)).toEqual({})
  })
})
