import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CommunityConfirmModal } from '../components/communities/CommunityConfirmModal'
import { CommunityPostCard } from '../components/communities/CommunityPostCard'
import { UserAvatar } from '../components/UserAvatar'
import { useAuth } from '../contexts/AuthContext'
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunity,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityById,
  getCommunityMembers,
  getCommunityPosts,
  joinCommunity,
  leaveCommunity,
  removeCommunityMember,
  toggleCommunityPostReaction,
  toggleCommunityPostSave,
  transferCommunityLeadership,
  updateCommunity,
  updateCommunityMemberRole,
  updateCommunityPostingPermission,
  type CommunityMember,
  type CommunityPost,
  type CommunityPostingPermission,
  type CommunityReactionType,
  type CommunitySummary,
} from '../services/communityService'
import { resolvePublicFileUrl, uploadCommunityPostImage } from '../services/storageService'
import { getOptionalPublicProfilePath } from '../utils/profileRoutes'
import './CommunitiesPage.css'

type FeedbackTone = 'success' | 'error' | 'info'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface SettingsDraft {
  nome: string
  descricao: string
  tipo: string
  categoria: string
  regras: string
}

type ConfirmState =
  | { kind: 'delete-community' }
  | { kind: 'leave-community' }
  | { kind: 'delete-post'; post: CommunityPost }
  | { kind: 'delete-comment'; post: CommunityPost; commentId: string }
  | { kind: 'kick-member'; member: CommunityMember }
  | { kind: 'transfer-leadership'; member: CommunityMember }
  | { kind: 'posting-permission'; permission: CommunityPostingPermission }

const POSTING_PERMISSION_LABELS: Record<CommunityPostingPermission, string> = {
  todos_membros: 'Todos os membros',
  somente_admins: 'Lider e administradores',
  somente_lider: 'Somente lider',
}

const POSTING_PERMISSION_DESCRIPTIONS: Record<CommunityPostingPermission, string> = {
  todos_membros: 'Qualquer membro pode criar posts.',
  somente_admins: 'Apenas lider e administradores podem criar posts.',
  somente_lider: 'Apenas o lider pode criar posts.',
}

function createSettingsDraft(community: CommunitySummary | null): SettingsDraft {
  return {
    nome: community?.nome || '',
    descricao: community?.descricao || '',
    tipo: community?.tipo || '',
    categoria: community?.categoria || '',
    regras: community?.regras || '',
  }
}

function getRoleLabel(role: string | null | undefined) {
  if (role === 'lider') return 'Lider'
  if (role === 'admin') return 'Administrador'
  return 'Membro'
}

function getMemberName(member: CommunityMember) {
  return member.usuario?.username || member.usuario?.nome_completo || 'usuario'
}

function getCommunityBanner(community: CommunitySummary | null) {
  if (!community) return null
  return resolvePublicFileUrl(community.banner_path) || community.jogo?.capa_url || null
}

function getNoPostPermissionMessage(permission: CommunityPostingPermission) {
  if (permission === 'somente_admins') {
    return 'Apenas o lider e administradores podem criar posts nesta comunidade.'
  }

  if (permission === 'somente_lider') {
    return 'Apenas o lider pode criar posts nesta comunidade.'
  }

  return 'Entre na comunidade para criar posts.'
}

function getConfirmCopy(confirmState: ConfirmState | null) {
  if (!confirmState) return null

  if (confirmState.kind === 'delete-community') {
    return {
      title: 'Excluir comunidade',
      description: 'A comunidade sera ocultada com exclusao logica. Esta acao so pode ser feita pelo lider.',
      confirmLabel: 'Excluir comunidade',
      tone: 'danger' as const,
    }
  }

  if (confirmState.kind === 'leave-community') {
    return {
      title: 'Sair da comunidade',
      description: 'Ao sair, voce nao podera mais criar posts, comentar, reagir ou salvar posts aqui.',
      confirmLabel: 'Sair',
      tone: 'default' as const,
    }
  }

  if (confirmState.kind === 'delete-post') {
    return {
      title: 'Deletar post',
      description: 'O post sera ocultado da comunidade e as contagens serao atualizadas.',
      confirmLabel: 'Deletar post',
      tone: 'danger' as const,
    }
  }

  if (confirmState.kind === 'delete-comment') {
    return {
      title: 'Excluir comentario',
      description: 'O comentario sera removido da visualizacao do post.',
      confirmLabel: 'Excluir comentario',
      tone: 'danger' as const,
    }
  }

  if (confirmState.kind === 'kick-member') {
    return {
      title: 'Expulsar membro',
      description: `Remover @${getMemberName(confirmState.member)} da comunidade?`,
      confirmLabel: 'Expulsar',
      tone: 'danger' as const,
    }
  }

  if (confirmState.kind === 'transfer-leadership') {
    return {
      title: 'Transferir lideranca',
      description: `@${getMemberName(confirmState.member)} virara lider. Voce continuara como administrador.`,
      confirmLabel: 'Transferir',
      tone: 'danger' as const,
    }
  }

  return {
    title: 'Alterar quem pode postar',
    description: `Nova regra: ${POSTING_PERMISSION_LABELS[confirmState.permission]}.`,
    confirmLabel: 'Alterar regra',
    tone: 'default' as const,
  }
}

