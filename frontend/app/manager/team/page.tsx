'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { getAuthToken } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ManagerTeamPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [agents, setAgents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/manager/team')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      void (async () => {
        try {
          const token = await getAuthToken()
          const h = { Authorization: token ? `Bearer ${token}` : '' }
          const res = await fetch(`${API}/v1/admin/agents`, { headers: h })
          if (res.ok) {
            const d = await res.json()
            setAgents(d.agents || [])
          }
        } catch {
          // Ignore
        } finally {
          setIsLoading(false)
        }
      })()
    }
  }, [isAuthenticated])

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Team Workload & Capacity Roster
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Monitor agent live presence, active conversation concurrency, and load balance queues.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-vip badge-vip-indigo">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            {agents.length} Total Specialists
          </span>
        </div>
      </div>

      {/* Agents Roster Table */}
      <div className="surface-vip overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Active Team Members ({agents.length})
          </h2>
        </div>
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            No agents found. Provision accounts in the Admin console.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {agents.map((a: any) => (
              <div key={a.id} className="p-4.5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-100 to-indigo-100 text-purple-700 font-extrabold flex items-center justify-center text-xs shadow-2xs shrink-0 border border-purple-200/50">
                  {a.name?.slice(0, 2).toUpperCase() || 'TM'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{a.name}</p>
                  <p className="text-[11px] text-slate-400 font-medium truncate">{a.email}</p>
                </div>
                <span className={`badge-vip ${
                  a.status === 'active'
                    ? 'badge-vip-emerald'
                    : 'badge-vip-slate'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-emerald-500 radar-live' : 'bg-slate-400'}`} />
                  {a.status}
                </span>
                <span className={`badge-vip ${
                  a.role === 'manager' ? 'badge-vip-purple' : 'badge-vip-indigo'
                }`}>
                  {a.role}
                </span>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-slate-900">{a.conversations_handled || 0}</p>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">handled</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
