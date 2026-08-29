/**
 * AdminGuard Component
 * Client-side guard for the admin section: requires an authenticated user
 * with an admin/manager role. (The API additionally enforces roles
 * server-side — this guard is UX, not the security boundary.)
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'

const ALLOWED_ROLES = ['admin', 'manager']

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const role = (user?.user_metadata?.role as string | undefined) ?? 'customer'
  const isAllowed = isAuthenticated && ALLOWED_ROLES.includes(role)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace('/login?redirect=/admin')
    } else if (!isAllowed) {
      router.replace('/chat')
    }
  }, [isLoading, isAuthenticated, isAllowed, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500">Checking access...</div>
      </div>
    )
  }

  if (!isAllowed) {
    return null // Redirecting
  }

  return <>{children}</>
}
