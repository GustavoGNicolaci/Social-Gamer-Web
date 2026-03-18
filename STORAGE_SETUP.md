# Configuração do Storage com Supabase - Social-Gamer-Web

## Passo 1: Criar o Bucket no Supabase

1. Acesse o painel do Supabase
2. Vá para **Storage** > **Buckets**
3. Clique em **Create a new bucket**
4. Nome: `user-uploads`
5. Deixe como **Private** (você configurará as políticas)
6. Clique em **Create bucket**

## Passo 2: Criar a Tabela de Profiles (SE NÃO EXISTIR)

Execute no SQL Editor do Supabase:

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  avatar_url TEXT,
  avatar_path TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

## Passo 3: Configurar Políticas de Storage

Execute no SQL Editor do Supabase:

```sql
-- Permitir usuários fazer upload em sua própria pasta
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usar URL pública (caso bucket seja público) ou gerar signed URLs
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir usuários deletar seus próprios arquivos
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Passo 4: Verificar as Variáveis de Ambiente

Verifique se seu `.env.local` tem:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Passo 5: Usar no Código

### Importar o Serviço

```typescript
import { uploadImage, getPublicUrl, deleteFile } from '../services/storageService';
```

### Usar o Componente de Avatar

```tsx
import { AvatarUpload } from '../components/AvatarUpload';

<AvatarUpload
  userId={user.id}
  currentAvatarPath={profile?.avatar_path}
  onUploadSuccess={(url, path) => {
    // Atualizar seu banco de dados
  }}
/>
```

### Ou Usar as Funções Diretamente

```typescript
// Upload de imagem
const result = await uploadImage(file, userId);
if (result) {
  console.log('URL:', result.url);
  console.log('Path:', result.path);
}

// Listar arquivos
const files = await listUserFiles(userId);

// Deletar arquivo
await deleteFile('user-id/images/file.jpg');

// Download
const blob = await downloadFile('user-id/images/file.jpg');
```

## Estrutura de Arquivos Criada

```
src/
├── services/
│   └── storageService.ts      # Funções de storage
├── components/
│   ├── AvatarUpload.tsx       # Componente de upload
│   └── AvatarUpload.css       # Estilos
└── pages/
    └── ProfilePage.tsx         # Exemplo de uso
```

## Função Disponíveis

### `uploadFile(file, userId, folder?)`
Upload genérico de arquivo

### `uploadImage(file, userId, maxSizeMB?)`
Upload com validação de imagem (tamanho e tipo)

### `getPublicUrl(filePath)`
Obtém URL pública de um arquivo

### `deleteFile(filePath)`
Deleta um arquivo

### `listUserFiles(userId, folder?)`
Lista arquivos do usuário

### `downloadFile(filePath)`
Faz download de um arquivo

## Notas Importantes

- ⚠️ Mude `BUCKET_NAME` em `storageService.ts` se usar outro nome
- 🔒 As políticas garantem que usuários só acessem seus próprios arquivos
- 📁 A estrutura de pastas é `{userId}/{folder}/{file}`
- 🖼️ O componente `AvatarUpload` já trata preview e deleção do avatar anterior
