/**
 * Top Topics Component
 * T152: Frequency list of top customer inquiry topics & escalation percentages
 */
'use client'

import { TopicMetric } from '@/lib/api'

interface TopTopicsProps {
  data: TopicMetric[]
  isLoading: boolean
}

export function TopTopics({ data, isLoading }: TopTopicsProps) {
  if (isLoading) {
    return <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
  }

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Top Customer Topics</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Most frequent query categories and human escalation rates</p>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.map((topic, idx) => (
          <div key={idx} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 flex items-center justify-center">
                #{idx + 1}
              </span>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{topic.topic}</h4>
                <span className="text-xs text-slate-400">{topic.count} conversations</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                topic.escalation_rate > 15
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
              }`}>
                {topic.escalation_rate}% Escalation Rate
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
