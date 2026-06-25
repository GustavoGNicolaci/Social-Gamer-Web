export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Nullable<T> = T | null
export type Relation<T> = T | T[] | null

type Relationship<
  ForeignKeyName extends string = string,
  Columns extends string[] = string[],
  ReferencedRelation extends string = string,
  ReferencedColumns extends string[] = string[],
  IsOneToOne extends boolean = boolean,
> = {
  foreignKeyName: ForeignKeyName
  columns: Columns
  isOneToOne: IsOneToOne
  referencedRelation: ReferencedRelation
  referencedColumns: ReferencedColumns
}

type Fk<
  ForeignKeyName extends string,
  Columns extends string[],
  ReferencedRelation extends string,
  ReferencedColumns extends string[],
  IsOneToOne extends boolean = false,
> = Relationship<ForeignKeyName, Columns, ReferencedRelation, ReferencedColumns, IsOneToOne>

type RelationshipMap = {
  avaliacao_curtidas: [
    Fk<'avaliacao_curtidas_avaliacao_id_fkey', ['avaliacao_id'], 'avaliacoes', ['id']>,
    Fk<'avaliacao_curtidas_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  avaliacao_deslikes: [
    Fk<'avaliacao_deslikes_avaliacao_id_fkey', ['avaliacao_id'], 'avaliacoes', ['id']>,
    Fk<'avaliacao_deslikes_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  avaliacoes: [
    Fk<'avaliacoes_jogo_id_fkey', ['jogo_id'], 'jogos', ['id']>,
    Fk<'avaliacoes_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  comentario_curtidas: [
    Fk<'comentario_curtidas_comentario_id_fkey', ['comentario_id'], 'comentarios', ['id']>,
    Fk<'comentario_curtidas_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  comentario_deslikes: [
    Fk<'comentario_deslikes_comentario_id_fkey', ['comentario_id'], 'comentarios', ['id']>,
    Fk<'comentario_deslikes_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  comentarios: [
    Fk<'comentarios_review_id_fkey', ['review_id'], 'avaliacoes', ['id']>,
    Fk<'comentarios_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  comunidade_denuncias: [
    Fk<'comunidade_denuncias_comentario_id_fkey', ['comentario_id'], 'comunidade_post_comentarios', ['id']>,
    Fk<'comunidade_denuncias_comunidade_id_fkey', ['comunidade_id'], 'comunidades', ['id']>,
    Fk<'comunidade_denuncias_denunciante_id_fkey', ['denunciante_id'], 'usuarios', ['id']>,
    Fk<'comunidade_denuncias_post_id_fkey', ['post_id'], 'comunidade_posts', ['id']>,
  ]
  comunidade_membros: [
    Fk<'comunidade_membros_comunidade_id_fkey', ['comunidade_id'], 'comunidades', ['id']>,
    Fk<'comunidade_membros_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  comunidade_post_comentarios: [
    Fk<'comunidade_post_comentarios_autor_id_fkey', ['autor_id'], 'usuarios', ['id']>,
    Fk<'comunidade_post_comentarios_comunidade_id_fkey', ['comunidade_id'], 'comunidades', ['id']>,
    Fk<'comunidade_post_comentarios_post_id_fkey', ['post_id'], 'comunidade_posts', ['id']>,
  ]
  comunidade_post_reacoes: [
    Fk<'comunidade_post_reacoes_post_id_fkey', ['post_id'], 'comunidade_posts', ['id']>,
    Fk<'comunidade_post_reacoes_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  comunidade_post_salvos: [
    Fk<'comunidade_post_salvos_post_id_fkey', ['post_id'], 'comunidade_posts', ['id']>,
    Fk<'comunidade_post_salvos_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  comunidade_posts: [
    Fk<'comunidade_posts_autor_id_fkey', ['autor_id'], 'usuarios', ['id']>,
    Fk<'comunidade_posts_comunidade_id_fkey', ['comunidade_id'], 'comunidades', ['id']>,
    Fk<'comunidade_posts_fixado_por_fkey', ['fixado_por'], 'usuarios', ['id']>,
  ]
  comunidade_solicitacoes_entrada: [
    Fk<'comunidade_solicitacoes_entrada_comunidade_id_fkey', ['comunidade_id'], 'comunidades', ['id']>,
    Fk<'comunidade_solicitacoes_entrada_decidido_por_fkey', ['decidido_por'], 'usuarios', ['id']>,
    Fk<'comunidade_solicitacoes_entrada_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  comunidades: [
    Fk<'comunidades_jogo_id_fkey', ['jogo_id'], 'jogos', ['id']>,
    Fk<'comunidades_lider_id_fkey', ['lider_id'], 'usuarios', ['id']>,
  ]
  denuncias_conteudo: [
    Fk<'denuncias_conteudo_avaliacao_id_fkey', ['avaliacao_id'], 'avaliacoes', ['id']>,
    Fk<'denuncias_conteudo_comentario_id_fkey', ['comentario_id'], 'comentarios', ['id']>,
    Fk<'denuncias_conteudo_denunciante_id_fkey', ['denunciante_id'], 'usuarios', ['id']>,
  ]
  denuncias_perfil: [
    Fk<'denuncias_perfil_denunciante_id_fkey', ['denunciante_id'], 'usuarios', ['id']>,
    Fk<'denuncias_perfil_usuario_denunciado_id_fkey', ['usuario_denunciado_id'], 'usuarios', ['id']>,
  ]
  game_catalog_cache: []
  game_external_ids: [
    Fk<'game_external_ids_jogo_id_fkey', ['jogo_id'], 'jogos', ['id']>,
  ]
  game_translations: [
    Fk<'game_translations_jogo_id_fkey', ['jogo_id'], 'jogos', ['id']>,
  ]
  jogo_midias: [
    Fk<'jogo_midias_jogo_id_fkey', ['jogo_id'], 'jogos', ['id']>,
  ]
  jogos: []
  lista_desejos: [
    Fk<'lista_desejos_jogo_id_fkey', ['jogo_id'], 'jogos', ['id']>,
    Fk<'lista_desejos_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  notifications: [
    Fk<'notifications_actor_id_fkey', ['actor_id'], 'usuarios', ['id']>,
    Fk<'notifications_user_id_fkey', ['user_id'], 'usuarios', ['id']>,
  ]
  seguidores: [
    Fk<'seguidores_seguidor_id_fkey', ['seguidor_id'], 'usuarios', ['id']>,
    Fk<'seguidores_seguido_id_fkey', ['seguido_id'], 'usuarios', ['id']>,
  ]
  status_jogo: [
    Fk<'status_jogo_jogo_id_fkey', ['jogo_id'], 'jogos', ['id']>,
    Fk<'status_jogo_usuario_id_fkey', ['usuario_id'], 'usuarios', ['id']>,
  ]
  usuarios: []
}

