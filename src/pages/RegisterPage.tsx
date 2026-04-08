import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase-client'
import { testDatabaseOperations } from '../utils/databaseTest'

function RegisterPage() {
  const navigate = useNavigate()

  const testDatabaseConnection = async () => {
    try {
      console.log('Testando conexão com a tabela usuarios...')
      await testDatabaseOperations()
    } catch (err) {
      console.error('Erro no teste de conexão:', err)
    }
  }

  // Testar conexão ao montar o componente
  useEffect(() => {
    testDatabaseConnection()
  }, [])

  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

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

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      console.log('Iniciando registro com dados:', formData)

      // 1. criar conta no auth do Supabase e armazenar dados básicos em user_metadata
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
            nome_completo: formData.name,
          },
        },
      })

      if (signUpError) {
        console.error('Error signing up:', signUpError.message)
        setErrors((prev) => ({ ...prev, submit: signUpError.message }))
        return
      }

      const user = signUpData.user
      if (!user) {
        console.error('Usuário não foi criado')
        setErrors((prev) => ({ ...prev, submit: 'Falha ao criar usuário' }))
        return
      }

      console.log('Usuário criado no auth:', user.id)

      // 2. inserir perfil na tabela usuarios
      const profileData = {
        id: user.id,
        username: formData.username,
        nome_completo: formData.name,
        avatar_url: null,
        bio: '',
        data_cadastro: new Date().toISOString(),
        configuracoes_privacidade: {},
      }

      console.log('Tentando inserir perfil:', profileData)

      // Verificar se temos uma sessão ativa
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('Sessão atual:', sessionData.session ? 'Ativa' : 'Inativa')

      const { data: insertedData, error: insertError } = await supabase.from('usuarios').insert(profileData).select()

      if (insertError) {
        console.error('Error inserting profile:', insertError)
        console.error('Detalhes do erro:', insertError.details, insertError.hint, insertError.code)
        // handle duplicate username constraint
        if (insertError.details?.includes('Key (username)')) {
          setErrors((prev) => ({ ...prev, username: 'Nome de usuário já existe' }))
        } else {
          setErrors((prev) => ({ ...prev, submit: insertError.message }))
        }
        return
      }

      console.log('Perfil inserido com sucesso:', insertedData)

      if (signUpData.session) {
        console.log('Sessão ativa, redirecionando para home')
        navigate('/')
      } else {
        console.log('Sessão não ativa, aguardando confirmação por email')
        setSuccessMessage(
          `Quase lá! Um e-mail de confirmação foi enviado para ${formData.email}. ` +
          'Abra sua caixa de entrada e clique no link para ativar sua conta. ' +
          'Depois disso, retorne aqui e faça login.'
        )
        setErrors({})
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

          {successMessage ? (
            <div className="success-banner">
              <h2>Confirmação enviada!</h2>
              <p>{successMessage}</p>
              <div className="success-actions">
                <Link to="/login" className="register-link">
                  Ir para login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister}>
              {/* Username */}
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

              {errors.submit && <div className="error-banner">{errors.submit}</div>}

              <button type="submit" className="register-submit-btn">
                Criar Conta
              </button>
            </form>
          )}

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
