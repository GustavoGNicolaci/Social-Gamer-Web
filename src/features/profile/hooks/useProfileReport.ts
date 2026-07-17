import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../../../contexts/AuthContext'
import { useI18n } from '../../../i18n/I18nContext'
import {
  deleteProfileReport,
  getCurrentUserProfileReport,
  submitProfileReport,
  type CurrentUserProfileReportSummary,
  type ProfileReportError,
  type ProfileReportReason,
} from '../../../services/profileReportService'
import type { PublicUserProfile } from '../../../services/userService'

type ActiveProfile = UserProfile | PublicUserProfile

interface ReportFeedbackState {
  tone: 'success' | 'error' | 'info'
  message: string
}

function getProfileReportErrorMessage(
  error: ProfileReportError | null,
  action: 'load' | 'submit' | 'delete'
) {
  if (!error) {
    return action === 'load'
      ? 'Could not load this profile report state right now.'
      : action === 'submit'
        ? 'Could not submit this profile report right now.'
        : 'Could not remove this profile report right now.'
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
      ? 'Could not load this profile report due to permissions. Check the policies for the denuncias_perfil table in Supabase.'
      : action === 'submit'
        ? 'Could not submit this report due to permissions. Check the policies for the denuncias_perfil table in Supabase.'
        : 'Could not remove this report due to permissions. Check the DELETE policies for the denuncias_perfil table in Supabase.'
  }

  if (fullMessage.includes('duplicate') || fullMessage.includes('unique')) {
    return 'You already reported this profile.'
  }

  if (fullMessage.includes('column')) {
    return 'The denuncias_perfil table structure does not match the frontend.'
  }

  return error.message
}

interface UseProfileReportParams {
  activeProfile: ActiveProfile | null
  isOwnerView: boolean
  user: User | null
}

export function useProfileReport({
  activeProfile,
  isOwnerView,
  user,
}: UseProfileReportParams) {
  const { t } = useI18n()
  const [currentProfileReport, setCurrentProfileReport] =
    useState<CurrentUserProfileReportSummary | null>(null)
  const [profileReportLoading, setProfileReportLoading] = useState(false)
  const [isProfileReportModalOpen, setIsProfileReportModalOpen] = useState(false)
  const [profileReportSubmitting, setProfileReportSubmitting] = useState(false)
  const [profileReportRemoving, setProfileReportRemoving] = useState(false)
  const [profileReportFeedback, setProfileReportFeedback] =
    useState<ReportFeedbackState | null>(null)
  const reportMutationRequestIdRef = useRef(0)
  const canReportProfile = Boolean(user && activeProfile && !isOwnerView)
  const activeProfileId = activeProfile?.id || null

  useEffect(() => {
    reportMutationRequestIdRef.current += 1

    const timeoutId = window.setTimeout(() => {
      setIsProfileReportModalOpen(false)
      setProfileReportFeedback(null)
      setProfileReportSubmitting(false)
      setProfileReportRemoving(false)
    }, 0)

    return () => {
      reportMutationRequestIdRef.current += 1
      window.clearTimeout(timeoutId)
    }
  }, [activeProfileId, isOwnerView, user?.id])

  useEffect(() => {
    let isMounted = true

    const loadCurrentProfileReport = async () => {
      if (!user || !activeProfile || isOwnerView) {
        if (isMounted) {
          setCurrentProfileReport(null)
          setProfileReportLoading(false)
          setProfileReportSubmitting(false)
          setProfileReportRemoving(false)
        }
        return
      }

      setProfileReportLoading(true)

      const result = await getCurrentUserProfileReport(user.id, activeProfile.id)

      if (!isMounted) return

      if (result.error) {
        console.error('Erro ao carregar denuncia atual do perfil:', result.error)
      }

      setCurrentProfileReport(result.data)
      setProfileReportLoading(false)
    }

    void loadCurrentProfileReport()

    return () => {
      isMounted = false
    }
  }, [activeProfile, isOwnerView, user])

  const handleOpenProfileReportModal = () => {
    if (!canReportProfile || profileReportLoading) return

    setProfileReportFeedback(null)
    setIsProfileReportModalOpen(true)
  }

  const handleCloseProfileReportModal = () => {
    if (profileReportSubmitting || profileReportRemoving) return

    setIsProfileReportModalOpen(false)
    setProfileReportFeedback(null)
  }

  const handleSubmitProfileReport = async ({
    reason,
    description,
  }: {
    reason: ProfileReportReason
    description: string
  }) => {
    if (!user || !activeProfile || isOwnerView) return

    const requestId = reportMutationRequestIdRef.current + 1
    reportMutationRequestIdRef.current = requestId
    setProfileReportSubmitting(true)
    setProfileReportFeedback(null)

    const reportResult = await submitProfileReport({
      reporterId: user.id,
      reportedUserId: activeProfile.id,
      reason,
      description,
    })

    if (reportMutationRequestIdRef.current !== requestId) return

    if (reportResult.error) {
      setProfileReportFeedback({
        tone: 'error',
        message: getProfileReportErrorMessage(reportResult.error, 'submit'),
      })
      setProfileReportSubmitting(false)
      return
    }

    if (reportResult.data) {
      setCurrentProfileReport(reportResult.data)
    }

    setProfileReportFeedback({
      tone: reportResult.status === 'already_exists' ? 'info' : 'success',
      message:
        reportResult.status === 'already_exists'
          ? t('profile.reportAlreadyExists')
          : t('profile.reportSent'),
    })
    setProfileReportSubmitting(false)
  }

  const handleRemoveProfileReport = async () => {
    if (!user || !currentProfileReport) return

    const requestId = reportMutationRequestIdRef.current + 1
    reportMutationRequestIdRef.current = requestId
    setProfileReportRemoving(true)
    setProfileReportFeedback(null)

    const result = await deleteProfileReport({
      reporterId: user.id,
      reportId: currentProfileReport.id,
    })

    if (reportMutationRequestIdRef.current !== requestId) return

    if (result.error) {
      setProfileReportFeedback({
        tone: 'error',
        message: getProfileReportErrorMessage(result.error, 'delete'),
      })
      setProfileReportRemoving(false)
      return
    }

    setCurrentProfileReport(null)
    setProfileReportFeedback({
      tone: 'success',
      message: t('profile.reportRemoved'),
    })
    setProfileReportRemoving(false)
  }

  return {
    canReportProfile,
    currentProfileReport,
    handleCloseProfileReportModal,
    handleOpenProfileReportModal,
    handleRemoveProfileReport,
    handleSubmitProfileReport,
    isProfileReportModalOpen,
    profileReportFeedback,
    profileReportLoading,
    profileReportRemoving,
    profileReportSubmitting,
  }
}
