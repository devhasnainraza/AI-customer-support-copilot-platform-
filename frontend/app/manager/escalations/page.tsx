'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { getAuthHeaders } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ManagerEscalationsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [escalations, setEscalations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/manager/escalations')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      async function loadEscalations() {
        try {
          const h = await getAuthHeaders()
          const r = await fetch(`${API}/v1/manager/escalations`, { headers: h })
          const d = await r.json()
          setEscalations(d.escalations || [])
        } catch (err) {
          console.error('Failed to load escalations:', err)
        } finally {
          setIsLoading(false)
        }
      }
      void loadEscalations()
    }
  }, [isAuthenticated])

  const handleAction = async (id: string, action: string) => {
    try {
      const h = await getAuthHeaders()
      await fetch(`${API}/v1/manager/escalations/${id}/${action}`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ notes: '' }),
      })
      setEscalations((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: action === 'approve' ? 'approved' : 'rejected' } : e))
      )
    } catch (err) {
      console.error(`Failed to ${action} escalation:`, err)
    }
  }

  const priorityBadge: Record<string, string> = {
    critical: 'badge-vip-rose',
    high: 'badge-vip-amber',
    medium: 'badge-vip-indigo',
    low: 'badge-vip-slate',
  }

  const statusBadge: Record<string, string> = {
    pending: 'badge-vip-amber',
    approved: 'badge-vip-emerald',
    rejected: 'badge-vip-rose',
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Escalation Review & Approval
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Audit escalated customer requests, authorize priority overrides, and ensure strict SLA fulfillment.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-vip badge-vip-rose">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {escalations.filter((e) => e.status === 'pending').length} Action Items
          </span>
        </div>
      </div>

      {/* Escalations List */}
      <div className="surface-vip overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Pending Escalations ({escalations.filter((e) => e.status === 'pending').length})
          </h2>
        </div>
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : escalations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-bold text-slate-700">No pending escalations found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">All customer tickets are currently handled within healthy thresholds.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {escalations.map((e: any) => (
              <div key={e.id} className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`badge-vip ${priorityBadge[e.priority] || 'badge-vip-slate'}`}>
                      {e.priority || 'Normal'}
                    </span>
                    <span className={`badge-vip ${statusBadge[e.status] || 'badge-vip-slate'}`}>
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">
                    Case Reference: <span className="font-mono text-indigo-600 font-bold">{e.ticket_id?.slice(0, 12) || e.id?.slice(0, 12)}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 font-medium">{e.reason || 'Escalated by AI / Customer request'}</p>
                </div>
                {e.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(e.id, 'approve')}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleAction(e.id, 'reject')}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer border border-rose-200"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
