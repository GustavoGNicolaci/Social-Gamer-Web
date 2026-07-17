import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  COMMUNITY_CATEGORY_VALUES,
  updateCommunity,
  updateCommunityModeratedDetails,
  type CommunityCategoryValue,
  type CommunitySummary,
} from '../../../services/communityService'
import {
  deleteFile,
  uploadCommunityBannerImage,
} from '../../../services/storageService'
import type {
  FeedbackState,
  SettingsDraft,
  Translate,
} from '../domain/communityDetailsTypes'

export interface UseCommunitySettingsControllerOptions {
  community: CommunitySummary | null
  currentUserId: string | null
  isLeader: boolean
  isModerator: boolean
  reloadCommunity: () => Promise<void>
  publishFeedback: (feedback: FeedbackState | null) => void
  t: Translate
}

export interface CommunitySettingsController {
  form: {
    draft: SettingsDraft
    saving: boolean
    update: <K extends keyof SettingsDraft>(field: K, value: SettingsDraft[K]) => void
    submit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  }
  banner: {
    file: File | null
    previewUrl: string | null
    select: (file: File | null) => void
  }
}

function createSettingsDraft(community: CommunitySummary | null): SettingsDraft {
  return {
    nome: community?.nome || '',
    descricao: community?.descricao || '',
    tipo: community?.tipo || '',
    categoria: COMMUNITY_CATEGORY_VALUES.includes(
      community?.categoria as CommunityCategoryValue
    )
      ? community?.categoria as CommunityCategoryValue
      : '',
    regras: community?.regras || '',
    visibilidade: community?.visibilidade || 'publica',
  }
}

async function deleteFileBestEffort(filePath: string) {
  try {
    return await deleteFile(filePath)
  } catch {
    return false
  }
}

function getUnexpectedErrorMessage(error: unknown, t: Translate) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  return t('communities.actionError')
}

