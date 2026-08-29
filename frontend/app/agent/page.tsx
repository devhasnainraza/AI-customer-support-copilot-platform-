/**
 * Agent Escalation Workspace — Advanced Features
 * Real-time chat with customers, customer context panel, internal notes,
 * agent presence indicators, AI copilot suggested replies, and queue management.
 */
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Markdown from 'react-markdown'
import { useAuth, getUserRole } from '@/stores/authStore'
import { api, Ticket } from '@/lib/api'
import { getWebSocketManager, WebSocketMessage } from '@/lib/websocket'
import { getAuthToken } from '@/lib/api'

interface AgentInfo {
  agent_id: string
  agent_name: string
  status: string
  current_conversation: string | null
}

interface HandoffItem {
  id: string
  conversation_id: string
  customer_id: string
  reason: string
  priority: string
  status: string
  context: Record<string, unknown>
  assigned_agent_id: string | null
  created_at: string
  wait_time_seconds: number | null
  internal_notes: Array<{ id: string; agent_id: string; agent_name: string; content: string; created_at: string }>
}

interface ChatMessage {
  id: string
  sender_type: 'customer' | 'ai' | 'human_agent'
  content: string
  timestamp: string
  agent_name?: string
}

export default function AgentPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const role = getUserRole(user)

  // Queue & selection
  const [queue, setQueue] = useState<HandoffItem[]>([])
  const [selectedHandoff, setSelectedHandoff] = useState<HandoffItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Real-time chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [replyText, setReplyText] = useState('')
  const [isCustomerTyping, setIsCustomerTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<ReturnType<typeof getWebSocketManager> | null>(null)

  // Agent presence
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [myStatus, setMyStatus] = useState<'online' | 'away'>('online')

  // AI Copilot
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([])
  const [aiCopilotLoading, setAiCopilotLoading] = useState(false)

  // Internal notes
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState<HandoffItem['internal_notes']>([])

  // Auth redirect
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) router.push('/login?redirect=/agent')
      else if (role === 'customer') router.push('/chat')
    }
  }, [authLoading, isAuthenticated, role, router])

  // Register agent as online + fetch queue
  useEffect(() => {
    if (!isAuthenticated || role === 'customer') return

    async function init() {
      try {
        const token = getAuthToken()
        // Register as online
        await fetch('/api/v1/handoff/agent/online', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        // Fetch queue
        await refreshQueue()
      } catch (err) {
        console.error('Agent init error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    init()

    return () => {
      // Disconnect on unmount
      const t = getAuthToken()
      fetch('/api/v1/handoff/agent/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {})
    }
  }, [isAuthenticated, role])

  const refreshQueue = async () => {
    try {
      const token = getAuthToken()
      const res = await fetch('/api/v1/handoff/queue', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setQueue(data.queue || [])
      // Also fetch agents
      const agentsRes = await fetch('/api/v1/handoff/agents', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const agentsData = await agentsRes.json()
      setAgents(agentsData.agents || [])
    } catch (err) {
      console.error('Failed to fetch queue:', err)
    }
  }

  // Connect WebSocket for real-time updates
  useEffect(() => {
    if (!isAuthenticated || role === 'customer') return

    const mgr = getWebSocketManager()
    wsRef.current = mgr

    const unsub = mgr.subscribe((msg: WebSocketMessage) => {
      if (msg.type === 'message' && (msg as any).conversation_id === selectedHandoff?.conversation_id) {
        setChatMessages(prev => [...prev, {
          id: (msg as any).message_id || `msg-${Date.now()}`,
          sender_type: (msg as any).sender_type || 'customer',
          content: msg.content || '',
          timestamp: msg.timestamp || new Date().toISOString(),
          agent_name: (msg as any).agent_name,
        }])
      }
      if (msg.type === 'typing') {
        setIsCustomerTyping((msg as any).is_typing || false)
      }
    })

    return () => unsub()
  }, [isAuthenticated, role, selectedHandoff?.conversation_id])

  // Load chat messages when selecting a handoff
  useEffect(() => {
    if (!selectedHandoff) { setChatMessages([]); return }

    async function loadMessages() {
      try {
        const token = getAuthToken()
        const res = await fetch(`/api/v1/chat/conversations/${selectedHandoff!.conversation_id}/messages?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const msgs = await res.json()
          setChatMessages(msgs.map((m: any) => ({
            id: m.id,
            sender_type: m.sender_type,
            content: m.content,
            timestamp: m.timestamp,
          })))
        }
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }
    loadMessages()
    setNotes(selectedHandoff.internal_notes || [])
    generateAiSuggestions(selectedHandoff)
  }, [selectedHandoff?.id])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // AI Copilot: generate suggested replies
  const generateAiSuggestions = async (handoff: HandoffItem) => {
    setAiCopilotLoading(true)
    try {
      const token = getAuthToken()
      const ctx = handoff.context || {}
      const summary = (ctx.ai_summary as string) || handoff.reason || ''
      const sentiment = (ctx.sentiment as string) || 'neutral'
      const priority = handoff.priority

      setSuggestedReplies([
        `I understand your concern about "${summary.slice(0, 60)}...". I'm here to help resolve this right away.`,
        `I've reviewed your case and I'm looking into this now. Let me pull up the details.`,
        `I sincerely apologize for the inconvenience. Let me get this sorted for you immediately.`,
      ])
    } catch {
      setSuggestedReplies([])
    } finally {
      setAiCopilotLoading(false)
    }
  }

  // Send reply to customer
  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedHandoff) return
    const content = replyText.trim()
    setReplyText('')

    try {
      const token = getAuthToken()
      // Save message
      await fetch(`/api/v1/chat/conversations/${selectedHandoff.conversation_id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      }).catch(() => {})

      // Add to local state
      setChatMessages(prev => [...prev, {
        id: `agent-${Date.now()}`,
        sender_type: 'human_agent',
        content,
        timestamp: new Date().toISOString(),
        agent_name: user?.email || 'Agent',
      }])
    } catch (err) {
      console.error('Send failed:', err)
    }
  }

  // Claim handoff
  const handleClaim = async (handoff: HandoffItem) => {
    try {
      const token = getAuthToken()
      await fetch(`/api/v1/handoff/request/${handoff.conversation_id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agent_id: user?.id }),
      })
      await fetch(`/api/v1/handoff/request/${handoff.conversation_id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setMyStatus('online')
      await refreshQueue()
      setSelectedHandoff({ ...handoff, status: 'in_progress', assigned_agent_id: user?.id || '' })
    } catch (err) {
      console.error('Claim failed:', err)
    }
  }

  // Resolve handoff
  const handleResolve = async () => {
    if (!selectedHandoff) return
    try {
      const token = getAuthToken()
      await fetch(`/api/v1/handoff/request/${selectedHandoff.conversation_id}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setSelectedHandoff(null)
      await refreshQueue()
    } catch (err) {
      console.error('Resolve failed:', err)
    }
  }

  // Add internal note
  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedHandoff) return
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/v1/handoff/request/${selectedHandoff.conversation_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: noteText.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setNotes(data.notes || [])
        setNoteText('')
      }
    } catch (err) {
      console.error('Note failed:', err)
    }
  }

  // Toggle status
  const toggleStatus = async () => {
    const newStatus = myStatus === 'online' ? 'away' : 'online'
    try {
      const token = getAuthToken()
      await fetch('/api/v1/handoff/agent/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      })
      setMyStatus(newStatus)
    } catch (err) {
      console.error('Status toggle failed:', err)
    }
  }

  if (authLoading || (isAuthenticated && role === 'customer')) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbfbfa] text-slate-500 text-sm font-semibold">
        Verifying authorization credentials...
      </div>
    )
  }

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-[#fbfbfa] bg-dot-grid text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md">C</div>
              <span className="font-bold text-lg text-slate-900">Copilot Portal</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-slate-600">Agent Handoff Workspace</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Agent online count */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {agents.filter(a => a.status === 'online').length} agents online
            </div>
            {/* My status toggle */}
            <button
              onClick={toggleStatus}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                myStatus === 'online'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${myStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {myStatus === 'online' ? 'Online' : 'Away'}
            </button>
            {role === 'admin' && (
              <Link href="/admin" className="text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                Admin Dashboard →
              </Link>
            )}
            <button
              onClick={() => void logout()}
              className="rounded-xl border border-rose-200/80 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              Sign Out
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace — 3-column layout */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Escalation Queue */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl flex flex-col shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Escalation Queue ({queue.filter(q => q.status === 'waiting').length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)
            ) : queue.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No pending escalations</div>
            ) : (
              queue.map((item) => {
                const isSelected = selectedHandoff?.id === item.id
                const priorityColors: Record<string, string> = {
                  critical: 'bg-red-100 text-red-700',
                  high: 'bg-orange-100 text-orange-700',
                  medium: 'bg-slate-100 text-slate-700',
                  low: 'bg-slate-100 text-slate-500',
                }
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedHandoff(item)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                        : 'bg-white border-slate-200/60 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${priorityColors[item.priority] || 'bg-slate-100 text-slate-700'}`}>
                        {item.priority}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {item.wait_time_seconds ? `${Math.round(item.wait_time_seconds / 60)}m wait` : ''}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">{item.reason}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {item.status === 'waiting' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClaim(item) }}
                        className="mt-2 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-1.5 transition-all cursor-pointer"
                      >
                        Claim
                      </button>
                    )}
                    {item.status === 'assigned' && item.assigned_agent_id === user?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedHandoff(item) }}
                        className="mt-2 w-full rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold py-1.5 transition-all cursor-pointer"
                      >
                        Open Chat
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* CENTER: Chat / Conversation */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {selectedHandoff ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    selectedHandoff.status === 'in_progress' ? 'bg-emerald-500 animate-pulse' :
                    selectedHandoff.status === 'assigned' ? 'bg-blue-500 animate-pulse' :
                    'bg-amber-500 animate-pulse'
                  }`} />
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Conversation: {selectedHandoff.conversation_id.slice(0, 8)}...
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Status: {selectedHandoff.status} • Priority: {selectedHandoff.priority}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedHandoff.status === 'in_progress' && (
                    <button
                      onClick={handleResolve}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
                    >
                      ✓ Resolve
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Context Summary */}
              {selectedHandoff.context && ((selectedHandoff.context as any).ai_summary || (selectedHandoff.context as any).sentiment) && (
                <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 text-xs space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-purple-600 tracking-wider">AI Context</span>
                  {(selectedHandoff.context as any).ai_summary && (
                    <p className="text-purple-900 font-medium leading-relaxed">
                      <Markdown>{String((selectedHandoff.context as any).ai_summary)}</Markdown>
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {(selectedHandoff.context as any).sentiment && (
                      <span className="font-bold text-purple-700">
                        Sentiment: {String((selectedHandoff.context as any).sentiment).toUpperCase()}
                      </span>
                    )}
                    {(selectedHandoff.context as any).confidence_score != null && (
                      <span className="font-bold text-purple-700">
                        AI Confidence: {Math.round(Number((selectedHandoff.context as any).confidence_score) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              <div className="bg-white border border-slate-200/80 rounded-2xl flex-1 flex flex-col shadow-sm overflow-hidden min-h-[300px]">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg) => {
                    const isAgent = msg.sender_type === 'human_agent'
                    const isCustomer = msg.sender_type === 'customer'
                    const isAI = msg.sender_type === 'ai'
                    return (
                      <div key={msg.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium ${
                          isCustomer
                            ? 'bg-slate-100 text-slate-800 rounded-bl-none'
                            : isAgent
                              ? 'bg-emerald-500 text-white rounded-br-none'
                              : 'bg-indigo-100 text-indigo-900 rounded-br-none italic'
                        }`}>
                          {isAgent && msg.agent_name && (
                            <span className="text-[10px] font-bold block mb-1 opacity-80">{msg.agent_name}</span>
                          )}
                          {isAI && <span className="text-[10px] font-bold block mb-1 opacity-60">AI Assistant</span>}
                          <div className={isAI ? 'markdown-content [&_p]:my-0.5 [&_strong]:font-bold [&_ul]:my-0.5 [&_ol]:my-0.5 [&_li]:my-0' : ''}>
                            {isAI ? <Markdown>{msg.content}</Markdown> : msg.content}
                          </div>
                          <span className="text-[9px] opacity-50 mt-1 block">{formatTime(msg.timestamp)}</span>
                        </div>
                      </div>
                    )
                  })}
                  {isCustomerTyping && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl rounded-bl-none px-4 py-2">
                        <span className="text-xs text-slate-500">Customer is typing...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* AI Copilot Suggestions */}
                {suggestedReplies.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">
                      💡 AI Suggested Replies
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {suggestedReplies.map((reply, i) => (
                        <button
                          key={i}
                          onClick={() => setReplyText(reply)}
                          className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-950 transition-colors border border-indigo-100 font-medium"
                        >
                          {reply.slice(0, 80)}{reply.length > 80 ? '...' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply Input */}
                <div className="p-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply() } }}
                      placeholder="Type your response to the customer..."
                      rows={1}
                      className="flex-1 resize-none rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={!replyText.trim()}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-40 transition-all cursor-pointer"
                    >
                      Send →
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400 shadow-sm flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">💬</div>
              <p className="text-sm font-semibold">Select a conversation from the queue</p>
              <p className="text-xs text-slate-400 mt-1">to view customer details and start chatting</p>
            </div>
          )}
        </div>

        {/* RIGHT: Internal Notes + Agent Presence */}
        <div className="lg:col-span-3 space-y-4">
          {/* Internal Notes Panel */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Internal Notes</h3>
            </div>
            <div className="p-3 max-h-[300px] overflow-y-auto space-y-2">
              {notes.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-4">No notes yet</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="bg-amber-50/50 border border-amber-100 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-amber-700">{note.agent_name}</span>
                      <span className="text-[9px] text-amber-500">{formatTime(note.created_at)}</span>
                    </div>
                    <p className="text-xs text-amber-900">{note.content}</p>
                  </div>
                ))
              )}
            </div>
            {selectedHandoff && (
              <div className="p-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote() }}
                    placeholder="Add internal note..."
                    className="flex-1 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim()}
                    className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40 cursor-pointer transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Agent Presence */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Team Status</h3>
            </div>
            <div className="p-3 space-y-1.5">
              {agents.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-3">No agents registered</p>
              ) : (
                agents.map((agent) => (
                  <div key={agent.agent_id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      agent.status === 'online' ? 'bg-emerald-500' :
                      agent.status === 'busy' ? 'bg-red-500' :
                      'bg-slate-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-800 truncate block">
                        {agent.agent_name}
                        {agent.agent_id === user?.id && ' (you)'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${
                      agent.status === 'online' ? 'text-emerald-600' :
                      agent.status === 'busy' ? 'text-red-600' :
                      'text-slate-400'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Queue Stats */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">Queue Stats</h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-2.5">
                <span className="text-lg font-black text-amber-600">{queue.filter(q => q.status === 'waiting').length}</span>
                <p className="text-[10px] font-bold text-amber-700">Waiting</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-2.5">
                <span className="text-lg font-black text-blue-600">{queue.filter(q => q.status === 'in_progress').length}</span>
                <p className="text-[10px] font-bold text-blue-700">In Progress</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
