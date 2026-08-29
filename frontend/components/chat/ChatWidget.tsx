/**
 * ChatWidget Component
 * T063: Main chat widget container with active ticket tracking banner in Modern Light Theme
 */
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
  conversationId: string
}

export function ChatWidget({ conversationId }: ChatWidgetProps) {
  const { messages, isTyping, typingAgent, connectionStatus, connectionError, handoff, sendMessage, reconnect, requestHandoff } =
    useChat(conversationId)
  const [associatedTicket, setAssociatedTicket] = useState<Ticket | null>(null)
  const ticketCheckPending = useRef(false)

  // Check for an associated ticket when the conversation opens, and again
  // after an escalation-worthy AI reply arrives — not on every message.
  const lastAiMessageId = messages.filter((m) => m.sender_type === 'ai').at(-1)?.id

  useEffect(() => {
    if (!conversationId || ticketCheckPending.current) return
    if (associatedTicket) return

    ticketCheckPending.current = true
    api.tickets
      .getTickets({ conversation_id: conversationId, limit: 1 })
      .then((res) => {
        setAssociatedTicket(res.data?.[0] ?? null)
      })
      .catch((err) => {
        console.error('Error checking ticket for conversation:', err)
      })
      .finally(() => {
        ticketCheckPending.current = false
      })
  }, [conversationId, lastAiMessageId, associatedTicket])

  return (
    <div className="flex h-full flex-col bg-[#fbfbfa] bg-dot-grid relative">
      {/* Background Glow Blobs in Chat */}
      <div className="absolute top-[20%] left-[-10%] w-[45%] h-[35%] rounded-full glow-blob-indigo pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[35%] rounded-full glow-blob-rose pointer-events-none" />

      {/* Connection status */}
      {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && (
        <div
          role="status"
          className="relative z-20 bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 text-center text-xs font-extrabold text-amber-800 animate-pulse"
        >
          ⚡ {connectionStatus === 'connecting' ? 'Connecting' : 'Reconnecting'} to the AI support stream...
        </div>
      )}
      {connectionStatus === 'failed' && (
        <div
          role="alert"
          className="relative z-20 bg-rose-50 border-b border-rose-200/80 px-4 py-2.5 text-center text-xs font-extrabold text-rose-700 flex items-center justify-center gap-3"
        >
          <span>{connectionError || 'Connection to the chat server was lost.'}</span>
          <button
            onClick={reconnect}
            className="rounded-lg bg-rose-600 px-3 py-1 text-white hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Associated Ticket Banner */}
      {associatedTicket && (
        <div className="relative z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-5 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100 shadow-inner">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                Support Case Assigned: <span className="text-purple-600 font-mono font-black">{associatedTicket.ticket_number}</span>
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                Status: <span className="font-extrabold text-indigo-600">{associatedTicket.status.replace('_', ' ')}</span> &bull; Priority: <span className="font-extrabold text-rose-600">{associatedTicket.priority}</span>
              </p>
            </div>
          </div>
          <Link
            href={`/tickets?id=${associatedTicket.id}`}
            className="rounded-xl bg-slate-900 hover:bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:scale-[1.02] transition-all cursor-pointer"
          >
            Check Status
          </Link>
        </div>
      )}

      {/* Handoff Status Banner */}
      {handoff.active && handoff.status && (
        <HandoffBanner
          status={handoff.status}
          reason={handoff.reason || undefined}
          agentName={handoff.assigned_agent}
          priority={handoff.priority || undefined}
          waitTime={handoff.wait_time || undefined}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
        <MessageList
          messages={messages}
          isTyping={isTyping}
          typingAgent={typingAgent}
          onSelectPrompt={sendMessage}
        />
      </div>

      {/* Message Input Footer */}
      <div className="p-4 sm:p-6 relative z-20">
        <div className="flex items-center gap-3 mb-3">
          <TalkToHuman
            onRequestHandoff={requestHandoff}
            isHandoffActive={handoff.active}
            handoffStatus={handoff.status}
            assignedAgent={handoff.assigned_agent}
          />
          {handoff.active && handoff.status && (
            <span className="text-[10px] font-semibold text-slate-400">
              A human agent will assist you shortly
            </span>
          )}
        </div>
        <MessageInput
          onSend={sendMessage}
          disabled={handoff.status === 'waiting' || handoff.status === 'assigned'}
        />
      </div>
    </div>
  )
}
