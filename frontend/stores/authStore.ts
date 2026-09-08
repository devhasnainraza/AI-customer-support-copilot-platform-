/**
 * Auth Store with Zustand & Role-Based Access Control (RBAC)
 * T032: Authentication & Role Management
 */
import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase, signIn, signInWithGoogle, signUp, signOut, resetPasswordForEmail } from '@/lib/supabase'

export type UserRole = 'admin' | 'agent' | 'manager' | 'customer' | 'suspended'

export function getUserRole(user: User | null): UserRole {
  if (!user) return 'customer'

  // 0. Check for account suspension FIRST
  if (
    user.user_metadata?.status === 'suspended' ||
    user.app_metadata?.status === 'suspended'
  ) {
    return 'suspended'
  }

  // 1. Check explicit app_metadata / user_metadata from Supabase (source of truth)
  const explicitRole = (user.app_metadata?.role || user.user_metadata?.role) as string | undefined
  if (explicitRole === 'admin' || explicitRole === 'agent' || explicitRole === 'manager' || explicitRole === 'customer') {
    return explicitRole
  }

  // 2. Check user-scoped local storage for this specific user ID only
  if (typeof window !== 'undefined' && user?.id) {
    try {
      const userScopedRole = localStorage.getItem(`copilot.role.${user.id}`)
      if (userScopedRole === 'admin' || userScopedRole === 'agent' || userScopedRole === 'manager' || userScopedRole === 'customer') {
        return userScopedRole
      }
    } catch {
      // Ignore
    }
  }

  // 3. Check known staff and customer email patterns
  const email = (user.email || '').toLowerCase().trim()
  if (email.includes('customer') || email.startsWith('client')) return 'customer'
  if (email.startsWith('admin') || email.includes('+admin') || email.includes('admin@')) return 'admin'
  if (email.startsWith('manager') || email.includes('+manager') || email.includes('manager@')) return 'manager'
  if (email.startsWith('agent') || email.includes('+agent') || email.includes('agent@')) return 'agent'

  return 'customer'
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean

  // Actions
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: (redirectTo?: string) => Promise<void>
  register: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>
  setUserRole: (role: UserRole) => Promise<void>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<string>
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      set({ isLoading: true })

      // Get current session
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        if (getUserRole(session.user) === 'suspended') {
          await signOut()
          set({ user: null, isAuthenticated: false, isLoading: false })
          return
        }

        set({
          user: session.user,
          isAuthenticated: true,
          isLoading: false
        })
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false
        })
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          if (getUserRole(session.user) === 'suspended') {
            await signOut()
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }
          set({
            user: session.user,
            isAuthenticated: true,
            isLoading: false
          })
        } else {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          })
        }
      })
    } catch (error) {
      console.error('Auth initialization failed:', error)
      set({ isLoading: false })
    }
  },

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true })
      const { user } = await signIn(email, password)
      if (user && getUserRole(user) === 'suspended') {
        await signOut()
        set({ user: null, isAuthenticated: false, isLoading: false })
        throw new Error('Your account has been suspended by an administrator.')
      }
      set({
        user: user || null,
        isAuthenticated: !!user,
        isLoading: false
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  loginWithGoogle: async (redirectTo?: string) => {
    try {
      set({ isLoading: true })
      await signInWithGoogle(redirectTo)
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (email: string, password: string, metadata?: Record<string, unknown>) => {
    try {
      set({ isLoading: true })
      const data = await signUp(email, password, metadata)
      const user = data?.user
      const session = data?.session
      
      set({
        user: user || null,
        isAuthenticated: !!session,
        isLoading: false
      })
      
      if (!session) {
        throw new Error('Verification email sent! Please confirm your email address before logging in.')
      }
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  setUserRole: async (role: UserRole) => {
    const user = get().user
    if (!user || !user.email) return

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`copilot.role.${user.id}`, role)
        localStorage.setItem('copilot.user.role', role)
      }

      // Sync with backend service role
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/auth/set-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, role })
      })

      // Refresh session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({ user: session.user })
      }
    } catch (err) {
      console.error('Failed to set user role:', err)
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true })
      if (typeof window !== 'undefined') {
        localStorage.removeItem('copilot.user.role')
      }
      await signOut()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  requestPasswordReset: async (email: string): Promise<string> => {
    try {
      set({ isLoading: true })
      const message = await resetPasswordForEmail(email)
      set({ isLoading: false })
      return message
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  setUser: (user: User | null) => {
    set({
      user,
      isAuthenticated: !!user
    })
  },
}))

// Helper hooks
export const useAuth = () => useAuthStore()
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
