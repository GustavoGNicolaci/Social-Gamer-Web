import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase-client'
import reactLogo from '../assets/react.svg'

interface AvatarIcon {
  id: string
  image: string
  name: string
}

const DEFAULT_AVATARS: AvatarIcon[] = [
  { id: 'warrior', image: reactLogo, name: 'Guerreiro' },
  { id: 'wizard', image: reactLogo, name: 'Mago' },
  { id: 'archer', image: reactLogo, name: 'Arqueiro' },
  { id: 'rogue', image: reactLogo, name: 'Gatuno' },
  { id: 'paladin', image: reactLogo, name: 'Paladino' },
  { id: 'ranger', image: reactLogo, name: 'Caçador' },
  { id: 'cleric', image: reactLogo, name: 'Clérigo' },
  { id: 'bard', image: reactLogo, name: 'Bardo' },
]

function RegisterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // if already logged in, send to home
  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const [formData, setFormData] = useState({
    username: '',
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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
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
      setUseCustomPhoto(true)
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

    if (!formData.username.trim()) {
      newErrors.username = 'Nome de usuário é obrigatório'
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Nome completo é obrigatório'
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

  const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    const filePath = `${userId}/avatars/${Date.now()}-${file.name}`
    const { error } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, file)

    if (error) {
      console.error('Error uploading avatar:', error.message)
      return null
    }

    const { data } = await supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      // 1. criar conta no auth do Supabase
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (signUpError) {
        console.error('Error signing up:', signUpError.message)
        setErrors((prev) => ({ ...prev, submit: signUpError.message }))
        return
      }

      const user = signUpData.user
      if (!user) {
        setErrors((prev) => ({ ...prev, submit: 'Falha ao criar usuário' }))
        return
      }

      // 2. se houver foto customizada, enviar para storage
      // determine final avatar URL - if user chose a default icon, use its image
      let avatarUrl: string | null = null
      if (useCustomPhoto && photoFile) {
        const uploadedUrl = await uploadAvatar(photoFile, user.id)
        if (uploadedUrl) avatarUrl = uploadedUrl
      } else {
        // find the image associated with the selected default avatar id
        const found = DEFAULT_AVATARS.find((a) => a.id === selectedAvatar)
        avatarUrl = found ? found.image : null
      }

      // 3. inserir perfil na tabela usuarios
      const { error: insertError } = await supabase.from('usuarios').insert({
        id: user.id,
        username: formData.username,
        nome_completo: formData.name,
        avatar_url: avatarUrl,
        bio: '',
        data_cadastro: new Date().toISOString(),
        configuracoes_privacidade: {},
      })

      if (insertError) {
        console.error('Error inserting profile:', insertError.message)
        // handle duplicate username constraint
        if (insertError.details?.includes('Key (username)')) {
          setErrors((prev) => ({ ...prev, username: 'Nome de usuário já existe' }))
        } else {
          setErrors((prev) => ({ ...prev, submit: insertError.message }))
        }
        return
      }

      // redireciona após registro bem-sucedido
      // se a sessão já estiver ativa (usuário logado automaticamente), vai para home
      if (signUpData.session) {
        navigate('/')
      } else {
        navigate('/login')
      }
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
          <h1>Criar Conta</h1>
          <p>Junte-se à comunidade!</p>

          <form onSubmit={handleRegister}>
            {/* Username */}
            <div className="form-columns">
              <div className="left-column">
            <div className="form-group">
              <label htmlFor="username">Nome de usuário</label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="Seu username (único)"
                value={formData.username}
                onChange={handleInputChange}
                className={errors.username ? 'input-error' : ''}
              />
              {errors.username && <span className="error-message">{errors.username}</span>}
            </div>

            {/* Nome */}
            <div className="form-group">
              <label htmlFor="name">Nome Completo</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Seu Nome Completo"
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
            </div> {/* end left-column */}
            <div className="right-column">

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
                    <img src={avatar.image} alt={avatar.name} className="avatar-image" />
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
            </div> {/* end right-column */}
            </div> {/* end form-columns */}

            {errors.submit && <div className="error-banner">{errors.submit}</div>}

            <button type="submit" className="register-submit-btn">
              Criar Conta
            </button>
          </form>

          <div className="register-footer">
            <p>
              Já tem conta?{' '}
              <Link to="/login" className="register-link">
                Faça login aqui
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
