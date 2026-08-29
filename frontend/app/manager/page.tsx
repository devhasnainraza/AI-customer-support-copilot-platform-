"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ManagerSidebar } from '@/components/manager/ManagerSidebar'

export default function ManagerPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const [metrics, setMetrics] = useState<any>({})
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/manager')
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const h = { Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') }
    Promise.all([
      fetch('/v1/manager/metrics', { headers: h }).then(r => r.json()).catch(() => ({})),
      fetch('/v1/manager/leaderboard', { headers: h }).then(r => r.json()).catch(() => ({ leaderboard: [] })),
    ]).then(([m, l]) => { setMetrics(m); setLeaderboard(l.leaderboard || []) })
  }, [isAuthenticated])

  if (authLoading) return <div className="flex h-screen items-center justify-center"><div className="text-slate-500 text-sm">Loading...</div></div>

  return (
    <RoleGuard allowedRoles={["manager", "admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <ManagerSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Manager Dashboard</h1>
              <p className="text-xs text-slate-500 mt-0.5">Team performance, escalations, and reports</p>
            </div>
            <button onClick={() => void logout()} className="rounded-xl border border-rose-200/80 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 cursor-pointer">Sign Out</button>
          </header>
          <div className="p-6 space-y-6 max-w-7xl w-full mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Total Conversations', value: metrics.total_conversations || 0, color: 'text-indigo-600' },
                { label: 'Resolved', value: metrics.resolved_conversations || 0, color: 'text-emerald-600' },
                { label: 'Avg Response Time', value: (metrics.avg_response_time || 0) + 's', color: 'text-amber-600' },
                { label: 'Satisfaction', value: (metrics.customer_satisfaction || 0).toFixed(1), color: 'text-purple-600' },
              ].map((m) => (
                <div key={m.label} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{m.label}</span>
                  <div className={`text-2xl font-extrabold mt-1 ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">Team Leaderboard</h2>
              {leaderboard.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No performance data yet</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((a: any) => (
                    <div key={a.agent_id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-lg font-black text-indigo-600 w-8 text-center">#{a.rank}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">{a.name}</p>
                        <p className="text-[10px] text-slate-400">{a.conversations} conversations</p>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-600">{a.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link href="/manager/team" className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition-all cursor-pointer">
                <h3 className="text-sm font-bold text-slate-900">Team Performance</h3>
                <p className="text-xs text-slate-400 mt-1">Individual agent metrics</p>
              </Link>
              <Link href="/manager/escalations" className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-rose-200 transition-all cursor-pointer">
                <h3 className="text-sm font-bold text-slate-900">Escalation Review</h3>
                <p className="text-xs text-slate-400 mt-1">Approve or reject escalations</p>
              </Link>
              <Link href="/manager/reports" className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-amber-200 transition-all cursor-pointer">
                <h3 className="text-sm font-bold text-slate-900">Reports</h3>
                <p className="text-xs text-slate-400 mt-1">Generate performance reports</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
