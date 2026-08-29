/**
 * Response Time Trend Component
 * T151: Response latency & P95 latency trend visualizer
 */
'use client'

import { ResponseTimePoint } from '@/lib/api'

interface ResponseTimeProps {
  data: ResponseTimePoint[]
  isLoading: boolean
}

export function ResponseTimeChart({ data, isLoading }: ResponseTimeProps) {
  if (isLoading) {
    return <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
  }

  const avgGlobal = (data.reduce((acc, d) => acc + d.avg_seconds, 0) / (data.length || 1)).toFixed(2)
  const p95Global = (data.reduce((acc, d) => acc + d.p95_seconds, 0) / (data.length || 1)).toFixed(2)

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Response Latency</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Average response time vs P95 tail latency (seconds)</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Avg: {avgGlobal}s
          </span>
          <span className="flex items-center gap-1.5 text-purple-500 dark:text-purple-400">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> P95: {p95Global}s
          </span>
        </div>
      </div>

      {/* Latency Bars */}
      <div className="space-y-3">
        {data.map((point, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="w-16 text-xs text-slate-400 font-mono text-right">{point.date.slice(5)}</span>
            <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-lg relative overflow-hidden flex items-center px-2">
              <div
                className="h-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-md transition-all duration-300"
                style={{ width: `${Math.min(100, (point.p95_seconds / 5.0) * 100)}%` }}
              />
              <span className="absolute right-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {point.avg_seconds}s (P95: {point.p95_seconds}s)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
