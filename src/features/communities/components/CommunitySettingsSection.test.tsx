import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { FormEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommunitySettingsController } from '../hooks/useCommunitySettingsController'
import {
  CommunitySettingsSection,
  type CommunitySettingsSectionProps,
} from './CommunitySettingsSection'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../../../services/communityService', () => ({
  COMMUNITY_CATEGORY_VALUES: ['acao', 'aventura', 'rpg'],
}))

function createSettingsController(
  overrides: {
    saving?: boolean
    file?: File | null
    previewUrl?: string | null
  } = {}
): CommunitySettingsController {
  return {
    form: {
      draft: {
        nome: 'Community name',
        descricao: 'Community description',
        tipo: 'General',
        categoria: 'aventura',
        regras: 'Community rules',
        visibilidade: 'publica',
      },
      saving: overrides.saving ?? false,
      update: vi.fn() as CommunitySettingsController['form']['update'],
      submit: vi.fn(async (event: FormEvent<HTMLFormElement>) => event.preventDefault()),
    },
    banner: {
      file: overrides.file ?? null,
      previewUrl: overrides.previewUrl ?? null,
      select: vi.fn(),
    },
  }
}

function createProps(
  overrides: Partial<CommunitySettingsSectionProps> = {}
): CommunitySettingsSectionProps {
  return {
    isLeader: true,
    currentPostingPermission: 'todos_membros',
    postingPermissionDraft: 'todos_membros',
    settings: createSettingsController(),
    onPostingPermissionDraftChange: vi.fn(),
    onConfirmPostingPermission: vi.fn(),
    onDeleteCommunity: vi.fn(),
    ...overrides,
  }
}

afterEach(cleanup)

