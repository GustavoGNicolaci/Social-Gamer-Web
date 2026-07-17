import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../../../contexts/AuthContext'
import {
  followUser,
  type FollowListKind,
  getFollowState,
  unfollowUser,
  type PublicUserProfile,
  type UserFollowState,
  type UserServiceError,
} from '../../../services/userService'

type ActiveProfile = UserProfile | PublicUserProfile

interface FollowFeedbackState {
  tone: 'error' | 'info'
  message: string
}

interface ScopedFollowFeedbackState {
  profileId: string
  feedback: FollowFeedbackState
}

const EMPTY_FOLLOW_STATE: UserFollowState = {
  isFollowing: false,
  followersCount: 0,
  followingCount: 0,
}

function getFollowErrorMessage(error: UserServiceError | null, action: 'load' | 'follow' | 'unfollow') {
  if (!error) {
    return action === 'load'
      ? 'Could not load this profile connections right now.'
      : action === 'follow'
        ? 'Could not follow this profile right now.'
        : 'Could not unfollow this profile right now.'
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
    return action === 'load'
      ? 'Could not load followers due to permissions. Check the policies for the seguidores table in Supabase.'
      : action === 'follow'
        ? 'Could not follow this profile due to permissions. Check the INSERT policies for the seguidores table in Supabase.'
        : 'Could not unfollow this profile due to permissions. Check the DELETE policies for the seguidores table in Supabase.'
  }

  if (fullMessage.includes('duplicate') || fullMessage.includes('unique')) {
    return 'You already follow this profile.'
  }

  return error.message || 'Could not continue this action right now.'
}

interface UseProfileFollowParams {
  activeProfile: ActiveProfile | null
  isRestrictedPublicView: boolean
  onFollowChanged: () => void
  user: User | null
}

export function useProfileFollow({
  activeProfile,
  isRestrictedPublicView,
  onFollowChanged,
  user,
}: UseProfileFollowParams) {
  const [followState, setFollowState] = useState<UserFollowState>(EMPTY_FOLLOW_STATE)
  const [followLoading, setFollowLoading] = useState(false)
  const [followSubmitting, setFollowSubmitting] = useState(false)
  const [scopedFollowFeedback, setScopedFollowFeedback] =
    useState<ScopedFollowFeedbackState | null>(null)
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false)
  const [connectionsInitialTab, setConnectionsInitialTab] =
    useState<FollowListKind>('followers')
  const [followersRefreshKey, setFollowersRefreshKey] = useState(0)
  const followStateRequestIdRef = useRef(0)
  const followMutationRequestIdRef = useRef(0)
  const activeProfileId = activeProfile?.id || null
  const followFeedback =
    scopedFollowFeedback?.profileId === activeProfileId
      ? scopedFollowFeedback.feedback
      : null

  useEffect(() => {
    followMutationRequestIdRef.current += 1

    const timeoutId = window.setTimeout(() => {
      setScopedFollowFeedback(null)
      setFollowSubmitting(false)
      setIsConnectionsModalOpen(false)
      setConnectionsInitialTab('followers')
    }, 0)

    return () => {
      followMutationRequestIdRef.current += 1
      window.clearTimeout(timeoutId)
    }
  }, [activeProfileId])

  const refreshFollowState = useCallback(async () => {
    const requestId = followStateRequestIdRef.current + 1
    followStateRequestIdRef.current = requestId

    if (!activeProfile) {
      setFollowLoading(false)
      setScopedFollowFeedback(null)
      setFollowState(EMPTY_FOLLOW_STATE)
      return
    }

    setFollowLoading(true)

    const result = await getFollowState(user?.id, activeProfile.id)

    if (followStateRequestIdRef.current !== requestId) return

    if (result.error) {
      setScopedFollowFeedback({
        profileId: activeProfile.id,
        feedback: {
          tone: 'error',
          message: getFollowErrorMessage(result.error, 'load'),
        },
      })
    } else {
      setScopedFollowFeedback(null)
    }

    setFollowState(result.data)
    setFollowLoading(false)
  }, [activeProfile, user?.id])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshFollowState()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      followStateRequestIdRef.current += 1
    }
  }, [refreshFollowState])

  const handleOpenConnectionsModal = (kind: FollowListKind) => {
    const totalItems = kind === 'followers' ? followState.followersCount : followState.followingCount

    if (isRestrictedPublicView || followLoading || totalItems <= 0) return

    setConnectionsInitialTab(kind)
    setIsConnectionsModalOpen(true)
  }

  const handleToggleFollow = async () => {
    if (!user || !activeProfile || followSubmitting || user.id === activeProfile.id) return

    const requestId = followMutationRequestIdRef.current + 1
    followMutationRequestIdRef.current = requestId
    const targetProfileId = activeProfile.id
    setFollowSubmitting(true)
    setScopedFollowFeedback(null)

    const wasFollowing = followState.isFollowing
    const result = wasFollowing
      ? await unfollowUser(user.id, activeProfile.id)
      : await followUser(user.id, activeProfile.id)

    if (followMutationRequestIdRef.current !== requestId) return

    if (result.error) {
      setScopedFollowFeedback({
        profileId: targetProfileId,
        feedback: {
          tone: 'error',
          message: getFollowErrorMessage(result.error, wasFollowing ? 'unfollow' : 'follow'),
        },
      })
      setFollowSubmitting(false)
      return
    }

    setFollowState(result.data)
    setFollowersRefreshKey(currentKey => currentKey + 1)
    onFollowChanged()
    setFollowSubmitting(false)
  }

  return {
    closeConnectionsModal: () => setIsConnectionsModalOpen(false),
    connectionsInitialTab,
    followFeedback,
    followLoading,
    followState,
    followSubmitting,
    followersRefreshKey,
    handleOpenConnectionsModal,
    handleToggleFollow,
    isConnectionsModalOpen,
    refreshFollowState,
  }
}
