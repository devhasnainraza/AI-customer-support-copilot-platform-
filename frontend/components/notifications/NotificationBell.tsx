'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/stores/authStore'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  priority: string
  read: boolean
  created_at: string
}

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const h = () => ({
    Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '')
  })

  useEffect(() => {
    if (!user?.id) return
    fetch(`/v1/notifications/user/${user.id}?limit=20`, { headers: h() })
      .then(r => r.json())
      .then(d => { setNotifications(d.notifications || []); setUnreadCount(d.notifications?.filter((n: NotificationItem) => !n.read).length || 0) })
      .catch(() => {})

    // Poll for new notifications every 30s
    const interval = setInterval(() => {
      if (!user?.id) return
      fetch(`/v1/notifications/user/${user.id}/unread-count`, { headers: h() })
        .then(r => r.json()).then(d => setUnreadCount(d.count || 0)).catch(() => {})
    }, 30000)

    return () => clearInterval(interval)
  }, [user?.id])

  // Close panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const markRead = async (id: string) => {
    if (!user?.id) return
    await fetch(`/v1/notifications/user/${user.id}/mark-read/${id}`, { method: 'POST', headers: h() })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    if (!user?.id) return
    await fetch(`/v1/notifications/user/${user.id}/mark-all-read`, { method: 'POST', headers: h() })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-slate-100 text-slate-600',
    low: 'bg-slate-100 text-slate-500',
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
        <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">Mark all read</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} onClick={() => markRead(n.id)} className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? 'bg-indigo-50/30' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-900 truncate">{n.title}</p>
                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${priorityColors[n.priority] || 'bg-slate-100'}`}>{n.priority}</span>
                        <span className="text-[9px] text-slate-400">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
