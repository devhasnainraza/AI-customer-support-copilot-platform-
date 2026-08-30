'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/stores/authStore'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useEmailPreferences, EmailPreference } from '@/hooks/useEmailPreferences'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  priority: string
  read: boolean
  created_at: string
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getHeaders() {
  const raw = localStorage.getItem('supabase.auth.token') || ''
  const token = raw.replace(/^"|"$/g, '')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'notifications' | 'push' | 'email'>('notifications')
  const panelRef = useRef<HTMLDivElement>(null)

  const {
    permissionState,
    isSubscribed,
    isServiceWorkerReady,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    subscriptionCount,
    refreshStats,
  } = usePushNotifications()

  const {
    preferences: emailPreferences,
    isLoading: emailPrefsLoading,
    togglePreference: toggleEmailPref,
    getEnabledCount: getEnabledEmailCount,
  } = useEmailPreferences(user?.id || '', user?.role || 'customer', user?.email || '')

  const [testSending, setTestSending] = useState(false)
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [emailToggleLoading, setEmailToggleLoading] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`${API}/v1/notifications/user/${user.id}?limit=20`, { headers: getHeaders() })
      const d = await res.json()
      setNotifications(d.notifications || [])
      setUnreadCount(d.notifications?.filter((n: NotificationItem) => !n.read).length || 0)
    } catch {}
  }, [user?.id])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(() => {
      if (!user?.id) return
      fetch(`${API}/v1/notifications/user/${user.id}/unread-count`, { headers: getHeaders() })
        .then(r => r.json()).then(d => setUnreadCount(d.count || 0)).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [user?.id, fetchNotifications])

  const markRead = async (id: string) => {
    if (!user?.id) return
    await fetch(`${API}/v1/notifications/user/${user.id}/mark-read/${id}`, { method: 'POST', headers: getHeaders() })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    if (!user?.id) return
    await fetch(`${API}/v1/notifications/user/${user.id}/mark-all-read`, { method: 'POST', headers: getHeaders() })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const handleTogglePush = async () => {
    setSubscribeLoading(true)
    try {
      if (isSubscribed) {
        await unsubscribe()
        await refreshStats()
      } else {
        const granted = permissionState === 'granted' || (await requestPermission())
        if (granted) {
          await subscribe()
          await refreshStats()
        }
      }
    } finally {
      setSubscribeLoading(false)
    }
  }

  const handleTestNotification = async () => {
    setTestSending(true)
    try {
      await sendTestNotification()
    } finally {
      setTestSending(false)
    }
  }

  const handleToggleEmailPref = async (category: string) => {
    setEmailToggleLoading(category)
    try {
      await toggleEmailPref(category)
    } finally {
      setEmailToggleLoading(null)
    }
  }

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-slate-100 text-slate-600',
    low: 'bg-slate-100 text-slate-500',
  }

  const typeIcons: Record<string, string> = {
    handoff: '👤',
    escalation: '🚨',
    ticket: '🎫',
    system: '⚙️',
    message: '💬',
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
        <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Tab Bar */}
          <div className="flex border-b border-slate-100">
            {[
              { key: 'notifications' as const, icon: '🔔', label: 'Notifications' },
              { key: 'push' as const, icon: '📱', label: 'Push' },
              { key: 'email' as const, icon: '📧', label: 'Email' },
            ].map(tab => (
              <button
                key={tab.key}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-3 py-3 text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
                  activeTab === tab.key ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <>
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">
                  Notifications {unreadCount > 0 && <span className="text-indigo-600">({unreadCount} new)</span>}
                </span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="text-3xl">📭</span>
                    <p className="text-xs text-slate-400 mt-2">No notifications yet</p>
                    <p className="text-[10px] text-slate-300 mt-1">You'll see alerts for handoffs, escalations, and tickets here</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? 'bg-indigo-50/30' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />}
                        <span className="text-lg flex-shrink-0">{typeIcons[n.type] || '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-900">{n.title}</p>
                          <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${priorityColors[n.priority] || 'bg-slate-100'}`}>
                              {n.priority}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Push Settings Tab */}
          {activeTab === 'push' && (
            <div className="p-4 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Push Notifications</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {permissionState === 'granted' ? 'Enabled' : permissionState === 'denied' ? 'Blocked by browser' : permissionState === 'unsupported' ? 'Not supported' : 'Not enabled yet'}
                    </p>
                  </div>
                  {permissionState === 'denied' ? (
                    <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold">Blocked</span>
                  ) : permissionState === 'unsupported' ? (
                    <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-extrabold">N/A</span>
                  ) : (
                    <button
                      onClick={handleTogglePush}
                      disabled={subscribeLoading || !isServiceWorkerReady}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isSubscribed
                          ? 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-200'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                      } disabled:opacity-50`}
                    >
                      {subscribeLoading ? '...' : isSubscribed ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>

              {isSubscribed && (
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">Test Notification</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Send a test push to verify it's working</p>
                    </div>
                    <button
                      onClick={handleTestNotification}
                      disabled={testSending}
                      className="px-4 py-2 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      {testSending ? '...' : '🧪 Send Test'}
                    </button>
                  </div>
                </div>
              )}

              {subscriptionCount > 0 && (
                <div className="text-center text-[10px] text-slate-400">
                  {subscriptionCount} active subscriber{subscriptionCount !== 1 ? 's' : ''} across the team
                </div>
              )}
            </div>
          )}

          {/* Email Preferences Tab */}
          {activeTab === 'email' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-extrabold text-slate-900">Email Preferences</p>
                <span className="text-[10px] text-slate-400">{getEnabledEmailCount()} of {emailPreferences.length} enabled</span>
              </div>

              {emailPrefsLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {emailPreferences.map(pref => (
                    <div
                      key={pref.category}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{pref.icon || '📧'}</span>
                        <div>
                          <p className="text-[11px] font-bold text-slate-900">{pref.category_name || pref.category}</p>
                          <p className="text-[9px] text-slate-500 line-clamp-1">{pref.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleEmailPref(pref.category)}
                        disabled={emailToggleLoading === pref.category}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          pref.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                        } ${emailToggleLoading === pref.category ? 'opacity-50' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            pref.enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {emailPreferences.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 text-center">
                    Manage detailed email preferences in{' '}
                    <span className="text-indigo-600 font-bold">Settings → Notifications</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
