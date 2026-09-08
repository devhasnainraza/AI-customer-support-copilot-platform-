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

  // Agent presence & responsive view mode
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [myStatus, setMyStatus] = useState<'online' | 'away'>('online')
  const [mobileTab, setMobileTab] = useState<'queue' | 'chat' | 'notes'>('chat')

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

    let heartbeatTimer: NodeJS.Timeout | null = null

    async function init() {
      try {
        const token = await getAuthToken()
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        // Register as online
        await fetch(`${API}/v1/handoff/agent/online`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token || ''}` },
        })
        // Fetch queue & agents
        await refreshQueue()
      } catch (err) {
        console.error('Agent init error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    init()

    // Send heartbeat every 25 seconds
    heartbeatTimer = setInterval(async () => {
      try {
        const token = await getAuthToken()
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        await fetch(`${API}/v1/handoff/agent/online`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token || ''}` },
        })
      } catch {}
    }, 25000)

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer)
    }
  }, [isAuthenticated, role])

  const refreshQueue = async () => {
    try {
      const token = await getAuthToken()
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API}/v1/handoff/queue`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (res.ok) {
        const data = await res.json()
        setQueue(data.queue || [])
      }
      // Also fetch agents
      const agentsRes = await fetch(`${API}/v1/handoff/agents`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json()
        setAgents(agentsData.agents || [])
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err)
    }
  }

  // Connect Agent WebSocket for real-time updates and notifications
  useEffect(() => {
    if (!isAuthenticated || role === 'customer') return

    let socket: WebSocket | null = null
    let pollTimer: NodeJS.Timeout | null = null
    let isMounted = true

    async function connectAgentWs() {
      try {
        const token = await getAuthToken()
        if (!token || !isMounted) return

        const wsBase = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
        const wsUrl = `${wsBase}/v1/handoff/ws/agent?token=${encodeURIComponent(token)}`

        socket = new WebSocket(wsUrl)

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'handoff_notification' || data.type === 'queue_updated') {
              refreshQueue()
              if (data.type === 'handoff_notification' && data.handoff?.status === 'resolved') {
                if (selectedHandoff?.conversation_id && (data.conversation_id === selectedHandoff.conversation_id || data.handoff?.conversation_id === selectedHandoff.conversation_id)) {
                  setSelectedHandoff(null)
                }
              }
              if (data.type === 'queue_updated' && data.resolved_conversation_id) {
                if (selectedHandoff?.conversation_id && data.resolved_conversation_id === selectedHandoff.conversation_id) {
                  setSelectedHandoff(null)
                }
              }
            }
            if (data.type === 'message') {
              const incomingConvId = data.conversation_id
              if (selectedHandoff?.conversation_id && incomingConvId === selectedHandoff.conversation_id) {
                setChatMessages((prev) => {
                  const msgId = data.message_id || data.id
                  if (prev.some((m) => m.id === msgId)) return prev

                  // Deduplicate incoming agent messages that match our optimistic message
                  const isAgentMsg = data.sender_type === 'human_agent' || data.sender === 'human_agent'
                  if (isAgentMsg) {
                    const optimisticIdx = prev.findIndex(
                      (m) =>
                        m.id.startsWith('agent-') &&
                        m.content.trim() === (data.content || '').trim()
                    )
                    if (optimisticIdx !== -1) {
                      return prev.map((m, idx) =>
                        idx === optimisticIdx
                          ? { ...m, id: msgId || m.id, timestamp: data.timestamp || m.timestamp }
                          : m
                      )
                    }
                  }

                  return [
                    ...prev,
                    {
                      id: msgId || `msg-${Date.now()}`,
                      sender_type: isAgentMsg ? 'human_agent' : (data.sender_type || (data.sender === 'customer' ? 'customer' : 'ai')),
                      content: data.content || '',
                      timestamp: data.timestamp || new Date().toISOString(),
                      agent_name: data.agent_name,
                    },
                  ]
                })
              } else {
                refreshQueue()
              }
            }
            if (data.type === 'typing' || data.type === 'agent_typing') {
              if (selectedHandoff?.conversation_id && data.conversation_id === selectedHandoff.conversation_id) {
                setIsCustomerTyping(data.is_typing || false)
              }
            }
          } catch (e) {
            console.error('Error parsing agent ws message:', e)
          }
        }

        socket.onerror = () => {}
      } catch (err) {
        console.error('Agent WS connect error:', err)
      }
    }

    connectAgentWs()

    // Background queue refresh polling every 6 seconds as a robust fallback
    pollTimer = setInterval(() => {
      refreshQueue()
    }, 6000)

    return () => {
      isMounted = false
      if (pollTimer) clearInterval(pollTimer)
      if (socket) {
        socket.close()
      }
    }
  }, [isAuthenticated, role, selectedHandoff?.conversation_id])

  // Load chat messages when selecting a handoff
  useEffect(() => {
    if (!selectedHandoff) {
      setChatMessages([])
      return
    }

    async function loadMessages() {
      try {
        const token = await getAuthToken()
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${API}/v1/chat/conversations/${selectedHandoff!.conversation_id}/messages?limit=100`, {
          headers: { Authorization: `Bearer ${token || ''}` },
        })
        if (res.ok) {
          const msgs = await res.json()
          setChatMessages(
            msgs.map((m: any) => ({
              id: m.id,
              sender_type: m.sender_type,
              content: m.content,
              timestamp: m.timestamp,
              agent_name: m.agent_name,
            }))
          )
        }
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }
    loadMessages()
    setNotes(selectedHandoff.internal_notes || [])
    generateAiSuggestions(selectedHandoff)
  }, [selectedHandoff?.conversation_id])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // AI Copilot: generate suggested replies
  const generateAiSuggestions = async (handoff: HandoffItem) => {
    setAiCopilotLoading(true)
    try {
      const ctx = handoff.context || {}
      const summary = (ctx.ai_summary as string) || handoff.reason || ''

      setSuggestedReplies([
        `I understand your request regarding "${summary.slice(0, 50)}...". I am here to help resolve this.`,
        `I've reviewed your conversation history and account details. Let me look into this right now.`,
        `Thank you for your patience. I have escalated this issue and am working on an immediate solution.`,
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

    const tempId = `agent-${Date.now()}`
    const agentName = user?.email || 'Support Specialist'

    // Optimistically add to local state
    setChatMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_type: 'human_agent',
        content,
        timestamp: new Date().toISOString(),
        agent_name: agentName,
      },
    ])

    try {
      const token = await getAuthToken()
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API}/v1/handoff/request/${selectedHandoff.conversation_id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ content, sender_type: 'human_agent' }),
      })
      if (res.ok) {
        const saved = await res.json()
        if (saved?.id) {
          setChatMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, id: saved.id, timestamp: saved.timestamp || m.timestamp } : m))
          )
        }
      }
    } catch (err) {
      console.error('Send reply failed:', err)
    }
  }

  // Claim handoff
  const handleClaim = async (handoff: HandoffItem) => {
    try {
      const token = await getAuthToken()
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      await fetch(`${API}/v1/handoff/request/${handoff.conversation_id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ agent_id: user?.id }),
      })
      setMyStatus('online')
      await refreshQueue()
      setSelectedHandoff({ ...handoff, status: 'in_progress', assigned_agent_id: user?.id || '' })
      setMobileTab('chat')
    } catch (err) {
      console.error('Claim failed:', err)
    }
  }

  // Resolve handoff
  const handleResolve = async () => {
    if (!selectedHandoff) return
    try {
      const token = await getAuthToken()
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      await fetch(`${API}/v1/handoff/request/${selectedHandoff.conversation_id}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
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
      const token = await getAuthToken()
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${API}/v1/handoff/request/${selectedHandoff.conversation_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
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
      const token = await getAuthToken()
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      await fetch(`${API}/v1/handoff/agent/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
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
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in p-4 sm:p-6">
      {/* Workspace Sub-Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-black tracking-tight text-slate-900">
              Escalation Command Center
            </h1>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              Live Workstation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time human-agent handoffs, AI suggested replies, sentiment analysis, and queue SLA monitor.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Agent online count */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 radar-live" />
            <span>{Math.max(myStatus === 'online' ? 1 : 0, agents.filter((a) => a.status === 'online').length)} agents online</span>
          </div>

          {/* My status toggle */}
          <button
            onClick={toggleStatus}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs ${
              myStatus === 'online'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${myStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>Status: {myStatus === 'online' ? 'Online' : 'Away'}</span>
          </button>
        </div>
      </div>

      {/* Responsive Mobile / Tablet Tab Switcher */}
      <div className="lg:hidden flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl mb-4 border border-slate-200 shrink-0">
        <button
          onClick={() => setMobileTab('queue')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'queue'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <span>Queue ({queue.filter((q) => q.status === 'waiting').length})</span>
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'chat'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Active Chat</span>
        </button>
        <button
          onClick={() => setMobileTab('notes')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'notes'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Notes &amp; Team</span>
        </button>
      </div>

      {/* Main Workspace — Spacious 3-column layout */}
      <div className="flex-1 min-h-0 max-w-[1800px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden h-full">
        {/* LEFT: Escalation Queue (3 cols) */}
        <div className={`lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl flex flex-col shadow-xs overflow-hidden h-full ${
          mobileTab === 'queue' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-600">
              Escalations ({queue.filter(q => ['waiting', 'open', 'escalated'].includes(q.status)).length} Waiting)
            </h2>
            <button
              onClick={refreshQueue}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Refresh queue"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {isLoading ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)
            ) : queue.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs font-medium">No pending escalations in queue</div>
            ) : (
              queue.map((item) => {
                const isSelected = selectedHandoff?.id === item.id || selectedHandoff?.conversation_id === item.conversation_id
                const isWaiting = ['waiting', 'open', 'escalated'].includes(item.status)
                const isActive = ['assigned', 'in_progress'].includes(item.status)
                const priorityColors: Record<string, string> = {
                  critical: 'bg-rose-100 text-rose-700 border-rose-200',
                  high: 'bg-orange-100 text-orange-700 border-orange-200',
                  medium: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                  low: 'bg-slate-100 text-slate-600 border-slate-200',
                }
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedHandoff(item)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-400 shadow-xs ring-1 ring-indigo-400/30'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${priorityColors[item.priority] || 'bg-slate-100 text-slate-700'}`}>
                        {item.priority}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {item.wait_time_seconds ? `${Math.round(item.wait_time_seconds / 60)}m wait` : 'Live'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{item.reason}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1.5 flex items-center justify-between">
                      <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                        isWaiting ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
                      }`}>
                        {item.status}
                      </span>
                    </p>
                    {isWaiting && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClaim(item) }}
                        className="mt-2.5 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold py-2 shadow-xs transition-all cursor-pointer"
                      >
                        Claim &amp; Join Chat
                      </button>
                    )}
                    {isActive && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedHandoff(item) }}
                        className="mt-2.5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 shadow-xs transition-all cursor-pointer"
                      >
                        Open Active Chat
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* CENTER: Main Chat Box (6.5 cols - Extra Large & High Visibility) */}
        <div className={`lg:col-span-6 flex flex-col overflow-hidden h-full bg-white border border-slate-200/80 rounded-2xl shadow-xs ${
          mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'
        }`}>
          {selectedHandoff ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Top Chat Header Bar */}
              <div className="p-3.5 sm:px-5 sm:py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${
                    selectedHandoff.status === 'in_progress' ? 'bg-emerald-500 radar-live' :
                    selectedHandoff.status === 'assigned' ? 'bg-indigo-500 animate-pulse' :
                    'bg-amber-500 animate-pulse'
                  }`} />
                  <div>
                    <h2 className="text-sm font-black text-slate-900 leading-tight">
                      Session #{selectedHandoff.conversation_id.slice(0, 8)}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Status: <span className="font-bold text-slate-700 uppercase">{selectedHandoff.status}</span> &bull; Priority: <span className="font-bold text-indigo-600 uppercase">{selectedHandoff.priority}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResolve}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-1.5 text-xs font-bold text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Resolve &amp; Free</span>
                  </button>
                </div>
              </div>

              {/* Compact AI Context Pill Bar */}
              {selectedHandoff.context && ((selectedHandoff.context as any).ai_summary || (selectedHandoff.context as any).sentiment) && (
                <div className="px-4 py-2 bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-purple-50/80 border-b border-purple-100 flex items-center justify-between text-xs shrink-0">
                  <div className="flex items-center gap-2 truncate mr-3">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-md shrink-0">AI Context</span>
                    <span className="text-purple-950 font-medium truncate text-xs">
                      {(selectedHandoff.context as any).ai_summary || selectedHandoff.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(selectedHandoff.context as any).sentiment && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-800">
                        {String((selectedHandoff.context as any).sentiment)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Messages Stream (Expanded & Large) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#f8fafc]/50 min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                    <p>No messages yet in this session.</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isAgent = msg.sender_type === 'human_agent'
                    const isCustomer = msg.sender_type === 'customer'
                    const isAI = msg.sender_type === 'ai'
                    return (
                      <div key={msg.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium shadow-2xs leading-relaxed ${
                          isCustomer
                            ? 'bg-white border border-slate-200/80 text-slate-900 rounded-bl-none'
                            : isAgent
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none'
                              : 'bg-indigo-50 border border-indigo-100 text-indigo-950 rounded-br-none'
                        }`}>
                          {isAgent && (
                            <span className="text-[10px] font-extrabold block mb-1 text-emerald-100 uppercase tracking-wide">
                              {msg.agent_name || 'Support Specialist (You)'}
                            </span>
                          )}
                          {isCustomer && (
                            <span className="text-[10px] font-extrabold block mb-1 text-slate-400 uppercase tracking-wide">Customer</span>
                          )}
                          {isAI && (
                            <span className="text-[10px] font-extrabold block mb-1 text-indigo-600 uppercase tracking-wide">AI Copilot</span>
                          )}
                          <div className={isAI ? 'markdown-content [&_p]:my-0.5 [&_strong]:font-bold' : 'whitespace-pre-wrap'}>
                            {isAI ? <Markdown>{msg.content}</Markdown> : msg.content}
                          </div>
                          <span className={`text-[10px] mt-1.5 block text-right ${isAgent ? 'text-emerald-200' : 'text-slate-400'}`}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                {isCustomerTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-2 shadow-2xs">
                      <span className="text-xs text-slate-500 font-medium animate-pulse">Customer is typing a reply...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Bottom Sticky Section: Compact AI Quick Suggestions + Reply Bar */}
              <div className="border-t border-slate-200/80 bg-white p-3 shrink-0 space-y-2">
                {suggestedReplies.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider shrink-0 flex items-center gap-1">
                      <span>✨ Quick:</span>
                    </span>
                    {suggestedReplies.map((reply, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setReplyText(reply)}
                        className="shrink-0 text-left text-xs px-3 py-1.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-100 font-semibold transition-colors cursor-pointer truncate max-w-xs"
                        title={reply}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reply Input Bar */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-2xl p-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendReply()
                      }
                    }}
                    placeholder="Type your response to the customer..."
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none placeholder:text-slate-400"
                    style={{ minHeight: '38px', maxHeight: '100px' }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <span>Send</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-display text-sm font-bold text-slate-800">No Escalation Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select an escalation from the left queue to open live conversation, view AI sentiment, and chat with the customer.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Internal Notes & Team Status (3 cols) */}
        <div className={`lg:col-span-3 flex flex-col gap-4 overflow-y-auto h-full ${
          mobileTab === 'notes' ? 'flex' : 'hidden lg:flex'
        }`}>
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
