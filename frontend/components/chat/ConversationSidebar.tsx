"use client"

import { useEffect, useState, useCallback } from 'react'
import { api, getAuthToken } from '@/lib/api'
import { Conversation } from '@/stores/chatStore'

interface ConversationWithPreview extends Conversation {
  lastMessage?: string
  lastMessageTime?: string
  messageCount?: number
}

interface ConversationSidebarProps {
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isCollapsed,
  onToggleCollapse,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchConversations = useCallback(async () => {
    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_BASE}/v1/chat/conversations?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data: Conversation[] = await res.json()

      // Enrich with last messages in background (non-blocking) and filter empty
      const token2 = await getAuthToken()
      const enriched: ConversationWithPreview[] = []

      for (const conv of data.slice(0, 30)) {
        try {
          const msgRes = await fetch(
            `${API_BASE}/v1/chat/conversations/${conv.id}/messages?limit=2`,
            { headers: { Authorization: `Bearer ${token2}` } }
          )
          if (!msgRes.ok) continue
          const msgs = await msgRes.json()
          // Only show conversations that have actual messages or are currently active
          if (msgs.length > 0 || conv.id === currentConversationId) {
            const lastUserMsg = [...msgs].reverse().find((m: any) => m.sender_type === 'customer')
            const lastAiMsg = [...msgs].reverse().find((m: any) => m.sender_type === 'ai')
            const lastMsg = lastAiMsg || lastUserMsg
            enriched.push({
              ...conv,
              lastMessage: lastMsg?.content?.slice(0, 80) || (conv.id === currentConversationId ? 'New session' : 'Empty conversation'),
              lastMessageTime: lastMsg?.timestamp || conv.started_at,
              messageCount: msgs.length,
            })
          }
        } catch {
          // If message fetch fails, still show if active
          if (conv.id === currentConversationId) {
            enriched.push({ ...conv, lastMessage: 'Current session', lastMessageTime: conv.started_at, messageCount: 0 })
          }
        }
      }
      setConversations(enriched)
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentConversationId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const filtered = conversations.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.lastMessage?.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    )
  })

  const formatTime = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'now'
    if (diffMin < 60) return `${diffMin}m`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d`
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-400'
      case 'escalated': return 'bg-amber-400'
      case 'closed': return 'bg-slate-300'
      default: return 'bg-slate-200'
    }
  }

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 gap-4 border-r border-slate-200/80 bg-white/60 backdrop-blur-xl w-16 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all cursor-pointer"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
        <button
          onClick={() => { onNewConversation(); }}
          className="w-10 h-10 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-500 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer"
          title="New conversation"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-1 mt-2">
          {filtered.slice(0, 8).map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectConversation(c.id)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                c.id === currentConversationId
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white/80 text-slate-500 hover:bg-indigo-50'
              }`}
              title={c.lastMessage || c.id.slice(0, 8)}
            >
              {formatTime(c.lastMessageTime || c.started_at)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-72 shrink-0 border-r border-slate-200/80 bg-white/60 backdrop-blur-xl h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Chat History</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { onNewConversation(); }}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all cursor-pointer text-sm"
              title="New conversation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg bg-white/80 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all cursor-pointer text-sm border border-slate-200/60"
              title="Collapse sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/80 border border-slate-200/80 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-slate-700 placeholder-slate-400"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mb-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-slate-600">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer group ${
                  c.id === currentConversationId
                    ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-200/80 shadow-sm'
                    : 'hover:bg-white/80 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor(c.status)}`} />
                    <span className="text-xs font-bold text-slate-700 truncate">
                      {c.id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatTime(c.lastMessageTime || c.started_at)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {c.lastMessage || 'Empty conversation'}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    c.status === 'active' ? 'text-emerald-600' :
                    c.status === 'escalated' ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    {c.status}
                  </span>
                  {c.messageCount != null && c.messageCount > 0 && (
                    <span className="text-[9px] text-slate-400">
                      {c.messageCount} msgs
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/40">
        <div className="text-[10px] text-slate-400 text-center">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
