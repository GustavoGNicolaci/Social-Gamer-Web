import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

interface AvatarIcon {
  id: string
  emoji: string
  name: string
}

const DEFAULT_AVATARS: AvatarIcon[] = [
  { id: 'warrior', emoji: '🗡️', name: 'Guerreiro' },
  { id: 'wizard', emoji: '🧙', name: 'Mago' },
  { id: 'archer', emoji: '🏹', name: 'Arqueiro' },
  { id: 'rogue', emoji: '🐱', name: 'Gatuno' },
  { id: 'paladin', emoji: '⚔️', name: 'Paladino' },
  { id: 'ranger', emoji: '🦌', name: 'Caçador' },
  { id: 'cleric', emoji: '✨', name: 'Clérigo' },
  { id: 'bard', emoji: '🎸', name: 'Bardo' },
]

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [selectedAvatar, setSelectedAvatar] = useState<string>('warrior')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [useCustomPhoto, setUseCustomPhoto] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const navigate = useNavigate()

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          photo: 'Arquivo deve ser menor que 5MB',
        }))
        return
      }

      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setErrors((prev) => ({
        ...prev,
        photo: '',
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }
    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres'
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirme sua senha'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      // TODO: Integrar com Supabase
      const registrationData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        avatar: useCustomPhoto ? 'custom' : selectedAvatar,
        photo: photoFile || null,
      }

      console.log('Registrando usuário:', {
        name: registrationData.name,
        email: registrationData.email,
        avatar: registrationData.avatar,
        hasPhoto: !!registrationData.photo,
      })

      // Simular sucesso por enquanto
      // await registerWithSupabase(registrationData)

      // Redirecionar para login após registro bem-sucedido
      navigate('/login')
    } catch (error) {
      console.error('Erro ao registrar:', error)
      setErrors((prev) => ({
        ...prev,
        submit: 'Erro ao registrar. Tente novamente.',
      }))
    }
  }

  return (
    <div className="page-container">
      <div className="register-container">
        <div className="register-box">
          <h1>Criar Conta 🎮</h1>
          <p>Junte-se à comunidade e comece a jogar!</p>

          <form onSubmit={handleRegister}>
            {/* Nome */}
            <div className="form-group">
              <label htmlFor="name">Nome</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Seu nome ou nickname"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? 'input-error' : ''}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? 'input-error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            {/* Senha */}
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Sua senha"
                value={formData.password}
                onChange={handleInputChange}
                className={errors.password ? 'input-error' : ''}
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>

            {/* Confirmar Senha */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Senha</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirme sua senha"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={errors.confirmPassword ? 'input-error' : ''}
              />
              {errors.confirmPassword && (
                <span className="error-message">{errors.confirmPassword}</span>
              )}
            </div>

            {/* Avatar Selection */}
            <div className="form-group">
              <label>Escolha seu Avatar</label>
              <div className="avatar-selection">
                {DEFAULT_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    className={`avatar-btn ${selectedAvatar === avatar.id && !useCustomPhoto ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedAvatar(avatar.id)
                      setUseCustomPhoto(false)
                    }}
                    title={avatar.name}
                  >
                    <span className="avatar-emoji">{avatar.emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Upload */}
            <div className="form-group">
              <label htmlFor="photo">Ou envie uma foto</label>
              <div className="photo-upload-container">
                <input
                  type="file"
                  id="photo"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="photo-input"
                />
                <label htmlFor="photo" className="photo-upload-label">
                  <span className="upload-icon">📸</span>
                  <span>Clique para enviar uma foto</span>
                </label>
              </div>
              {errors.photo && <span className="error-message">{errors.photo}</span>}
            </div>

            {/* Photo Preview */}
            {photoPreview && (
              <div className="photo-preview-container">
                <img src={photoPreview} alt="Preview" className="photo-preview" />
                <button
                  type="button"
                  className="remove-photo-btn"
                  onClick={() => {
                    setPhotoFile(null)
                    setPhotoPreview(null)
                    setUseCustomPhoto(false)
                  }}
                >
                  ✕ Remover
                </button>
              </div>
            )}

            {errors.submit && <div className="error-banner">{errors.submit}</div>}

            <button type="submit" className="register-submit-btn">
              Criar Conta
            </button>
          </form>

          <div className="register-footer">
            <p>
              Já tem conta?{' '}
              <a href="/login" className="register-link">
                Faça login aqui
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
