/**
 * useChat Hook - WebSocket Connection Management
 * T062: Custom hook for chat functionality
 *
 * Only ONE component per conversation should call this hook with a
 * conversationId (it owns the WebSocket connection). Components that only
 * need conversation actions (create/load) can call it with no argument.
 */
'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useChatStore, Conversation, Message } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getWebSocketManager, WebSocketMessage } from '@/lib/websocket'
import { api, getAuthToken } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// If the server never clears the typing indicator (worker crash, dropped
// Kafka event), stop animating after this long.
const TYPING_WATCHDOG_MS = 90_000

export function useChat(conversationId?: string) {
  const wsManager = useRef(getWebSocketManager())
  const typingWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    currentConversation,
    messages,
    isTyping,
    typingAgent,
    isConnected,
    connectionStatus,
    connectionError,
    handoff,
    addMessage,
    removeMessage,
    setMessages,
    setIsTyping,
    setConnectionStatus,
    setConnectionError,
    setTypingAgent,
    setHandoff,
    setCurrentConversation,
  } = useChatStore()

  const { user } = useAuthStore()

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'connected':
          setConnectionError(null)
          break

        case 'message':
          setIsTyping(false)
          const isHumanAgent = message.sender === 'human_agent' || (message as any).sender_type === 'human_agent'
          if (isHumanAgent) {
            let agentName = (message as any).agent_name || 'Support Specialist'
            if (user?.email && agentName.toLowerCase().trim() === user.email.toLowerCase().trim()) {
              agentName = 'Support Specialist'
            }
            addMessage({
              id: message.message_id || (message as any).id || `agent-${Date.now()}`,
              conversation_id: conversationId || (message as any).conversation_id,
              sender_type: 'human_agent',
              agent_name: agentName,
              content: message.content,
              timestamp: message.timestamp || new Date().toISOString(),
            })
            setHandoff({
              active: true,
              status: 'in_progress',
              assigned_agent: agentName,
            })
          } else if (message.sender === 'ai' || (message as any).sender_type === 'ai') {
            addMessage({
              id: message.message_id || (message as any).id || `ai-${Date.now()}`,
              conversation_id: conversationId || (message as any).conversation_id,
              sender_type: 'ai',
              content: message.content,
              timestamp: message.timestamp || new Date().toISOString(),
              confidence_score: message.confidence ?? (message as any).confidence_score,
              sources: message.sources,
              suggested_followups: (message as any).suggested_followups,
              sentiment: (message as any).sentiment,
              sentiment_urgency: (message as any).sentiment_urgency,
              tools_used: (message as any).tools_used,
              agent_name: (message as any).agent_name,
            })
            // Update handoff state if included in message
            if ((message as any).handoff) {
              const h = (message as any).handoff
              setHandoff({
                active: h.status !== 'resolved' && h.status !== 'cancelled',
                status: h.status,
                assigned_agent: h.assigned_agent || h.assigned_agent_id,
                priority: h.priority,
              })
            }
          }
          break

        case 'typing':
          setIsTyping(message.is_typing)
          setTypingAgent((message as any).agent || null)
          if (typingWatchdog.current) clearTimeout(typingWatchdog.current)
          if (message.is_typing) {
            typingWatchdog.current = setTimeout(() => {
              setIsTyping(false)
              setTypingAgent(null)
            }, TYPING_WATCHDOG_MS)
          } else {
            setTypingAgent(null)
          }
          break

        case 'error':
          setConnectionError(message.message)
          break

        case 'escalation':
          console.log('Escalation:', message.message, message.reason)
          break

        case 'handoff_notification': {
          // Customer receives handoff status update
          const hMsg = message as any
          if (hMsg.handoff) {
            const h = hMsg.handoff
            let rawAgent = h.assigned_agent_name || h.assigned_agent || h.assigned_agent_id || null
            if (rawAgent && user?.email && rawAgent.toLowerCase().trim() === user.email.toLowerCase().trim()) {
              rawAgent = 'Support Specialist'
            }
            const displayAgent = rawAgent && (rawAgent.includes('@') || !rawAgent.includes('-')) ? rawAgent : (rawAgent ? 'Support Specialist' : null)
            setHandoff({
              active: h.active !== false && h.status !== 'resolved' && h.status !== 'cancelled',
              status: h.status,
              reason: h.reason,
              priority: h.priority,
              assigned_agent: displayAgent,
              request_id: h.id || h.request_id,
            })
          }
          break
        }

        case 'agent_typing': {
          // Human agent is typing
          const atMsg = message as any
          setIsTyping(atMsg.is_typing)
          setTypingAgent(atMsg.agent_name || 'Support Agent')
          break
        }
      }
    },
    [conversationId, addMessage, setIsTyping, setTypingAgent, setConnectionError, setHandoff]
  )

  // Connect to WebSocket and ensure listeners are always active
  useEffect(() => {
    if (!user) return

    const manager = wsManager.current

    const unsubscribeMessages = manager.subscribe(handleWebSocketMessage)
    const unsubscribeStatus = manager.subscribeStatus((status, detail) => {
      setConnectionStatus(status)
      if (status === 'failed') {
        setConnectionError(detail || 'Connection lost')
      } else if (status === 'connected') {
        setConnectionError(null)
      }
    })

    if (conversationId) {
      // The manager re-fetches a fresh token (with auto-refresh) on every
      // connect AND reconnect attempt.
      void manager.connect(conversationId, getAuthToken)
    }

    return () => {
      unsubscribeMessages()
      unsubscribeStatus()
      if (typingWatchdog.current) clearTimeout(typingWatchdog.current)
      manager.disconnect()
    }
  }, [conversationId, user, handleWebSocketMessage, setConnectionStatus, setConnectionError])

  // Manual retry after the manager has given up
  const reconnect = useCallback(() => {
    wsManager.current.reconnect()
  }, [])

  // Create new conversation
  const createConversation = useCallback(
    async (initialMessage?: string, language?: string): Promise<Conversation> => {
      const conversation = await api.chat.createConversation({
        initial_message: initialMessage,
        language,
      })

      setCurrentConversation(conversation)
      return conversation
    },
    [setCurrentConversation]
  )

  // Load conversation messages and check handoff status
  const loadConversation = useCallback(
    async (convId: string) => {
      const [conversation, msgs] = await Promise.all([
        api.chat.getConversation(convId),
        api.chat.getMessages(convId),
      ])

      setCurrentConversation(conversation)
      setMessages(msgs)

      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_BASE}/v1/handoff/request/${convId}`, {
          headers: { Authorization: `Bearer ${token || ''}` },
        })
        if (res.ok) {
          const h = await res.json()
          if (h && (h.status === 'waiting' || h.status === 'assigned' || h.status === 'in_progress')) {
            let rawAgent = h.assigned_agent_name || h.assigned_agent || h.assigned_agent_id || null
            if (rawAgent && user?.email && rawAgent.toLowerCase().trim() === user.email.toLowerCase().trim()) {
              rawAgent = 'Support Specialist'
            }
            const displayAgent = rawAgent && (rawAgent.includes('@') || !rawAgent.includes('-')) ? rawAgent : (rawAgent ? 'Support Specialist' : null)
            setHandoff({
              active: true,
              status: h.status,
              reason: h.reason,
              priority: h.priority,
              assigned_agent: displayAgent,
              request_id: h.id,
            })
          }
        }
      } catch {}
    },
    [setCurrentConversation, setMessages, setHandoff]
  )

  // Auto-load conversation messages and handoff status whenever conversationId changes
  useEffect(() => {
    if (conversationId && user) {
      loadConversation(conversationId)
    }
  }, [conversationId, user, loadConversation])

  // Send message (lazily creates conversation if none exists)
  const sendMessage = useCallback(
    async (content: string): Promise<string> => {
      if (!user) {
        throw new Error('Please sign in to send messages.')
      }

      let activeId = conversationId

      // Lazily create conversation in database on first message
      if (!activeId) {
        const newConv = await createConversation(content)
        activeId = newConv.id
        // Connect websocket for the newly created conversation
        await wsManager.current.connect(activeId, getAuthToken)
      }

      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: activeId,
        sender_type: 'customer',
        content,
        timestamp: new Date().toISOString(),
      }
      addMessage(tempMessage)

      try {
        await wsManager.current.sendMessage(content)
        return activeId
      } catch (error) {
        // Roll back the optimistic message so the transcript doesn't show
        // a message that was never delivered.
        removeMessage(tempMessage.id)
        throw error
      }
    },
    [conversationId, user, addMessage, removeMessage, createConversation]
  )

  // Request human agent handoff
  const requestHandoff = useCallback(
    async (reason: string, priority: string = 'medium'): Promise<string> => {
      if (!user) throw new Error('Please sign in to request a support specialist.')

      let activeId = conversationId
      if (!activeId) {
        const newConv = await createConversation(`[Human Specialist Requested] Reason: ${reason}`)
        activeId = newConv.id
        await wsManager.current.connect(activeId, getAuthToken)
      }

      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_BASE}/v1/handoff/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversation_id: activeId,
            reason,
            priority,
          }),
        })
        if (!res.ok) throw new Error('Handoff request failed')
        const data = await res.json()
        setHandoff({
          active: true,
          status: data.status || 'waiting',
          reason: data.reason || reason,
          priority: data.priority || priority,
          request_id: data.id,
        })
        return activeId
      } catch (err) {
        console.error('Handoff request error:', err)
        throw err
      }
    },
    [conversationId, user, createConversation, setHandoff]
  )

  // Cancel human handoff and resume AI chat
  const cancelHandoff = useCallback(async () => {
    if (!conversationId) return
    try {
      const token = await getAuthToken()
      await fetch(`${API_BASE}/v1/handoff/request/${conversationId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
      })
    } catch (err) {
      console.error('Cancel handoff error:', err)
    } finally {
      setHandoff({
        active: false,
        status: null,
        reason: null,
        priority: null,
        assigned_agent: null,
        wait_time: null,
        request_id: null,
      })
    }
  }, [conversationId, setHandoff])

  // Mark handoff as resolved
  const resolveHandoff = useCallback(async () => {
    if (!conversationId) return
    try {
      const token = await getAuthToken()
      await fetch(`${API_BASE}/v1/handoff/request/${conversationId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
      })
    } catch (err) {
      console.error('Resolve handoff error:', err)
    } finally {
      setHandoff({
        active: false,
        status: 'resolved',
        reason: null,
        priority: null,
        assigned_agent: null,
        wait_time: null,
      })
    }
  }, [conversationId, setHandoff])

  // Fast connect with an available specialist (for immediate assignment)
  const fastAssignAgent = useCallback(
    async (agentName: string = 'Alex Morgan (Senior Support Specialist)') => {
      if (!conversationId) return
      setHandoff({
        active: true,
        status: 'in_progress',
        assigned_agent: agentName,
      })

      try {
        const token = await getAuthToken()
        await fetch(`${API_BASE}/v1/handoff/request/${conversationId}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`,
          },
          body: JSON.stringify({ agent_id: 'specialist-alex-morgan' }),
        })
      } catch (err) {
        console.error('Fast assign error:', err)
      }
    },
    [conversationId, setHandoff]
  )

  return {
    conversation: currentConversation,
    messages,
    isTyping,
    typingAgent,
    isConnected,
    connectionStatus,
    connectionError,
    handoff,
    sendMessage,
    reconnect,
    requestHandoff,
    cancelHandoff,
    resolveHandoff,
    fastAssignAgent,
    loadConversation,
    createConversation,
  }
}
