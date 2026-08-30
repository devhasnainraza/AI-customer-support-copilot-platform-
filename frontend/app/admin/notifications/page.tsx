"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getHeaders() {
  const raw = localStorage.getItem('supabase.auth.token') || ''
  const token = raw.replace(/^"|"$/g, '')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

interface EmailConfig {
  configured: boolean
  from_email: string
  from_name: string
  has_api_key: boolean
}

interface EmailStats {
  total: number
  sent: number
  failed: number
  pending: number
  success_rate: string
  configured: boolean
}

interface EmailRecord {
  id: string
  to: string
  subject: string
  template: string
  status: string
  error: string | null
  created_at: string
  sent_at: string | null
}

interface EmailTemplate {
  id: string
  name: string
  description: string
  trigger: string
  recipients: string
}

export default function AdminNotificationsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const [activeTab, setActiveTab] = useState<'rules' | 'email'>('rules')

  // Notification rules state
  const [rules, setRules] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newRule, setNewRule] = useState({ name: '', trigger: 'handoff.created', channels: ['in_app'], recipients: 'all_agents', priority: 'medium' })

  // Email state
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null)
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null)
  const [emailHistory, setEmailHistory] = useState<EmailRecord[]>([])
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [showEmailConfig, setShowEmailConfig] = useState(false)
  const [showSendEmail, setShowSendEmail] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [fromEmailInput, setFromEmailInput] = useState('')
  const [fromNameInput, setFromNameInput] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testSubject, setTestSubject] = useState('')
  const [testBody, setTestBody] = useState('')
  const [configSaving, setConfigSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/admin/notifications')
  }, [authLoading, isAuthenticated])

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`${API}/v1/admin/notification-rules`, { headers: getHeaders() })
      const d = await res.json()
      setRules(d.rules || [])
    } catch {}
  }, [])

  const fetchEmailData = useCallback(async () => {
    try {
      const [configRes, statsRes, histRes, tplRes] = await Promise.all([
        fetch(`${API}/v1/notifications/email/config`, { headers: getHeaders() }),
        fetch(`${API}/v1/notifications/email/stats`, { headers: getHeaders() }),
        fetch(`${API}/v1/notifications/email/history`, { headers: getHeaders() }),
        fetch(`${API}/v1/notifications/email/templates`, { headers: getHeaders() }),
      ])
      setEmailConfig(await configRes.json())
      setEmailStats(await statsRes.json())
      const histData = await histRes.json()
      setEmailHistory(histData.history || [])
      const tplData = await tplRes.json()
      setEmailTemplates(tplData.templates || [])
    } catch {}
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchRules()
      fetchEmailData()
    }
  }, [isAuthenticated, fetchRules, fetchEmailData])

  const handleCreateRule = async () => {
    await fetch(`${API}/v1/admin/notification-rules`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(newRule) })
    setShowCreate(false)
    setNewRule({ name: '', trigger: 'handoff.created', channels: ['in_app'], recipients: 'all_agents', priority: 'medium' })
    fetchRules()
  }

  const handleDeleteRule = async (id: string) => {
    await fetch(`${API}/v1/admin/notification-rules/${id}`, { method: 'DELETE', headers: getHeaders() })
    fetchRules()
  }

  const handleSaveEmailConfig = async () => {
    setConfigSaving(true)
    try {
      await fetch(`${API}/v1/notifications/email/config`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ api_key: apiKeyInput || undefined, from_email: fromEmailInput || undefined, from_name: fromNameInput || undefined }),
      })
      await fetchEmailData()
      setShowEmailConfig(false)
    } finally {
      setConfigSaving(false)
    }
  }

  const handleSendTestEmail = async () => {
    setSendingTest(true)
    try {
      await fetch(`${API}/v1/notifications/email/test`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ to: testEmail, subject: testSubject || 'Test Email', heading: 'Test Email', body_html: testBody || '<p>This is a test email from AI Support Copilot.</p>' }),
      })
      await fetchEmailData()
      setTestEmail('')
      setTestSubject('')
      setTestBody('')
      setShowSendEmail(false)
    } finally {
      setSendingTest(false)
    }
  }

  const channelLabels: Record<string, string> = { in_app: 'In-App', push: 'Browser Push', email: 'Email' }
  const triggers = ['handoff.created', 'handoff.assigned', 'handoff.resolved', 'escalation.created', 'agent.offline', 'ticket.created', 'system.alert']

  const statusColors: Record<string, string> = {
    sent: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700',
    bounced: 'bg-orange-100 text-orange-700',
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Notification Management</h1>
              <p className="text-xs text-slate-500 mt-0.5">Configure notification rules, email delivery, and alert channels</p>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === 'rules' && (
                <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-md">
                  {showCreate ? 'Cancel' : '+ New Rule'}
                </button>
              )}
              {activeTab === 'email' && (
                <>
                  <button onClick={() => { setShowSendEmail(true); setShowEmailConfig(false) }} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-md">
                    ✉️ Send Email
                  </button>
                  <button onClick={() => { setShowEmailConfig(true); setShowSendEmail(false) }} className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer shadow-sm">
                    ⚙️ Configure
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Tab Bar */}
          <div className="border-b border-slate-200/80 bg-white/60 px-6">
            <div className="flex gap-1 -mb-px">
              <button onClick={() => setActiveTab('rules')} className={`px-4 py-3 text-xs font-extrabold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'rules' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                🔔 Notification Rules
              </button>
              <button onClick={() => setActiveTab('email')} className={`px-4 py-3 text-xs font-extrabold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'email' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                📧 Email Delivery
              </button>
            </div>
          </div>

          <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
            {/* ── Rules Tab ── */}
            {activeTab === 'rules' && (
              <>
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
                    <button onClick={handleCreateRule} disabled={!newRule.name} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer">Create Rule</button>
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
                          <button onClick={() => handleDeleteRule(r.id)} className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold cursor-pointer">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Email Tab ── */}
            {activeTab === 'email' && (
              <>
                {/* Email Config Panel */}
                {showEmailConfig && (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Resend API Configuration</h2>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">API Key (Resend)</label>
                        <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder={emailConfig?.has_api_key ? '••••••••••••••••' : 're_xxxxxxxxxxxxxxxx'} className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">From Email</label>
                          <input type="email" value={fromEmailInput} onChange={e => setFromEmailInput(e.target.value)} placeholder="notifications@yourdomain.com" className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">From Name</label>
                          <input type="text" value={fromNameInput} onChange={e => setFromNameInput(e.target.value)} placeholder="AI Support Copilot" className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleSaveEmailConfig} disabled={configSaving} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-md">
                        {configSaving ? 'Saving...' : 'Save Configuration'}
                      </button>
                      <button onClick={() => setShowEmailConfig(false)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Send Email Panel */}
                {showSendEmail && (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Send Email Notification</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Recipient Email</label>
                        <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="admin@company.com" className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Subject</label>
                        <input type="text" value={testSubject} onChange={e => setTestSubject(e.target.value)} placeholder="Important notification" className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">HTML Body</label>
                      <textarea value={testBody} onChange={e => setTestBody(e.target.value)} rows={4} placeholder="<p>Your message here...</p>" className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleSendTestEmail} disabled={!testEmail || sendingTest} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-md">
                        {sendingTest ? 'Sending...' : '✉️ Send Email'}
                      </button>
                      <button onClick={() => setShowSendEmail(false)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Sent</span>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">{emailStats?.total || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">All-time email delivery</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Delivered</span>
                    <div className="text-2xl font-extrabold text-emerald-600 mt-1">{emailStats?.sent || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Successfully delivered</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Failed</span>
                    <div className="text-2xl font-extrabold text-red-600 mt-1">{emailStats?.failed || 0}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Delivery failures</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Success Rate</span>
                    <div className="text-2xl font-extrabold text-indigo-600 mt-1">{emailStats?.success_rate || '0%'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Delivery success rate</div>
                  </div>
                </div>

                {/* Email Templates */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">Email Templates</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {emailTemplates.map(tpl => (
                      <div key={tpl.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{tpl.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{tpl.description}</p>
                          </div>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{tpl.trigger}</span>
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{tpl.recipients}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery History */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Delivery History ({emailHistory.length})</h2>
                    <button onClick={fetchEmailData} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">🔄 Refresh</button>
                  </div>
                  {emailHistory.length === 0 ? (
                    <div className="p-12 text-center">
                      <span className="text-3xl">📧</span>
                      <p className="text-xs text-slate-400 mt-2">No emails sent yet</p>
                      <p className="text-[10px] text-slate-300 mt-1">Configure Resend API key to start sending email notifications</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            <th className="py-3 px-4">Recipient</th>
                            <th className="py-3 px-4">Subject</th>
                            <th className="py-3 px-4">Template</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Sent At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {emailHistory.map(record => (
                            <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 font-semibold text-slate-900">{record.to}</td>
                              <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{record.subject}</td>
                              <td className="py-3 px-4">
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{record.template}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${statusColors[record.status] || 'bg-slate-100 text-slate-600'}`}>
                                  {record.status}
                                </span>
                                {record.error && <p className="text-[9px] text-red-500 mt-0.5">{record.error}</p>}
                              </td>
                              <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                                {record.sent_at ? new Date(record.sent_at).toLocaleString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
