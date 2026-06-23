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

interface OwnedCommunityRow {
  id: string
  nome: string | null
  banner_path: string | null
}

interface CommunityAdminRow {
  comunidade_id: string
}

interface StoragePreserveEntry {
  bucket: string
  path: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const publicUploadsBucket = 'user-uploads'
const communityPostMediaBucket = 'community-post-media'
const storageBuckets = [publicUploadsBucket, communityPostMediaBucket]
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

function getErrorField(error: unknown, fieldName: 'code' | 'message' | 'details' | 'hint' | 'name') {
  if (!error || typeof error !== 'object' || !(fieldName in error)) {
    return null
  }

  const value = (error as Record<string, unknown>)[fieldName]
  return typeof value === 'string' ? value : null
}

function getErrorCode(error: unknown) {
  return getErrorField(error, 'code')
}

function getErrorMessage(error: unknown) {
  return getErrorField(error, 'message') || (error instanceof Error ? error.message : null)
}

function normalizeErrorForLog(error: unknown) {
  if (!error) return null

  if (typeof error !== 'object') {
    return { message: String(error) }
  }

  return {
    name: getErrorField(error, 'name'),
    code: getErrorCode(error),
    message: getErrorMessage(error),
    details: getErrorField(error, 'details'),
    hint: getErrorField(error, 'hint'),
  }
}

function logEdgeError(message: string, error: unknown, context: Record<string, unknown> = {}) {
  console.error(message, {
    ...context,
    error: normalizeErrorForLog(error),
  })
}

function isMissingRpcError(error: unknown) {
  const code = getErrorCode(error)
  return code === 'PGRST202' || code === '42883'
}

function isCommunityLeadershipTransferRequiredError(error: unknown) {
  const message = getErrorMessage(error) || ''
  return message.includes('community_leadership_transfer_required')
}

function normalizeStorageObjectPath(bucket: string, filePath: string | null | undefined) {
  const normalizedPath = filePath?.trim()

  if (!normalizedPath) return null
  if (/^(null|undefined)$/i.test(normalizedPath)) return null
  if (/^([a-z]+:)?\/\//i.test(normalizedPath)) return null
  if (normalizedPath.includes('..') || normalizedPath.includes('\\')) return null
  if (normalizedPath.startsWith('/')) return null

  const bucketPrefix = `${bucket}/`
  return normalizedPath.startsWith(bucketPrefix)
    ? normalizedPath.slice(bucketPrefix.length)
    : normalizedPath
}

function createPreservedPathsByBucket(preserveEntries: StoragePreserveEntry[]) {
  const preservedPathsByBucket = new Map<string, Set<string>>()

  preserveEntries.forEach(entry => {
    const normalizedPath = normalizeStorageObjectPath(entry.bucket, entry.path)
    if (!normalizedPath) return

    const currentPaths = preservedPathsByBucket.get(entry.bucket) || new Set<string>()
    currentPaths.add(normalizedPath)
    preservedPathsByBucket.set(entry.bucket, currentPaths)
  })

  return preservedPathsByBucket
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

async function removeUserStorageFilesExcept(
  adminClient: SupabaseClient,
  userId: string,
  preserveEntries: StoragePreserveEntry[]
) {
  const preservedPathsByBucket = createPreservedPathsByBucket(preserveEntries)

  for (const bucket of storageBuckets) {
    const { paths, error } = await listUserFiles(adminClient, bucket, userId)

    if (error) {
      return { ok: false, error }
    }

    const preservedPaths = preservedPathsByBucket.get(bucket)
    const removablePaths = preservedPaths
      ? paths.filter(path => !preservedPaths.has(path))
      : paths

    for (let index = 0; index < removablePaths.length; index += removalChunkSize) {
      const chunk = removablePaths.slice(index, index + removalChunkSize)

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

async function getAccountDeletionPreparation(adminClient: SupabaseClient, userId: string) {
  const { data: ownedCommunitiesData, error: ownedCommunitiesError } = await adminClient
    .from('comunidades')
    .select('id, nome, banner_path')
    .eq('lider_id', userId)
    .is('deleted_at', null)

  if (ownedCommunitiesError) {
    return {
      ok: false,
      error: ownedCommunitiesError,
      missingAdminCommunities: [] as string[],
      preserveStorageEntries: [] as StoragePreserveEntry[],
    }
  }

  const ownedCommunities = (ownedCommunitiesData || []) as OwnedCommunityRow[]

  if (ownedCommunities.length === 0) {
    return {
      ok: true,
      error: null,
      missingAdminCommunities: [] as string[],
      preserveStorageEntries: [] as StoragePreserveEntry[],
    }
  }

  const communityIds = ownedCommunities.map(community => community.id)
  const { data: adminRowsData, error: adminRowsError } = await adminClient
    .from('comunidade_membros')
    .select('comunidade_id')
    .in('comunidade_id', communityIds)
    .eq('cargo', 'admin')
    .neq('usuario_id', userId)

  if (adminRowsError) {
    return {
      ok: false,
      error: adminRowsError,
      missingAdminCommunities: [] as string[],
      preserveStorageEntries: [] as StoragePreserveEntry[],
    }
  }

  const communityIdsWithAdmin = new Set(
    ((adminRowsData || []) as CommunityAdminRow[]).map(row => row.comunidade_id)
  )
  const missingAdminCommunities = ownedCommunities
    .filter(community => !communityIdsWithAdmin.has(community.id))
    .map(community => community.nome || community.id)

  if (missingAdminCommunities.length > 0) {
    return {
      ok: false,
      error: null,
      missingAdminCommunities,
      preserveStorageEntries: [] as StoragePreserveEntry[],
    }
  }

  const preserveStorageEntries = ownedCommunities.flatMap(community => {
    const bannerPath = normalizeStorageObjectPath(publicUploadsBucket, community.banner_path)
    return bannerPath
      ? [{
          bucket: publicUploadsBucket,
          path: bannerPath,
        }]
      : []
  })

  return {
    ok: true,
    error: null,
    missingAdminCommunities: [] as string[],
    preserveStorageEntries,
  }
}

async function deleteAccountData(adminClient: SupabaseClient, userId: string) {
  const argumentCandidates = [
    { target_user_id: userId },
    { p_user_id: userId },
    { user_id: userId },
  ]

  for (const args of argumentCandidates) {
    const { error } = await adminClient.rpc('admin_delete_account_data', args)

    if (!error) {
      return { ok: true, error: null }
    }

    if (!isMissingRpcError(error)) {
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

  const deletionPreparationResult = await getAccountDeletionPreparation(adminClient, user.id)

  if (!deletionPreparationResult.ok) {
    if (deletionPreparationResult.missingAdminCommunities.length > 0) {
      return jsonResponse(409, {
        error: 'community_leadership_transfer_required',
        communities: deletionPreparationResult.missingAdminCommunities,
      })
    }

    logEdgeError('delete-own-account preparation error', deletionPreparationResult.error, {
      step: 'prepare_community_transfer',
      userId: user.id,
    })
    return jsonResponse(500, { error: 'data_cleanup_failed' })
  }

  const storageCleanupResult = await removeUserStorageFilesExcept(
    adminClient,
    user.id,
    deletionPreparationResult.preserveStorageEntries
  )

  if (!storageCleanupResult.ok) {
    logEdgeError('delete-own-account storage cleanup error', storageCleanupResult.error, {
      step: 'storage_cleanup',
      userId: user.id,
    })
    return jsonResponse(500, { error: 'storage_cleanup_failed' })
  }

  const dataCleanupResult = await deleteAccountData(adminClient, user.id)

  if (!dataCleanupResult.ok) {
    logEdgeError('delete-own-account rpc error', dataCleanupResult.error, {
      step: 'data_cleanup',
      userId: user.id,
    })

    if (isCommunityLeadershipTransferRequiredError(dataCleanupResult.error)) {
      return jsonResponse(409, { error: 'community_leadership_transfer_required' })
    }

    return jsonResponse(500, { error: 'data_cleanup_failed' })
  }

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteUserError) {
    logEdgeError('delete-own-account auth delete error', deleteUserError, {
      step: 'auth_delete',
      userId: user.id,
    })
    return jsonResponse(500, { error: 'auth_delete_failed' })
  }

  return jsonResponse(200, { ok: true })
})
