/**
 * usePushNotifications
 * Manages browser push notification subscription lifecycle:
 * - Request permission
 * - Subscribe to push via Service Worker
 * - Register subscription with backend
 * - Send test notifications
 * - Unsubscribe
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/stores/authStore"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

async function getAuthToken(): Promise<string> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ""
  } catch {
    return ""
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export type PushPermissionState = "default" | "granted" | "denied" | "unsupported"

interface UsePushNotificationsReturn {
  permissionState: PushPermissionState
  isSubscribed: boolean
  isServiceWorkerReady: boolean
  subscription: PushSubscription | null
  requestPermission: () => Promise<boolean>
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  sendTestNotification: () => Promise<boolean>
  subscriptionCount: number
  refreshStats: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth()
  const [permissionState, setPermissionState] = useState<PushPermissionState>("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [subscriptionCount, setSubscriptionCount] = useState(0)

  // Check initial state
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermissionState("unsupported")
      return
    }

    setPermissionState(Notification.permission as PushPermissionState)

    // Wait for service worker to be ready
    navigator.serviceWorker.ready.then(async (reg) => {
      setIsServiceWorkerReady(true)
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        setSubscription(sub)
        setIsSubscribed(true)
      }
    })

    // Listen for SW updates
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setSubscription(sub)
        setIsSubscribed(!!sub)
      })
    })
  }, [])

  const getVapidKey = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API}/v1/notifications/push/vapid-public-key`, {
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
      })
      const data = await res.json()
      return data.public_key
    } catch {
      return null
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === "undefined") return false

    const result = await Notification.requestPermission()
    setPermissionState(result as PushPermissionState)
    return result === "granted"
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !isServiceWorkerReady) return false

    // Request permission first if needed
    if (Notification.permission === "default") {
      const granted = await requestPermission()
      if (!granted) return false
    }

    if (Notification.permission === "denied") return false

    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = await getVapidKey()
      if (!vapidKey) return false

      // Convert VAPID key to ArrayBuffer
      const applicationServerKey = urlBase64ToUint8Array(
        vapidKey.replace(/-/g, "+").replace(/_/g, "/")
      ).buffer as ArrayBuffer

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      setSubscription(sub)
      setIsSubscribed(true)

      // Register with backend
      const subJson = sub.toJSON()
      await fetch(`${API}/v1/notifications/push/subscribe/${user.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      })

      return true
    } catch (err) {
      console.error("Push subscription failed:", err)
      return false
    }
  }, [user?.id, isServiceWorkerReady, requestPermission, getVapidKey])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !subscription) return false

    try {
      await subscription.unsubscribe()

      await fetch(`${API}/v1/notifications/push/unsubscribe/${user.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      })

      setSubscription(null)
      setIsSubscribed(false)
      return true
    } catch {
      return false
    }
  }, [user?.id, subscription])

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const res = await fetch(`${API}/v1/notifications/push/send/${user.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          title: "Copilot Portal",
          body: "Push notifications are working! You'll receive alerts for new messages, handoffs, and escalations.",
          icon: "/icons/notification.png",
          url: "/",
          data: { test: true },
        }),
      })
      const data = await res.json()
      return data.sent === true
    } catch {
      return false
    }
  }, [user?.id])

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/v1/notifications/push/stats`, {
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
      })
      const data = await res.json()
      setSubscriptionCount(data.total_subscriptions || 0)
    } catch {}
  }, [])

  useEffect(() => {
    if (user?.id) refreshStats()
  }, [user?.id, refreshStats])

  return {
    permissionState,
    isSubscribed,
    isServiceWorkerReady,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    subscriptionCount,
    refreshStats,
  }
}
