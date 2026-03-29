import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Vanhentunut / korruptoitunut refresh token localstoragessa (esim. reset DB, vaihdettu projekti). */
export function isRefreshTokenAuthError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false
  const msg = String((err as { message?: string }).message || '').toLowerCase()
  return (
    msg.includes('refresh token') &&
    (msg.includes('not found') || msg.includes('invalid') || msg.includes('expired'))
  )
}

function removeSupabaseAuthKeys(storage: Storage) {
  const toRemove: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && key.startsWith('sb-') && key.includes('auth')) {
      toRemove.push(key)
    }
  }
  toRemove.forEach((k) => storage.removeItem(k))
}

/** Tyhjentää paikallisen sessionin ilman server-kutsua (toimii kun refresh on jo rikki). */
export async function recoverFromStaleSupabaseAuth(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    removeSupabaseAuthKeys(localStorage)
    removeSupabaseAuthKeys(sessionStorage)
  }
}