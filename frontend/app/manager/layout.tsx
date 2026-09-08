'use client'

import { ReactNode } from 'react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AppShell } from '@/components/layout/AppShell'

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['manager', 'admin']}>
      <AppShell activeRole="manager">
        {children}
      </AppShell>
    </RoleGuard>
  )
}