type Table<Name extends keyof RelationshipMap, Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: RelationshipMap[Name]
}

type View<Row> = {
  Row: Row
  Insert: never
  Update: never
  Relationships: Relationship[]
}

type PublicEnums = {
  comunidade_cargo: 'lider' | 'admin' | 'membro'
  comunidade_denuncia_motivo:
    | 'spam'
    | 'assedio_ou_ofensa'
    | 'conteudo_improprio'
    | 'informacao_enganosa'
    | 'discurso_de_odio'
    | 'outro'
  comunidade_denuncia_status: 'pending' | 'under_review' | 'resolved' | 'dismissed'
  comunidade_denuncia_tipo: 'post' | 'comentario'
  comunidade_permissao_postagem: 'todos_membros' | 'somente_admins' | 'somente_lider'
  comunidade_reacao_tipo: 'curtida' | 'dislike'
  comunidade_solicitacao_status: 'pendente' | 'aprovada' | 'recusada' | 'cancelada'
  comunidade_visibilidade: 'publica' | 'privada'
  motivo_denuncia_conteudo:
    | 'spam'
    | 'assedio_ou_ofensa'
    | 'conteudo_improprio'
    | 'informacao_enganosa'
    | 'discurso_de_odio'
    | 'outro'
  motivo_denuncia_perfil:
    | 'foto_ofensiva'
    | 'nome_ofensivo'
    | 'perfil_falso'
    | 'spam'
    | 'assedio_ou_ofensa'
    | 'conteudo_improprio'
    | 'discurso_de_odio'
    | 'outro'
  status_denuncia_conteudo: 'pending' | 'under_review' | 'resolved' | 'dismissed'
  status_denuncia_perfil: 'pending' | 'under_review' | 'resolved' | 'dismissed'
  tipo_denuncia_conteudo: 'review' | 'comment'
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.4'
  }
  public: {
    Tables: {
      avaliacao_curtidas: Table<'avaliacao_curtidas', {
        id: string
        avaliacao_id: string
        usuario_id: string
        criado_em: string
      }>
      avaliacao_deslikes: Table<'avaliacao_deslikes', {
        id: string
        avaliacao_id: string
        usuario_id: string
        created_at: string
      }>
      avaliacoes: Table<'avaliacoes', {
        id: string
        usuario_id: string
        jogo_id: number
        nota: number
        texto_review: string | null
        curtidas: number
        data_publicacao: string | null
        editado_em: string | null
      }>
      comentario_curtidas: Table<'comentario_curtidas', {
        id: string
        comentario_id: string
        usuario_id: string
        created_at: string
      }>
      comentario_deslikes: Table<'comentario_deslikes', {
        id: string
        comentario_id: string
        usuario_id: string
        created_at: string
      }>
      comentarios: Table<'comentarios', {
        id: string
        usuario_id: string
        review_id: string
        texto: string
        data_comentario: string
        editado_em: string | null
      }>
      comunidade_denuncias: Table<'comunidade_denuncias', {
        id: string
        comunidade_id: string
        denunciante_id: string
        tipo_conteudo: PublicEnums['comunidade_denuncia_tipo']
        post_id: string | null
        comentario_id: string | null
        motivo: PublicEnums['comunidade_denuncia_motivo']
        descricao: string | null
        status: PublicEnums['comunidade_denuncia_status']
        created_at: string
        updated_at: string
      }>
      comunidade_membros: Table<'comunidade_membros', {
        comunidade_id: string
        usuario_id: string
        cargo: PublicEnums['comunidade_cargo']
        entrou_em: string
        atualizado_em: string
      }>
      comunidade_post_comentarios: Table<'comunidade_post_comentarios', {
        id: string
        post_id: string
        comunidade_id: string
        autor_id: string
        texto: string
        created_at: string
        updated_at: string
        deleted_at: string | null
      }>
      comunidade_post_reacoes: Table<'comunidade_post_reacoes', {
        post_id: string
        usuario_id: string
        tipo: PublicEnums['comunidade_reacao_tipo']
        created_at: string
        updated_at: string
      }>
      comunidade_post_salvos: Table<'comunidade_post_salvos', {
        post_id: string
        usuario_id: string
        created_at: string
      }>
      comunidade_posts: Table<'comunidade_posts', {
        id: string
        comunidade_id: string
        autor_id: string
        texto: string | null
        imagem_path: string | null
        curtidas_count: number
        dislikes_count: number
        comentarios_count: number
        created_at: string
        updated_at: string
        deleted_at: string | null
        fixado: boolean
        fixado_em: string | null
        fixado_por: string | null
      }>
      comunidade_solicitacoes_entrada: Table<'comunidade_solicitacoes_entrada', {
        id: string
        comunidade_id: string
        usuario_id: string
        status: PublicEnums['comunidade_solicitacao_status']
        decidido_por: string | null
        decidido_em: string | null
        created_at: string
        updated_at: string
      }>
      comunidades: Table<'comunidades', {
        id: string
        nome: string
        descricao: string | null
        banner_path: string | null
        tipo: string | null
        jogo_id: number | null
        categoria: string | null
        regras: string | null
        permissao_postagem: PublicEnums['comunidade_permissao_postagem']
        lider_id: string
        membros_count: number
        posts_count: number
        created_at: string
        updated_at: string
        deleted_at: string | null
        visibilidade: PublicEnums['comunidade_visibilidade']
      }>
      denuncias_conteudo: Table<'denuncias_conteudo', {
        id: string
        denunciante_id: string
        tipo_conteudo: PublicEnums['tipo_denuncia_conteudo']
        avaliacao_id: string | null
        comentario_id: string | null
        motivo: PublicEnums['motivo_denuncia_conteudo']
        descricao: string | null
        status: PublicEnums['status_denuncia_conteudo']
        created_at: string
      }>
      denuncias_perfil: Table<'denuncias_perfil', {
        id: string
        denunciante_id: string
        usuario_denunciado_id: string
        nome_usuario_denunciado: string
        motivo: PublicEnums['motivo_denuncia_perfil']
        descricao: string | null
        status: PublicEnums['status_denuncia_perfil']
        created_at: string
      }>
      game_catalog_cache: Table<'game_catalog_cache', {
        cache_key: string
        provider: string
        request: Json
        game_ids: number[]
        has_next_page: boolean
        expires_at: string
        created_at: string
        updated_at: string
      }>
      game_external_ids: Table<'game_external_ids', {
        id: number
        jogo_id: number
        provider: string
        external_id: string
        url: string | null
        metadata: Json
        last_synced_at: string | null
        created_at: string
        updated_at: string
      }>
      game_translations: Table<'game_translations', {
        id: number
        jogo_id: number
        provider: string
        field: string
        source_locale: string
        target_locale: string
        source_hash: string
        translated_text: string | null
        status: string
        error_message: string | null
        created_at: string
        updated_at: string
      }>
      jogo_midias: Table<'jogo_midias', {
        id: number
        jogo_id: number
        tipo: string
        url: string
        thumbnail_url: string | null
        provider: string | null
        external_media_id: string | null
        width: number | null
        height: number | null
        ordem: number
        is_primary: boolean
        created_at: string
        updated_at: string
      }>
      jogos: Table<'jogos', {
        id: number
        titulo: string
        capa_url: string | null
        desenvolvedora: string | null
        generos: string[] | null
        data_lancamento: string | null
        descricao: string | null
        plataformas: string[] | null
        slug: string | null
        descricao_curta: string | null
        source_primary: string
        external_updated_at: string | null
        status_importacao: string
        nota_media_externa: number | null
        nota_media_externa_count: number
        metadados: Json
        created_at: string
        updated_at: string
        search_vector: unknown | null
      }>
      lista_desejos: Table<'lista_desejos', {
        id: string
        usuario_id: string
        jogo_id: number
        adicionado_em: string
        prioridade: number
      }>
      notifications: Table<'notifications', {
        id: string
        user_id: string
        actor_id: string | null
        type: string
        title: string
        message: string | null
        entity_type: string | null
        entity_id: string | null
        link: string | null
        metadata: Json
        dedupe_key: string | null
        is_read: boolean
        read_at: string | null
        created_at: string
      }>
      seguidores: Table<'seguidores', {
        id: string
        seguidor_id: string
        seguido_id: string
        data_inicio: string
      }>
      status_jogo: Table<'status_jogo', {
        id: string
        usuario_id: string
        jogo_id: number
        status: string
        created_at: string | null
        favorito: boolean | null
      }>
      usuarios: Table<'usuarios', {
        id: string
        username: string | null
        nome_completo: string | null
        avatar_url: string | null
        bio: string | null
        data_cadastro: string | null
        configuracoes_privacidade: Record<string, unknown> | null
        avatar_path: string | null
      }>
    }
    Views: {
      game_rating_summaries: View<{
        jogo_id: number | null
        review_count: number | null
        average_rating: number | null
      }>
    }
    Functions: {
      alterar_cargo_membro: {
        Args: { p_comunidade_id: string; p_usuario_id: string; p_cargo: string }
        Returns: undefined
      }
      alterar_fixacao_post_comunidade: {
        Args: { p_post_id: string; p_fixado: boolean }
        Returns: undefined
      }
      alterar_permissao_postagem: {
        Args: {
          p_comunidade_id: string
          p_permissao: PublicEnums['comunidade_permissao_postagem'] | string
        }
        Returns: undefined
      }
      alternar_post_salvo: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      alternar_reacao_post: {
        Args: { p_post_id: string; p_tipo: string }
        Returns: {
          curtidas_count: number
          dislikes_count: number
          reacao_atual: PublicEnums['comunidade_reacao_tipo'] | null
        }[]
      }
      aprovar_solicitacao_comunidade: {
        Args: { p_solicitacao_id: string }
        Returns: undefined
      }
      atualizar_status_denuncia_comunidade: {
        Args: { p_denuncia_id: string; p_status: PublicEnums['comunidade_denuncia_status'] }
        Returns: Database['public']['Tables']['comunidade_denuncias']['Row']
      }
      cancelar_solicitacao_comunidade: {
        Args: { p_solicitacao_id: string }
        Returns: undefined
      }
      criar_comentario_comunidade: {
        Args: { p_post_id: string; p_texto: string }
        Returns: string
      }
      criar_comunidade: {
        Args: {
          p_nome: string
          p_descricao?: string | null
          p_banner_path?: string | null
          p_tipo?: string | null
          p_jogo_id?: number | null
          p_categoria?: string | null
          p_regras?: string | null
          p_permissao_postagem?: PublicEnums['comunidade_permissao_postagem'] | string | null
          p_visibilidade?: PublicEnums['comunidade_visibilidade'] | null
        }
        Returns: Database['public']['Tables']['comunidades']['Row']
      }
      criar_denuncia_comunidade: {
        Args: {
          p_comunidade_id: string
          p_conteudo_id: string
          p_tipo_conteudo: PublicEnums['comunidade_denuncia_tipo']
          p_motivo: PublicEnums['comunidade_denuncia_motivo']
          p_descricao?: string | null
        }
        Returns: Database['public']['Tables']['comunidade_denuncias']['Row']
      }
      criar_post_comunidade: {
        Args: { p_comunidade_id: string; p_texto?: string | null; p_imagem_path?: string | null }
        Returns: string
      }
      editar_comunidade: {
        Args: {
          p_comunidade_id: string
          p_nome: string
          p_descricao?: string | null
          p_banner_path?: string | null
          p_tipo?: string | null
          p_jogo_id?: number | null
          p_categoria?: string | null
          p_regras?: string | null
          p_visibilidade?: PublicEnums['comunidade_visibilidade'] | null
        }
        Returns: Database['public']['Tables']['comunidades']['Row']
      }
      editar_comunidade_moderavel: {
        Args: {
          p_comunidade_id: string
          p_descricao?: string | null
          p_banner_path?: string | null
          p_regras?: string | null
        }
        Returns: Database['public']['Tables']['comunidades']['Row']
      }
      entrar_comunidade: {
        Args: { p_comunidade_id: string }
        Returns: string
      }
      excluir_comentario_comunidade: {
        Args: { p_comentario_id: string }
        Returns: undefined
      }
      excluir_comunidade: {
        Args: { p_comunidade_id: string }
        Returns: undefined
      }
      excluir_post_comunidade: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      expulsar_membro: {
        Args: { p_comunidade_id: string; p_usuario_id: string }
        Returns: undefined
      }
      get_community_creation_quota: {
        Args: Record<PropertyKey, never>
        Returns: { can_create: boolean; created_count: number; limit_count: number; remaining_count: number }[]
      }
      get_catalog_facets: {
        Args: { p_query?: string | null }
        Returns: {
          category: string
          value: string | null
          result_count: number
        }[]
      }
      get_home_active_communities: {
        Args: { p_days_window?: number; p_limit?: number }
        Returns: {
          activity_score: number
          banner_path: string | null
          community_id: string
          created_at: string
          descricao: string | null
          jogo_cover_url: string | null
          jogo_id: number | null
          jogo_title: string | null
          membros_count: number
          new_members_count: number
          nome: string
          posts_count: number
          recent_posts_count: number
          tipo: string | null
        }[]
      }
      get_home_featured_recent_reviewed_games: {
        Args: { days_window?: number; games_limit?: number }
        Returns: {
          average_rating: number
          game_cover_url: string | null
          game_genres: Json
          game_id: number
          game_title: string
          latest_review_at: string
          recent_review_count: number
          release_date: string | null
          total_review_count: number
        }[]
      }
      get_home_following_activities: {
        Args: { activity_limit?: number }
        Returns: {
          activity_created_at: string
          activity_id: string
          activity_type: string
          author_avatar_path: string | null
          author_id: string
          author_name: string | null
          author_username: string | null
          game_cover_url: string | null
          game_genres: Json
          game_id: number
          game_title: string
          is_favorite: boolean
          review_id: string | null
          score: number | null
          status_id: string | null
          status_value: string | null
          text_review: string | null
        }[]
      }
      get_home_trending_reviews: {
        Args: { excluded_review_ids?: string[]; min_likes?: number; review_limit?: number }
        Returns: {
          author_avatar_path: string | null
          author_id: string
          author_name: string | null
          author_username: string | null
          game_cover_url: string | null
          game_genres: Json
          game_id: number
          game_title: string
          likes_count: number
          published_at: string
          review_id: string
          score: number
          text_review: string | null
        }[]
      }
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: Database['public']['Tables']['notifications']['Row']
      }
      recusar_solicitacao_comunidade: {
        Args: { p_solicitacao_id: string }
        Returns: undefined
      }
      sair_comunidade: {
        Args: { p_comunidade_id: string }
        Returns: undefined
      }
      search_catalog_games: {
        Args: {
          p_query?: string | null
          p_genres?: string[]
          p_platforms?: string[]
          p_developers?: string[]
          p_sort?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: number
          titulo: string
          capa_url: string | null
          desenvolvedora: string | null
          generos: string[] | null
          data_lancamento: string | null
          plataformas: string[] | null
          average_rating: number | null
          review_count: number
          total_count: number
        }[]
      }
      solicitar_entrada_comunidade: {
        Args: { p_comunidade_id: string }
        Returns: Database['public']['Tables']['comunidade_solicitacoes_entrada']['Row']
      }
      transferir_lideranca: {
        Args: { p_comunidade_id: string; p_novo_lider_id: string }
        Returns: undefined
      }
    }
    Enums: PublicEnums
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type GameStatusValue = 'jogando' | 'zerado' | 'dropado' | 'planejando' | 'pausado'
export type CommunityRole = Enums<'comunidade_cargo'>
export type CommunityPostingPermission = Enums<'comunidade_permissao_postagem'>
export type CommunityVisibility = Enums<'comunidade_visibilidade'>
export type CommunityReactionType = Enums<'comunidade_reacao_tipo'>
export type CommunityJoinRequestStatus = Enums<'comunidade_solicitacao_status'>
export type CommunityReportTargetType = Enums<'comunidade_denuncia_tipo'>
export type CommunityReportStatus = Enums<'comunidade_denuncia_status'>
export type ContentReportTargetType = Enums<'tipo_denuncia_conteudo'>
export type ReportStatus = Enums<'status_denuncia_conteudo'>

