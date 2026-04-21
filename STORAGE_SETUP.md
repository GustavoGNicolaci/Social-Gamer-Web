# Configuracao do Storage com Supabase - Social-Gamer-Web

## Passo 1: Criar o bucket no Supabase

1. Acesse o painel do Supabase.
2. Va para **Storage** > **Buckets**.
3. Clique em **Create a new bucket**.
4. Nome: `user-uploads`.
5. Marque o bucket como **Public** para que fotos de perfil possam aparecer para outros usuarios e visitantes.
6. Clique em **Create bucket**.

## Passo 2: Criar a tabela de profiles (se necessario)

Execute no SQL Editor do Supabase:

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  avatar_url text,
  avatar_path text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);
```

## Passo 3: Configurar politicas de storage

Execute no SQL Editor do Supabase:

```sql
create policy "Users can upload to their own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-uploads' and
  (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Public can view avatar files"
on storage.objects
for select
using (
  bucket_id = 'user-uploads'
);

create policy "Users can delete their own files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-uploads' and
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Passo 4: Verificar as variaveis de ambiente

Garanta que o `.env` tenha:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Passo 5: Usar no codigo

### Importar o servico

```typescript
import { uploadImage, getPublicUrl, deleteFile } from '../services/storageService'
```

### Upload de avatar

```typescript
const result = await uploadImage(file, userId)

if (result) {
  await updateOwnProfile({
    avatar_url: result.url,
  })
}
```

### Outras funcoes

```typescript
const files = await listUserFiles(userId)
await deleteFile('user-id/images/file.jpg')
const blob = await downloadFile('user-id/images/file.jpg')
```

## Estrutura de arquivos

```text
src/
|-- services/
|   `-- storageService.ts
|-- components/
|   |-- AvatarUpload.tsx
|   `-- AvatarUpload.css
`-- pages/
    `-- ProfilePage.tsx
```

## Funcoes disponiveis

### `uploadFile(file, userId, folder?)`

Upload generico de arquivo.

### `uploadImage(file, userId, maxSizeMB?)`

Upload com validacao de imagem.

### `getPublicUrl(filePath)`

Obtem a URL publica de um avatar.

### `deleteFile(filePath)`

Deleta um arquivo do bucket.

### `listUserFiles(userId, folder?)`

Lista arquivos do usuario.

### `downloadFile(filePath)`

Faz download de um arquivo.

## Notas importantes

- Ajuste `BUCKET_NAME` em `storageService.ts` se usar outro bucket.
- As fotos de perfil ficam publicas para aparecer em reviews, comentarios e na Home.
- Upload e delecao continuam restritos a pasta do proprio usuario.
- A estrutura de pastas continua sendo `{userId}/{folder}/{file}`.
