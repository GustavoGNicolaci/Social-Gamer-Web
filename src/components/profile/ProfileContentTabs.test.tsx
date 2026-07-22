import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProfileTab } from '../../features/profile/hooks/useProfileCollections'
import { ProfileContentTabs } from './ProfileContentTabs'

function TestTabs() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('status')

  return (
    <ProfileContentTabs
      activeTab={activeTab}
      isOwnerView
      contentLabel="Profile content"
      navigationLabel="Profile sections"
      statusLabel="Status"
      wishlistLabel="Wishlist"
      reviewsLabel="Reviews"
      communitiesLabel="Communities"
      communityPostsLabel="Posts"
      savedCommunityPostsLabel="Saved"
      statusPanel={<span>Status panel</span>}
      wishlistPanel={<span>Wishlist panel</span>}
      reviewsPanel={<span>Reviews panel</span>}
      communitiesPanel={<span>Communities panel</span>}
      communityPostsPanel={<span>Posts panel</span>}
      savedCommunityPostsPanel={<span>Saved panel</span>}
      onTabChange={setActiveTab}
    />
  )
}

describe('ProfileContentTabs keyboard navigation', () => {
  it('moves selection and focus with arrows, Home and End', () => {
    render(<TestTabs />)

    const statusTab = screen.getByRole('tab', { name: 'Status' })
    expect(statusTab).toHaveAttribute('aria-selected', 'true')
    expect(statusTab).toHaveAttribute('tabindex', '0')

    statusTab.focus()
    fireEvent.keyDown(statusTab, { key: 'ArrowRight' })

    const wishlistTab = screen.getByRole('tab', { name: 'Wishlist' })
    expect(wishlistTab).toHaveFocus()
    expect(wishlistTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Wishlist panel')).toBeVisible()

    fireEvent.keyDown(wishlistTab, { key: 'End' })
    const savedTab = screen.getByRole('tab', { name: 'Saved' })
    expect(savedTab).toHaveFocus()
    expect(savedTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(savedTab, { key: 'Home' })
    expect(statusTab).toHaveFocus()
    expect(statusTab).toHaveAttribute('aria-selected', 'true')
  })
})
