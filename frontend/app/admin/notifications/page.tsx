"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default function AdminNotificationsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [rules, setRules] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newRule, setNewRule] = useState({ name: '', trigger: 'handoff.created', channels: ['in_app'], recipients: 'all_agents', priority: 'medium' })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/admin/notifications')
  }, [authLoading, isAuthenticated])

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') })

  const fetchRules = () => {
    fetch('/v1/admin/notification-rules', { headers: h() }).then(r => r.json()).then(d => setRules(d.rules || [])).catch(() => {})
  }

  useEffect(() => { if (isAuthenticated) fetchRules() }, [isAuthenticated])

  const handleCreate = async () => {
    await fetch('/v1/admin/notification-rules', { method: 'POST', headers: h(), body: JSON.stringify(newRule) })
    setShowCreate(false)
    setNewRule({ name: '', trigger: 'handoff.created', channels: ['in_app'], recipients: 'all_agents', priority: 'medium' })
    fetchRules()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/v1/admin/notification-rules/${id}`, { method: 'DELETE', headers: h() })
    fetchRules()
  }

  const channelLabels: Record<string, string> = { in_app: 'In-App', push: 'Browser Push', email: 'Email' }
  const triggers = ['handoff.created', 'handoff.assigned', 'handoff.resolved', 'escalation.created', 'agent.offline', 'ticket.created', 'system.alert']

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Notification Rules</h1>
              <p className="text-xs text-slate-500 mt-0.5">Configure who gets notified and how</p>
            </div>
            <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-md">
              {showCreate ? 'Cancel' : '+ New Rule'}
            </button>
          </header>
          <div className="p-6 max-w-5xl w-full mx-auto space-y-6">
            {showCreate && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Create Notification Rule</h2>
                <input value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} placeholder="Rule name (e.g. 'New handoff alert')" className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Trigger</label>
                    <select value={newRule.trigger} onChange={e => setNewRule({...newRule, trigger: e.target.value})} className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200">
                      {triggers.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Recipients</label>
                    <select value={newRule.recipients} onChange={e => setNewRule({...newRule, recipients: e.target.value})} className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200">
                      <option value="all_agents">All Agents</option>
                      <option value="managers">Managers</option>
                      <option value="admins">Admins</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Priority</label>
                    <select value={newRule.priority} onChange={e => setNewRule({...newRule, priority: e.target.value})} className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">Channels</label>
                  <div className="flex gap-3">
                    {['in_app', 'push', 'email'].map(ch => (
                      <label key={ch} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={newRule.channels.includes(ch)} onChange={e => {
                          const channels = e.target.checked ? [...newRule.channels, ch] : newRule.channels.filter(c => c !== ch)
                          setNewRule({...newRule, channels})
                        }} className="rounded border-slate-300" />
                        {channelLabels[ch]}
                      </label>
                    ))}
                  </div>
                </div>
                <button onClick={handleCreate} disabled={!newRule.name} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer">Create Rule</button>
              </div>
            )}

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Active Rules ({rules.length})</h2>
              </div>
              {rules.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">No rules configured</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {rules.map((r: any) => (
                    <div key={r.id} className="p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">{r.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{r.trigger}</span>
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{r.recipients}</span>
                          {r.channels.map((ch: string) => (
                            <span key={ch} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{channelLabels[ch] || ch}</span>
                          ))}
                        </div>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${r.priority === 'critical' ? 'bg-red-100 text-red-700' : r.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>{r.priority}</span>
                      <button onClick={() => handleDelete(r.id)} className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold cursor-pointer">Delete</button>
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
