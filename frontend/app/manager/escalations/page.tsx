"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ManagerSidebar } from '@/components/manager/ManagerSidebar'

export default function ManagerEscalationsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [escalations, setEscalations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/manager/escalations')
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      const h = { Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') }
      fetch('/v1/manager/escalations', { headers: h }).then(r => r.json()).then(d => { setEscalations(d.escalations || []); setIsLoading(false) }).catch(() => setIsLoading(false))
    }
  }, [isAuthenticated])

  const handleAction = async (id: string, action: string) => {
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') }
    await fetch(`/v1/manager/escalations/${id}/${action}`, { method: 'POST', headers: h, body: JSON.stringify({ notes: '' }) })
    setEscalations(prev => prev.map(e => e.id === id ? { ...e, status: action === 'approve' ? 'approved' : 'rejected' } : e))
  }

  const pc: Record<string, string> = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-slate-100 text-slate-700', low: 'bg-slate-100 text-slate-500' }
  const sc: Record<string, string> = { pending: 'bg-amber-50 text-amber-700', approved: 'bg-emerald-50 text-emerald-700', rejected: 'bg-red-50 text-red-700' }

  return (
    <RoleGuard allowedRoles={["manager", "admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <ManagerSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Escalation Review</h1>
            <p className="text-xs text-slate-500 mt-0.5">Review and manage escalated tickets</p>
          </header>
          <div className="p-6 max-w-7xl w-full mx-auto">
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Pending ({escalations.filter(e => e.status === 'pending').length})</h2>
              </div>
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : escalations.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm font-semibold text-slate-600">No pending escalations</p>
                  <p className="text-xs text-slate-400 mt-1">All caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {escalations.map((e: any) => (
                    <div key={e.id} className="p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${pc[e.priority] || 'bg-slate-100'}`}>{e.priority}</span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${sc[e.status] || 'bg-slate-100'}`}>{e.status}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900">Ticket: {e.ticket_id?.slice(0, 8)}...</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{e.reason}</p>
                      </div>
                      {e.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleAction(e.id, 'approve')} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer">Approve</button>
                          <button onClick={() => handleAction(e.id, 'reject')} className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[11px] font-bold cursor-pointer">Reject</button>
                        </div>
                      )}
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
