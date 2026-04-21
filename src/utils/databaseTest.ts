import { supabase } from '../supabase-client'

export const testDatabaseOperations = async () => {
  console.log('=== TESTE DE BANCO DE DADOS ===')

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    console.log('Sessao ativa:', sessionData.session ? 'Sim' : 'Nao')

    console.log('1. Testando leitura da tabela usuarios...')
    const { data: readData, error: readError } = await supabase.from('usuarios').select('*').limit(1)

    if (readError) {
      console.error('Erro na leitura:', readError)
      console.error('Codigo:', readError.code)
    } else {
      console.log('Leitura OK. Dados encontrados:', readData?.length || 0)
    }

    console.log('2. Testando insercao na tabela usuarios...')
    const testId = crypto.randomUUID()
    const testData = {
      id: testId,
      username: `testuser_${Date.now()}`,
      nome_completo: 'Usuario Teste',
      avatar_path: null,
      avatar_url: null,
      bio: 'Teste',
      data_cadastro: new Date().toISOString(),
      configuracoes_privacidade: {},
    }

    console.log('Tentando inserir com ID:', testId)

    const { data: insertData, error: insertError } = await supabase
      .from('usuarios')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('Erro na insercao:', insertError)
      console.error('Codigo:', insertError.code)
      console.error('Mensagem:', insertError.message)

      if (insertError.code === '42501') {
        console.log('Possivel problema: RLS bloqueando insercao')
      } else if (insertError.code === '23505') {
        console.log('Erro: violacao de constraint unica, provavelmente username')
      }
    } else {
      console.log('Insercao OK. Dados inseridos:', insertData)
      await supabase.from('usuarios').delete().eq('id', testId)
      console.log('Registro de teste removido')
    }
  } catch (error) {
    console.error('Erro geral no teste:', error)
  }

  console.log('=== FIM DO TESTE ===')
}
