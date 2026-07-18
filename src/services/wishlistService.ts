export {
  type WishlistEntry,
  type WishlistError,
  type WishlistGame,
  type WishlistGameItem,
  type WishlistPageOptions,
  type WishlistQueryTimings,
} from '../features/profile/domain/wishlist'
export {
  getWishlistEntry,
  getWishlistGamesByUserId,
  getWishlistGamesPageByUserId,
} from '../features/profile/data/wishlistRepository'
export {
  addGameToWishlist,
  deleteWishlistEntry,
  updateWishlistPriorities,
} from '../features/profile/data/wishlistMutations'
