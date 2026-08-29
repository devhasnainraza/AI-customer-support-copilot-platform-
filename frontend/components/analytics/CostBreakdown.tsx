/**
 * Cost Savings Breakdown Component
 * T153: Cost analysis comparing AI copilot vs human labor cost
 */
'use client'

import { CostMetrics } from '@/lib/api'

interface CostProps {
  data: CostMetrics | null
  isLoading: boolean
}

export function CostBreakdown({ data, isLoading }: CostProps) {
  if (isLoading || !data) {
    return <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">ROI & Cost Reduction</span>
            <h3 className="text-xl font-extrabold text-white mt-1">Support Cost Savings</h3>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
            {data.savings_percentage}% Cost Reduction
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
            <span className="text-xs text-slate-400">AI LLM Infrastructure Cost</span>
            <div className="text-2xl font-bold text-slate-200 mt-1">${data.ai_cost_usd.toFixed(2)}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
            <span className="text-xs text-slate-400">Equivalent Human Support Cost</span>
            <div className="text-2xl font-bold text-slate-200 mt-1">${data.human_equivalent_cost_usd.toFixed(2)}</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 backdrop-blur-md border border-emerald-500/30">
            <span className="text-xs text-emerald-300 font-semibold">Net Dollar Savings</span>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">${data.net_savings_usd.toFixed(2)}</div>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          * Estimated savings are computed based on average human tier-1 support agent resolution cost of $12.00/ticket versus AI automated resolution cost of ~$0.35/conversation.
        </p>
      </div>
    </div>
  )
}
