'use client'

import { ReactNode } from 'react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AppShell } from '@/components/layout/AppShell'

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['customer']}>
      <AppShell activeRole="customer" fullBleed>
        {children}
      </AppShell>
    </RoleGuard>
  )
}
