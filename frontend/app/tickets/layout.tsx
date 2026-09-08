'use client'

import { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'

export default function TicketsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      {children}
    </AppShell>
  )
}
