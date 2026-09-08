'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { getAuthToken } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function AdminSettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [config, setConfig] = useState<any>({})
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/admin/settings')
  }, [authLoading, isAuthenticated, router])

  const getHeaders = async () => {
    const token = await getAuthToken()
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      void (async () => {
        try {
          const headers = await getHeaders()
          const r = await fetch(`${API}/v1/admin/settings`, { headers })
          if (r.ok) {
            const data = await r.json()
            setConfig(data)
          }
        } catch {
          // Ignore
        }
      })()
    }
  }, [isAuthenticated])

  const handleSave = async () => {
    setIsSaving(true)
    setSavedSuccess(false)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${API}/v1/admin/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const updateConfig = (key: string, value: any) => setConfig({ ...config, [key]: value })

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                LLM &amp; Guardrails Configuration
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Configure Groq Llama 3.3 models, confidence thresholds, SLA shifts, and routing policies.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 animate-fade-in flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>Saved Successfully</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>{isSaving ? 'Saving Changes...' : 'Save Configuration'}</span>
            {!isSaving && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* AI & Model Configuration */}
        <div className="surface-vip p-6 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>AI Model &amp; Inference Engine</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Primary LLM Engine (Groq LPUs)
              </label>
              <select
                value={config.ai_model || 'llama-3.3-70b-versatile'}
                onChange={(e) => updateConfig('ai_model', e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs text-slate-800"
              >
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Recommended Enterprise)</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra-fast &lt;200ms)</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B (MoE 32k context)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Escalation Confidence Threshold
                </label>
                <span className="text-xs font-black text-indigo-600">
                  {Math.round((config.escalation_threshold || 0.8) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.escalation_threshold || 0.8}
                onChange={(e) => updateConfig('escalation_threshold', parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400 font-medium">
                Queries with AI confidence below this score are automatically routed to human agents.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="surface-vip p-6 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Autonomous Automation &amp; Guardrails</span>
          </h2>
          <div className="space-y-3">
            {[
              {
                key: 'auto_response_enabled',
                label: 'Autonomous AI Grounded Responses',
                desc: 'Generate immediate high-accuracy answers verified against indexed knowledge base',
              },
              {
                key: 'enable_sentiment_analysis',
                label: 'Real-time Sentiment & Frustration Detection',
                desc: 'Flag negative sentiment or angry tones for immediate specialist escalation',
              },
              {
                key: 'enable_auto_ticket_creation',
                label: 'Auto Ticket Provisioning on Escalation',
                desc: 'Generate standardized Kafka support tickets with conversation context upon handoff',
              },
            ].map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{f.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{f.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig(f.key, !config[f.key])}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                    config[f.key] ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-xs transition-transform ${
                      config[f.key] ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Business Hours & SLA */}
        <div className="surface-vip p-6 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
            Support Schedule &amp; Agent Capacity Limits
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Operating Start Time
              </label>
              <input
                type="time"
                value={config.business_hours_start || '09:00'}
                onChange={(e) => updateConfig('business_hours_start', e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Operating End Time
              </label>
              <input
                type="time"
                value={config.business_hours_end || '18:00'}
                onChange={(e) => updateConfig('business_hours_end', e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Max Concurrent Chats / Agent
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.max_concurrent_chats || 10}
                onChange={(e) => updateConfig('max_concurrent_chats', parseInt(e.target.value))}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
