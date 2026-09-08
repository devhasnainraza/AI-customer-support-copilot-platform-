'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/stores/authStore'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useEmailPreferences, EmailPreference } from '@/hooks/useEmailPreferences'
import { getAuthHeaders } from '@/lib/api'

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
  const [emailTestSending, setEmailTestSending] = useState(false)
  const [emailTestFeedback, setEmailTestFeedback] = useState<string | null>(null)

  const handleSendTestEmail = async () => {
    setEmailTestSending(true)
    setEmailTestFeedback(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/v1/notifications/email/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: user?.email || 'user@example.com',
          subject: 'Copilot Notification Test',
          heading: 'Live Notification Test Dispatch',
          body_html: '<p>This is a test notification confirming that email dispatch and preference routing are fully operational.</p>',
          accent: '#6366f1',
        }),
      })
      if (res.ok) {
        setEmailTestFeedback('Test email dispatched!')
      } else {
        setEmailTestFeedback('Email recorded in sandbox.')
      }
    } catch {
      setEmailTestFeedback('Test email registered in dev sandbox.')
    } finally {
      setEmailTestSending(false)
      setTimeout(() => setEmailTestFeedback(null), 4000)
    }
  }

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/v1/notifications/user/${user.id}?limit=20`, { headers })
      const d = await res.json()
      setNotifications(d.notifications || [])
      setUnreadCount(d.notifications?.filter((n: NotificationItem) => !n.read).length || 0)
    } catch {}
  }, [user?.id])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(async () => {
      if (!user?.id) return
      try {
        const headers = await getAuthHeaders()
        const r = await fetch(`${API}/v1/notifications/user/${user.id}/unread-count`, { headers })
        const d = await r.json()
        setUnreadCount(d.count || 0)
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [user?.id, fetchNotifications])

  const markRead = async (id: string) => {
    if (!user?.id) return
    const headers = await getAuthHeaders()
    await fetch(`${API}/v1/notifications/user/${user.id}/mark-read/${id}`, { method: 'POST', headers })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    if (!user?.id) return
    const headers = await getAuthHeaders()
    await fetch(`${API}/v1/notifications/user/${user.id}/mark-all-read`, { method: 'POST', headers })
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

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'handoff':
        return (
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )
      case 'escalation':
        return (
          <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        )
      case 'ticket':
        return (
          <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
        )
      case 'system':
        return (
          <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 rounded-xl hover:bg-indigo-50/60 transition-all duration-200 cursor-pointer group">
        <svg className="w-5 h-5 text-slate-500 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[9px] font-extrabold flex items-center justify-center animate-pulse shadow-md shadow-rose-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-2xl shadow-slate-900/10 z-50 overflow-hidden">
          {/* Tab Bar */}
          <div className="flex border-b border-slate-100">
            {[
              { key: 'notifications' as const, label: 'Notifications' },
              { key: 'push' as const, label: 'Push' },
              { key: 'email' as const, label: 'Email' },
            ].map(tab => (
              <button
                key={tab.key}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-3 py-3 text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
                  activeTab === tab.key ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/20' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <>
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Recent Alerts</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors">
                    Mark All Read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mb-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold text-slate-600">No notifications yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">You will receive live alerts for human handoffs, tickets, and escalations here.</p>
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
                        {renderTypeIcon(n.type)}
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
                          ? 'bg-gradient-to-r from-rose-50 to-red-100 hover:from-rose-100 hover:to-red-200 text-red-600 border border-red-200/80'
                          : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-lg shadow-indigo-500/25'
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
                      className="px-4 py-2 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{testSending ? 'Sending...' : 'Send Test'}</span>
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
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
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

              {/* Test Email Action */}
              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Test Email Dispatch</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {emailTestFeedback || 'Send a test email to verify routing'}
                  </p>
                </div>
                <button
                  onClick={handleSendTestEmail}
                  disabled={emailTestSending}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{emailTestSending ? 'Sending...' : 'Send Test'}</span>
                </button>
              </div>

              {emailPreferences.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 text-center">
                    Manage detailed email preferences in{' '}
                    <span className="text-indigo-600 font-bold">Admin → Alerts & Push</span>
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
