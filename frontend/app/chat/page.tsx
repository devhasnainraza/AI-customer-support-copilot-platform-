/**
 * Chat Page
 * T067: Main chat interface page
 */
'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/stores/authStore'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function ChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  // No conversationId here: ChatWidget owns the WebSocket connection.
  // This instance only provides create/load actions.
  const { createConversation, loadConversation } = useChat()
  // Guards against the create → URL change → effect re-run → create loop
  // (and against React Strict Mode double-invoking the effect in dev).
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (authLoading) return

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login?redirect=/chat')
      return
    }

    if (bootstrapped.current) return
    bootstrapped.current = true

    const convId = searchParams.get('conversation')

    const startNewConversation = async () => {
      try {
        const conversation = await createConversation()
        setConversationId(conversation.id)
        router.replace(`/chat?conversation=${conversation.id}`)
      } catch (error) {
        console.error('Failed to create conversation:', error)
        setSetupError(
          error instanceof Error ? error.message : 'Failed to start a conversation. Please try again.'
        )
      }
    }

    if (convId) {
      loadConversation(convId)
        .then(() => setConversationId(convId))
        .catch((error) => {
          console.error('Failed to load conversation:', error)
          // Fall back to a fresh conversation exactly once — never loop.
          void startNewConversation()
        })
    } else {
      void startNewConversation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated])

  const handleRetry = () => {
    setSetupError(null)
    bootstrapped.current = false
    // Re-trigger the bootstrap effect by forcing a re-render via router refresh.
    router.replace('/chat')
    window.location.reload()
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  if (setupError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#fbfbfa] px-6 text-center">
        <p className="text-sm font-semibold text-slate-700">{setupError}</p>
        <button
          onClick={handleRetry}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-600 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!conversationId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-600">Starting chat...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[#fbfbfa]">
      {/* Navigation Header */}
      <header className="border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-rose-500 text-white font-extrabold text-xl shadow-md shadow-indigo-100">
                C
              </div>
              <div>
                <span className="font-display text-base font-bold tracking-tight text-slate-900">
                  Copilot Portal
                </span>
                <p className="text-[9px] text-indigo-600 font-extrabold tracking-widest uppercase">
                  AI Customer Support
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/chat"
              className="text-sm font-bold text-indigo-600 bg-indigo-50/50 border border-indigo-100/30 px-3.5 py-1.5 rounded-xl transition-all"
            >
              Support Chat
            </Link>
            <Link
              href="/tickets"
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100/50"
            >
              My Tickets
            </Link>

            <button
              onClick={() => void logout()}
              className="rounded-xl border border-rose-200/80 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ml-2"
              title="Sign Out"
            >
              <span>Sign Out</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <ErrorBoundary pageName="Support Chat">
          <ChatWidget conversationId={conversationId} />
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#fbfbfa]">
        <div className="text-gray-600 font-medium">Loading support chat...</div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
