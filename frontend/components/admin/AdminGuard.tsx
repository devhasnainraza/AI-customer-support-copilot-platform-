/**
 * AdminGuard Component
 * Client-side guard for the admin section: requires an authenticated user with admin role.
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, getUserRole } from '@/stores/authStore'

const ALLOWED_ROLES = ['admin']

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const role = getUserRole(user)
  const isAllowed = isAuthenticated && ALLOWED_ROLES.includes(role)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace('/login?redirect=/admin')
    } else if (!isAllowed) {
      if (role === 'agent') router.replace('/agent')
      else if (role === 'manager') router.replace('/manager')
      else router.replace('/customer/chat')
    }
  }, [isLoading, isAuthenticated, isAllowed, role, router])

  if (isLoading || !isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfcfd]">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <span>Verifying admin credentials...</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
