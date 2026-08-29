"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/stores/authStore'
import { api } from '@/lib/api'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function CustomerTicketsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/customer/tickets')
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      api.tickets.getTickets().then(d => setTickets(d?.data || [])).catch(console.error).finally(() => setIsLoading(false))
    }
  }, [isAuthenticated])

  if (authLoading) return <div className="flex h-screen items-center justify-center"><div className="text-gray-600">Loading...</div></div>

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const pc: Record<string, string> = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-slate-100 text-slate-700', low: 'bg-slate-100 text-slate-500' }

  return (
    <RoleGuard allowedRoles={["customer"]}>
      <div className="min-h-screen bg-[#fbfbfa] bg-dot-grid">
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md">C</div>
              <span className="font-bold text-lg text-slate-900">Copilot Portal</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/customer/chat" className="text-xs font-bold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-slate-100/50">Support Chat</Link>
              <Link href="/customer/tickets" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">My Tickets</Link>
              <button onClick={() => void logout()} className="rounded-xl border border-rose-200/80 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 cursor-pointer">Sign Out</button>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto p-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">My Tickets ({tickets.length})</h2>
              <Link href="/customer/chat" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer">New Chat</Link>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-slate-600">No tickets yet</p>
                <p className="text-xs text-slate-400 mt-1">Start a chat and tickets will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((t: any) => (
                  <div key={t.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">{t.ticket_number}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${pc[t.priority] || 'bg-slate-100'}`}>{t.priority}</span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{t.status}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{t.category || 'Support'}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{fmt(t.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
