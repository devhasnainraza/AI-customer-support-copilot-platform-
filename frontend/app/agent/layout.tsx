'use client'

import { ReactNode } from 'react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AppShell } from '@/components/layout/AppShell'

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['agent', 'manager', 'admin']}>
      <AppShell activeRole="agent" fullBleed>
        {children}
      </AppShell>
    </RoleGuard>
  )
}
