"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, getUserRole } from '@/stores/authStore'

type UserRole = 'admin' | 'agent' | 'manager' | 'customer' | 'suspended'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: ('admin' | 'agent' | 'manager' | 'customer')[]
  redirectTo?: string
}

export function RoleGuard({ children, allowedRoles, redirectTo = '/login' }: RoleGuardProps) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const role = getUserRole(user)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push(redirectTo)
      return
    }
    if (role === 'suspended') {
      import('@/lib/supabase').then(({ signOut }) => {
        void signOut()
      })
      router.replace('/login?error=account_suspended')
      return
    }
    if (!allowedRoles.includes(role as any)) {
      // Redirect to role-appropriate page
      if (role === 'admin') router.push('/admin')
      else if (role === 'manager') router.push('/manager')
      else if (role === 'agent') router.push('/agent')
      else router.push('/customer/chat')
    }
  }, [isLoading, isAuthenticated, role, allowedRoles, redirectTo, router])

  if (isLoading || !isAuthenticated || !allowedRoles.includes(role as any)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbfbfa]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <div className="text-xs font-bold text-slate-500">
            {isLoading ? 'Checking permissions...' : 'Redirecting to your authorized workspace...'}
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
