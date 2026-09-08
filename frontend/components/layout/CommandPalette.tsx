'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, getUserRole } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  category: 'Navigation' | 'Actions' | 'Settings'
  icon: React.ReactNode
  shortcut?: string
  action: () => void
  roles?: ('admin' | 'manager' | 'agent' | 'customer')[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const role = getUserRole(user) || 'customer'
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const allItems: CommandItem[] = useMemo(() => [
    // Customer Nav
    {
      id: 'nav-chat',
      title: 'Support Live Chat',
      subtitle: 'AI Copilot assistance & real-time answers',
      category: 'Navigation',
      roles: ['customer'],
      icon: (
        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      shortcut: 'G C',
      action: () => router.push('/customer/chat'),
    },
    {
      id: 'nav-tickets',
      title: 'My Support Tickets',
      subtitle: 'Track status, SLA and ticket history',
      category: 'Navigation',
      roles: ['customer'],
      icon: (
        <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      shortcut: 'G T',
      action: () => router.push('/customer/tickets'),
    },
    // Agent Nav
    {
      id: 'nav-agent',
      title: 'Agent Escalation Cockpit',
      subtitle: 'Real-time customer queue and AI draft assistance',
      category: 'Navigation',
      roles: ['agent'],
      icon: (
        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      shortcut: 'G A',
      action: () => router.push('/agent'),
    },
    {
      id: 'nav-agent-tickets',
      title: 'Assigned Tickets Workbench',
      subtitle: 'Review and update tickets assigned to you',
      category: 'Navigation',
      roles: ['agent'],
      icon: (
        <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      action: () => router.push('/tickets'),
    },
    // Manager Nav
    {
      id: 'nav-manager',
      title: 'Manager Dashboard',
      subtitle: 'Overview, team metrics, and customer satisfaction',
      category: 'Navigation',
      roles: ['manager'],
      icon: (
        <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      shortcut: 'G M',
      action: () => router.push('/manager'),
    },
    {
      id: 'nav-team',
      title: 'Team Workload & Capacity',
      subtitle: 'Agent presence, active chats, and load balancing',
      category: 'Navigation',
      roles: ['manager'],
      icon: (
        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      action: () => router.push('/manager/team'),
    },
    {
      id: 'nav-escalations',
      title: 'Escalation Review',
      subtitle: 'Approve or route escalated tickets',
      category: 'Navigation',
      roles: ['manager'],
      icon: (
        <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      action: () => router.push('/manager/escalations'),
    },
    {
      id: 'nav-reports',
      title: 'Analytics Reports',
      subtitle: 'CSAT, volume, and response time reports',
      category: 'Navigation',
      roles: ['manager'],
      icon: (
        <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      action: () => router.push('/manager/reports'),
    },
    // Admin Nav
    {
      id: 'nav-admin-kb',
      title: 'Knowledge Base & Vector Index',
      subtitle: 'Manage RAG docs and inspect pgvector embeddings',
      category: 'Navigation',
      roles: ['admin'],
      icon: (
        <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      shortcut: 'G K',
      action: () => router.push('/admin'),
    },
    {
      id: 'nav-admin-agents',
      title: 'Agent Roster & Capacity',
      subtitle: 'Manage support staff, permissions, and routing',
      category: 'Navigation',
      roles: ['admin'],
      icon: (
        <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      action: () => router.push('/admin/agents'),
    },
    {
      id: 'nav-admin-whatsapp',
      title: 'WhatsApp Cloud Integration',
      subtitle: 'Webhooks, templates, and omni-channel sync',
      category: 'Navigation',
      roles: ['admin'],
      icon: (
        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      action: () => router.push('/admin/whatsapp'),
    },
    {
      id: 'nav-admin-settings',
      title: 'LLM & System Settings',
      subtitle: 'Groq Llama 3.3 models, temperature, guardrails',
      category: 'Settings',
      roles: ['admin'],
      icon: (
        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      shortcut: 'G S',
      action: () => router.push('/admin/settings'),
    },
    {
      id: 'nav-analytics',
      title: 'BI & Executive Analytics',
      subtitle: 'KPI overview, resolution rates, token costs',
      category: 'Navigation',
      roles: ['admin', 'manager', 'agent'],
      icon: (
        <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      action: () => router.push('/analytics'),
    },
    // Actions
    {
      id: 'act-new-chat',
      title: 'Start New Conversation',
      subtitle: 'Open a fresh AI assistant session',
      category: 'Actions',
      roles: ['customer', 'agent'],
      icon: (
        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      shortcut: 'N',
      action: () => {
        useChatStore.getState().reset()
        router.push(`/customer/chat?new=${Date.now()}`)
      },
    },
    {
      id: 'act-logout',
      title: 'Sign Out',
      subtitle: 'End your current session safely',
      category: 'Actions',
      icon: (
        <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      action: () => void logout(),
    },
  ], [router, logout])

  // Strictly filter items by role and query
  const filteredItems = useMemo(() => {
    return allItems
      .filter((item) => {
        if (item.roles && !item.roles.includes(role as any)) {
          return false
        }
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        )
      })
  }, [allItems, query, role])

  // Handle keyboard events inside palette
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action()
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden z-10 flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200/80 gap-3">
          <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder={`Search ${role} commands, pages, or quick actions...`}
            className="flex-1 bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1">Try searching for available actions</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action()
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {item.title}
                        </p>
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {item.shortcut && (
                    <kbd className={`hidden sm:inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${
                      isSelected ? 'bg-indigo-700/60 text-white' : 'bg-slate-100 border border-slate-200 text-slate-500'
                    }`}>
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="border-t border-slate-200/80 bg-slate-50/70 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-3">
            <span><kbd className="font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-xs">↑↓</kbd> Navigate</span>
            <span><kbd className="font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-xs">↵</kbd> Select</span>
            <span><kbd className="font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-xs">ESC</kbd> Close</span>
          </div>
          <span className="font-semibold text-slate-400 capitalize">{role} Workspace Command</span>
        </div>
      </div>
    </div>
  )
}