function CommunityDetailsPage() {
  const { id } = useParams()
  const communityId = id || ''
  const { user } = useAuth()
  const navigate = useNavigate()

  const [community, setCommunity] = useState<CommunitySummary | null>(null)
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [postText, setPostText] = useState('')
  const [postImageFile, setPostImageFile] = useState<File | null>(null)
  const [postSubmitting, setPostSubmitting] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => createSettingsDraft(null))
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [postingPermissionDraft, setPostingPermissionDraft] =
    useState<CommunityPostingPermission>('todos_membros')
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  const isLeader = community?.currentUserRole === 'lider'
  const isModerator = community?.currentUserRole === 'lider' || community?.currentUserRole === 'admin'
  const canPost = Boolean(user && community?.canPost)
  const bannerUrl = getCommunityBanner(community)
  const confirmCopy = getConfirmCopy(confirmState)

  const sidebarMembers = useMemo(() => {
    const roleOrder: Record<string, number> = { lider: 0, admin: 1, membro: 2 }
    return [...members].sort((left, right) => {
      const roleDelta = (roleOrder[left.cargo] ?? 3) - (roleOrder[right.cargo] ?? 3)
      if (roleDelta !== 0) return roleDelta
      return getMemberName(left).localeCompare(getMemberName(right), 'pt-BR')
    })
  }, [members])

  const loadCommunityData = useCallback(async () => {
    if (!communityId) return

    setLoading(true)
    const [communityResult, membersResult] = await Promise.all([
      getCommunityById(communityId, user?.id),
      getCommunityMembers(communityId),
    ])

    setCommunity(communityResult.data)
    setMembers(membersResult.data)
    setSettingsDraft(createSettingsDraft(communityResult.data))
    setPostingPermissionDraft(communityResult.data?.permissao_postagem || 'todos_membros')
    setFeedback(
      communityResult.error || membersResult.error
        ? {
            tone: 'error',
            message:
              communityResult.error?.message ||
              membersResult.error?.message ||
              'Nao foi possivel carregar a comunidade.',
          }
        : null
    )
    setLoading(false)
  }, [communityId, user?.id])

  const loadPosts = useCallback(async () => {
    if (!communityId) return

    setPostsLoading(true)
    const result = await getCommunityPosts(communityId, user?.id, community?.currentUserRole)
    setPosts(result.data)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
    }
    setPostsLoading(false)
  }, [community?.currentUserRole, communityId, user?.id])

  useEffect(() => {
    void loadCommunityData()
  }, [loadCommunityData])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const reloadAll = async () => {
    await loadCommunityData()
    await loadPosts()
  }

  const handleJoin = async () => {
    if (!communityId) return
    const result = await joinCommunity(communityId)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }
    setFeedback({ tone: 'success', message: 'Voce entrou na comunidade.' })
    await reloadAll()
  }

  const handlePostImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPostImageFile(event.target.files?.[0] || null)
  }

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !community || postSubmitting) return

    const normalizedText = postText.trim()
    if (!normalizedText && !postImageFile) {
      setFeedback({ tone: 'error', message: 'Escreva um texto ou selecione uma imagem.' })
      return
    }

    setPostSubmitting(true)
    setFeedback(null)

    try {
      let imagePath: string | null = null
      if (postImageFile) {
        const uploadResult = await uploadCommunityPostImage(postImageFile, user.id)
        if (!uploadResult) {
          setFeedback({ tone: 'error', message: 'Nao foi possivel enviar a imagem do post.' })
          return
        }
        imagePath = uploadResult.path
      }

      const result = await createCommunityPost(community.id, normalizedText, imagePath)
      if (result.error) {
        setFeedback({ tone: 'error', message: result.error.message })
        return
      }

      setPostText('')
      setPostImageFile(null)
      setFeedback({ tone: 'success', message: 'Post publicado.' })
      await reloadAll()
    } finally {
      setPostSubmitting(false)
    }
  }

  const handleToggleReaction = async (post: CommunityPost, reaction: CommunityReactionType) => {
    const result = await toggleCommunityPostReaction(post.id, reaction)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    if (result.data) {
      setPosts(currentPosts =>
        currentPosts.map(currentPost =>
          currentPost.id === post.id
            ? {
                ...currentPost,
                curtidas_count: result.data?.curtidas_count ?? currentPost.curtidas_count,
                dislikes_count: result.data?.dislikes_count ?? currentPost.dislikes_count,
                currentUserReaction: result.data?.reacao_atual ?? null,
              }
            : currentPost
        )
      )
    }
  }

  const handleToggleSave = async (post: CommunityPost) => {
    const result = await toggleCommunityPostSave(post.id)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    setPosts(currentPosts =>
      currentPosts.map(currentPost =>
        currentPost.id === post.id
          ? { ...currentPost, savedByCurrentUser: result.data }
          : currentPost
      )
    )
  }

  const handleCreateComment = async (post: CommunityPost, text: string) => {
    const result = await createCommunityComment(post.id, text)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    await loadPosts()
  }

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!community || !isLeader || settingsSaving) return

    setSettingsSaving(true)
    const result = await updateCommunity({
      comunidadeId: community.id,
      nome: settingsDraft.nome,
      descricao: settingsDraft.descricao,
      tipo: settingsDraft.tipo,
      categoria: settingsDraft.categoria,
      regras: settingsDraft.regras,
      bannerPath: community.banner_path,
      jogoId: community.jogo_id,
      permissaoPostagem: community.permissao_postagem,
    })

    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
    } else {
      setFeedback({ tone: 'success', message: 'Comunidade atualizada.' })
      await loadCommunityData()
    }

    setSettingsSaving(false)
  }

  const executeConfirmAction = async () => {
    if (!confirmState || !community) return

    setConfirmSubmitting(true)

    try {
      if (confirmState.kind === 'delete-community') {
        const result = await deleteCommunity(community.id)
        if (result.error) throw result.error
        navigate('/comunidades')
        return
      }

      if (confirmState.kind === 'leave-community') {
        const result = await leaveCommunity(community.id)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: 'Voce saiu da comunidade.' })
      }

      if (confirmState.kind === 'delete-post') {
        const result = await deleteCommunityPost(confirmState.post.id)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: 'Post deletado.' })
      }

      if (confirmState.kind === 'delete-comment') {
        const result = await deleteCommunityComment(confirmState.commentId)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: 'Comentario excluido.' })
      }

      if (confirmState.kind === 'kick-member') {
        const result = await removeCommunityMember(community.id, confirmState.member.usuario_id)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: 'Membro removido.' })
      }

      if (confirmState.kind === 'transfer-leadership') {
        const result = await transferCommunityLeadership(
          community.id,
          confirmState.member.usuario_id
        )
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: 'Lideranca transferida.' })
      }

      if (confirmState.kind === 'posting-permission') {
        const result = await updateCommunityPostingPermission(community.id, confirmState.permission)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: 'Regra de postagem atualizada.' })
      }

      setConfirmState(null)
      await reloadAll()
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : 'Nao foi possivel concluir a acao.'
      setFeedback({ tone: 'error', message })
    } finally {
      setConfirmSubmitting(false)
    }
  }

  const handlePromoteOrDemote = async (member: CommunityMember) => {
    if (!community) return
    const nextRole = member.cargo === 'admin' ? 'membro' : 'admin'
    const result = await updateCommunityMemberRole(community.id, member.usuario_id, nextRole)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    setFeedback({
      tone: 'success',
      message: nextRole === 'admin' ? 'Membro promovido a administrador.' : 'Administrador removido.',
    })
    await loadCommunityData()
  }

  const updateSettingsDraft = <K extends keyof SettingsDraft>(field: K, value: SettingsDraft[K]) => {
    setSettingsDraft(currentDraft => ({ ...currentDraft, [field]: value }))
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="communities-state-card">Carregando comunidade...</div>
        </div>
      </div>
    )
  }

  if (!community) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="communities-state-card">
            Comunidade nao encontrada ou removida.
            <div className="community-details-actions">
              <Link to="/comunidades" className="communities-primary-link">
                Voltar para comunidades
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="community-details-page">
          <section className="community-details-hero">
            <div className="community-details-copy">
              <span className="communities-kicker">Comunidade</span>
              <h1>{community.nome}</h1>
              <p>{community.descricao || 'Sem descricao informada.'}</p>

              <div className="community-details-actions">
                <span className="community-role-badge">
                  {community.currentUserRole ? getRoleLabel(community.currentUserRole) : 'Visitante'}
                </span>
                <span className="community-permission-badge">
                  {POSTING_PERMISSION_LABELS[community.permissao_postagem]}
                </span>
              </div>

              <div className="community-details-actions">
                {!user ? (
                  <Link to="/login" className="communities-primary-link">
                    Fazer login para participar
                  </Link>
                ) : community.currentUserRole ? (
                  community.currentUserRole !== 'lider' ? (
                    <button
                      type="button"
                      className="community-secondary-button"
                      onClick={() => setConfirmState({ kind: 'leave-community' })}
                    >
                      Sair da comunidade
                    </button>
                  ) : null
                ) : (
                  <button type="button" className="communities-primary-button" onClick={handleJoin}>
                    Entrar na comunidade
                  </button>
                )}

                {isLeader ? (
                  <button
                    type="button"
                    className="community-danger-button"
                    onClick={() => setConfirmState({ kind: 'delete-community' })}
                  >
                    Excluir comunidade
                  </button>
                ) : null}
              </div>
            </div>

            <div className="community-details-banner-shell">
              {bannerUrl ? (
                <img className="community-details-banner" src={bannerUrl} alt="" />
              ) : (
                <div className="community-details-banner-fallback">
                  {community.nome.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </section>

          {feedback ? (
            <p className={`communities-feedback is-${feedback.tone}`}>{feedback.message}</p>
          ) : null}

          <section className="community-details-grid">
            <main className="community-feed">
              <section className="community-section">
                <h2>Criar post</h2>
                {canPost ? (
                  <form className="community-post-form" onSubmit={handleCreatePost}>
                    <textarea
                      value={postText}
                      onChange={event => setPostText(event.target.value)}
                      placeholder="Compartilhe texto, imagem ou os dois."
                      maxLength={4000}
                      disabled={postSubmitting}
                    />
                    <label className="communities-field">
                      <span>Imagem opcional</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePostImageChange}
                        disabled={postSubmitting}
                      />
                    </label>
                    <button type="submit" disabled={postSubmitting}>
                      {postSubmitting ? 'Publicando...' : 'Publicar'}
                    </button>
                  </form>
                ) : (
                  <p>
                    {user
                      ? getNoPostPermissionMessage(community.permissao_postagem)
                      : 'Entre na comunidade para comentar, reagir, salvar e criar posts.'}
                  </p>
                )}
              </section>

              {postsLoading ? (
                <div className="communities-state-card">Carregando posts...</div>
              ) : posts.length === 0 ? (
                <div className="communities-state-card">
                  Ainda nao ha posts nesta comunidade.
                </div>
              ) : (
                posts.map(post => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    currentUserId={user?.id}
                    currentUserRole={community.currentUserRole}
                    onToggleReaction={handleToggleReaction}
                    onToggleSave={handleToggleSave}
                    onCreateComment={handleCreateComment}
                    onDeletePost={postToDelete =>
                      setConfirmState({ kind: 'delete-post', post: postToDelete })
                    }
                    onDeleteComment={(postWithComment, commentId) =>
                      setConfirmState({
                        kind: 'delete-comment',
                        post: postWithComment,
                        commentId,
                      })
                    }
                  />
                ))
              )}
            </main>

            <aside className="community-sidebar">
              <section className="community-section">
                <h2>Sobre</h2>
                <p>{community.regras || 'Esta comunidade ainda nao cadastrou regras.'}</p>
                <p>
                  {community.membros_count} membros / {community.posts_count} posts
                </p>
                {community.jogo ? <p>Jogo relacionado: {community.jogo.titulo}</p> : null}
                {community.tipo ? <p>Tema: {community.tipo}</p> : null}
                {community.categoria ? <p>Categoria: {community.categoria}</p> : null}
              </section>

              {isModerator ? (
                <section className="community-settings-card">
                  <h2>Quem pode postar</h2>
                  <p>{POSTING_PERMISSION_DESCRIPTIONS[community.permissao_postagem]}</p>
                  <label className="communities-field">
                    <span>Regra</span>
                    <select
                      value={postingPermissionDraft}
                      onChange={event =>
                        setPostingPermissionDraft(event.target.value as CommunityPostingPermission)
                      }
                    >
                      {Object.entries(POSTING_PERMISSION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="community-settings-button"
                    disabled={postingPermissionDraft === community.permissao_postagem}
                    onClick={() =>
                      setConfirmState({
                        kind: 'posting-permission',
                        permission: postingPermissionDraft,
                      })
                    }
                  >
                    Alterar regra
                  </button>
                </section>
              ) : null}

              {isLeader ? (
                <section className="community-settings-card">
                  <h2>Configuracoes</h2>
                  <form className="community-settings-form" onSubmit={handleSaveSettings}>
                    <label className="communities-field">
                      <span>Nome</span>
                      <input
                        value={settingsDraft.nome}
                        onChange={event => updateSettingsDraft('nome', event.target.value)}
                        maxLength={80}
                        required
                      />
                    </label>
                    <label className="communities-field">
                      <span>Descricao</span>
                      <textarea
                        value={settingsDraft.descricao}
                        onChange={event => updateSettingsDraft('descricao', event.target.value)}
                        maxLength={600}
                      />
                    </label>
                    <div className="communities-form-grid">
                      <label className="communities-field">
                        <span>Tema</span>
                        <input
                          value={settingsDraft.tipo}
                          onChange={event => updateSettingsDraft('tipo', event.target.value)}
                        />
                      </label>
                      <label className="communities-field">
                        <span>Categoria</span>
                        <input
                          value={settingsDraft.categoria}
                          onChange={event => updateSettingsDraft('categoria', event.target.value)}
                        />
                      </label>
                    </div>
                    <label className="communities-field">
                      <span>Regras</span>
                      <textarea
                        value={settingsDraft.regras}
                        onChange={event => updateSettingsDraft('regras', event.target.value)}
                        maxLength={3000}
                      />
                    </label>
                    <button type="submit" className="community-settings-button" disabled={settingsSaving}>
                      {settingsSaving ? 'Salvando...' : 'Salvar informacoes'}
                    </button>
                  </form>
                </section>
              ) : null}

              <section className="community-section">
                <h2>Membros</h2>
                <div className="community-member-list">
                  {sidebarMembers.map(member => {
                    const memberName = getMemberName(member)
                    const memberPath = getOptionalPublicProfilePath(member.usuario?.username)
                    const canKick = isModerator && member.cargo === 'membro'
                    const canManageAdmin = isLeader && member.cargo !== 'lider'
                    const canTransfer = isLeader && member.usuario_id !== user?.id

                    return (
                      <article key={member.usuario_id} className="community-member-card">
                        <div className="community-member-header">
                          {memberPath ? (
                            <Link to={memberPath} className="community-member-author">
                              <UserAvatar
                                name={memberName}
                                avatarPath={member.usuario?.avatar_path}
                                imageClassName="community-member-avatar"
                                fallbackClassName="community-member-avatar-fallback"
                              />
                              <span>
                                <strong>@{memberName}</strong>
                                <span>{getRoleLabel(member.cargo)}</span>
                              </span>
                            </Link>
                          ) : (
                            <div className="community-member-author">
                              <UserAvatar
                                name={memberName}
                                avatarPath={member.usuario?.avatar_path}
                                imageClassName="community-member-avatar"
                                fallbackClassName="community-member-avatar-fallback"
                              />
                              <span>
                                <strong>@{memberName}</strong>
                                <span>{getRoleLabel(member.cargo)}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {(canKick || canManageAdmin || canTransfer) ? (
                          <div className="community-member-actions">
                            {canManageAdmin ? (
                              <button
                                type="button"
                                className="community-secondary-button"
                                onClick={() => void handlePromoteOrDemote(member)}
                              >
                                {member.cargo === 'admin' ? 'Remover admin' : 'Promover admin'}
                              </button>
                            ) : null}

                            {canTransfer ? (
                              <button
                                type="button"
                                className="community-secondary-button"
                                onClick={() =>
                                  setConfirmState({ kind: 'transfer-leadership', member })
                                }
                              >
                                Transferir lideranca
                              </button>
                            ) : null}

                            {canKick ? (
                              <button
                                type="button"
                                className="community-danger-button"
                                onClick={() => setConfirmState({ kind: 'kick-member', member })}
                              >
                                Expulsar
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </section>
            </aside>
          </section>

          {confirmCopy && confirmState ? (
            <CommunityConfirmModal
              title={confirmCopy.title}
              description={confirmCopy.description}
              confirmLabel={confirmCopy.confirmLabel}
              tone={confirmCopy.tone}
              isSubmitting={confirmSubmitting}
              onClose={() => setConfirmState(null)}
              onConfirm={() => void executeConfirmAction()}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default CommunityDetailsPage