describe('CommunitySettingsSection', () => {
  it('preserva o elemento raiz, a ordem e as classes dos tres cards do lider', () => {
    const { container } = render(<CommunitySettingsSection {...createProps()} />)
    const layout = container.firstElementChild

    expect(layout).toHaveClass('community-settings-layout')
    expect(layout?.tagName).toBe('DIV')
    expect(layout?.children).toHaveLength(3)
    expect(layout?.children[0]).toHaveClass('community-settings-card')
    expect(layout?.children[1]).toHaveClass(
      'community-settings-card',
      'community-posting-settings-card'
    )
    expect(layout?.children[2]).toHaveClass('community-settings-card', 'is-danger-zone')
    expect(layout?.children[0].querySelector(':scope > form')).toHaveClass(
      'community-settings-form'
    )
    expect(screen.getByRole('heading', { name: 'communities.tabs.settings' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'communities.settings.postingTitle' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'common.dangerZone' })).toBeInTheDocument()
  })

  it('preserva campos exclusivos do lider e campos moderaveis do admin', () => {
    const props = createProps({ isLeader: false })
    const { container } = render(<CommunitySettingsSection {...props} />)

    expect(screen.getByLabelText('communities.field.name')).toBeDisabled()
    expect(screen.getByLabelText('communities.field.theme')).toBeDisabled()
    expect(screen.getByLabelText('communities.field.category')).toBeDisabled()
    expect(screen.getByLabelText('communities.field.visibility')).toBeDisabled()
    expect(screen.getByLabelText('communities.field.description')).toBeEnabled()
    expect(screen.getByLabelText('communities.field.rules')).toBeEnabled()
    expect(container.querySelector('input[type="file"]')).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'common.dangerZone' })).not.toBeInTheDocument()

    expect(screen.getByLabelText('communities.field.name')).toHaveAttribute('maxlength', '80')
    expect(screen.getByLabelText('communities.field.name')).toBeRequired()
    expect(screen.getByLabelText('communities.field.description')).toHaveAttribute(
      'maxlength',
      '600'
    )
    expect(screen.getByLabelText('communities.field.rules')).toHaveAttribute(
      'maxlength',
      '3000'
    )
  })

  it('encaminha alteracoes, submit e selecao de banner aos grupos do controller', () => {
    const settings = createSettingsController()
    const props = createProps({ settings })
    const { container } = render(<CommunitySettingsSection {...props} />)

    fireEvent.change(screen.getByLabelText('communities.field.name'), {
      target: { value: 'Updated name' },
    })
    fireEvent.change(screen.getByLabelText('communities.field.description'), {
      target: { value: 'Updated description' },
    })
    fireEvent.change(screen.getByLabelText('communities.field.theme'), {
      target: { value: 'Updated theme' },
    })
    fireEvent.change(screen.getByLabelText('communities.field.category'), {
      target: { value: 'rpg' },
    })
    fireEvent.change(screen.getByLabelText('communities.field.rules'), {
      target: { value: 'Updated rules' },
    })
    fireEvent.change(screen.getByLabelText('communities.field.visibility'), {
      target: { value: 'privada' },
    })

    expect(settings.form.update).toHaveBeenCalledWith('nome', 'Updated name')
    expect(settings.form.update).toHaveBeenCalledWith('descricao', 'Updated description')
    expect(settings.form.update).toHaveBeenCalledWith('tipo', 'Updated theme')
    expect(settings.form.update).toHaveBeenCalledWith('categoria', 'rpg')
    expect(settings.form.update).toHaveBeenCalledWith('regras', 'Updated rules')
    expect(settings.form.update).toHaveBeenCalledWith('visibilidade', 'privada')

    const bannerFile = new File(['banner'], 'banner.png', { type: 'image/png' })
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [bannerFile] },
    })
    expect(settings.banner.select).toHaveBeenCalledWith(bannerFile)

    fireEvent.submit(container.querySelector('form.community-settings-form')!)
    expect(settings.form.submit).toHaveBeenCalledTimes(1)
  })

  it('preserva loading do formulario e do seletor de banner', () => {
    const bannerFile = new File(['banner'], 'banner.png', { type: 'image/png' })
    const settings = createSettingsController({ saving: true, file: bannerFile })
    const { container } = render(
      <CommunitySettingsSection {...createProps({ settings })} />
    )

    expect(screen.getByRole('button', { name: 'common.saving' })).toBeDisabled()
    expect(container.querySelector('input[type="file"]')).toBeDisabled()
    expect(screen.getByText('communities.upload.uploading')).toBeInTheDocument()
  })

  it('encaminha permissao selecionada, confirmacao e exclusao sem estado local', () => {
    const onPostingPermissionDraftChange = vi.fn()
    const onConfirmPostingPermission = vi.fn()
    const onDeleteCommunity = vi.fn()
    const props = createProps({
      currentPostingPermission: 'todos_membros',
      postingPermissionDraft: 'somente_admins',
      onPostingPermissionDraftChange,
      onConfirmPostingPermission,
      onDeleteCommunity,
    })
    const { container, rerender } = render(<CommunitySettingsSection {...props} />)

    const selectedRadio = screen.getByRole('radio', {
      name: /communities\.permission\.somente_admins/,
    })
    expect(selectedRadio).toBeChecked()
    expect(selectedRadio.closest('label')).toHaveClass('community-posting-option', 'is-selected')

    fireEvent.click(screen.getByRole('radio', {
      name: /communities\.permission\.somente_lider/,
    }))
    expect(onPostingPermissionDraftChange).toHaveBeenCalledWith('somente_lider')

    fireEvent.click(screen.getByRole('button', {
      name: 'communities.settings.changePosting',
    }))
    expect(onConfirmPostingPermission).toHaveBeenCalledWith('somente_admins')

    fireEvent.click(screen.getByRole('button', {
      name: 'communities.settings.deleteCommunity',
    }))
    expect(onDeleteCommunity).toHaveBeenCalledTimes(1)

    rerender(
      <CommunitySettingsSection
        {...props}
        currentPostingPermission="somente_admins"
      />
    )
    expect(screen.getByRole('button', {
      name: 'communities.settings.changePosting',
    })).toBeDisabled()
    expect(container.querySelectorAll('.community-posting-option')).toHaveLength(3)
  })
})
