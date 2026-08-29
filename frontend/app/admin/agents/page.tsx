"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default function AdminAgentsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [agents, setAgents] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newAgent, setNewAgent] = useState({ email: '', name: '', role: 'agent' })
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/admin/agents')
  }, [authLoading, isAuthenticated])

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') })

  const fetchAgents = () => {
    fetch('/v1/admin/agents', { headers: h() }).then(r => r.json()).then(d => setAgents(d.agents || [])).catch(() => {})
  }

  useEffect(() => { if (isAuthenticated) fetchAgents() }, [isAuthenticated])

  const handleCreate = async () => {
    if (!newAgent.email || !newAgent.name) return
    setIsCreating(true)
    try {
      await fetch('/v1/admin/agents', { method: 'POST', headers: h(), body: JSON.stringify(newAgent) })
      setNewAgent({ email: '', name: '', role: 'agent' })
      setShowCreate(false)
      fetchAgents()
    } finally { setIsCreating(false) }
  }

  const handleAction = async (id: string, action: string) => {
    await fetch(`/v1/admin/agents/${id}/${action}`, { method: 'POST', headers: h() })
    fetchAgents()
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Agent Management</h1>
              <p className="text-xs text-slate-500 mt-0.5">Create, manage, and monitor support agents</p>
            </div>
            <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-md">
              {showCreate ? 'Cancel' : '+ New Agent'}
            </button>
          </header>
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
            {showCreate && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">Create New Agent</h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <input value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} placeholder="Full Name" className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input value={newAgent.email} onChange={e => setNewAgent({...newAgent, email: e.target.value})} placeholder="Email" className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <select value={newAgent.role} onChange={e => setNewAgent({...newAgent, role: e.target.value})} className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                  </select>
                  <button onClick={handleCreate} disabled={isCreating || !newAgent.email || !newAgent.name} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer">{isCreating ? 'Creating...' : 'Create'}</button>
                </div>
              </div>
            )}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">All Agents ({agents.length})</h2>
              </div>
              {agents.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">No agents yet. Create one above.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {agents.map((a: any) => (
                    <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/80 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs">{a.name?.slice(0, 2).toUpperCase()}</div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">{a.name}</p>
                        <p className="text-[10px] text-slate-400">{a.email}</p>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${a.role === 'manager' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>{a.role}</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : a.status === 'suspended' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                      <div className="flex items-center gap-2">
                        {a.status === 'active' && <button onClick={() => handleAction(a.id, 'suspend')} className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold cursor-pointer">Suspend</button>}
                        {a.status !== 'active' && <button onClick={() => handleAction(a.id, 'deactivate')} className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold cursor-pointer">Activate</button>}
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
