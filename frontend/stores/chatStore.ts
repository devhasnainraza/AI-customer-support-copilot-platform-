/**
 * Chat Store with Zustand
 * T061: Chat state management
 */
'use client'

import { create } from 'zustand'
import type { ConnectionStatus } from '@/lib/websocket'

export interface Message {
  id: string
  conversation_id: string
  sender_type: 'customer' | 'ai' | 'human_agent'
  content: string
  timestamp: string
  confidence_score?: number
  sources?: Array<{
    chunk_id: string
    similarity: number
    content: string
  }>
  suggested_followups?: string[]
  sentiment?: string
  sentiment_urgency?: string
  tools_used?: string[]
  agent_name?: string
}

export interface HandoffState {
  active: boolean
  status: string | null      // waiting | assigned | in_progress | resolved
  reason: string | null
  priority: string | null
  assigned_agent: string | null
  wait_time: number | null   // seconds
  request_id: string | null
}

export interface Conversation {
  id: string
  status: 'active' | 'closed' | 'escalated' | 'abandoned'
  language: string
  started_at: string
  ended_at?: string
  ai_resolution: boolean
}

interface ChatState {
  // Current conversation
  currentConversation: Conversation | null
  messages: Message[]
  isLoading: boolean
  isTyping: boolean
  error: string | null

  // WebSocket state
  isConnected: boolean
  connectionStatus: ConnectionStatus
  connectionError: string | null
  typingAgent: string | null

  // Handoff state
  handoff: HandoffState

  // Actions
  setCurrentConversation: (conversation: Conversation | null) => void
  addMessage: (message: Message) => void
  removeMessage: (messageId: string) => void
  setMessages: (messages: Message[]) => void
  setIsTyping: (isTyping: boolean) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setConnectionError: (error: string | null) => void
  setTypingAgent: (agent: string | null) => void
  setError: (error: string | null) => void
  setHandoff: (handoff: Partial<HandoffState>) => void
  clearMessages: () => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  currentConversation: null,
  messages: [],
  isLoading: false,
  isTyping: false,
  error: null,
  isConnected: false,
  connectionStatus: 'idle',
  connectionError: null,
  typingAgent: null,
  handoff: {
    active: false,
    status: null,
    reason: null,
    priority: null,
    assigned_agent: null,
    wait_time: null,
    request_id: null,
  },

  // Actions
  setCurrentConversation: (conversation) =>
    set({ currentConversation: conversation }),

  addMessage: (message) =>
    set((state) =>
      // Guard against duplicate delivery (e.g. overlapping sockets/handlers).
      state.messages.some((m) => m.id === message.id)
        ? state
        : { messages: [...state.messages, message] }
    ),

  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),

  setMessages: (messages) =>
    set({ messages }),

  setIsTyping: (isTyping) =>
    set({ isTyping }),

  setConnectionStatus: (status) =>
    set({ connectionStatus: status, isConnected: status === 'connected' }),

  setConnectionError: (error) =>
    set({ connectionError: error }),

  setTypingAgent: (agent) =>
    set({ typingAgent: agent }),

  setHandoff: (partial) =>
    set((state) => ({ handoff: { ...state.handoff, ...partial } })),

  setError: (error) =>
    set({ error }),

  clearMessages: () =>
    set({ messages: [] }),

  reset: () =>
    set({
      currentConversation: null,
      messages: [],
      isLoading: false,
      isTyping: false,
      error: null,
      isConnected: false,
      connectionStatus: 'idle',
      connectionError: null,
      typingAgent: null,
      handoff: {
        active: false,
        status: null,
        reason: null,
        priority: null,
        assigned_agent: null,
        wait_time: null,
        request_id: null,
      },
    }),
}))

// Helper hooks
export const useCurrentConversation = () =>
  useChatStore((state) => state.currentConversation)

export const useMessages = () =>
  useChatStore((state) => state.messages)

export const useIsTyping = () =>
  useChatStore((state) => state.isTyping)

export const useIsConnected = () =>
  useChatStore((state) => state.isConnected)
