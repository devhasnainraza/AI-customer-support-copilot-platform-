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
        router.push('/customer/chat')
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
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black tracking-tight text-slate-900">
              Executive Analytics & Telemetry
            </h1>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
              Real-time BI
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry, AI self-service resolution rates, latency trends, and ROI token economics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
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
        <div className="mb-6">
          <AgentPerformance agents={agents} isLoading={isLoading} />
        </div>
    </div>
  )
}
