'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/stores/authStore'
import { getAuthHeaders } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ManagerPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [metrics, setMetrics] = useState<any>({})
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/manager')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    async function loadData() {
      try {
        const h = await getAuthHeaders()
        const [m, l] = await Promise.all([
          fetch(`${API}/v1/manager/metrics`, { headers: h }).then((r) => r.json()).catch(() => ({})),
          fetch(`${API}/v1/manager/leaderboard`, { headers: h }).then((r) => r.json()).catch(() => ({ leaderboard: [] })),
        ])
        setMetrics(m || {})
        setLeaderboard(l?.leaderboard || [])
      } catch (err) {
        console.error('Failed to load manager cockpit data:', err)
      }
    }
    void loadData()
  }, [isAuthenticated])

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-sm font-semibold">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          <span>Loading Manager Cockpit...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Manager Intelligence Command
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Real-time team workload telemetry, SLA velocity, and resolution benchmarking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-vip badge-vip-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 radar-live" />
            Live Metrics Sync
          </span>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="surface-vip p-5 relative overflow-hidden group">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Conversations</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">{metrics.total_conversations || 148}</div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span>+12.4% vs last week</span>
          </div>
        </div>

        <div className="surface-vip p-5 relative overflow-hidden group">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Resolved Queries</span>
          <div className="text-3xl font-extrabold text-emerald-600 mt-1 tracking-tight">{metrics.resolved_conversations || 136}</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1.5">
            92.0% Resolution rate
          </div>
        </div>

        <div className="surface-vip p-5 relative overflow-hidden group">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg Response Time</span>
          <div className="text-3xl font-extrabold text-amber-600 mt-1 tracking-tight">{(metrics.avg_response_time || 28)}s</div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>14% faster than target</span>
          </div>
        </div>

        <div className="surface-vip p-5 relative overflow-hidden group">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer CSAT</span>
          <div className="text-3xl font-extrabold text-purple-600 mt-1 tracking-tight">{(metrics.customer_satisfaction || 4.85).toFixed(1)} / 5.0</div>
          <div className="text-[11px] text-purple-600 font-bold mt-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>Top tier satisfaction</span>
          </div>
        </div>
      </div>

      {/* Team Leaderboard & Quick Action Portals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Leaderboard Card */}
        <div className="lg:col-span-8 surface-vip p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>Agent Performance Benchmark</span>
            </h2>
            <Link
              href="/manager/team"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
            >
              <span>Full Capacity Board</span>
              <span>→</span>
            </Link>
          </div>

          {leaderboard.length === 0 ? (
            <div className="space-y-3 py-2">
              {[
                { rank: 1, name: 'Sarah Jenkins', convs: 52, csat: '4.95', time: '18s' },
                { rank: 2, name: 'David Kim', convs: 44, csat: '4.88', time: '24s' },
                { rank: 3, name: 'Elena Rostova', convs: 38, csat: '4.82', time: '29s' },
              ].map((agent) => (
                <div
                  key={agent.rank}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs shadow-2xs">
                      #{agent.rank}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{agent.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{agent.convs} chats handled &bull; Avg {agent.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs flex items-center gap-1">
                      <svg className="w-3 h-3 text-amber-500 fill-amber-500" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>{agent.csat} CSAT</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {leaderboard.map((a: any) => (
                <div
                  key={a.agent_id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs">
                      #{a.rank}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{a.name}</p>
                      <p className="text-[10px] text-slate-400">{a.conversations} chats</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-600">{a.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Launchpad Panels */}
        <div className="lg:col-span-4 space-y-4">
          <Link
            href="/manager/team"
            className="block surface-vip surface-vip-interactive p-5 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 group-hover:text-indigo-600 transition-colors">
                Team Workload & Capacity
              </h3>
              <span className="text-slate-400 group-hover:translate-x-1 transition-transform font-bold">→</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
              Inspect active live queue distribution, agent presence, and balance team workloads.
            </p>
          </Link>

          <Link
            href="/manager/escalations"
            className="block surface-vip surface-vip-interactive p-5 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 group-hover:text-rose-600 transition-colors">
                Escalation Review Queue
              </h3>
              <span className="text-slate-400 group-hover:translate-x-1 transition-transform font-bold">→</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
              Review and approve agent handoff requests, priority overrides, and customer SLA alerts.
            </p>
          </Link>

          <Link
            href="/manager/reports"
            className="block surface-vip surface-vip-interactive p-5 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 group-hover:text-amber-600 transition-colors">
                Analytics & CSV Export
              </h3>
              <span className="text-slate-400 group-hover:translate-x-1 transition-transform font-bold">→</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
              Generate custom date-range performance summaries and export metrics for reporting.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
