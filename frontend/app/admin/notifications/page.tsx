"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { getAuthHeaders } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface EmailConfig {
  configured: boolean
  from_email: string
  from_name: string
  has_api_key: boolean
  smtp_host?: string
  mode?: string
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
  mode?: string
}

interface WhatsAppConfig {
  connected: boolean
  business_name: string
  display_phone_number: string
  notification_phone: string
  phone_number_id: string
  business_account_id: string
  verify_token: string
  webhook_configured: boolean
  mode: string
}

interface WhatsAppRecord {
  id: string
  to: string
  title: string
  message: string
  priority: string
  status: string
  mode: string
  created_at: string
  formatted_text?: string
}

export default function AdminNotificationsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'rules' | 'whatsapp' | 'email'>('rules')

  // Notification rules state
  const [rules, setRules] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    trigger: 'handoff.created',
    channels: ['in_app', 'whatsapp', 'email'],
    recipients: 'all_agents',
    priority: 'high',
  })

  // Toast / feedback message
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Multi-Channel Test
  const [multiSending, setMultiSending] = useState(false)

  // WhatsApp state
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null)
  const [whatsappHistory, setWhatsappHistory] = useState<WhatsAppRecord[]>([])
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState('')
  const [showWhatsAppPhoneEdit, setShowWhatsAppPhoneEdit] = useState(false)
  const [savingWhatsAppPhone, setSavingWhatsAppPhone] = useState(false)
  const [showSendWhatsApp, setShowSendWhatsApp] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [testWhatsAppPhone, setTestWhatsAppPhone] = useState('')
  const [testWhatsAppTitle, setTestWhatsAppTitle] = useState('🚨 Human Support Specialist Needed')
  const [testWhatsAppMessage, setTestWhatsAppMessage] = useState('Customer in Chat #8bf34846 requested live assistance for enterprise billing.')

  // Email state
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null)
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null)
  const [emailHistory, setEmailHistory] = useState<EmailRecord[]>([])
  const [showEmailConfig, setShowEmailConfig] = useState(false)
  const [showSendEmail, setShowSendEmail] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [fromEmailInput, setFromEmailInput] = useState('')
  const [fromNameInput, setFromNameInput] = useState('')
  const [sendingEmailTest, setSendingEmailTest] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testSubject, setTestSubject] = useState('')
  const [testBody, setTestBody] = useState('')
  const [configSaving, setConfigSaving] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/admin/notifications')
  }, [authLoading, isAuthenticated, router])

  const fetchRules = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/v1/admin/notification-rules`, { headers })
      const d = await res.json()
      setRules(d.rules || [])
    } catch {}
  }, [])

  const fetchWhatsApp = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const [cfgRes, histRes] = await Promise.all([
        fetch(`${API}/v1/notifications/whatsapp/config`, { headers }),
        fetch(`${API}/v1/notifications/whatsapp/history`, { headers }),
      ])
      const cfg = await cfgRes.json()
      const hist = await histRes.json()
      setWhatsappConfig(cfg)
      setWhatsappHistory(hist.history || [])
      setWhatsappPhoneInput(cfg.notification_phone || '')
      setTestWhatsAppPhone(cfg.notification_phone || '+18005550199')
    } catch {}
  }, [])

  const fetchEmailData = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const [configRes, statsRes, histRes] = await Promise.all([
        fetch(`${API}/v1/notifications/email/config`, { headers }),
        fetch(`${API}/v1/notifications/email/stats`, { headers }),
        fetch(`${API}/v1/notifications/email/history`, { headers }),
      ])
      const cfg = await configRes.json()
      setEmailConfig(cfg)
      setEmailStats(await statsRes.json())
      const histData = await histRes.json()
      setEmailHistory(histData.history || [])
      setTestEmail(cfg.from_email || 'developerhasnainraza@gmail.com')
    } catch {}
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      void fetchRules()
      void fetchWhatsApp()
      void fetchEmailData()
    }
  }, [isAuthenticated, fetchRules, fetchWhatsApp, fetchEmailData])

  const handleCreateRule = async () => {
    const headers = await getAuthHeaders()
    await fetch(`${API}/v1/admin/notification-rules`, { method: 'POST', headers, body: JSON.stringify(newRule) })
    setShowCreate(false)
    setNewRule({ name: '', trigger: 'handoff.created', channels: ['in_app', 'whatsapp', 'email'], recipients: 'all_agents', priority: 'high' })
    void fetchRules()
    showToast('Notification rule created successfully!')
  }

  const handleDeleteRule = async (id: string) => {
    const headers = await getAuthHeaders()
    await fetch(`${API}/v1/admin/notification-rules/${id}`, { method: 'DELETE', headers })
    void fetchRules()
    showToast('Rule deleted', 'info')
  }

  const handleUpdateWhatsAppPhone = async () => {
    setSavingWhatsAppPhone(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/v1/notifications/whatsapp/config`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ notification_phone: whatsappPhoneInput }),
      })
      if (res.ok) {
        showToast('WhatsApp alert destination phone updated!')
        setShowWhatsAppPhoneEdit(false)
        void fetchWhatsApp()
      }
    } catch {
      showToast('Failed to update phone number', 'error')
    } finally {
      setSavingWhatsAppPhone(false)
    }
  }

  const handleSendTestWhatsApp = async () => {
    setSendingWhatsApp(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/v1/notifications/whatsapp/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to_phone: testWhatsAppPhone,
          title: testWhatsAppTitle,
          message: testWhatsAppMessage,
          priority: 'high',
          data: { test: true },
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`WhatsApp test alert dispatched to ${testWhatsAppPhone}! (${data.record?.mode})`)
        setShowSendWhatsApp(false)
        void fetchWhatsApp()
      } else {
        showToast('Failed to send WhatsApp alert', 'error')
      }
    } catch {
      showToast('Error dispatching WhatsApp test alert', 'error')
    } finally {
      setSendingWhatsApp(false)
    }
  }

  const handleSendTestEmail = async () => {
    if (!testEmail) return
    setSendingEmailTest(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/v1/notifications/email/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: testEmail,
          subject: testSubject || 'Test Alert: AI Support Copilot System',
          heading: 'AI Support Copilot Notification Test',
          body_html: testBody || '<p>This is a verified test alert dispatched from your Copilot notification settings.</p>',
        }),
      })
      if (res.ok) {
        showToast(`Email test sent to ${testEmail}!`)
        setShowSendEmail(false)
        setTestSubject('')
        setTestBody('')
        void fetchEmailData()
      } else {
        showToast('Failed to dispatch email test', 'error')
      }
    } catch {
      showToast('Error sending test email', 'error')
    } finally {
      setSendingEmailTest(false)
    }
  }

  const handleMultiChannelTest = async () => {
    setMultiSending(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/v1/notifications/test-multi-channel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: '🚨 Multi-Channel Escalation Alert',
          message: 'Customer requested human assistance for Ticket #TICK-20260907-0002. Dispatched to WhatsApp & Email.',
          priority: 'critical',
          to_email: emailConfig?.from_email || 'developerhasnainraza@gmail.com',
          to_phone: whatsappConfig?.notification_phone || '+18005550199',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Multi-channel test dispatched to WhatsApp AND Email successfully!')
        void fetchWhatsApp()
        void fetchEmailData()
      } else {
        showToast('Multi-channel dispatch returned error', 'error')
      }
    } catch {
      showToast('Error triggering multi-channel test', 'error')
    } finally {
      setMultiSending(false)
    }
  }

  const channelLabels: Record<string, string> = {
    in_app: 'In-App',
    push: 'Browser Push',
    email: 'Email (SMTP)',
    whatsapp: 'WhatsApp',
  }

  const triggers = [
    'handoff.created',
    'handoff.assigned',
    'handoff.resolved',
    'escalation.created',
    'agent.offline',
    'ticket.created',
    'system.alert',
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Toast Banner */}
      {toast && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold shadow-md flex items-center justify-between transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Enterprise Notification Center
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Multi-channel alert routing via WhatsApp, Email (Gmail SMTP), Browser Push &amp; In-App.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleMultiChannelTest}
            disabled={multiSending}
            className="btn-vip-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-200 cursor-pointer disabled:opacity-50"
          >
            <span>{multiSending ? 'Dispatching...' : '⚡ Test Multi-Channel (WhatsApp + Email)'}</span>
          </button>

          {activeTab === 'rules' && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="btn-vip-secondary px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              {showCreate ? 'Cancel' : '+ New Rule'}
            </button>
          )}

          {activeTab === 'whatsapp' && (
            <button
              onClick={() => setShowSendWhatsApp(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>+ Send WhatsApp Alert</span>
            </button>
          )}

          {activeTab === 'email' && (
            <button
              onClick={() => setShowSendEmail(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>+ Send Email Alert</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200/80 bg-white/60 px-6 rounded-t-2xl">
        <div className="flex gap-2 -mb-px">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-3 text-xs font-extrabold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'rules'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <span>📋 Notification Rules</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">
              {rules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-4 py-3 text-xs font-extrabold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'text-emerald-600 border-emerald-600'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <span>💬 WhatsApp Alerts</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
              {whatsappConfig?.notification_phone || 'Active'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-3 text-xs font-extrabold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'email'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <span>📧 Email Delivery</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
              Gmail SMTP
            </span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: NOTIFICATION RULES ── */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {showCreate && (
            <div className="surface-vip p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Create Multi-Channel Notification Rule
              </h2>
              <input
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="Rule name (e.g. 'Escalation to Live Specialist')"
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Trigger Event</label>
                  <select
                    value={newRule.trigger}
                    onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  >
                    {triggers.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Target Recipients</label>
                  <select
                    value={newRule.recipients}
                    onChange={(e) => setNewRule({ ...newRule, recipients: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <option value="all_agents">All Agents</option>
                    <option value="managers">Managers</option>
                    <option value="admins">Admins</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Alert Priority</label>
                  <select
                    value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                  Delivery Channels
                </label>
                <div className="flex flex-wrap gap-4">
                  {['in_app', 'push', 'whatsapp', 'email'].map((ch) => (
                    <label key={ch} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRule.channels.includes(ch)}
                        onChange={(e) => {
                          const channels = e.target.checked
                            ? [...newRule.channels, ch]
                            : newRule.channels.filter((c) => c !== ch)
                          setNewRule({ ...newRule, channels })
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{channelLabels[ch]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRule}
                  disabled={!newRule.name}
                  className="btn-vip-primary px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  Create Rule
                </button>
              </div>
            </div>
          )}

          {/* Rules List */}
          <div className="surface-vip shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Active Notification Rules ({rules.length})
              </h2>
              <span className="text-[11px] text-slate-500 font-semibold">
                Multi-channel broadcast enabled
              </span>
            </div>
            {rules.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">No rules configured</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {rules.map((r: any) => (
                  <div key={r.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-bold text-slate-900">{r.name}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-vip badge-vip-indigo text-[10px]">{r.trigger}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          To: {r.recipients}
                        </span>
                        {r.channels.map((ch: string) => (
                          <span
                            key={ch}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ch === 'whatsapp'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : ch === 'email'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {channelLabels[ch] || ch}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge-vip text-[10px] ${
                        r.priority === 'critical' ? 'badge-vip-rose' : r.priority === 'high' ? 'badge-vip-amber' : 'badge-vip-slate'
                      }`}>
                        {r.priority}
                      </span>
                      <button
                        onClick={() => handleDeleteRule(r.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Rule"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: WHATSAPP ALERTS ── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          
          {/* WhatsApp Status Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 surface-vip p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600 text-base">💬</span>
                    <span>WhatsApp Alert Dispatcher</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    All high-priority tickets, escalations, and system alerts are formatted and dispatched directly to WhatsApp.
                  </p>
                </div>
                <span className={`badge-vip ${whatsappConfig?.connected ? 'badge-vip-emerald' : 'badge-vip-indigo'}`}>
                  {whatsappConfig?.connected ? '● Meta Cloud API Active' : '● Sandbox Simulation Mode'}
                </span>
              </div>

              {/* Destination Phone Configuration */}
              <div className="surface-inset p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Notification Destination Phone:</span>
                  {!showWhatsAppPhoneEdit ? (
                    <button
                      onClick={() => setShowWhatsAppPhoneEdit(true)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Change Phone Number &rarr;
                    </button>
                  ) : null}
                </div>

                {!showWhatsAppPhoneEdit ? (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-black text-slate-900">
                      {whatsappConfig?.notification_phone || '+18005550199'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      (Receives all WhatsApp escalation alerts)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={whatsappPhoneInput}
                      onChange={(e) => setWhatsappPhoneInput(e.target.value)}
                      placeholder="+1234567890"
                      className="px-3 py-2 text-xs font-mono font-bold rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                    />
                    <button
                      onClick={handleUpdateWhatsAppPhone}
                      disabled={savingWhatsAppPhone}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {savingWhatsAppPhone ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setShowWhatsAppPhoneEdit(false)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="lg:col-span-4 surface-vip p-6 flex flex-col justify-between space-y-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                WhatsApp Dispatch Metrics
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="surface-inset p-3 rounded-xl text-center">
                  <div className="text-2xl font-black font-mono text-emerald-600">
                    {whatsappHistory.length}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Alerts Sent</div>
                </div>
                <div className="surface-inset p-3 rounded-xl text-center">
                  <div className="text-2xl font-black font-mono text-slate-900">100%</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Success Rate</div>
                </div>
              </div>
              <button
                onClick={() => setShowSendWhatsApp(true)}
                className="btn-vip-primary w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                Send Test WhatsApp Message
              </button>
            </div>
          </div>

          {/* Send Test Modal / Box */}
          {showSendWhatsApp && (
            <div className="surface-vip p-6 shadow-md space-y-4 border-2 border-emerald-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  Send Instant Test WhatsApp Alert
                </h3>
                <button onClick={() => setShowSendWhatsApp(false)} className="text-slate-400 hover:text-slate-600">
                  &times;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Recipient Phone Number
                  </label>
                  <input
                    value={testWhatsAppPhone}
                    onChange={(e) => setTestWhatsAppPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Alert Title
                  </label>
                  <input
                    value={testWhatsAppTitle}
                    onChange={(e) => setTestWhatsAppTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Alert Body Message
                </label>
                <textarea
                  value={testWhatsAppMessage}
                  onChange={(e) => setTestWhatsAppMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSendWhatsApp(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTestWhatsApp}
                  disabled={sendingWhatsApp}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {sendingWhatsApp ? 'Sending...' : 'Dispatch Alert Now'}
                </button>
              </div>
            </div>
          )}

          {/* WhatsApp Delivery History Table */}
          <div className="surface-vip shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Dispatched WhatsApp Notifications ({whatsappHistory.length})
              </h3>
              <span className="text-[11px] text-slate-500 font-semibold">
                Logged &amp; tracked in real-time
              </span>
            </div>
            {whatsappHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No WhatsApp notifications dispatched yet. Try the test button above!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Recipient</th>
                      <th className="px-5 py-3">Alert Title</th>
                      <th className="px-5 py-3">Message Content</th>
                      <th className="px-5 py-3">Mode</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {whatsappHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-500">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-slate-800">
                          {item.to}
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-900">
                          {item.title}
                        </td>
                        <td className="px-5 py-3 text-slate-600 max-w-xs truncate">
                          {item.message}
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                            {item.mode}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="badge-vip badge-vip-emerald text-[10px]">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── TAB 3: EMAIL DELIVERY ── */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          
          {/* Email Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="surface-vip p-5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Dispatched</span>
              <div className="text-2xl font-black font-mono text-slate-900 mt-1">{emailStats?.total || emailHistory.length}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">Recorded in session</div>
            </div>
            <div className="surface-vip p-5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Delivery Status</span>
              <div className="text-2xl font-black font-mono text-emerald-600 mt-1">{emailStats?.sent || emailHistory.length} Sent</div>
              <div className="text-[11px] text-emerald-600 mt-0.5 font-semibold">100% success rate</div>
            </div>
            <div className="surface-vip p-5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sender Mode</span>
              <div className="text-base font-black font-mono text-indigo-600 mt-2">{emailConfig?.mode || 'Gmail SMTP'}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{emailConfig?.from_email || 'developerhasnainraza@gmail.com'}</div>
            </div>
            <div className="surface-vip p-5 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Quick Test</span>
              <button
                onClick={() => setShowSendEmail(true)}
                className="btn-vip-primary w-full py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Send Test Email
              </button>
            </div>
          </div>

          {/* Send Test Email Modal / Form */}
          {showSendEmail && (
            <div className="surface-vip p-6 shadow-md space-y-4 border-2 border-indigo-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-800">
                  Send Test Email Notification
                </h3>
                <button onClick={() => setShowSendEmail(false)} className="text-slate-400 hover:text-slate-600">
                  &times;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Destination Email
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="developerhasnainraza@gmail.com"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Subject Line
                  </label>
                  <input
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                    placeholder="[CRITICAL] Support Escalation Notice"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  HTML Body Content
                </label>
                <textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  placeholder="<p>Detailed escalation alert context...</p>"
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSendEmail(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTestEmail}
                  disabled={sendingEmailTest}
                  className="btn-vip-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {sendingEmailTest ? 'Sending via SMTP...' : 'Dispatch Email'}
                </button>
              </div>
            </div>
          )}

          {/* Email History Table */}
          <div className="surface-vip shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Dispatched Email History ({emailHistory.length})
              </h3>
              <span className="text-[11px] text-slate-500 font-semibold">
                Dispatched via {emailConfig?.smtp_host || 'Gmail SMTP'}
              </span>
            </div>
            {emailHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No email delivery records yet. Click 'Send Test Email' to dispatch one!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Recipient</th>
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Template</th>
                      <th className="px-5 py-3">Mode</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {emailHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-500">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-slate-800">
                          {item.to}
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-900">
                          {item.subject}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {item.template}
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                            {item.mode || 'smtp'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="badge-vip badge-vip-emerald text-[10px]">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  )
}
