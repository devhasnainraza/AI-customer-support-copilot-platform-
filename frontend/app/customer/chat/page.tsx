"use client"

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/stores/authStore'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { NotificationBell } from '@/components/notifications/NotificationBell'

function ChatContent() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const { createConversation, loadConversation } = useChat()
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { router.push('/login?redirect=/customer/chat'); return }
    if (bootstrapped.current) return
    bootstrapped.current = true
    const urlParams = new URLSearchParams(window.location.search)
    const convId = urlParams.get('conversation')
    const startNew = async () => {
      try {
        const c = await createConversation()
        setConversationId(c.id)
        router.replace('/customer/chat?conversation=' + c.id)
      } catch (e) { setSetupError(e instanceof Error ? e.message : 'Failed') }
    }
    if (convId) { loadConversation(convId).then(() => setConversationId(convId)).catch(() => void startNew()) }
    else void startNew()
  }, [authLoading, isAuthenticated])

  if (authLoading || !conversationId) return <div className="flex h-screen items-center justify-center"><div className="text-gray-600">Loading chat...</div></div>
  if (setupError) return <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#fbfbfa]"><p className="text-sm font-semibold text-slate-700">{setupError}</p><button onClick={() => window.location.reload()} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Try again</button></div>

  return (
    <div className="flex h-screen flex-col bg-[#fbfbfa]">
      <header className="border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between w-full">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-rose-500 text-white font-extrabold text-xl shadow-md">C</div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-slate-900">Copilot Portal</span>
              <p className="text-[9px] text-indigo-600 font-extrabold tracking-widest uppercase">Customer Support</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/customer/chat" className="text-sm font-bold text-indigo-600 bg-indigo-50/50 px-3.5 py-1.5 rounded-xl">Support Chat</Link>
            <Link href="/customer/tickets" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-slate-100/50">My Tickets</Link>
            <NotificationBell />
            <button onClick={() => void logout()} className="rounded-xl border border-rose-200/80 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 flex items-center gap-1.5 cursor-pointer ml-2">Sign Out</button>
          </nav>
        </div>
      </header>
      <main className="flex-1 overflow-hidden relative">
        <ErrorBoundary pageName="Support Chat"><ChatWidget conversationId={conversationId} /></ErrorBoundary>
      </main>
    </div>
  )
}

export default function CustomerChatPage() {
  return (
    <RoleGuard allowedRoles={["customer"]}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="text-gray-600">Loading...</div></div>}>
        <ChatContent />
      </Suspense>
    </RoleGuard>
  )
}
