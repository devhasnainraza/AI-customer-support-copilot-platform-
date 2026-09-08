'use client'

import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth, getUserRole } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { getAuthToken } from '@/lib/api'

interface NavItem {
  name: string
  href: string
  icon: React.ReactNode
  badge?: string | number
  badgeColor?: string
  roles?: ('admin' | 'manager' | 'agent' | 'customer')[]
  shortcut?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
  roles?: ('admin' | 'manager' | 'agent' | 'customer')[]
}

interface ConversationItem {
  id: string
  started_at: string
  status: string
  lastMessage?: string
  lastMessageTime?: string
  pinned?: boolean
}

interface GlobalSidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen?: boolean
  onCloseMobile?: () => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const MIN_WIDTH = 220
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 270

type UserPresenceStatus = 'online' | 'busy' | 'away' | 'offline'

function GlobalSidebarInner({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}: GlobalSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, logout, isAuthenticated } = useAuth()
  const role = getUserRole(user) || 'customer'
  
  // Presence & status
  const [presence, setPresence] = useState<UserPresenceStatus>('online')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Load custom width & presence from localStorage
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('copilot.sidebar.width')
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10)
        if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
          setSidebarWidth(parsed)
        }
      }
      const savedPresence = localStorage.getItem('copilot.user.presence') as UserPresenceStatus
      if (savedPresence) setPresence(savedPresence)
    } catch {}
  }, [])

  const handlePresenceChange = (newStatus: UserPresenceStatus) => {
    setPresence(newStatus)
    setShowStatusMenu(false)
    try {
      localStorage.setItem('copilot.user.presence', newStatus)
    } catch {}
  }

  // Close status menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Drag handle for resizing
  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault()
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX
        if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
          setSidebarWidth(newWidth)
          try {
            localStorage.setItem('copilot.sidebar.width', newWidth.toString())
          } catch {}
        }
      }
    },
    [isResizing]
  )

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, resize, stopResizing])

  // Recent chat conversations state
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const currentConversationId = searchParams?.get('conversation') || null

  // Fetch recent conversations
  const fetchRecentConversations = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      setIsLoadingChats(true)
      const token = await getAuthToken()
      const res = await fetch(`${API_BASE}/v1/chat/conversations?limit=30`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setConversations(
          data.map((c: any) => ({
            id: c.id,
            started_at: c.started_at,
            status: c.status,
            lastMessage: c.title || c.last_message || `Chat #${c.id.slice(0, 6)}`,
            lastMessageTime: c.updated_at || c.started_at,
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load recent chats in sidebar:', err)
    } finally {
      setIsLoadingChats(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchRecentConversations()
  }, [fetchRecentConversations, pathname])

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        onToggleCollapse()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggleCollapse])

  const handleStartNewChat = () => {
    onCloseMobile?.()
    useChatStore.getState().reset()
    router.push(`/customer/chat?new=${Date.now()}`)
  }

  const formatRelativeTime = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'now'
    if (diffMin < 60) return `${diffMin}m`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Navigation Groups with SVGs and Shortcuts
  const navigationGroups: NavGroup[] = [
    {
      title: 'Customer Support',
      roles: ['customer'],
      items: [
        {
          name: 'Live Support Chat',
          href: '/customer/chat',
          roles: ['customer'],
          shortcut: 'C',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
        {
          name: 'My Support Tickets',
          href: '/customer/tickets',
          roles: ['customer'],
          shortcut: 'T',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Agent Operations',
      roles: ['agent'],
      items: [
        {
          name: 'Escalation Cockpit',
          href: '/agent',
          roles: ['agent'],
          badge: 'Live',
          badgeColor: 'badge-vip-emerald',
          shortcut: 'E',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        },
        {
          name: 'Assigned Tickets',
          href: '/tickets',
          roles: ['agent'],
          shortcut: 'T',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Management & Control',
      roles: ['manager'],
      items: [
        {
          name: 'Manager Dashboard',
          href: '/manager',
          roles: ['manager'],
          shortcut: 'D',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          ),
        },
        {
          name: 'Team Roster',
          href: '/manager/team',
          roles: ['manager'],
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          name: 'Escalation Review',
          href: '/manager/escalations',
          roles: ['manager'],
          badge: 'Alerts',
          badgeColor: 'badge-vip-rose',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        },
        {
          name: 'Reports & Export',
          href: '/manager/reports',
          roles: ['manager'],
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Administration',
      roles: ['admin'],
      items: [
        {
          name: 'Knowledge Base & RAG',
          href: '/admin',
          roles: ['admin'],
          shortcut: 'K',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          ),
        },
        {
          name: 'Agent Accounts',
          href: '/admin/agents',
          roles: ['admin'],
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
        {
          name: 'WhatsApp Business',
          href: '/admin/whatsapp',
          roles: ['admin'],
          badge: 'Meta',
          badgeColor: 'badge-vip-emerald',
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
        {
          name: 'Alerts & Push',
          href: '/admin/notifications',
          roles: ['admin'],
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
        },
        {
          name: 'AI Configuration',
          href: '/admin/settings',
          roles: ['admin'],
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'BI Intelligence',
      roles: ['admin', 'manager', 'agent'],
      items: [
        {
          name: 'Executive Analytics',
          href: '/analytics',
          roles: ['admin', 'manager', 'agent'],
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
      ],
    },
  ]

  // Filter groups strictly based on user's registered role
  const visibleGroups = useMemo(() => {
    return navigationGroups
      .filter((group) => !group.roles || group.roles.includes(role as any))
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.roles || item.roles.includes(role as any)),
      }))
      .filter((group) => group.items.length > 0)
  }, [role])

  const computedWidth = isCollapsed ? 72 : sidebarWidth

  const presenceConfig: Record<UserPresenceStatus, { label: string; color: string; ring: string }> = {
    online: { label: 'Online & Available', color: 'bg-emerald-500', ring: 'ring-emerald-400/30' },
    busy: { label: 'In Session / Busy', color: 'bg-rose-500', ring: 'ring-rose-400/30' },
    away: { label: 'Away / Inactive', color: 'bg-amber-500', ring: 'ring-amber-400/30' },
    offline: { label: 'Invisible', color: 'bg-slate-400', ring: 'ring-slate-300/30' },
  }

  const sidebarContent = (
    <aside
      ref={sidebarRef}
      style={{ width: `${computedWidth}px` }}
      className={`relative flex flex-col h-full bg-[#fcfcfd] border-r border-slate-200/80 transition-all select-none ${
        isResizing ? 'transition-none' : 'duration-200'
      }`}
    >
      {/* ── CENTERED FLOATING COLLAPSE TOGGLE BUTTON ── */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3.5 z-50 h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer group"
        title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
        aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 text-slate-500 group-hover:text-indigo-600 ${
            isCollapsed ? 'rotate-180' : 'rotate-0'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-3.5 border-b border-slate-200/70 bg-white/70 backdrop-blur-xs shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 overflow-hidden group"
          onClick={() => onCloseMobile?.()}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-600 text-white font-black text-sm shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform shrink-0">
            CP
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 transition-opacity duration-200">
              <span className="font-display text-sm font-extrabold tracking-tight text-slate-900 leading-tight truncate">
                Copilot Platform
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 truncate">
                {role ? `${role} portal` : 'AI Suite'}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Primary Action Button: + New Conversation (for customer role) */}
      {role === 'customer' && (
        <div className="p-3 border-b border-slate-200/60 bg-white shrink-0">
          {isCollapsed ? (
            <button
              onClick={handleStartNewChat}
              className="w-full flex items-center justify-center h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 transition-all cursor-pointer active:scale-95"
              title="Start New Conversation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleStartNewChat}
              className="btn-vip-primary w-full flex items-center justify-center gap-2 py-2 text-xs font-bold shadow-xs cursor-pointer active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Conversation</span>
            </button>
          )}
        </div>
      )}

      {/* Navigation Group Items & Integrated Chat History */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        {/* Navigation Sections */}
        {visibleGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5 pt-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onCloseMobile?.()}
                    title={isCollapsed ? item.name : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-all duration-150 ${
                      isActive
                        ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                        : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    {/* Active Accent Indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 rounded-r-full" />
                    )}

                    <span className={`shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="truncate flex-1 font-semibold">{item.name}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${isActive ? 'bg-indigo-50 text-indigo-700' : item.badgeColor || 'badge-vip-indigo'}`}>
                        {item.badge}
                      </span>
                    )}
                    {!isCollapsed && item.shortcut && (
                      <span className="text-[9px] font-mono font-medium text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.shortcut}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* ── INTEGRATED RECENT CHAT HISTORY (For customer role only) ── */}
        {!isCollapsed && role === 'customer' && (
          <div className="pt-3 border-t border-slate-200/60 space-y-2">
            <div className="flex items-center justify-between px-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Recent Chats
              </span>
              <button
                onClick={() => fetchRecentConversations()}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                title="Sync recent conversations"
              >
                Sync
              </button>
            </div>

            <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1">
              {isLoadingChats && conversations.length === 0 ? (
                <div className="px-2.5 py-2 text-[11px] text-slate-400">Loading history...</div>
              ) : conversations.length === 0 ? (
                <div className="px-2.5 py-3 text-center text-[11px] text-slate-400">
                  No previous chats yet
                </div>
              ) : (
                conversations.map((c) => {
                  const isCurrent = currentConversationId === c.id
                  return (
                    <Link
                      key={c.id}
                      href={`/customer/chat?conversation=${c.id}`}
                      onClick={() => onCloseMobile?.()}
                      className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                        isCurrent
                          ? 'bg-white text-indigo-700 font-bold border border-indigo-100 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100/60 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          c.status === 'active' ? 'bg-emerald-500 radar-live' : 'bg-slate-300'
                        }`} />
                        <span className="truncate text-[11px]">{c.lastMessage}</span>
                      </div>
                      <span suppressHydrationWarning className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(c.lastMessageTime || c.started_at)}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        )}
      </nav>

      {/* User Profile & Status Footer */}
      <div className="border-t border-slate-200/80 p-2.5 bg-white/70 shrink-0 relative" ref={statusMenuRef}>
        {/* Presence Status Popover Menu */}
        {showStatusMenu && !isCollapsed && (
          <div className="absolute bottom-full left-2 right-2 mb-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 animate-fade-in space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Set Availability Status
            </div>
            {(['online', 'busy', 'away', 'offline'] as UserPresenceStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => handlePresenceChange(st)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  presence === st ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${presenceConfig[st].color}`} />
                <span className="flex-1 capitalize">{presenceConfig[st].label}</span>
                {presence === st && (
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div
            onClick={() => !isCollapsed && setShowStatusMenu(!showStatusMenu)}
            className={`flex items-center gap-2.5 min-w-0 ${!isCollapsed ? 'cursor-pointer hover:opacity-80 transition-opacity flex-1' : ''}`}
          >
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-extrabold text-xs shadow-xs">
                {user?.email?.slice(0, 2).toUpperCase() || 'US'}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ring-2 ${presenceConfig[presence].ring} ${presenceConfig[presence].color} transition-all`}
              />
            </div>

            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {(user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'User'}
                </span>
                <span className="text-[10px] text-slate-400 capitalize truncate flex items-center gap-1">
                  <span>{role}</span>
                  <span>&bull;</span>
                  <span className="font-semibold text-slate-600">{presence}</span>
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={() => void logout()}
              title="Sign Out"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── DRAGGABLE / RESIZABLE RIGHT HANDLE ── */}
      {!isCollapsed && (
        <div
          onMouseDown={startResizing}
          title="Drag to resize sidebar width"
          className="hidden md:block absolute right-0 top-0 bottom-0 w-1.5 hover:w-2 hover:bg-indigo-400 active:bg-indigo-600 transition-all cursor-col-resize z-40 group"
        >
          <div className="h-full w-full opacity-0 group-hover:opacity-100 bg-indigo-500/40 transition-opacity" />
        </div>
      )}
    </aside>
  )

  return (
    <>
      {/* Desktop Sticky Resizable Sidebar (Elevated forward over page content) */}
      <div className="hidden md:flex shrink-0 h-screen sticky top-0 z-30 shadow-md shadow-slate-900/5">
        {sidebarContent}
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 max-w-xs w-full shadow-2xl z-10 animate-slide-in-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}

export function GlobalSidebar(props: GlobalSidebarProps) {
  return (
    <Suspense
      fallback={
        <aside
          className={`flex flex-col h-full bg-[#fcfcfd] border-r border-slate-200/80 transition-all duration-300 ${
            props.isCollapsed ? 'w-[72px]' : 'w-[270px]'
          }`}
        />
      }
    >
      <GlobalSidebarInner {...props} />
    </Suspense>
  )
}
