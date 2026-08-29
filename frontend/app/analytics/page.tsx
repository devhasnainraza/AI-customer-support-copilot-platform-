/**
 * Analytics Dashboard Page
 * T155: Management analytics dashboard page with real-time KPI overview & trends in Modern Light Theme
 * Role Protected: Admin & Agent Only
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth, getUserRole } from '@/stores/authStore'
import {
  api,
  OverviewMetrics,
  ResolutionRatePoint,
  ResponseTimePoint,
  TopicMetric,
  CostMetrics,
  AgentPerformanceMetric
} from '@/lib/api'
import { Overview } from '@/components/analytics/Overview'
import { ResolutionChart } from '@/components/analytics/ResolutionChart'
import { ResponseTimeChart } from '@/components/analytics/ResponseTimeChart'
import { TopTopics } from '@/components/analytics/TopTopics'
import { CostBreakdown } from '@/components/analytics/CostBreakdown'
import { AgentPerformance } from '@/components/analytics/AgentPerformance'

export default function AnalyticsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const role = getUserRole(user)

  const [dateRange, setDateRange] = useState<number>(30)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const [overview, setOverview] = useState<OverviewMetrics | null>(null)
  const [resolutionTrend, setResolutionTrend] = useState<ResolutionRatePoint[]>([])
  const [responseTimeTrend, setResponseTimeTrend] = useState<ResponseTimePoint[]>([])
  const [topics, setTopics] = useState<TopicMetric[]>([])
  const [costs, setCosts] = useState<CostMetrics | null>(null)
  const [agents, setAgents] = useState<AgentPerformanceMetric[]>([])

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/analytics')
      } else if (role === 'customer') {
        router.push('/chat')
      }
    }
  }, [authLoading, isAuthenticated, role, router])

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [ov, res, resp, top, cst, agt] = await Promise.all([
          api.analytics.getOverview(dateRange),
          api.analytics.getResolutionRate(7),
          api.analytics.getResponseTimes(7),
          api.analytics.getTopTopics(),
          api.analytics.getCosts(dateRange),
          api.analytics.getAgentPerformance()
        ])
        setOverview(ov)
        setResolutionTrend(res)
        setResponseTimeTrend(resp)
        setTopics(top)
        setCosts(cst)
        setAgents(agt)
      } catch (err) {
        console.error('Failed to load analytics dashboard data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (isAuthenticated && role !== 'customer') {
      void loadData()
    }
  }, [isAuthenticated, role, dateRange])

  if (authLoading || (isAuthenticated && role === 'customer')) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbfbfa] text-slate-500 text-sm font-semibold">
        Verifying authorization credentials...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] bg-dot-grid text-slate-900">
      {/* Navigation Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md">
                C
              </div>
              <span className="font-bold text-lg text-slate-900">Copilot Portal</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-slate-600">Analytics Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>

            {role === 'admin' && (
              <Link
                href="/admin"
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-indigo-600 text-white transition-all shadow-md"
              >
                Admin Center
              </Link>
            )}

            <button
              onClick={() => void logout()}
              className="rounded-xl border border-rose-200/80 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Sign Out"
            >
              <span>Sign Out</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Support Operations & Performance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time telemetry, AI self-service resolution rates, latency trends, and ROI metrics.
          </p>
        </div>

        {/* Overview KPI Cards */}
        <Overview metrics={overview} isLoading={isLoading} />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ResolutionChart data={resolutionTrend} isLoading={isLoading} />
          <ResponseTimeChart data={responseTimeTrend} isLoading={isLoading} />
        </div>

        {/* Topics & Cost Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <TopTopics data={topics} isLoading={isLoading} />
          <CostBreakdown data={costs} isLoading={isLoading} />
        </div>

        {/* Human Agent Performance */}
        <div className="mb-12">
          <AgentPerformance agents={agents} isLoading={isLoading} />
        </div>
      </main>
    </div>
  )
}
