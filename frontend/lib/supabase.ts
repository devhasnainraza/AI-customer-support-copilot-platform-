/**
 * Supabase Client Initialization for Frontend
 * T029: Supabase client setup for Next.js
 */
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Lazy initialization: this module is transitively imported by the root
// layout, so throwing at module scope on a missing env var would 500 every
// route during SSR. Failing at first use keeps the outage scoped to auth.
let client: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables'
      )
    }
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = getSupabaseClient()
    const value = instance[prop as keyof SupabaseClient]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(redirectTo?: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const callbackUrl = `${origin}${redirectTo || '/login'}`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error

  if (data?.url) {
    try {
      // Pre-check if Google provider is enabled in Supabase without throwing raw JSON in user's browser
      const checkRes = await fetch(data.url, { method: 'GET' })
      if (!checkRes.ok) {
        const errJson = await checkRes.json().catch(() => null)
        if (errJson?.msg?.includes('Unsupported provider') || errJson?.msg?.includes('not enabled')) {
          throw new Error('Google Sign-In is not enabled yet in your Supabase dashboard. Please enable it in Supabase Dashboard (Authentication -> Providers -> Google) or sign in with Email & Password.')
        }
        throw new Error(errJson?.msg || 'Google Sign-In service is currently unavailable.')
      }
      // If valid, redirect to Google consent screen
      if (typeof window !== 'undefined') {
        window.location.href = data.url
      }
    } catch (checkErr: any) {
      if (checkErr.message?.includes('Google Sign-In')) {
        throw checkErr
      }
      // Network/CORS redirect to Google is normal on success
      if (typeof window !== 'undefined') {
        window.location.href = data.url
      }
    }
  }
  return data
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, metadata?: Record<string, unknown>) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  })
  if (error) throw error
  return data
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Send password reset email via backend API (uses Resend SMTP)
 * The backend generates a Supabase recovery link and sends it through
 * the configured SMTP provider, ensuring reliable email delivery.
 */
export async function resetPasswordForEmail(email: string): Promise<string> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const response = await fetch(`${API_BASE_URL}/v1/auth/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body?.detail || body?.message || `Request failed (HTTP ${response.status})`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }

  const body = await response.json().catch(() => ({}))
  return body?.message || 'Password reset link sent.'
}

/**
 * Update the current user's password (used after PASSWORD_RECOVERY event)
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (error) throw error
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback)
}
