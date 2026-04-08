import { supabase } from '../supabase-client'

export const testDatabaseOperations = async () => {
  console.log('=== TESTE DE BANCO DE DADOS ===')

  try {
    // Verificar se há sessão ativa
    const { data: sessionData } = await supabase.auth.getSession()
    console.log('Sessão ativa:', sessionData.session ? '✅ Sim' : '❌ Não')

    // Teste 1: Verificar se conseguimos ler da tabela
    console.log('1. Testando leitura da tabela usuarios...')
    const { data: readData, error: readError } = await supabase
      .from('usuarios')
      .select('*')
      .limit(1)

    if (readError) {
      console.error('❌ Erro na leitura:', readError)
      console.error('Código:', readError.code)
    } else {
      console.log('✅ Leitura OK. Dados encontrados:', readData?.length || 0)
    }

    // Teste 2: Verificar se conseguimos inserir (usando um UUID válido para teste)
    console.log('2. Testando inserção na tabela usuarios...')
    const testId = crypto.randomUUID() // Gera um UUID válido
    const testData = {
      id: testId,
      username: 'testuser_' + Date.now(),
      nome_completo: 'Usuário Teste',
      avatar_url: null,
      bio: 'Teste',
      data_cadastro: new Date().toISOString(),
      configuracoes_privacidade: {}
    }

    console.log('Tentando inserir com ID:', testId)

    const { data: insertData, error: insertError } = await supabase
      .from('usuarios')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('❌ Erro na inserção:', insertError)
      console.error('Código:', insertError.code)
      console.error('Mensagem:', insertError.message)

      if (insertError.code === '42501') {
        console.log('💡 Provável problema: RLS (Row Level Security) bloqueando inserção')
        console.log('💡 Solução: Verificar políticas RLS na tabela usuarios no Supabase')
      } else if (insertError.code === '23505') {
        console.log('💡 Erro: Violação de constraint único (provavelmente username)')
      }
    } else {
      console.log('✅ Inserção OK. Dados inseridos:', insertData)

      // Limpar o registro de teste
      await supabase.from('usuarios').delete().eq('id', testId)
      console.log('🧹 Registro de teste removido')
    }

  } catch (err) {
    console.error('❌ Erro geral no teste:', err)
  }

  console.log('=== FIM DO TESTE ===')
}