export type UsuarioRow = Omit<Tables<'usuarios'>, 'configuracoes_privacidade'> & {
  configuracoes_privacidade: Record<string, unknown> | null
}
export type JogoRow = Omit<Tables<'jogos'>, 'desenvolvedora' | 'generos' | 'plataformas'> & {
  desenvolvedora: string[] | string | null
  generos: string[] | string | null
  plataformas: string[] | string | null
}
export type AvaliacaoRow = Tables<'avaliacoes'>
export type ComentarioRow = Tables<'comentarios'>
export type StatusJogoRow = Omit<Tables<'status_jogo'>, 'status'> & { status: GameStatusValue }
export type ListaDesejosRow = Tables<'lista_desejos'>
export type NotificationRow = Omit<Tables<'notifications'>, 'metadata'> & {
  metadata: Record<string, unknown> | null
}
export type ComunidadeRow = Tables<'comunidades'>

export const Constants = {
  public: {
    Enums: {
      comunidade_cargo: ['lider', 'admin', 'membro'],
      comunidade_denuncia_motivo: [
        'spam',
        'assedio_ou_ofensa',
        'conteudo_improprio',
        'informacao_enganosa',
        'discurso_de_odio',
        'outro',
      ],
      comunidade_denuncia_status: ['pending', 'under_review', 'resolved', 'dismissed'],
      comunidade_denuncia_tipo: ['post', 'comentario'],
      comunidade_permissao_postagem: ['todos_membros', 'somente_admins', 'somente_lider'],
      comunidade_reacao_tipo: ['curtida', 'dislike'],
      comunidade_solicitacao_status: ['pendente', 'aprovada', 'recusada', 'cancelada'],
      comunidade_visibilidade: ['publica', 'privada'],
      motivo_denuncia_conteudo: [
        'spam',
        'assedio_ou_ofensa',
        'conteudo_improprio',
        'informacao_enganosa',
        'discurso_de_odio',
        'outro',
      ],
      motivo_denuncia_perfil: [
        'foto_ofensiva',
        'nome_ofensivo',
        'perfil_falso',
        'spam',
        'assedio_ou_ofensa',
        'conteudo_improprio',
        'discurso_de_odio',
        'outro',
      ],
      status_denuncia_conteudo: ['pending', 'under_review', 'resolved', 'dismissed'],
      status_denuncia_perfil: ['pending', 'under_review', 'resolved', 'dismissed'],
      tipo_denuncia_conteudo: ['review', 'comment'],
    },
  },
} as const
