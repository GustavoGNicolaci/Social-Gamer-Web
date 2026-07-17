import { describe, expect, expectTypeOf, it } from 'vitest'
import * as mappers from '../features/communities/data/mappers'
import * as membership from '../features/communities/data/membership'
import * as moderation from '../features/communities/data/moderation'
import * as posts from '../features/communities/data/posts'
import * as queries from '../features/communities/data/queries'
import * as types from '../features/communities/data/types'
import type {
  CommunityPost as InternalCommunityPost,
  CommunitySummary as InternalCommunitySummary,
  ServiceResult as InternalServiceResult,
} from '../features/communities/data/types'
import * as communityService from './communityService'
import type {
  CommunityPost,
  CommunitySummary,
  ServiceResult,
} from './communityService'

const expectedPublicExports = {
  COMMUNITY_CATEGORY_VALUES: types.COMMUNITY_CATEGORY_VALUES,
  COMMUNITY_CREATION_LIMIT: types.COMMUNITY_CREATION_LIMIT,
  COMMUNITY_CREATION_LIMIT_ERROR_CODE: types.COMMUNITY_CREATION_LIMIT_ERROR_CODE,
  COMMUNITY_REPORT_REASONS: types.COMMUNITY_REPORT_REASONS,
  isCommunityCreationLimitError: mappers.isCommunityCreationLimitError,
  mergeCommunityComments: mappers.mergeCommunityComments,
  createCommunity: queries.createCommunity,
  getCommunities: queries.getCommunities,
  getCommunitiesByUserId: queries.getCommunitiesByUserId,
  getCommunityById: queries.getCommunityById,
  getCommunityCreationQuota: queries.getCommunityCreationQuota,
  getCommunityTypeOptions: queries.getCommunityTypeOptions,
  updateCommunity: queries.updateCommunity,
  approveCommunityJoinRequest: membership.approveCommunityJoinRequest,
  cancelCommunityJoinRequest: membership.cancelCommunityJoinRequest,
  getCommunityJoinRequests: membership.getCommunityJoinRequests,
  getCommunityMembers: membership.getCommunityMembers,
  joinCommunity: membership.joinCommunity,
  leaveCommunity: membership.leaveCommunity,
  rejectCommunityJoinRequest: membership.rejectCommunityJoinRequest,
  removeCommunityMember: membership.removeCommunityMember,
  transferCommunityLeadership: membership.transferCommunityLeadership,
  updateCommunityMemberRole: membership.updateCommunityMemberRole,
  createCommunityComment: posts.createCommunityComment,
  createCommunityPost: posts.createCommunityPost,
  deleteCommunityComment: posts.deleteCommunityComment,
  deleteCommunityPost: posts.deleteCommunityPost,
  getCommunityCommentAnchor: posts.getCommunityCommentAnchor,
  getCommunityCommentTarget: posts.getCommunityCommentTarget,
  getCommunityPostById: posts.getCommunityPostById,
  getCommunityPostCommentsPage: posts.getCommunityPostCommentsPage,
  getCommunityPosts: posts.getCommunityPosts,
  getCommunityPostsByUserId: posts.getCommunityPostsByUserId,
  getSavedCommunityPostsByUserId: posts.getSavedCommunityPostsByUserId,
  toggleCommunityPostPinned: posts.toggleCommunityPostPinned,
  toggleCommunityPostReaction: posts.toggleCommunityPostReaction,
  toggleCommunityPostSave: posts.toggleCommunityPostSave,
  deleteCommunity: moderation.deleteCommunity,
  getCommunityReports: moderation.getCommunityReports,
  submitCommunityReport: moderation.submitCommunityReport,
  updateCommunityModeratedDetails: moderation.updateCommunityModeratedDetails,
  updateCommunityPostingPermission: moderation.updateCommunityPostingPermission,
  updateCommunityReportStatus: moderation.updateCommunityReportStatus,
}

describe('communityService compatibility facade', () => {
  it('keeps the exact runtime export surface and delegates without wrappers', () => {
    expect(Object.keys(communityService).sort()).toEqual(Object.keys(expectedPublicExports).sort())

    Object.entries(expectedPublicExports).forEach(([name, implementation]) => {
      expect(communityService[name as keyof typeof communityService]).toBe(implementation)
    })
  })

  it('keeps representative public types and function signatures unchanged', () => {
    expectTypeOf<CommunitySummary>().toEqualTypeOf<InternalCommunitySummary>()
    expectTypeOf<CommunityPost>().toEqualTypeOf<InternalCommunityPost>()
    expectTypeOf<ServiceResult<string>>().toEqualTypeOf<InternalServiceResult<string>>()
    expectTypeOf(communityService.getCommunityMembers)
      .toEqualTypeOf(membership.getCommunityMembers)
    expectTypeOf(communityService.getCommunityPosts)
      .toEqualTypeOf(posts.getCommunityPosts)
  })
})
