import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import {
  type CommunityPost,
  type CommunityReactionType,
  type CommunityRole,
} from '../../services/communityService'
import { resolvePublicFileUrl } from '../../services/storageService'
import { getOptionalPublicProfilePath } from '../../utils/profileRoutes'

interface CommunityPostCardProps {
  post: CommunityPost
  currentUserId?: string | null
  currentUserRole?: CommunityRole | null
  onToggleReaction: (post: CommunityPost, reaction: CommunityReactionType) => Promise<void>
  onToggleSave: (post: CommunityPost) => Promise<void>
  onCreateComment: (post: CommunityPost, text: string) => Promise<void>
  onDeletePost: (post: CommunityPost) => void
  onDeleteComment: (post: CommunityPost, commentId: string) => void
}

const INITIAL_VISIBLE_COMMENTS = 3
const COMMENT_BATCH_SIZE = 3

function formatDate(value: string) {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return 'Data nao informada'

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getAuthorName(author: { username?: string | null; nome_completo?: string | null } | null) {
  return author?.username || author?.nome_completo || 'usuario'
}

export function CommunityPostCard({
  post,
  currentUserId,
  currentUserRole,
  onToggleReaction,
  onToggleSave,
  onCreateComment,
  onDeletePost,
  onDeleteComment,
}: CommunityPostCardProps) {
  const [visibleCommentCount, setVisibleCommentCount] = useState(INITIAL_VISIBLE_COMMENTS)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const authorName = getAuthorName(post.autor)
  const authorProfilePath = getOptionalPublicProfilePath(post.autor?.username)
  const postImageUrl = resolvePublicFileUrl(post.imagem_path)
  const visibleComments = useMemo(
    () => post.comentarios.slice(0, visibleCommentCount),
    [post.comentarios, visibleCommentCount]
  )
  const hiddenCommentsCount = post.comentarios.length - visibleComments.length
  const isModerator = currentUserRole === 'lider' || currentUserRole === 'admin'

  const handleReaction = async (reaction: CommunityReactionType) => {
    setPendingAction(reaction)
    try {
      await onToggleReaction(post, reaction)
    } finally {
      setPendingAction(null)
    }
  }

  const handleSave = async () => {
    setPendingAction('save')
    try {
      await onToggleSave(post)
    } finally {
      setPendingAction(null)
    }
  }

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedText = commentText.trim()
    if (!normalizedText) return

    setIsSubmittingComment(true)
    try {
      await onCreateComment(post, normalizedText)
      setCommentText('')
      setVisibleCommentCount(currentCount => Math.max(currentCount, INITIAL_VISIBLE_COMMENTS))
    } finally {
      setIsSubmittingComment(false)
    }
  }

  return (
    <article className="community-post-card">
      <header className="community-post-header">
        {authorProfilePath ? (
          <Link to={authorProfilePath} className="community-post-author">
            <UserAvatar
              name={authorName}
              avatarPath={post.autor?.avatar_path}
              imageClassName="community-post-avatar"
              fallbackClassName="community-post-avatar-fallback"
            />
            <span>
              <strong>@{authorName}</strong>
              <small>{formatDate(post.created_at)}</small>
            </span>
          </Link>
        ) : (
          <div className="community-post-author">
            <UserAvatar
              name={authorName}
              avatarPath={post.autor?.avatar_path}
              imageClassName="community-post-avatar"
              fallbackClassName="community-post-avatar-fallback"
            />
            <span>
              <strong>@{authorName}</strong>
              <small>{formatDate(post.created_at)}</small>
            </span>
          </div>
        )}

        {post.canDelete ? (
          <button type="button" className="community-danger-link" onClick={() => onDeletePost(post)}>
            Deletar post
          </button>
        ) : null}
      </header>

      {post.texto ? <p className="community-post-text">{post.texto}</p> : null}

      {postImageUrl ? (
        <img className="community-post-image" src={postImageUrl} alt="Imagem do post" />
      ) : null}

      <div className="community-post-actions" aria-label="Acoes do post">
        <button
          type="button"
          className={`community-action-button${post.currentUserReaction === 'curtida' ? ' is-active' : ''}`}
          onClick={() => void handleReaction('curtida')}
          disabled={!post.canInteract || pendingAction !== null}
        >
          Curtir {post.curtidas_count}
        </button>

        <button
          type="button"
          className={`community-action-button${post.currentUserReaction === 'dislike' ? ' is-active is-dislike' : ''}`}
          onClick={() => void handleReaction('dislike')}
          disabled={!post.canInteract || pendingAction !== null}
        >
          Nao gostei {post.dislikes_count}
        </button>

        <button
          type="button"
          className={`community-action-button${post.savedByCurrentUser ? ' is-saved' : ''}`}
          onClick={() => void handleSave()}
          disabled={!post.canInteract || pendingAction !== null}
        >
          {post.savedByCurrentUser ? 'Salvo' : 'Salvar'}
        </button>

        <span className="community-post-count">{post.comentarios_count} comentarios</span>
      </div>

      <section className="community-comments" aria-label="Comentarios">
        {visibleComments.length > 0 ? (
          <div className="community-comment-list">
            {visibleComments.map(comment => {
              const commentAuthorName = getAuthorName(comment.autor)
              const commentAuthorPath = getOptionalPublicProfilePath(comment.autor?.username)
              const canDeleteComment =
                Boolean(currentUserId && comment.autor_id === currentUserId) || isModerator

              return (
                <div key={comment.id} className="community-comment-card">
                  <div className="community-comment-header">
                    {commentAuthorPath ? (
                      <Link to={commentAuthorPath} className="community-comment-author">
                        <UserAvatar
                          name={commentAuthorName}
                          avatarPath={comment.autor?.avatar_path}
                          imageClassName="community-comment-avatar"
                          fallbackClassName="community-comment-avatar-fallback"
                        />
                        <strong>@{commentAuthorName}</strong>
                      </Link>
                    ) : (
                      <div className="community-comment-author">
                        <UserAvatar
                          name={commentAuthorName}
                          avatarPath={comment.autor?.avatar_path}
                          imageClassName="community-comment-avatar"
                          fallbackClassName="community-comment-avatar-fallback"
                        />
                        <strong>@{commentAuthorName}</strong>
                      </div>
                    )}

                    <div className="community-comment-meta">
                      <span>{formatDate(comment.created_at)}</span>
                      {canDeleteComment ? (
                        <button
                          type="button"
                          className="community-danger-link is-compact"
                          onClick={() => onDeleteComment(post, comment.id)}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <p>{comment.texto}</p>
                </div>
              )
            })}
          </div>
        ) : null}

        {hiddenCommentsCount > 0 ? (
          <button
            type="button"
            className="community-expand-button"
            onClick={() =>
              setVisibleCommentCount(currentCount =>
                Math.min(currentCount + COMMENT_BATCH_SIZE, post.comentarios.length)
              )
            }
          >
            Ver mais comentarios
          </button>
        ) : null}

        {post.canInteract ? (
          <form className="community-comment-form" onSubmit={handleSubmitComment}>
            <textarea
              value={commentText}
              onChange={event => setCommentText(event.target.value)}
              placeholder="Escreva um comentario..."
              maxLength={1200}
              disabled={isSubmittingComment}
            />
            <button type="submit" disabled={isSubmittingComment || !commentText.trim()}>
              {isSubmittingComment ? 'Enviando...' : 'Comentar'}
            </button>
          </form>
        ) : null}
      </section>
    </article>
  )
}
