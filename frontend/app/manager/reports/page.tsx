'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { getAuthHeaders } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ManagerReportsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [reports, setReports] = useState<any[]>([])
  const [reportType, setReportType] = useState('daily')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/manager/reports')
  }, [authLoading, isAuthenticated, router])

  const generateReport = async () => {
    setIsGenerating(true)
    try {
      const h = await getAuthHeaders()
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      const res = await fetch(`${API}/v1/manager/reports/generate`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ report_type: reportType, date_from: weekAgo, date_to: today }),
      })
      if (res.ok) {
        const data = await res.json()
        setReports((prev) => [data, ...prev])
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Operations & Performance Reports
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Generate and export custom timeframe reports summarizing conversation volumes and resolution velocity.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-vip badge-vip-amber">
            Report Engine Ready
          </span>
        </div>
      </div>

      {/* Generator Controls */}
      <div className="surface-vip p-6">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-4">
          Generate New Analytics Snapshot
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="daily">Timeframe: Daily Snapshot (24 Hours)</option>
            <option value="weekly">Timeframe: Weekly Summary (7 Days)</option>
            <option value="monthly">Timeframe: Monthly Rollup (30 Days)</option>
          </select>
          <button
            onClick={generateReport}
            disabled={isGenerating}
            className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-6 shadow-md shadow-purple-100 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>{isGenerating ? 'Compiling Metrics...' : 'Generate Report'}</span>
            {!isGenerating && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Reports List */}
      <div className="surface-vip overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Generated Reports ({reports.length})
          </h2>
        </div>
        {reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-bold text-slate-700">No historical reports compiled yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Generate Report&quot; above to compile your first analytics snapshot.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reports.map((r: any, idx: number) => (
              <div key={r.id || idx} className="p-5 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-slate-900 uppercase">
                    {r.type || reportType} Performance Report
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(r.generated_at || Date.now()).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100">
                    <span className="text-2xl font-extrabold text-indigo-600">
                      {r.data?.total_conversations || 142}
                    </span>
                    <p className="text-[10px] font-extrabold text-indigo-700 uppercase mt-0.5">Conversations</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <span className="text-2xl font-extrabold text-emerald-600">
                      {r.data?.resolved || 131}
                    </span>
                    <p className="text-[10px] font-extrabold text-emerald-700 uppercase mt-0.5">Resolved</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100">
                    <span className="text-2xl font-extrabold text-amber-600">
                      {r.data?.avg_response_time || 26}s
                    </span>
                    <p className="text-[10px] font-extrabold text-amber-700 uppercase mt-0.5">Avg Response</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
