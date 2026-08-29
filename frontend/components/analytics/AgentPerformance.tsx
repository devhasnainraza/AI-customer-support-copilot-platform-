/**
 * Agent Performance Table Component
 * T154: Table summarizing human support agent performance & CSAT scores
 */
'use client'

import { AgentPerformanceMetric } from '@/lib/api'

interface AgentPerformanceProps {
  agents: AgentPerformanceMetric[]
  isLoading: boolean
}

export function AgentPerformance({ agents, isLoading }: AgentPerformanceProps) {
  if (isLoading) {
    return <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
  }

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Human Agent Performance</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Handled escalations, resolution speed, and customer ratings</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">Agent</th>
              <th className="py-3 px-4">Chats Handled</th>
              <th className="py-3 px-4">Tickets Resolved</th>
              <th className="py-3 px-4">Avg Handle Time</th>
              <th className="py-3 px-4">CSAT Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {agents.map((agent) => (
              <tr key={agent.agent_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 px-4 flex items-center gap-3">
                  {agent.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={agent.avatar_url} alt={agent.agent_name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                      {agent.agent_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{agent.agent_name}</span>
                </td>
                <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">{agent.chats_handled}</td>
                <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">{agent.tickets_resolved}</td>
                <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">{agent.avg_handle_time_minutes}m</td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full text-xs">
                    ★ {agent.csat_score.toFixed(1)} / 5.0
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
