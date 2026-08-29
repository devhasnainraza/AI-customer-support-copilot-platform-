/**
 * Admin Sidebar Component
 * T091: Collapsible sidebar for Admin Portal navigation & telemetry in Light Theme
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/stores/authStore'

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const navItems = [
    {
      name: 'Knowledge Base',
      href: '/admin',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      name: 'Analytics Dashboard',
      href: '/analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      name: 'Agent Management',
      href: '/admin/agents',
    },
    {
      name: 'WhatsApp',
      href: '/admin/whatsapp',
    },
    {
      name: 'Notifications',
      href: '/admin/notifications',
    },
    {
      name: 'System Settings',
      href: '/admin/settings',
    },
    {
      name: 'Agent Workspace',
      href: '/agent',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    }
  ]

  return (
    <aside className="w-64 bg-white text-slate-800 flex flex-col border-r border-slate-200/80 shrink-0 shadow-sm">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md">
            C
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-base leading-tight">Copilot Portal</h1>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Admin Control Center</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 mb-2">
          System Administration
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Realtime System Telemetry Widget */}
      <div className="p-4 m-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-800">System Telemetry</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="space-y-1.5 text-[11px] text-slate-600">
          <div className="flex justify-between">
            <span>Supabase DB:</span>
            <span className="text-emerald-600 font-mono font-bold">Online</span>
          </div>
          <div className="flex justify-between">
            <span>Vector Engine:</span>
            <span className="text-indigo-600 font-mono font-bold">HNSW pgvector</span>
          </div>
          <div className="flex justify-between">
            <span>LLM Model:</span>
            <span className="text-purple-600 font-mono font-bold">Groq Llama-3</span>
          </div>
        </div>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs flex-shrink-0">
            {user?.email?.slice(0, 2).toUpperCase() || 'AD'}
          </div>
          <div className="truncate text-xs">
            <p className="font-bold text-slate-900 truncate">{user?.email || 'Administrator'}</p>
            <p className="text-[10px] text-slate-400 font-medium">System Admin</p>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
          title="Sign Out"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
