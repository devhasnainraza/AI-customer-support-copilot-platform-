'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { TalkToHuman } from './TalkToHuman'
import { HandoffBanner } from './HandoffBanner'
import { useChat } from '@/hooks/useChat'
import { api, Ticket } from '@/lib/api'

interface ChatWidgetProps {
  conversationId?: string | null
  onConversationCreated?: (id: string) => void
}

export function ChatWidget({ conversationId, onConversationCreated }: ChatWidgetProps) {
  const {
    messages,
    isTyping,
    typingAgent,
    connectionStatus,
    connectionError,
    handoff,
    sendMessage,
    reconnect,
    requestHandoff,
    cancelHandoff,
    resolveHandoff,
    fastAssignAgent,
  } = useChat(conversationId || undefined)

  const [associatedTicket, setAssociatedTicket] = useState<Ticket | null>(null)
  const ticketCheckPending = useRef(false)
  const lastAiMessageId = messages.filter((m) => m.sender_type === 'ai').at(-1)?.id

  useEffect(() => {
    if (!conversationId || ticketCheckPending.current || associatedTicket) return
    ticketCheckPending.current = true
    api.tickets
      .getTickets({ conversation_id: conversationId, limit: 1 })
      .then((res) => {
        setAssociatedTicket(res.data?.[0] ?? null)
      })
      .catch(() => {})
      .finally(() => {
        ticketCheckPending.current = false
      })
  }, [conversationId, lastAiMessageId, associatedTicket])

  const handleSendMessage = async (content: string) => {
    const createdId = await sendMessage(content)
    if (createdId && onConversationCreated && createdId !== conversationId) {
      onConversationCreated(createdId)
    }
  }

  const handleRequestHandoff = async (reason: string, priority: string) => {
    const createdId = await requestHandoff(reason, priority)
    if (createdId && onConversationCreated && createdId !== conversationId) {
      onConversationCreated(createdId)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#f8fafc] relative">
      {/* ── Top Chat Header ── */}
      <div className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
            AI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                AI Support Copilot
              </h2>
              <span className={`flex h-2 w-2 rounded-full ${
                handoff.active
                  ? handoff.status === 'in_progress'
                    ? 'bg-emerald-500 radar-live'
                    : 'bg-amber-500 animate-ping'
                  : 'bg-emerald-500 radar-live'
              }`} />
            </div>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {handoff.active && handoff.status === 'in_progress'
                ? `Live Agent: ${handoff.assigned_agent || 'Assigned'}`
                : conversationId
                ? `Session #${conversationId.slice(0, 8)} • Grounded RAG`
                : 'New Session • Grounded RAG'}
            </p>
          </div>
        </div>

        {/* Right Header Actions: Ticket link + Talk To Human Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {associatedTicket && (
            <Link
              href={'/tickets?id=' + associatedTicket.id}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 text-xs font-bold transition-all shadow-2xs"
            >
              <span>Ticket #{associatedTicket.ticket_number}</span>
            </Link>
          )}

          {/* Talk To Human Trigger & Active Status */}
          <TalkToHuman
            onRequestHandoff={handleRequestHandoff}
            onCancelHandoff={cancelHandoff}
            onFastConnect={() => fastAssignAgent()}
            isHandoffActive={handoff.active}
            handoffStatus={handoff.status}
            assignedAgent={handoff.assigned_agent}
          />
        </div>
      </div>

      {/* Connection Failure Error Banner (Only shown if disconnected after retries) */}
      {connectionStatus === 'failed' && (
        <div
          role="alert"
          className="relative z-20 bg-rose-50 border-b border-rose-200 px-4 py-2 text-center text-xs font-bold text-rose-700 flex items-center justify-center gap-3"
        >
          <span>{connectionError || 'Session reconnecting...'}</span>
          <button
            onClick={reconnect}
            className="rounded-lg bg-rose-600 px-3 py-1 text-white hover:bg-rose-700 transition text-xs font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Handoff Banner (if active) */}
      {handoff.active && handoff.status && (
        <HandoffBanner
          status={handoff.status}
          reason={handoff.reason || undefined}
          agentName={handoff.assigned_agent}
          priority={handoff.priority || undefined}
          waitTime={handoff.wait_time || undefined}
          onCancel={cancelHandoff}
          onResolve={resolveHandoff}
          onFastConnect={() => fastAssignAgent()}
        />
      )}

      {/* Message History Stream */}
      <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
        <MessageList
          messages={messages}
          isTyping={isTyping}
          typingAgent={typingAgent}
          onSelectPrompt={handleSendMessage}
        />
      </div>

      {/* Clean Bottom Input Area */}
      <div className="p-3 sm:p-4 relative z-20 border-t border-slate-200/60 bg-white/70 backdrop-blur-md">
        <MessageInput
          onSend={handleSendMessage}
          disabled={false}
          placeholder={
            handoff.active && handoff.status === 'in_progress'
              ? `Message ${handoff.assigned_agent || 'Support Specialist'}... (Enter to send)`
              : handoff.active && handoff.status === 'waiting'
              ? 'Add context or details for the incoming specialist...'
              : 'Ask AI Copilot anything... (Enter to send, Shift+Enter for new line)'
          }
        />
      </div>
    </div>
  )
}
