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
          if (message.sender === 'ai' || (message as any).sender_type === 'ai') {
            setIsTyping(false)
            addMessage({
              id: message.message_id || (message as any).id || `ai-${Date.now()}`,
              conversation_id: conversationId!,
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
                assigned_agent: h.assigned_agent,
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
            setHandoff({
              active: h.status !== 'resolved' && h.status !== 'cancelled',
              status: h.status,
              reason: h.reason,
              priority: h.priority,
              assigned_agent: h.assigned_agent_id,
              request_id: h.id,
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
    [conversationId, addMessage, setIsTyping, setTypingAgent, setConnectionError]
  )

  // Connect to WebSocket when this hook owns a conversation
  useEffect(() => {
    if (!conversationId || !user) return

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

    // The manager re-fetches a fresh token (with auto-refresh) on every
    // connect AND reconnect attempt.
    void manager.connect(conversationId, getAuthToken)

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

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !user) {
        throw new Error('Not connected')
      }

      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_type: 'customer',
        content,
        timestamp: new Date().toISOString(),
      }
      addMessage(tempMessage)

      try {
        wsManager.current.sendMessage(content)
      } catch (error) {
        // Roll back the optimistic message so the transcript doesn't show
        // a message that was never delivered.
        removeMessage(tempMessage.id)
        throw error
      }
    },
    [conversationId, user, addMessage, removeMessage]
  )

  // Load conversation messages
  const loadConversation = useCallback(
    async (convId: string) => {
      const [conversation, msgs] = await Promise.all([
        api.chat.getConversation(convId),
        api.chat.getMessages(convId),
      ])

      setCurrentConversation(conversation)
      setMessages(msgs)
    },
    [setCurrentConversation, setMessages]
  )

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

  // Request human agent handoff
  const requestHandoff = useCallback(
    async (reason: string, priority: string = 'medium') => {
      if (!conversationId || !user) throw new Error('Not connected')

      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_BASE}/v1/handoff/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            reason,
            priority,
          }),
        })
        if (!res.ok) throw new Error('Handoff request failed')
        const data = await res.json()
        setHandoff({
          active: true,
          status: data.status,
          reason: data.reason,
          priority: data.priority,
          request_id: data.id,
        })
      } catch (err) {
        console.error('Handoff request error:', err)
        throw err
      }
    },
    [conversationId, user, setHandoff]
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
    loadConversation,
    createConversation,
  }
}
