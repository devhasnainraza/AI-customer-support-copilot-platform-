'use client'

import { ReactNode } from 'react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AppShell } from '@/components/layout/AppShell'

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'agent']}>
      <AppShell>
        {children}
      </AppShell>
    </RoleGuard>
  )
}
