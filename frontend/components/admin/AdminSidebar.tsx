'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/stores/authStore'

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const navItems = [
    { name: 'Knowledge Base', href: '/admin', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { name: 'Analytics', href: '/analytics', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { name: 'Agents', href: '/admin/agents' },
    { name: 'WhatsApp', href: '/admin/whatsapp' },
    { name: 'Notifications', href: '/admin/notifications' },
    { name: 'Settings', href: '/admin/settings' },
    { name: 'Agent Workspace', href: '/agent', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  ]

  return (
    <aside className="w-60 bg-white text-gray-800 flex flex-col border-r border-gray-200 shrink-0">
      <div className="p-5 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">C</div>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm leading-tight">Copilot Portal</h1>
            <span className="text-[10px] text-gray-500 font-medium">Admin</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 px-3 mb-2">Administration</div>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href} className={'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ' + (isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')}>
              {item.icon}
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-3 m-3 rounded-lg bg-gray-50 border border-gray-200 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-700">System Status</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
        <div className="space-y-1 text-[11px] text-gray-500">
          <div className="flex justify-between"><span>Database</span><span className="text-emerald-600 font-medium">Online</span></div>
          <div className="flex justify-between"><span>Vector Engine</span><span className="text-gray-700 font-medium">pgvector</span></div>
          <div className="flex justify-between"><span>LLM</span><span className="text-gray-700 font-medium">Groq</span></div>
        </div>
      </div>
      <div className="p-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-medium flex items-center justify-center text-[10px] shrink-0">{user?.email?.slice(0, 2).toUpperCase() || 'AD'}</div>
          <div className="truncate text-xs"><p className="font-medium text-gray-900 truncate">{user?.email || 'Admin'}</p><p className="text-[10px] text-gray-400">System Admin</p></div>
        </div>
        <button onClick={() => void logout()} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer" title="Sign Out">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
    </aside>
  )
}
