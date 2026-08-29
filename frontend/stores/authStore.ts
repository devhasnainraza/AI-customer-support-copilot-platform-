/**
 * Auth Store with Zustand & Role-Based Access Control (RBAC)
 * T032: Authentication & Role Management
 */
import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase, signIn, signUp, signOut, resetPasswordForEmail } from '@/lib/supabase'

export type UserRole = 'admin' | 'agent' | 'manager' | 'customer'

export function getUserRole(user: User | null): UserRole {
  if (!user) return 'customer'
  const role = (user.app_metadata?.role || user.user_metadata?.role) as string | undefined
  if (role === 'admin' || role === 'agent' || role === 'manager') return role
  return 'customer'
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean

  // Actions
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      set({ isLoading: true })

      // Get current session
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
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
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
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

  logout: async () => {
    try {
      set({ isLoading: true })
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

  requestPasswordReset: async (email: string) => {
    try {
      set({ isLoading: true })
      await resetPasswordForEmail(email)
      set({ isLoading: false })
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
