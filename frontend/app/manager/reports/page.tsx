"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ManagerSidebar } from '@/components/manager/ManagerSidebar'

export default function ManagerReportsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [reports, setReports] = useState<any[]>([])
  const [reportType, setReportType] = useState('daily')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/manager/reports')
  }, [authLoading, isAuthenticated])

  const generateReport = async () => {
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') }
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const res = await fetch('/v1/manager/reports/generate', { method: 'POST', headers: h, body: JSON.stringify({ report_type: reportType, date_from: weekAgo, date_to: today }) })
    if (res.ok) { const data = await res.json(); setReports(prev => [data, ...prev]) }
  }

  return (
    <RoleGuard allowedRoles={["manager", "admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <ManagerSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Reports</h1>
            <p className="text-xs text-slate-500 mt-0.5">Generate and view performance reports</p>
          </header>
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">Generate Report</h2>
              <div className="flex items-center gap-4">
                <select value={reportType} onChange={e => setReportType(e.target.value)} className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button onClick={generateReport} className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer shadow-md">Generate</button>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Generated Reports ({reports.length})</h2>
              </div>
              {reports.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">No reports yet. Generate one above.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reports.map((r: any) => (
                    <div key={r.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 uppercase">{r.type} Report</span>
                        <span className="text-[10px] text-slate-400">{new Date(r.generated_at).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                          <span className="text-lg font-black text-indigo-600">{r.data.total_conversations}</span>
                          <p className="text-[10px] font-bold text-indigo-700">Conversations</p>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                          <span className="text-lg font-black text-emerald-600">{r.data.resolved}</span>
                          <p className="text-[10px] font-bold text-emerald-700">Resolved</p>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                          <span className="text-lg font-black text-amber-600">{r.data.avg_response_time}s</span>
                          <p className="text-[10px] font-bold text-amber-700">Avg Response</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
