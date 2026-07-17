import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../../../contexts/AuthContext'
import {
  getPublicProfileByUsername,
  type PublicUserProfile,
  type UserServiceError,
} from '../../../services/userService'
import {
  getTopFiveEntriesFromPrivacySettings,
  type TopFiveStoredEntry,
} from '../../../utils/profileTopFive'

export type ResolvedProfile =
  | {
      kind: 'own'
      data: UserProfile
      topFiveEntries: TopFiveStoredEntry[]
    }
  | {
      kind: 'public'
      data: PublicUserProfile
      topFiveEntries: TopFiveStoredEntry[]
    }

function getPublicProfileErrorMessage(error: UserServiceError | null) {
  if (!error) {
    return 'Could not load this profile right now.'
  }

  const fullMessage = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Could not load this profile due to permissions. Check the SELECT policies for the usuarios table in Supabase.'
  }

  return 'Could not load this profile right now.'
}

interface UseResolvedProfileParams {
  requestedUsername: string
  user: User | null
  ownProfile: UserProfile | null
  authLoading: boolean
}

export function useResolvedProfile({
  requestedUsername,
  user,
  ownProfile,
  authLoading,
}: UseResolvedProfileParams) {
  const isUsernameRoute = requestedUsername.length > 0
  const [publicProfile, setPublicProfile] = useState<PublicUserProfile | null>(null)
  const [publicProfileLoading, setPublicProfileLoading] = useState(false)
  const [publicProfileError, setPublicProfileError] = useState<string | null>(null)
  const [publicProfileRefreshKey, setPublicProfileRefreshKey] = useState(0)

  useEffect(() => {
    let isMounted = true

    const loadRequestedProfile = async () => {
      if (!isUsernameRoute) {
        if (isMounted) {
          setPublicProfile(null)
          setPublicProfileLoading(false)
          setPublicProfileError(null)
        }
        return
      }

      setPublicProfileLoading(true)
      setPublicProfileError(null)

      const result = await getPublicProfileByUsername(requestedUsername, user?.id)

      if (!isMounted) return

      if (result.error) {
        setPublicProfile(null)
        setPublicProfileError(getPublicProfileErrorMessage(result.error))
      } else {
        setPublicProfile(result.data)
        setPublicProfileError(null)
      }

      setPublicProfileLoading(false)
    }

    void loadRequestedProfile()

    return () => {
      isMounted = false
    }
  }, [isUsernameRoute, publicProfileRefreshKey, requestedUsername, user?.id])

  const resolvedProfile = useMemo<ResolvedProfile | null>(() => {
    if (!isUsernameRoute) {
      if (!ownProfile) return null

      return {
        kind: 'own',
        data: ownProfile,
        topFiveEntries: getTopFiveEntriesFromPrivacySettings(
          ownProfile.configuracoes_privacidade
        ),
      }
    }

    if (!publicProfile) return null

    if (user && ownProfile && user.id === publicProfile.id && ownProfile.id === user.id) {
      return {
        kind: 'own',
        data: ownProfile,
        topFiveEntries: getTopFiveEntriesFromPrivacySettings(
          ownProfile.configuracoes_privacidade
        ),
      }
    }

    return {
      kind: 'public',
      data: publicProfile,
      topFiveEntries: publicProfile.topFiveEntries,
    }
  }, [isUsernameRoute, ownProfile, publicProfile, user])

  const activeProfile = resolvedProfile?.data || null
  const editableProfile = resolvedProfile?.kind === 'own' ? resolvedProfile.data : null
  const isOwnerView = resolvedProfile?.kind === 'own'
  const isRestrictedPublicView = Boolean(
    resolvedProfile?.kind === 'public' && !resolvedProfile.data.canViewRestrictedContent
  )

  return {
    activeProfile,
    editableProfile,
    isOwnerView,
    isRestrictedPublicView,
    isUsernameRoute,
    pageLoading: authLoading || publicProfileLoading,
    publicProfile,
    publicProfileError,
    refreshPublicProfile: () => setPublicProfileRefreshKey(currentKey => currentKey + 1),
    resolvedProfile,
    topFiveEntries: resolvedProfile?.topFiveEntries || [],
  }
}
