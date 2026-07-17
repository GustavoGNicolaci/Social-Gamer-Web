import type { TranslationParams } from '../../../i18n'
import type {
  CommunityCategoryValue,
  CommunityMember,
  CommunityPost,
  CommunityPostingPermission,
  CommunityVisibility,
} from '../../../services/communityService'

export type FeedbackTone = 'success' | 'error' | 'info'

export interface FeedbackState {
  tone: FeedbackTone
  message: string
}

export interface SettingsDraft {
  nome: string
  descricao: string
  tipo: string
  categoria: CommunityCategoryValue | ''
  regras: string
  visibilidade: CommunityVisibility
}

export type ConfirmState =
  | { kind: 'delete-community' }
  | { kind: 'leave-community' }
  | { kind: 'delete-post'; post: CommunityPost }
  | { kind: 'delete-comment'; post: CommunityPost; commentId: string }
  | { kind: 'kick-member'; member: CommunityMember }
  | { kind: 'transfer-leadership'; member: CommunityMember }
  | { kind: 'posting-permission'; permission: CommunityPostingPermission }
  | { kind: 'promote-member'; member: CommunityMember }
  | { kind: 'demote-admin'; member: CommunityMember }

export type Translate = (key: string, params?: TranslationParams) => string
