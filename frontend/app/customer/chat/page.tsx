"use client"

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useChat } from '@/hooks/useChat'
import { useChatStore } from '@/stores/chatStore'
import { useAuth } from '@/stores/authStore'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function ChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const { loadConversation } = useChat()
  const activeConvParam = searchParams.get('conversation')
  const isNewParam = searchParams.get('new')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push('/login?redirect=/customer/chat')
      return
    }

    const initChat = async () => {
      try {
        setSetupError(null)

        // Explicit new chat request: start in clean draft state
        if (isNewParam) {
          useChatStore.getState().reset()
          setConversationId(null)
          setIsInitializing(false)
          return
        }

        // Requested specific conversation
        if (activeConvParam) {
          if (activeConvParam !== conversationId) {
            try {
              await loadConversation(activeConvParam)
              setConversationId(activeConvParam)
            } catch (loadErr) {
              console.warn('Failed to load requested conversation, starting draft:', loadErr)
              setConversationId(null)
            }
          }
          setIsInitializing(false)
          return
        }

        // No conversation specified in URL: check if user has existing conversations with messages
        try {
          const { api } = await import('@/lib/api')
          const existing = await api.chat.getConversations()
          if (existing && existing.length > 0) {
            const latest = existing[0]
            await loadConversation(latest.id)
            setConversationId(latest.id)
          } else {
            // Clean draft session — will create in DB only when customer sends first message
            setConversationId(null)
          }
        } catch {
          setConversationId(null)
        }
      } catch (e) {
        console.error('Chat init error:', e)
        setSetupError(e instanceof Error ? e.message : 'Failed to initialize chat session')
      } finally {
        setIsInitializing(false)
      }
    }

    void initChat()
  }, [authLoading, isAuthenticated, activeConvParam, isNewParam, loadConversation, router])

  if (setupError) {
    return (
      <div className="flex h-full min-h-[calc(100vh-4rem)] flex-1 flex-col items-center justify-center gap-4 p-6 bg-slate-50/50">
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center max-w-md shadow-sm">
          <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            !
          </div>
          <p className="text-sm font-black text-rose-900">Chat Connection Notice</p>
          <p className="text-xs text-rose-600 mt-1 font-medium">{setupError}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer hover:bg-slate-800 transition-all"
          >
            Retry Connection
          </button>
          <button
            onClick={() => {
              setSetupError(null)
              setConversationId(null)
              router.replace('/customer/chat?new=1')
            }}
            className="rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-800 shadow-xs cursor-pointer hover:bg-slate-50 transition-all"
          >
            Start New Session
          </button>
        </div>
      </div>
    )
  }

  if (authLoading || isInitializing) {
    return (
      <div className="flex h-full min-h-[calc(100vh-4rem)] flex-1 items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-base shadow-md shadow-indigo-100 animate-pulse">
            C
          </div>
          <span className="text-xs font-semibold text-slate-400">Opening AI Support Copilot...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex-1 flex flex-col overflow-hidden bg-slate-50/50">
      <ErrorBoundary pageName="Support Chat">
        <ChatWidget
          key={conversationId || 'new-session'}
          conversationId={conversationId}
          onConversationCreated={(newId) => {
            setConversationId(newId)
            router.replace('/customer/chat?conversation=' + newId)
          }}
        />
      </ErrorBoundary>
    </div>
  )
}

export default function CustomerChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[calc(100vh-4rem)] flex-1 items-center justify-center bg-slate-50/50">
          <div className="text-xs font-semibold text-slate-400">Loading Support Copilot...</div>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  )
}
