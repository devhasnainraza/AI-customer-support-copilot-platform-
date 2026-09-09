/**
 * API Client with React Query
 * T030: API client setup with TanStack Query
 */
import { QueryClient } from '@tanstack/react-query'
import type { Conversation, Message } from '@/stores/chatStore'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Create a QueryClient. Must be called once per browser session (inside a
 * useState in Providers) — a module-scope singleton would be shared across
 * all SSR requests and could leak one user's cache into another's render.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

/** Error thrown for non-2xx API responses, carrying the HTTP status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Extract a human-readable message from a FastAPI error body.
 * FastAPI serializes HTTPException as {"detail": "..."} and validation
 * errors as {"detail": [{loc, msg, type}, ...]}.
 */
function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const detail = (body as Record<string, unknown>).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
        .filter(Boolean)
      if (msgs.length) return msgs.join('; ')
    }
    const message = (body as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  return `Request failed (HTTP ${status})`
}

// Deduplicate concurrent refreshSession() calls: with refresh-token rotation,
// two simultaneous refreshes invalidate each other.
let refreshInFlight: Promise<string | null> | null = null

/**
 * Get authorization token from Supabase, refreshing if it expires within 60s.
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const { supabase } = await import('./supabase')
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) return null

  try {
    const payloadBase64 = session.access_token.split('.')[1]
    if (payloadBase64) {
      const normalizedBase64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(window.atob(normalizedBase64))
      const exp = payload.exp * 1000

      // Refresh token if expired or expiring within 60 seconds
      if (Date.now() >= exp - 60000) {
        if (!refreshInFlight) {
          refreshInFlight = supabase.auth
            .refreshSession()
            .then(({ data, error }) => (!error && data.session ? data.session.access_token : null))
            .finally(() => {
              refreshInFlight = null
            })
        }
        const refreshed = await refreshInFlight
        if (refreshed) return refreshed
      }
    }
  } catch (e) {
    console.error('Failed to check or refresh token expiration:', e)
  }
  return session.access_token
}

/** Get standard JSON request headers with Supabase Auth Bearer token */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/** Clear the local session and bounce to login, preserving the return path. */
async function handleUnauthorized(): Promise<never> {
  if (typeof window !== 'undefined') {
    try {
      const { supabase } = await import('./supabase')
      await supabase.auth.signOut()
    } catch {
      // Session may already be gone.
    }
    const returnTo = window.location.pathname + window.location.search
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?redirect=${encodeURIComponent(returnTo)}`)
    }
  }
  throw new ApiError(401, 'Your session has expired. Please sign in again.')
}

/**
 * Base fetch wrapper with auth
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()

  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    return handleUnauthorized()
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, extractErrorMessage(body, response.status))
  }

  return response.json()
}

/** Shared API response shapes (mirroring the FastAPI backend). */
export interface Pagination {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface Ticket {
  id: string
  ticket_number: string
  conversation_id: string
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category?: string | null
  ai_summary?: string | null
  created_by?: string | null
  assigned_team?: string | null
  assigned_agent_id?: string | null
  assigned_agent_name?: string | null
  created_at: string
  updated_at?: string
  resolved_at?: string | null
  conversation_preview?: {
    message_count?: number
    last_message_at?: string
    last_message_preview?: string
  }
}

export interface TicketListResponse {
  data: Ticket[]
  pagination: Pagination
}

export interface KnowledgeDocument {
  id: string
  filename: string
  file_type: 'pdf' | 'docx' | 'txt' | 'markdown' | 'html'
  language: string
  file_size_bytes: number
  uploaded_at: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  processing_error?: string | null
  version: number
  metadata?: Record<string, unknown>
}

export interface SearchResult {
  id: string
  document_id: string
  content: string
  position: number
  similarity: number
  source_title?: string | null
}

export interface OverviewMetrics {
  total_chats: number
  ai_resolution_rate: number
  avg_response_time_seconds: number
  escalation_rate: number
  cost_savings_usd: number
  active_conversations: number
  total_tickets_created: number
}

export interface ResolutionRatePoint {
  date: string
  ai_resolved: number
  human_resolved: number
  unresolved: number
}

export interface ResponseTimePoint {
  date: string
  avg_seconds: number
  p95_seconds: number
}

export interface TopicMetric {
  topic: string
  count: number
  escalation_rate: number
  sentiment: string
}

export interface CostMetrics {
  ai_cost_usd: number
  human_equivalent_cost_usd: number
  net_savings_usd: number
  savings_percentage: number
}

export interface AgentPerformanceMetric {
  agent_id: string
  agent_name: string
  avatar_url?: string
  chats_handled: number
  tickets_resolved: number
  avg_handle_time_minutes: number
  csat_score: number
}

/**
 * API methods
 */
export const api = {
  // Health check
  health: () => apiFetch<{ status: string; services: Record<string, string> }>('/health'),

  // Chat endpoints
  chat: {
    createConversation: (data: { initial_message?: string; language?: string }) =>
      apiFetch<Conversation>('/v1/chat/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getConversations: () => apiFetch<Conversation[]>('/v1/chat/conversations'),
    getConversation: (id: string) => apiFetch<Conversation>(`/v1/chat/conversations/${id}`),
    getMessages: (conversationId: string) =>
      apiFetch<Message[]>(`/v1/chat/conversations/${conversationId}/messages`),
  },

  // Knowledge base endpoints
  knowledge: {
    getDocuments: () => apiFetch<KnowledgeDocument[]>('/v1/knowledge/documents'),
    getDocument: (id: string) => apiFetch<KnowledgeDocument>(`/v1/knowledge/documents/${id}`),
    getChunks: (id: string) => apiFetch<unknown[]>(`/v1/knowledge/documents/${id}/chunks`),
    search: (data: { query: string; language: string; match_count?: number; similarity_threshold?: number }) =>
      apiFetch<{ query: string; results: SearchResult[] }>('/v1/knowledge/search', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    uploadDocument: async (file: File, language: string): Promise<KnowledgeDocument> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', language)

      const token = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}/v1/knowledge/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (response.status === 401) {
        return handleUnauthorized()
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new ApiError(response.status, extractErrorMessage(body, response.status))
      }
      return response.json()
    },
    deleteDocument: (id: string) =>
      apiFetch<{ success?: boolean }>(`/v1/knowledge/documents/${id}`, {
        method: 'DELETE',
      }),
  },

  // Ticket endpoints
  tickets: {
    getTickets: (params?: {
      status?: string
      priority?: string
      conversation_id?: string
      limit?: number
      offset?: number
    }) => {
      const query = new URLSearchParams()
      if (params?.status) query.append('status', params.status)
      if (params?.priority) query.append('priority', params.priority)
      if (params?.conversation_id) query.append('conversation_id', params.conversation_id)
      if (params?.limit) query.append('limit', String(params.limit))
      if (params?.offset) query.append('offset', String(params.offset))
      const queryString = query.toString()
      return apiFetch<TicketListResponse>(`/v1/tickets${queryString ? `?${queryString}` : ''}`)
    },
    getTicket: (id: string) => apiFetch<Ticket>(`/v1/tickets/${id}`),
    getTicketConversation: (id: string) => apiFetch<{ messages: Message[] }>(`/v1/tickets/${id}/conversation`),
    search: (query: string) =>
      apiFetch<{ results: Ticket[] }>('/v1/tickets/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
    createTicket: (data: { conversation_id: string; priority?: string; category?: string }) =>
      apiFetch<Ticket>('/v1/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateTicket: (id: string, data: Partial<Pick<Ticket, 'status' | 'priority' | 'assigned_agent_id' | 'ai_summary'>>) =>
      apiFetch<Ticket>(`/v1/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // Analytics endpoints
  analytics: {
    getOverview: (days = 30) => apiFetch<OverviewMetrics>(`/v1/analytics/overview?days=${days}`),
    getResolutionRate: (days = 7) => apiFetch<ResolutionRatePoint[]>(`/v1/analytics/resolution-rate?days=${days}`),
    getResponseTimes: (days = 7) => apiFetch<ResponseTimePoint[]>(`/v1/analytics/response-times?days=${days}`),
    getTopTopics: () => apiFetch<TopicMetric[]>('/v1/analytics/top-topics'),
    getCosts: (days = 30) => apiFetch<CostMetrics>(`/v1/analytics/costs?days=${days}`),
    getAgentPerformance: () => apiFetch<AgentPerformanceMetric[]>('/v1/analytics/agent-performance'),
  },
}

