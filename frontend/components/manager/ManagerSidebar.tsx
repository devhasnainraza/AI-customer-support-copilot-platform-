'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/stores/authStore'

export function ManagerSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const nav = [
    { name: 'Dashboard', href: '/manager', icon: '\u{1F4CA}' },
    { name: 'Team Performance', href: '/manager/team', icon: '\u{1F465}' },
    { name: 'Escalation Review', href: '/manager/escalations', icon: '\u{1F6A8}' },
    { name: 'Reports', href: '/manager/reports', icon: '\u{1F4CB}' },
  ]

  return (
    <aside className="w-64 bg-white text-slate-800 flex flex-col border-r border-slate-200/80 shrink-0 shadow-sm">
      <div className="p-6 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md">C</div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-base leading-tight">Copilot Portal</h1>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600">Manager Console</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 mb-2">Team Management</div>
        {nav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:text-purple-600 hover:bg-purple-50/60'}`}>
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <Link href="/admin" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60 transition-all mb-2">
          <span>Admin Panel</span>
        </Link>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center text-xs flex-shrink-0">{user?.email?.slice(0, 2).toUpperCase() || 'MG'}</div>
          <div className="truncate text-xs flex-1">
            <p className="font-bold text-slate-900 truncate">{user?.email || 'Manager'}</p>
            <p className="text-[10px] text-slate-400 font-medium">Team Manager</p>
          </div>
          <button onClick={() => void logout()} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors" title="Sign Out">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