export function useCommunitySettingsController({
  community,
  currentUserId,
  isLeader,
  isModerator,
  reloadCommunity,
  publishFeedback,
  t,
}: UseCommunitySettingsControllerOptions): CommunitySettingsController {
  const [draft, setDraft] = useState<SettingsDraft>(() => createSettingsDraft(community))
  const [saving, setSaving] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null)
  const scopeKey = [
    community?.id || 'none',
    currentUserId || 'anonymous',
    isLeader ? 'leader' : isModerator ? 'moderator' : 'blocked',
  ].join(':')
  const scopeKeyRef = useRef(scopeKey)
  const previousScopeKeyRef = useRef(scopeKey)
  const previousCommunityRef = useRef(community)
  const mountedRef = useRef(false)
  const requestVersionRef = useRef(0)
  const savingRef = useRef(false)
  const bannerPreviewUrlRef = useRef<string | null>(null)

  const revokeBannerPreview = useCallback(() => {
    if (!bannerPreviewUrlRef.current) return
    URL.revokeObjectURL(bannerPreviewUrlRef.current)
    bannerPreviewUrlRef.current = null
  }, [])

  const selectBannerFile = useCallback((file: File | null) => {
    revokeBannerPreview()

    const nextPreviewUrl = file ? URL.createObjectURL(file) : null
    bannerPreviewUrlRef.current = nextPreviewUrl
    setBannerFile(file)
    setBannerPreviewUrl(nextPreviewUrl)
  }, [revokeBannerPreview])

  useLayoutEffect(() => {
    scopeKeyRef.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestVersionRef.current += 1
      savingRef.current = false
      revokeBannerPreview()
    }
  }, [revokeBannerPreview])

  useEffect(() => {
    if (previousScopeKeyRef.current === scopeKey) return

    previousScopeKeyRef.current = scopeKey
    requestVersionRef.current += 1
    savingRef.current = false
    revokeBannerPreview()

    const timeoutId = window.setTimeout(() => {
      setBannerFile(null)
      setBannerPreviewUrl(null)
      setSaving(false)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [revokeBannerPreview, scopeKey])

  useEffect(() => {
    if (previousCommunityRef.current === community) return

    previousCommunityRef.current = community
    const timeoutId = window.setTimeout(() => {
      setDraft(createSettingsDraft(community))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [community])

  const isRequestActive = useCallback((expectedScopeKey: string, requestVersion: number) => (
    mountedRef.current &&
    scopeKeyRef.current === expectedScopeKey &&
    requestVersionRef.current === requestVersion
  ), [])

  const updateDraft = useCallback(<K extends keyof SettingsDraft>(
    field: K,
    value: SettingsDraft[K]
  ) => {
    setDraft(currentDraft => ({ ...currentDraft, [field]: value }))
  }, [])

  const submitSettings = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!community || !currentUserId || !isModerator || savingRef.current) return

    const expectedScopeKey = scopeKey
    const requestVersion = ++requestVersionRef.current
    const communitySnapshot = community
    const draftSnapshot = draft
    const bannerFileSnapshot = bannerFile
    let uploadedBannerPath: string | null = null
    let persisted = false

    savingRef.current = true
    setSaving(true)
    publishFeedback(null)

    try {
      let bannerPath = communitySnapshot.banner_path

      if (bannerFileSnapshot) {
        const uploadResult = await uploadCommunityBannerImage(
          bannerFileSnapshot,
          currentUserId
        )

        if (!isRequestActive(expectedScopeKey, requestVersion)) {
          if (uploadResult?.path) await deleteFileBestEffort(uploadResult.path)
          return
        }

        if (!uploadResult) {
          publishFeedback({
            tone: 'error',
            message: t('communities.settings.bannerUploadError'),
          })
          return
        }

        uploadedBannerPath = uploadResult.path
        bannerPath = uploadResult.path
      }

      const result = isLeader
        ? await updateCommunity({
            comunidadeId: communitySnapshot.id,
            nome: draftSnapshot.nome,
            descricao: draftSnapshot.descricao,
            tipo: draftSnapshot.tipo,
            categoria: draftSnapshot.categoria || null,
            regras: draftSnapshot.regras,
            bannerPath,
            jogoId: communitySnapshot.jogo_id,
            permissaoPostagem: communitySnapshot.permissao_postagem,
            visibilidade: draftSnapshot.visibilidade,
          })
        : await updateCommunityModeratedDetails({
            comunidadeId: communitySnapshot.id,
            currentUserId,
            descricao: draftSnapshot.descricao,
            regras: draftSnapshot.regras,
            bannerPath,
          })

      if (result.error) {
        if (uploadedBannerPath) await deleteFileBestEffort(uploadedBannerPath)
        if (isRequestActive(expectedScopeKey, requestVersion)) {
          publishFeedback({ tone: 'error', message: result.error.message })
        }
        return
      }

      persisted = true
      const previousBannerPath = communitySnapshot.banner_path
      const shouldDeletePreviousBanner = Boolean(
        uploadedBannerPath &&
        previousBannerPath &&
        uploadedBannerPath !== previousBannerPath
      )
      const cleanupPreviousBanner = shouldDeletePreviousBanner
        ? deleteFileBestEffort(previousBannerPath!)
        : Promise.resolve(true)

      if (!isRequestActive(expectedScopeKey, requestVersion)) {
        await cleanupPreviousBanner
        return
      }

      selectBannerFile(null)
      publishFeedback({
        tone: 'success',
        message: t('communities.settings.saved'),
      })

      await Promise.allSettled([
        cleanupPreviousBanner,
        reloadCommunity(),
      ])
    } catch (error) {
      if (uploadedBannerPath && !persisted) {
        await deleteFileBestEffort(uploadedBannerPath)
      }

      if (isRequestActive(expectedScopeKey, requestVersion)) {
        publishFeedback({
          tone: 'error',
          message: getUnexpectedErrorMessage(error, t),
        })
      }
    } finally {
      if (isRequestActive(expectedScopeKey, requestVersion)) {
        savingRef.current = false
        setSaving(false)
      }
    }
  }, [
    bannerFile,
    community,
    currentUserId,
    draft,
    isLeader,
    isModerator,
    isRequestActive,
    publishFeedback,
    reloadCommunity,
    scopeKey,
    selectBannerFile,
    t,
  ])

  return {
    form: {
      draft,
      saving,
      update: updateDraft,
      submit: submitSettings,
    },
    banner: {
      file: bannerFile,
      previewUrl: bannerPreviewUrl,
      select: selectBannerFile,
    },
  }
}
