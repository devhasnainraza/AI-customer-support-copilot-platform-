"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/authStore'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default function AdminWhatsAppPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [config, setConfig] = useState<any>({})
  const [form, setForm] = useState({ phone_number: '', business_name: '', webhook_url: '', access_token: '', phone_number_id: '', business_account_id: '', verify_token: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/admin/whatsapp')
  }, [authLoading, isAuthenticated])

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('supabase.auth.token')?.replace(/^"|"$/g, '') || '') })

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/v1/admin/whatsapp', { headers: h() }).then(r => r.json()).then(d => { setConfig(d); if (d.phone_number) setForm(d) }).catch(() => {})
    }
  }, [isAuthenticated])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/v1/admin/whatsapp/configure', { method: 'POST', headers: h(), body: JSON.stringify(form) })
      if (res.ok) { const data = await res.json(); setConfig(data) }
    } finally { setIsSaving(false) }
  }

  const handleDisconnect = async () => {
    await fetch('/v1/admin/whatsapp/disconnect', { method: 'POST', headers: h() })
    setConfig({ ...config, connected: false })
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">WhatsApp Integration</h1>
            <p className="text-xs text-slate-500 mt-0.5">Connect WhatsApp Business API for omnichannel support</p>
          </header>
          <div className="p-6 max-w-3xl w-full mx-auto space-y-6">
            {/* Status Card */}
            <div className={`rounded-2xl p-6 border shadow-sm ${config.connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${config.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <h2 className="text-sm font-extrabold text-slate-900">{config.connected ? 'Connected' : 'Not Connected'}</h2>
              </div>
              {config.connected && (
                <div className="text-xs text-slate-600 space-y-1">
                  <p>Business: {config.business_name}</p>
                  <p>Phone: {config.phone_number}</p>
                  <button onClick={handleDisconnect} className="mt-3 px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold cursor-pointer">Disconnect</button>
                </div>
              )}
            </div>

            {/* Configuration Form */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">WhatsApp Business API Configuration</h2>
              <div className="space-y-4">
                {[
                  { key: 'business_name', label: 'Business Name', placeholder: 'My Company' },
                  { key: 'phone_number', label: 'Phone Number', placeholder: '+1234567890' },
                  { key: 'phone_number_id', label: 'Phone Number ID', placeholder: 'From Meta Dashboard' },
                  { key: 'business_account_id', label: 'Business Account ID', placeholder: 'From Meta Dashboard' },
                  { key: 'access_token', label: 'Access Token', placeholder: 'Permanent or temporary token' },
                  { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://your-domain.com/webhook/whatsapp' },
                  { key: 'verify_token', label: 'Verify Token', placeholder: 'Your custom verify token' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{f.label}</label>
                    <input value={(form as any)[f.key] || ''} onChange={e => setForm({...form, [f.key]: e.target.value})} placeholder={f.placeholder}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                ))}
                <button onClick={handleSave} disabled={isSaving} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-md">
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
