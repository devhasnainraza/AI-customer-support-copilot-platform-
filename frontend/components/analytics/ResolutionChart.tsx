/**
 * Resolution Rate Breakdown Component
 * T150: AI vs Human Resolution breakdown chart
 */
'use client'

import { ResolutionRatePoint } from '@/lib/api'

interface ResolutionChartProps {
  data: ResolutionRatePoint[]
  isLoading: boolean
}

export function ResolutionChart({ data, isLoading }: ResolutionChartProps) {
  if (isLoading) {
    return <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
  }

  const totalAI = data.reduce((acc, d) => acc + d.ai_resolved, 0)
  const totalHuman = data.reduce((acc, d) => acc + d.human_resolved, 0)
  const totalUnresolved = data.reduce((acc, d) => acc + d.unresolved, 0)
  const grandTotal = totalAI + totalHuman + totalUnresolved || 1

  const aiPct = Math.round((totalAI / grandTotal) * 100)
  const humanPct = Math.round((totalHuman / grandTotal) * 100)
  const unresolvedPct = 100 - aiPct - humanPct

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Resolution Channels</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Self-service AI resolution vs human agent escalation</p>
        </div>
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          {aiPct}% AI Autonomous
        </span>
      </div>

      {/* Progress Bar Stack */}
      <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex mb-6 shadow-inner">
        <div style={{ width: `${aiPct}%` }} className="bg-indigo-600 transition-all duration-500" title={`AI Resolved: ${aiPct}%`} />
        <div style={{ width: `${humanPct}%` }} className="bg-purple-500 transition-all duration-500" title={`Human Resolved: ${humanPct}%`} />
        <div style={{ width: `${unresolvedPct}%` }} className="bg-amber-400 transition-all duration-500" title={`Unresolved: ${unresolvedPct}%`} />
      </div>

      {/* Legend & Daily Trend Bars */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            AI Resolved
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{totalAI}</div>
        </div>
        <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/30">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            Human Escalated
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{totalHuman}</div>
        </div>
        <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            Pending / Open
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{totalUnresolved}</div>
        </div>
      </div>

      {/* Daily Breakdown Histogram */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
          Daily Resolution Volume (Past 7 Days)
        </div>
        <div className="flex items-end justify-between h-24 gap-2 pt-2">
          {data.map((item, idx) => {
            const maxVal = Math.max(...data.map(d => d.ai_resolved + d.human_resolved)) || 1
            const heightPct = Math.round(((item.ai_resolved + item.human_resolved) / maxVal) * 100)
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-md relative overflow-hidden flex flex-col justify-end" style={{ height: `${Math.max(15, heightPct)}%` }}>
                  <div className="w-full bg-indigo-600 rounded-t-sm" style={{ height: `${(item.ai_resolved / (item.ai_resolved + item.human_resolved || 1)) * 100}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{item.date.slice(5)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
