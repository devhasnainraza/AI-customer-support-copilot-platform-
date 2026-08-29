"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, getUserRole } from '@/stores/authStore'

type UserRole = 'admin' | 'agent' | 'manager' | 'customer'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
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
    if (!allowedRoles.includes(role)) {
      // Redirect to role-appropriate page
      if (role === 'admin') router.push('/admin')
      else if (role === 'manager') router.push('/manager')
      else if (role === 'agent') router.push('/agent')
      else router.push('/customer/chat')
    }
  }, [isLoading, isAuthenticated, role, allowedRoles, redirectTo, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbfbfa]">
        <div className="text-sm font-semibold text-slate-500">Checking access...</div>
      </div>
    )
  }

  if (!isAuthenticated || !allowedRoles.includes(role)) {
    return null
  }

  return <>{children}</>
}
