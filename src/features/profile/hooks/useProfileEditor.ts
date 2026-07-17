import { useState, type ChangeEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import type {
  ProfileUpdateError,
  UserProfile,
  UserProfileUpdates,
} from '../../../contexts/AuthContext'
import { useI18n } from '../../../i18n/I18nContext'
import { uploadAvatarImage } from '../../../services/storageService'
import {
  mergeTopFiveEntriesIntoPrivacySettings,
  type TopFiveStoredEntry,
} from '../../../utils/profileTopFive'

type FeedbackTone = 'success' | 'error'

export interface ProfileDraft {
  nome_completo: string
  username: string
  bio: string
}

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

type UpdateOwnProfile = (
  updates: UserProfileUpdates
) => Promise<{ data: UserProfile | null; error: ProfileUpdateError | null }>

const createProfileDraft = (profile: UserProfile | null): ProfileDraft => ({
  nome_completo: profile?.nome_completo || '',
  username: profile?.username || '',
  bio: profile?.bio || '',
})

function getProfileUpdateErrorMessage(error: ProfileUpdateError | null) {
  if (!error) {
    return 'Could not save profile changes right now.'
  }

  const fullMessage = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (
    error.code === '23505' ||
    fullMessage.includes('duplicate') ||
    fullMessage.includes('key (username)') ||
    fullMessage.includes('unique')
  ) {
    return 'This username is already in use. Try another one.'
  }

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Could not update the profile due to permissions. Check the UPDATE and SELECT policies for the usuarios table in Supabase.'
  }

  if (fullMessage.includes('column')) {
    return 'Could not save the profile because the usuarios table structure does not match the frontend.'
  }

  if (
    fullMessage.includes('nenhum registro') ||
    fullMessage.includes('no rows') ||
    fullMessage.includes('json object requested')
  ) {
    return 'Could not confirm the profile update. Check the UPDATE and SELECT policies for the usuarios table in Supabase.'
  }

  return 'Could not save profile changes right now.'
}

interface UseProfileEditorParams {
  editableProfile: UserProfile | null
  user: User | null
  updateOwnProfile: UpdateOwnProfile
}

export function useProfileEditor({
  editableProfile,
  user,
  updateOwnProfile,
}: UseProfileEditorParams) {
  const { t } = useI18n()
  const [draftProfile, setDraftProfile] = useState<ProfileDraft>(() => createProfileDraft(null))
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<FeedbackState | null>(null)
  const [avatarFeedback, setAvatarFeedback] = useState<FeedbackState | null>(null)

  const resetDraft = () => {
    setDraftProfile(createProfileDraft(editableProfile))
  }

  const handleStartEditing = () => {
    if (!editableProfile) return

    resetDraft()
    setSaveFeedback(null)
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    resetDraft()
    setSaveFeedback(null)
    setIsEditing(false)
  }

  const handleDraftChange = (field: keyof ProfileDraft, value: string) => {
    setDraftProfile(currentDraft => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editableProfile || !user || user.id !== editableProfile.id) return

    setAvatarFeedback(null)
    setIsUploadingAvatar(true)

    try {
      const result = await uploadAvatarImage(file, user.id)

      if (!result) {
        setAvatarFeedback({
          tone: 'error',
          message: t('profile.avatarUploadError'),
        })
        return
      }

      const { error } = await updateOwnProfile({
        avatar_path: result.path,
        avatar_url: result.publicUrl,
      })

      if (error) {
        setAvatarFeedback({
          tone: 'error',
          message: getProfileUpdateErrorMessage(error),
        })
        return
      }

      setAvatarFeedback({
        tone: 'success',
        message: t('profile.avatarSuccess'),
      })
    } catch (error) {
      console.error('Erro inesperado ao atualizar avatar do perfil:', error)
      setAvatarFeedback({
        tone: 'error',
        message: t('profile.avatarUpdateError'),
      })
    } finally {
      setIsUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleSaveProfile = async () => {
    if (!editableProfile) return

    const trimmedName = draftProfile.nome_completo.trim()
    const trimmedUsername = draftProfile.username.trim()
    const trimmedBio = draftProfile.bio.trim()
    const currentName = editableProfile.nome_completo?.trim() || ''
    const currentUsername = editableProfile.username?.trim() || ''
    const currentBio = editableProfile.bio?.trim() || ''

    if (!trimmedUsername) {
      setSaveFeedback({
        tone: 'error',
        message: t('profile.usernameRequired'),
      })
      return
    }

    if (
      trimmedName === currentName &&
      trimmedUsername === currentUsername &&
      trimmedBio === currentBio
    ) {
      setSaveFeedback(null)
      setIsEditing(false)
      return
    }

    setSaveFeedback(null)
    setIsSaving(true)

    try {
      const { data, error } = await updateOwnProfile({
        nome_completo: trimmedName || null,
        username: trimmedUsername,
        bio: trimmedBio || null,
      })

      if (error || !data) {
        setSaveFeedback({
          tone: 'error',
          message: getProfileUpdateErrorMessage(error),
        })
        return
      }

      setDraftProfile(createProfileDraft(data))
      setSaveFeedback({
        tone: 'success',
        message: t('profile.saveSuccess'),
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Erro inesperado ao salvar perfil:', error)
      setSaveFeedback({
        tone: 'error',
        message: t('profile.error.saveGeneric'),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveTopFive = async (entries: TopFiveStoredEntry[]) => {
    if (!editableProfile) {
      return {
        ok: false,
        message: t('profile.error.identifyTopFiveUpdate'),
      }
    }

    const nextPrivacySettings = mergeTopFiveEntriesIntoPrivacySettings(
      editableProfile.configuracoes_privacidade,
      entries
    )

    const { data, error } = await updateOwnProfile({
      configuracoes_privacidade: nextPrivacySettings,
    })

    if (error || !data) {
      return {
        ok: false,
        message: getProfileUpdateErrorMessage(error),
      }
    }

    return { ok: true }
  }

  return {
    avatarFeedback,
    draftProfile,
    handleAvatarChange,
    handleCancelEditing,
    handleDraftChange,
    handleSaveProfile,
    handleSaveTopFive,
    handleStartEditing,
    isEditing,
    isSaving,
    isUploadingAvatar,
    saveFeedback,
  }
}
