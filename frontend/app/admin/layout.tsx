'use client'

import { ReactNode } from 'react'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AppShell } from '@/components/layout/AppShell'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <AppShell activeRole="admin">
        {children}
      </AppShell>
    </AdminGuard>
  )
}
