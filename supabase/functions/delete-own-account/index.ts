import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

interface DeleteAccountBody {
  username?: unknown
  currentPassword?: unknown
}

interface ProfileRow {
  username: string | null
}

interface StorageEntry {
  name: string
  id?: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const storageBuckets = ['user-uploads', 'community-post-media']
const storagePageSize = 100
const removalChunkSize = 100

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function readDeleteAccountBody(request: Request): Promise<DeleteAccountBody> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body as DeleteAccountBody : {}
  } catch {
    return {}
  }
}

async function getAuthenticatedUser(
  supabaseUrl: string,
  anonKey: string,
  authorizationHeader: string | null
) {
  if (!authorizationHeader) {
    return { user: null, error: 'not_authenticated' as const }
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: authorizationHeader,
      },
    },
  })

  const { data, error } = await userClient.auth.getUser()

  if (error || !data.user) {
    return { user: null, error: 'not_authenticated' as const }
  }

  return { user: data.user, error: null }
}

async function validateCurrentPassword(
  supabaseUrl: string,
  anonKey: string,
  user: User,
  currentPassword: string
) {
  if (!user.email) {
    return false
  }

  const validationClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { error } = await validationClient.auth.signInWithPassword({
    email: user.email.trim().toLowerCase(),
    password: currentPassword,
  })

  if (!error) {
    await validationClient.auth.signOut()
  }

  return !error
}

async function assertUsernameMatches(
  adminClient: SupabaseClient,
  userId: string,
  username: string
) {
  const { data, error } = await adminClient
    .from('usuarios')
    .select('username')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return false
  }

  const profile = data as ProfileRow
  return profile.username === username
}

function joinStoragePath(prefix: string, name: string) {
  return prefix ? `${prefix}/${name}` : name
}

async function listUserFiles(adminClient: SupabaseClient, bucket: string, userId: string) {
  const paths: string[] = []
  const pendingPrefixes = [userId]

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.shift()

    if (!prefix) {
      continue
    }

    let offset = 0
    let keepReading = true

    while (keepReading) {
      const { data, error } = await adminClient.storage.from(bucket).list(prefix, {
        limit: storagePageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })

      if (error) {
        return { paths, error }
      }

      const entries = (data || []) as StorageEntry[]

      entries.forEach(entry => {
        const fullPath = joinStoragePath(prefix, entry.name)

        if (entry.id) {
          paths.push(fullPath)
        } else {
          pendingPrefixes.push(fullPath)
        }
      })

      keepReading = entries.length === storagePageSize
      offset += entries.length
    }
  }

  return { paths, error: null }
}

async function removeUserStorageFiles(adminClient: SupabaseClient, userId: string) {
  for (const bucket of storageBuckets) {
    const { paths, error } = await listUserFiles(adminClient, bucket, userId)

    if (error) {
      return { ok: false, error }
    }

    for (let index = 0; index < paths.length; index += removalChunkSize) {
      const chunk = paths.slice(index, index + removalChunkSize)

      if (chunk.length === 0) {
        continue
      }

      const { error: removeError } = await adminClient.storage.from(bucket).remove(chunk)

      if (removeError) {
        return { ok: false, error: removeError }
      }
    }
  }

  return { ok: true, error: null }
}

async function deleteAccountData(adminClient: SupabaseClient, userId: string) {
  const argumentCandidates = [
    { p_user_id: userId },
    { target_user_id: userId },
    { user_id: userId },
  ]

  for (const args of argumentCandidates) {
    const { error } = await adminClient.rpc('admin_delete_account_data', args)

    if (!error) {
      return { ok: true, error: null }
    }

    if (error.code !== 'PGRST202' && error.code !== '42883') {
      return { ok: false, error }
    }
  }

  return { ok: false, error: new Error('admin_delete_account_data RPC was not found') }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' })
  }

  let supabaseUrl = ''
  let anonKey = ''
  let serviceRoleKey = ''

  try {
    supabaseUrl = getRequiredEnv('SUPABASE_URL')
    anonKey = getRequiredEnv('SUPABASE_ANON_KEY')
    serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  } catch {
    return jsonResponse(500, { error: 'server_misconfigured' })
  }

  const { user, error: authError } = await getAuthenticatedUser(
    supabaseUrl,
    anonKey,
    request.headers.get('Authorization')
  )

  if (authError || !user) {
    return jsonResponse(401, { error: 'not_authenticated' })
  }

  const body = await readDeleteAccountBody(request)
  const username = normalizeText(body.username)
  const currentPassword = normalizeText(body.currentPassword)

  if (!username || !currentPassword) {
    return jsonResponse(400, { error: 'missing_confirmation' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const usernameMatches = await assertUsernameMatches(adminClient, user.id, username)

  if (!usernameMatches) {
    return jsonResponse(400, { error: 'username_mismatch' })
  }

  const passwordIsValid = await validateCurrentPassword(supabaseUrl, anonKey, user, currentPassword)

  if (!passwordIsValid) {
    return jsonResponse(400, { error: 'invalid_password' })
  }

  const storageCleanupResult = await removeUserStorageFiles(adminClient, user.id)

  if (!storageCleanupResult.ok) {
    return jsonResponse(500, { error: 'storage_cleanup_failed' })
  }

  const dataCleanupResult = await deleteAccountData(adminClient, user.id)

  if (!dataCleanupResult.ok) {
    return jsonResponse(500, { error: 'data_cleanup_failed' })
  }

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteUserError) {
    return jsonResponse(500, { error: 'auth_delete_failed' })
  }

  return jsonResponse(200, { ok: true })
})
