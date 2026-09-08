"use client"

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ChatRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const q = searchParams.toString()
    router.replace(`/customer/chat${q ? `?${q}` : ''}`)
  }, [router, searchParams])

  return (
    <div className="flex h-screen items-center justify-center bg-[#fbfbfa]">
      <div className="text-xs font-bold text-slate-500">Redirecting to Support Copilot...</div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <ChatRedirectContent />
    </Suspense>
  )
}
