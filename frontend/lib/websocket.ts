/**
 * WebSocket Manager
 * T068: WebSocket connection and message handling
 */

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export type WebSocketMessage =
  | { type: 'connected'; conversation_id: string; message: string }
  | { type: 'message'; message_id: string; sender: string; content: string; confidence: number; timestamp: string; sources?: MessageSource[]; [key: string]: unknown }
  | { type: 'typing'; is_typing: boolean; [key: string]: unknown }
  | { type: 'escalation'; message: string; reason: string }
  | { type: 'error'; message: string }
  | { type: 'handoff_notification'; handoff: Record<string, unknown>; [key: string]: unknown }
  | { type: 'agent_typing'; is_typing: boolean; agent_name: string; [key: string]: unknown }
  | { type: 'agent_connected'; agent_id: string; queue: unknown[]; agents: unknown[]; [key: string]: unknown }

export interface MessageSource {
  chunk_id: string
  similarity: number
  content: string
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'closed'

export type WebSocketEventHandler = (message: WebSocketMessage) => void
export type ConnectionStatusHandler = (status: ConnectionStatus, detail?: string) => void
export type TokenProvider = () => Promise<string | null>

// Close codes the server uses for non-retryable failures (auth/authz/policy).
const NON_RETRYABLE_CODES = new Set([1000, 1008, 4001, 4003])

export class WebSocketManager {
  private ws: WebSocket | null = null
  private handlers: Set<WebSocketEventHandler> = new Set()
  private statusHandlers: Set<ConnectionStatusHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 8
  private reconnectDelay = 1000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private conversationId: string | null = null
  private tokenProvider: TokenProvider | null = null
  private status: ConnectionStatus = 'idle'
  // Incremented on every connect()/disconnect() so callbacks from stale
  // sockets can detect they've been superseded and bail out.
  private generation = 0

  async connect(conversationId: string, tokenProvider: TokenProvider): Promise<void> {
    // Already connected or connecting to this same conversation — nothing to do.
    if (
      this.conversationId === conversationId &&
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    // Switching conversations: tear down the old socket first.
    this.teardownSocket()

    this.conversationId = conversationId
    this.tokenProvider = tokenProvider
    this.reconnectAttempts = 0
    await this.open()
  }

  private async open(): Promise<void> {
    if (!this.conversationId || !this.tokenProvider) return

    const generation = ++this.generation
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')

    let token: string | null = null
    try {
      token = await this.tokenProvider()
    } catch {
      token = null
    }

    // A newer connect()/disconnect() happened while we awaited the token.
    if (generation !== this.generation) return

    if (!token) {
      this.setStatus('failed', 'Authentication required')
      return
    }

    const url = `${WS_BASE_URL}/v1/chat/ws?conversation_id=${encodeURIComponent(this.conversationId)}&token=${encodeURIComponent(token)}`

    try {
      const ws = new WebSocket(url)
      this.ws = ws

      ws.onopen = () => {
        if (generation !== this.generation) return
        this.reconnectAttempts = 0
        this.setStatus('connected')
      }

      ws.onmessage = (event) => {
        if (generation !== this.generation) return
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.notifyHandlers(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = () => {
        // onclose always follows onerror; reconnect logic lives there.
        if (generation !== this.generation) return
        console.error('WebSocket error')
      }

      ws.onclose = (event) => {
        if (generation !== this.generation) return
        this.ws = null

        if (NON_RETRYABLE_CODES.has(event.code)) {
          // Normal close or a policy failure (bad token, access denied) that
          // retrying with the same inputs can never fix.
          this.setStatus(
            event.code === 1000 ? 'closed' : 'failed',
            event.reason || (event.code === 1000 ? undefined : 'Connection rejected by server')
          )
          return
        }

        this.scheduleReconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      if (generation === this.generation) {
        this.scheduleReconnect()
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('failed', 'Unable to reach the chat server. Please retry.')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)
    this.setStatus('reconnecting', `Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      // Token is re-fetched inside open(), so an expired JWT is refreshed
      // before every reconnect attempt.
      void this.open()
    }, delay)
  }

  /** Manual retry after the manager has given up ('failed'). */
  reconnect() {
    if (!this.conversationId || !this.tokenProvider) return
    this.reconnectAttempts = 0
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    void this.open()
  }

  disconnect() {
    this.teardownSocket()
    this.conversationId = null
    this.tokenProvider = null
    this.reconnectAttempts = 0
    this.setStatus('idle')
  }

  private teardownSocket() {
    // Invalidate all pending callbacks/timers from the current socket.
    this.generation++
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      const ws = this.ws
      this.ws = null
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Client disconnect')
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            try {
              ws.close(1000, 'Client disconnect')
            } catch {}
          }
        }
      } catch {
        // Socket may already be closed.
      }
    }
  }

  async waitForOpen(timeoutMs: number = 6000): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    return new Promise<void>((resolve, reject) => {
      const startTime = Date.now()
      const interval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          clearInterval(interval)
          resolve()
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval)
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            resolve()
          } else {
            reject(new Error('Connection to chat server timed out. Please retry.'))
          }
        }
      }, 50)
    })
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // If currently connecting, wait up to 4s for open event
      await this.waitForOpen(4000)
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to chat server')
    }

    this.ws.send(JSON.stringify({ type: 'message', content }))
  }

  subscribe(handler: WebSocketEventHandler) {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  subscribeStatus(handler: ConnectionStatusHandler) {
    this.statusHandlers.add(handler)
    // Deliver the current status immediately so late subscribers sync up.
    handler(this.status)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  private setStatus(status: ConnectionStatus, detail?: string) {
    this.status = status
    this.statusHandlers.forEach((handler) => {
      try {
        handler(status, detail)
      } catch (error) {
        console.error('Status handler error:', error)
      }
    })
  }

  private notifyHandlers(message: WebSocketMessage) {
    this.handlers.forEach((handler) => {
      try {
        handler(message)
      } catch (error) {
        console.error('Handler error:', error)
      }
    })
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager()
  }
  return wsManager
}
