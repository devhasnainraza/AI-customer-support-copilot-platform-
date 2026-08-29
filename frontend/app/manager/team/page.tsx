"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ManagerSidebar } from '@/components/manager/ManagerSidebar'

export default function ManagerTeamPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/manager/team')
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      const h = { Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') }
      fetch('/v1/admin/agents', { headers: h }).then(r => r.json()).then(d => setAgents(d.agents || [])).catch(() => {})
    }
  }, [isAuthenticated])

  return (
    <RoleGuard allowedRoles={["manager", "admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <ManagerSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Team Performance</h1>
            <p className="text-xs text-slate-500 mt-0.5">Individual agent metrics</p>
          </header>
          <div className="p-6 max-w-7xl w-full mx-auto">
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Team Members ({agents.length})</h2>
              </div>
              {agents.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">No agents registered yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {agents.map((a: any) => (
                    <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/80 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs">{a.name?.slice(0, 2).toUpperCase()}</div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">{a.name}</p>
                        <p className="text-[10px] text-slate-400">{a.email}</p>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${a.role === 'manager' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>{a.role}</span>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{a.conversations_handled}</p>
                        <p className="text-[10px] text-slate-400">conversations</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
