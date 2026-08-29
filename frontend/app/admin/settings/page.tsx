"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default function AdminSettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [config, setConfig] = useState<any>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/admin/settings')
  }, [authLoading, isAuthenticated])

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') })

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/v1/admin/settings', { headers: h() }).then(r => r.json()).then(setConfig).catch(() => {})
    }
  }, [isAuthenticated])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/v1/admin/settings', { method: 'PUT', headers: h(), body: JSON.stringify(config) })
      if (res.ok) { const data = await res.json(); setConfig(data) }
    } finally { setIsSaving(false) }
  }

  const updateConfig = (key: string, value: any) => setConfig({ ...config, [key]: value })

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">System Settings</h1>
              <p className="text-xs text-slate-500 mt-0.5">Configure AI model, escalation, and behavior</p>
            </div>
            <button onClick={handleSave} disabled={isSaving} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-md">
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </header>
          <div className="p-6 max-w-3xl w-full mx-auto space-y-6">
            {/* AI Configuration */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">AI Configuration</h2>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">AI Model</label>
                  <select value={config.ai_model || ''} onChange={e => updateConfig('ai_model', e.target.value)} className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200">
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Escalation Confidence Threshold</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="1" step="0.05" value={config.escalation_threshold || 0.8} onChange={e => updateConfig('escalation_threshold', parseFloat(e.target.value))} className="flex-1" />
                    <span className="text-xs font-bold text-indigo-600 w-12 text-right">{Math.round((config.escalation_threshold || 0.8) * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">Feature Toggles</h2>
              <div className="space-y-3">
                {[
                  { key: 'auto_response_enabled', label: 'Auto Response', desc: 'AI automatically responds to customer queries' },
                  { key: 'enable_sentiment_analysis', label: 'Sentiment Analysis', desc: 'Analyze customer emotion in messages' },
                  { key: 'enable_auto_ticket_creation', label: 'Auto Ticket Creation', desc: 'Automatically create tickets on escalation' },
                ].map(f => (
                  <div key={f.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{f.label}</p>
                      <p className="text-[10px] text-slate-400">{f.desc}</p>
                    </div>
                    <button onClick={() => updateConfig(f.key, !config[f.key])}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${config[f.key] ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config[f.key] ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Hours */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">Business Hours</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Start Time</label>
                  <input type="time" value={config.business_hours_start || '09:00'} onChange={e => updateConfig('business_hours_start', e.target.value)} className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">End Time</label>
                  <input type="time" value={config.business_hours_end || '18:00'} onChange={e => updateConfig('business_hours_end', e.target.value)} className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Timezone</label>
                  <select value={config.timezone || 'UTC'} onChange={e => updateConfig('timezone', e.target.value)} className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200">
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern (US)</option>
                    <option value="America/Chicago">Central (US)</option>
                    <option value="America/Denver">Mountain (US)</option>
                    <option value="America/Los_Angeles">Pacific (US)</option>
                    <option value="Europe/London">London</option>
                    <option value="Asia/Karachi">Karachi</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Concurrency */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">Concurrency Limits</h2>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Max Concurrent Chats per Agent</label>
                <input type="number" min="1" max="50" value={config.max_concurrent_chats || 10} onChange={e => updateConfig('max_concurrent_chats', parseInt(e.target.value))} className="w-32 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
