/**
 * Providers Component
 * Wraps the application with React Query and initializes auth
 */
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useEffect, useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session (never shared across SSR requests).
  const [queryClient] = useState(makeQueryClient)
  const initialize = useAuthStore((state) => state.initialize)

  // Initialize auth on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
