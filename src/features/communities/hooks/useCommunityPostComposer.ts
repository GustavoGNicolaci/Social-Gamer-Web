import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  createCommunityPost,
} from '../../../services/communityService'
import { uploadCommunityPostImage } from '../../../services/storageService'
import type {
  FeedbackState,
  Translate,
} from '../domain/communityDetailsTypes'

interface UseCommunityPostComposerOptions {
  communityId: string | null
  currentUserId: string | null
  reloadAll: () => Promise<void>
  resetPostsPage: () => void
  publishFeedback: (feedback: FeedbackState | null) => void
  t: Translate
}

export function useCommunityPostComposer({
  communityId,
  currentUserId,
  reloadAll,
  resetPostsPage,
  publishFeedback,
  t,
}: UseCommunityPostComposerOptions) {
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const imagePreviewUrlRef = useRef<string | null>(null)

  const setImage = useCallback((file: File | null) => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current)
    }

    const nextPreviewUrl = file ? URL.createObjectURL(file) : null
    imagePreviewUrlRef.current = nextPreviewUrl
    setImageFile(file)
    setImagePreviewUrl(nextPreviewUrl)
  }, [])

  useEffect(() => () => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current)
    }
  }, [])

  const submit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUserId || !communityId || submitting) return

    const normalizedText = text.trim()
    if (!normalizedText && !imageFile) {
      publishFeedback({
        tone: 'error',
        message: t('communities.post.emptyError'),
      })
      return
    }

    setSubmitting(true)
    publishFeedback(null)

    try {
      let imagePath: string | null = null
      if (imageFile) {
        const uploadResult = await uploadCommunityPostImage(
          imageFile,
          currentUserId,
        )
        if (!uploadResult) {
          publishFeedback({
            tone: 'error',
            message: t('communities.post.imageUploadError'),
          })
          return
        }
        imagePath = uploadResult.path
      }

      const result = await createCommunityPost(
        communityId,
        normalizedText,
        imagePath,
      )
      if (result.error) {
        publishFeedback({
          tone: 'error',
          message: result.error.message,
        })
        return
      }

      setText('')
      setImage(null)
      resetPostsPage()
      publishFeedback({
        tone: 'success',
        message: t('communities.post.published'),
      })
      await reloadAll()
    } finally {
      setSubmitting(false)
    }
  }, [
    communityId,
    currentUserId,
    imageFile,
    publishFeedback,
    reloadAll,
    resetPostsPage,
    setImage,
    submitting,
    t,
    text,
  ])

  return {
    text,
    imageFile,
    imagePreviewUrl,
    submitting,
    setText,
    setImage,
    submit,
  }
}
