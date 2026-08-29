/**
 * Overview Metrics Cards Component
 * T149: Summary KPI grid displaying core metrics in Light Theme
 */
'use client'

import { OverviewMetrics } from '@/lib/api'

interface OverviewProps {
  metrics: OverviewMetrics | null
  isLoading: boolean
}

export function Overview({ metrics, isLoading }: OverviewProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Total Conversations',
      value: metrics.total_chats.toLocaleString(),
      change: '+14.2% vs last month',
      changeType: 'positive',
      icon: (
        <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      bg: 'bg-indigo-50/60 border-indigo-100'
    },
    {
      title: 'AI Resolution Rate',
      value: `${metrics.ai_resolution_rate}%`,
      change: '+3.8% efficiency gain',
      changeType: 'positive',
      icon: (
        <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-emerald-50/60 border-emerald-100'
    },
    {
      title: 'Avg Response Latency',
      value: `${metrics.avg_response_time_seconds}s`,
      change: '-0.4s faster AI response',
      changeType: 'positive',
      icon: (
        <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      bg: 'bg-purple-50/60 border-purple-100'
    },
    {
      title: 'Est. Cost Savings',
      value: `$${metrics.cost_savings_usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      change: 'Calculated at $12/human chat',
      changeType: 'neutral',
      icon: (
        <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-amber-50/60 border-amber-100'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`p-6 rounded-2xl border ${card.bg} transition-all duration-200 hover:shadow-lg bg-white shadow-sm`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {card.title}
            </span>
            <div className="p-2.5 rounded-xl bg-white shadow-sm border border-slate-200/60">
              {card.icon}
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
            {card.value}
          </div>
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <span className="text-emerald-600 font-bold">{card.change}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
