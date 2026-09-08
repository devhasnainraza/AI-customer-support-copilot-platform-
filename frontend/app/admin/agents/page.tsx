'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { getAuthToken } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function AdminAgentsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [agents, setAgents] = useState<any[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newAgent, setNewAgent] = useState({ email: '', name: '', role: 'agent', password: 'Staff@2026!' })
  const [isCreating, setIsCreating] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; creds?: { email: string; pass: string; role: string } } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const handleCopyStaffLink = () => {
    const staffUrl = typeof window !== 'undefined' ? `${window.location.origin}/staff/login` : 'http://localhost:3000/staff/login'
    navigator.clipboard.writeText(staffUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/admin/agents')
  }, [authLoading, isAuthenticated, router])

  const getHeaders = async () => {
    const token = await getAuthToken()
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }

  const fetchAgents = async () => {
    try {
      const headers = await getHeaders()
      const r = await fetch(`${API}/v1/admin/agents`, { headers })
      if (!r.ok) {
        setIsLoadingAgents(false)
        return
      }
      const d = await r.json()
      setAgents(d.agents || [])
    } catch {
      // Ignore network errors
    } finally {
      setIsLoadingAgents(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) fetchAgents()
  }, [isAuthenticated])

  const handleCreate = async () => {
    if (!newAgent.email || !newAgent.name) return
    setIsCreating(true)
    setFeedback(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API}/v1/admin/agents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newAgent),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || 'Failed to provision staff account')
      }
      const data = await res.json()
      setFeedback({
        type: 'success',
        message: `Account provisioned successfully for ${newAgent.name}!`,
        creds: {
          email: newAgent.email,
          pass: data.temporary_password || newAgent.password,
          role: newAgent.role,
        },
      })
      setNewAgent({ email: '', name: '', role: 'agent', password: 'Staff@2026!' })
      setShowCreate(false)
      fetchAgents()
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error occurred while provisioning account.',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleAction = async (id: string, action: string) => {
    // Optimistic status flip for instant interactive feedback
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: action === 'suspend' ? 'suspended' : 'active' } : a))
    )
    try {
      const headers = await getHeaders()
      await fetch(`${API}/v1/admin/agents/${id}/${action}`, { method: 'POST', headers })
      await fetchAgents()
    } catch {
      await fetchAgents()
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center font-bold shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Staff Roster & Capacity Provisioning
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Invite customer support specialists, configure queue capacity, and manage access permissions.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleCopyStaffLink}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            title="Copy dedicated staff login URL to share with agents and managers"
          >
            {copiedLink ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-700">Staff Link Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy Staff Login Link</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              setShowCreate(!showCreate)
              setFeedback(null)
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center gap-1.5"
          >
            {showCreate ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cancel</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Staff Agent</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex flex-col gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold">{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs opacity-60 hover:opacity-100 cursor-pointer font-black"
            >
              &times;
            </button>
          </div>
          {feedback.creds && (
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-200 text-[11px] font-mono text-slate-800 space-y-1">
              <div><span className="font-bold text-slate-500">Email:</span> {feedback.creds.email}</div>
              <div><span className="font-bold text-slate-500">Temporary Password:</span> {feedback.creds.pass}</div>
              <div><span className="font-bold text-slate-500">Role:</span> {feedback.creds.role}</div>
            </div>
          )}
        </div>
      )}

      {/* New Agent Form Modal / Card */}
      {showCreate && (
        <div className="surface-vip p-6 animate-fade-in">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-4">
            Provision New Staff Account
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={newAgent.name}
              onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              placeholder="Full Name (e.g. Alex Morgan)"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              value={newAgent.email}
              onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
              placeholder="Work Email (e.g. alex@company.com)"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              value={newAgent.password}
              onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
              placeholder="Temporary Password"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <select
                value={newAgent.role}
                onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="agent">Support Specialist</option>
                <option value="manager">Support Manager</option>
              </select>
              <button
                onClick={handleCreate}
                disabled={isCreating || !newAgent.email || !newAgent.name}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold py-2 px-4 shadow-2xs transition-all cursor-pointer shrink-0"
              >
                {isCreating ? 'Provisioning...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agents Roster Table */}
      <div className="surface-vip overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Registered Staff {isLoadingAgents ? '(Loading...)' : `(${agents.length})`}
          </h2>
        </div>
        {isLoadingAgents ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50/70 border border-slate-100 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-36 h-3.5 bg-slate-200 rounded" />
                  <div className="w-52 h-2.5 bg-slate-100 rounded" />
                </div>
                <div className="w-16 h-6 bg-slate-200 rounded-full" />
                <div className="w-14 h-6 bg-slate-200 rounded-full" />
                <div className="w-16 h-7 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            No agents registered yet. Click &quot;Add Staff Agent&quot; above to provision your first account.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {agents.map((a: any) => (
              <div key={a.id} className="p-4.5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-100 to-violet-100 text-indigo-700 font-black flex items-center justify-center text-xs shadow-2xs shrink-0 border border-indigo-200/50">
                  {a.name?.slice(0, 2).toUpperCase() || 'AG'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{a.name}</p>
                  <p className="text-[11px] text-slate-400 font-medium truncate">{a.email}</p>
                </div>
                <span className={`badge-vip ${
                  a.role === 'manager' ? 'badge-vip-purple' : 'badge-vip-indigo'
                }`}>
                  {a.role}
                </span>
                <span className={`badge-vip ${
                  a.status === 'active'
                    ? 'badge-vip-emerald'
                    : a.status === 'suspended'
                    ? 'badge-vip-rose'
                    : 'badge-vip-slate'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-emerald-500 radar-live' : 'bg-rose-500'}`} />
                  {a.status}
                </span>
                <div className="flex items-center gap-2">
                  {a.status === 'active' ? (
                    <button
                      onClick={() => handleAction(a.id, 'suspend')}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold transition-colors cursor-pointer border border-rose-200"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(a.id, 'activate')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold transition-colors cursor-pointer border border-emerald-200"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
