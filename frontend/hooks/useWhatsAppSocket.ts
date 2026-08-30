/**
 * useWhatsAppSocket
 * Real-time WebSocket hook for WhatsApp admin notifications.
 * Receives: new_message, status_update, conversation_update, typing_indicator.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000") + "/v1/whatsapp/ws"

export type WhatsAppEvent =
  | { type: "connected"; connection_id: string; message: string }
  | { type: "new_message"; direction: "inbound" | "outbound"; conversation: any; message: any }
  | { type: "status_update"; message_id: string; status: string }
  | { type: "conversation_update"; conversation: any }
  | { type: "pong" }
  | { type: "subscribed"; conversation_id: string }
  | { type: "typing"; conversation_id: string; is_typing: boolean }
  | { type: "error"; message: string }

export type WhatsAppConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "failed"

interface UseWhatsAppSocketReturn {
  status: WhatsAppConnectionStatus
  lastEvent: WhatsAppEvent | null
  events: WhatsAppEvent[]
  subscribe: (conversationId: string) => void
  sendReadReceipt: (conversationId: string) => void
  clearEvents: () => void
}

export function useWhatsAppSocket(enabled: boolean = true): UseWhatsAppSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<WhatsAppConnectionStatus>("idle")
  const [lastEvent, setLastEvent] = useState<WhatsAppEvent | null>(null)
  const [events, setEvents] = useState<WhatsAppEvent[]>([])
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const generation = useRef(0)

  const cleanup = useCallback(() => {
    if (pingTimer.current) clearInterval(pingTimer.current)
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!enabled) return
    cleanup()

    const gen = ++generation.current
    setStatus(reconnectAttempts.current > 0 ? "reconnecting" : "connecting")

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (gen !== generation.current) return
        setStatus("connected")
        reconnectAttempts.current = 0

        // Start ping keepalive
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }))
          }
        }, 25000)
      }

      ws.onmessage = (event) => {
        if (gen !== generation.current) return
        try {
          const data = JSON.parse(event.data)
          if (data.type === "ping") return // ignore server pings
          setLastEvent(data as WhatsAppEvent)
          setEvents((prev) => [data, ...prev].slice(0, 100)) // keep last 100 events
        } catch {}
      }

      ws.onclose = () => {
        if (gen !== generation.current) return
        if (pingTimer.current) clearInterval(pingTimer.current)
        wsRef.current = null

        if (reconnectAttempts.current < 10) {
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 30000)
          reconnectAttempts.current++
          setStatus("reconnecting")
          reconnectTimer.current = setTimeout(connect, delay)
        } else {
          setStatus("failed")
        }
      }

      ws.onerror = () => {
        if (gen !== generation.current) return
        setStatus("failed")
      }
    } catch {
      setStatus("failed")
    }
  }, [enabled, cleanup])

  useEffect(() => {
    if (enabled) connect()
    return cleanup
  }, [enabled, connect, cleanup])

  const subscribe = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe_conversation", conversation_id: conversationId }))
    }
  }, [])

  const sendReadReceipt = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "read_receipt", conversation_id: conversationId }))
    }
  }, [])

  const clearEvents = useCallback(() => {
    setEvents([])
    setLastEvent(null)
  }, [])

  return { status, lastEvent, events, subscribe, sendReadReceipt, clearEvents }
}
