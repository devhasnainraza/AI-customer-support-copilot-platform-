"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/stores/authStore"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { useWhatsAppSocket, WhatsAppEvent } from "@/hooks/useWhatsAppSocket"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function getHeaders() {
  const raw = localStorage.getItem("supabase.auth.token") || ""
  const token = raw.replace(/^"|"$/g, "")
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

type Tab = "overview" | "conversations" | "templates" | "analytics" | "webhook"

interface WConfig {
  connected: boolean
  business_name: string
  display_phone_number: string
  phone_number_id: string
  business_account_id: string
  verify_token: string
  webhook_configured: boolean
}

interface WConversation {
  id: string
  wa_chat_id: string
  customer_phone: string
  customer_name: string
  status: string
  message_count: number
  last_message_at: string
  unread_count: number
  last_message: { text: string; direction: string } | null
  messages?: any[]
}

interface WTemplate {
  name: string
  language: string
  category: string
  status: string
  parameters: any[]
  times_used: number
}

interface WAnalytics {
  connected: boolean
  total_conversations: number
  active_conversations: number
  total_messages: number
  inbound_messages: number
  outbound_messages: number
  templates_available: number
  templates_used: number
  message_statuses: Record<string, number>
}

export default function AdminWhatsAppPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [tab, setTab] = useState<Tab>("overview")
  const [config, setConfig] = useState<WConfig | null>(null)
  const [conversations, setConversations] = useState<WConversation[]>([])
  const [selectedConv, setSelectedConv] = useState<WConversation | null>(null)
  const [templates, setTemplates] = useState<WTemplate[]>([])
  const [analytics, setAnalytics] = useState<WAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [wsConnected, setWsConnected] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Real-time WhatsApp WebSocket
  const { status: wsStatus, lastEvent, events: wsEvents, clearEvents } = useWhatsAppSocket(isAuthenticated)

  // Config form
  const [form, setForm] = useState({
    business_name: "",
    phone_number: "",
    phone_number_id: "",
    business_account_id: "",
    access_token: "",
    app_secret: "",
    webhook_url: "",
    verify_token: "",
    display_phone_number: "",
  })
  const [saving, setSaving] = useState(false)

  // Send message form
  const [sendForm, setSendForm] = useState({ to_number: "", message: "" })
  const [sending, setSending] = useState(false)

  // Template form
  const [tplForm, setTplForm] = useState({ name: "", language: "en", category: "UTILITY", body: "", parameters: "" })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login?redirect=/admin/whatsapp")
  }, [authLoading, isAuthenticated])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, convRes, tplRes, anaRes] = await Promise.allSettled([
        fetch(`${API}/v1/whatsapp/config`, { headers: getHeaders() }).then((r) => r.json()),
        fetch(`${API}/v1/whatsapp/conversations`, { headers: getHeaders() }).then((r) => r.json()),
        fetch(`${API}/v1/whatsapp/templates`, { headers: getHeaders() }).then((r) => r.json()),
        fetch(`${API}/v1/whatsapp/analytics`, { headers: getHeaders() }).then((r) => r.json()),
      ])
      if (cfgRes.status === "fulfilled") setConfig(cfgRes.value)
      if (convRes.status === "fulfilled") setConversations(convRes.value.conversations || [])
      if (tplRes.status === "fulfilled") setTemplates(tplRes.value.templates || [])
      if (anaRes.status === "fulfilled") setAnalytics(anaRes.value)
    } catch (e) {
      console.error("Failed to load WhatsApp data:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchAll()
  }, [isAuthenticated, fetchAll])

  // Track WebSocket connection status
  useEffect(() => {
    setWsConnected(wsStatus === "connected")
  }, [wsStatus])

  // Handle real-time WhatsApp WebSocket events
  useEffect(() => {
    if (!lastEvent) return

    if (lastEvent.type === "new_message" && lastEvent.direction === "inbound") {
      const msg = lastEvent.message
      const conv = lastEvent.conversation
      const senderName = conv?.customer_name || msg?.from_number || "Unknown"
      const text = msg?.text || "[Media]"

      // Show toast notification
      setToast({ message: `New message from ${senderName}: ${text.slice(0, 60)}`, type: "info" })
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 5000)

      // Update conversation list in-place
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conv?.id)
        const updated = conv || prev[idx]
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = { ...copy[idx], ...updated, last_message: msg, unread_count: (copy[idx].unread_count || 0) + 1 }
          return copy
        }
        // New conversation — prepend
        return [{ ...updated, last_message: msg, message_count: 1 }, ...prev]
      })

      // Increment unread counter for this conversation
      if (conv?.id) {
        setUnreadCounts((prev) => ({ ...prev, [conv.id]: (prev[conv.id] || 0) + 1 }))
      }

      // Update analytics
      setAnalytics((prev) => prev ? { ...prev, total_messages: prev.total_messages + 1, inbound_messages: prev.inbound_messages + 1 } : prev)

      // If this conversation is currently selected, refresh its messages
      if (selectedConv?.id === conv?.id) {
        loadConversation(conv.id)
      }
    }

    if (lastEvent.type === "status_update") {
      setAnalytics((prev) => {
        if (!prev) return prev
        const statuses = { ...prev.message_statuses }
        statuses[lastEvent.status] = (statuses[lastEvent.status] || 0) + 1
        return { ...prev, message_statuses: statuses }
      })
    }
  }, [lastEvent, selectedConv?.id])

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/v1/whatsapp/configure`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          access_token: form.access_token,
          phone_number_id: form.phone_number_id,
          business_account_id: form.business_account_id,
          verify_token: form.verify_token,
          app_secret: form.app_secret,
          business_name: form.business_name,
          display_phone_number: form.phone_number,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        setTestResult("✅ Connected successfully!")
      } else {
        setTestResult("❌ Connection failed — check your credentials")
      }
    } catch {
      setTestResult("❌ Network error — is the backend running?")
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    await fetch(`${API}/v1/whatsapp/disconnect`, { method: "POST", headers: getHeaders() })
    setConfig((c) => (c ? { ...c, connected: false } : c))
  }

  const handleTestConnection = async () => {
    setTestResult("Testing...")
    try {
      const res = await fetch(`${API}/v1/whatsapp/test-connection`, { method: "POST", headers: getHeaders() })
      const data = await res.json()
      setTestResult(data.status === "ok" ? "✅ Connection healthy" : "❌ Connection failed")
    } catch {
      setTestResult("❌ Backend not reachable")
    }
  }

  const handleSendMessage = async () => {
    if (!sendForm.to_number || !sendForm.message) return
    setSending(true)
    try {
      await fetch(`${API}/v1/whatsapp/send/text`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(sendForm),
      })
      setSendForm({ to_number: "", message: "" })
    } finally {
      setSending(false)
    }
  }

  const handleSyncTemplates = async () => {
    try {
      const res = await fetch(`${API}/v1/whatsapp/templates/sync`, { method: "POST", headers: getHeaders() })
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {}
  }

  const handleCreateTemplate = async () => {
    try {
      const params = tplForm.parameters
        ? tplForm.parameters.split(",").map((p, i) => ({ type: "text", text: `{{${i + 1}}}` }))
        : []
      await fetch(`${API}/v1/whatsapp/templates`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ ...tplForm, parameters: params }),
      })
      setTplForm({ name: "", language: "en", category: "UTILITY", body: "", parameters: "" })
      fetchAll()
    } catch {}
  }

  const handleDeleteTemplate = async (name: string) => {
    await fetch(`${API}/v1/whatsapp/templates/${name}`, { method: "DELETE", headers: getHeaders() })
    setTemplates((t) => t.filter((tpl) => tpl.name !== name))
  }

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`${API}/v1/whatsapp/conversations/${id}`, { headers: getHeaders() })
      const data = await res.json()
      setSelectedConv(data)
    } catch {}
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "conversations", label: "Conversations", icon: "💬" },
    { key: "templates", label: "Templates", icon: "📝" },
    { key: "analytics", label: "Analytics", icon: "📈" },
    { key: "webhook", label: "Webhook", icon: "🔗" },
  ]

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbfbfa] text-slate-500 text-sm font-semibold">
        Loading...
      </div>
    )
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div className="flex h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden">
        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 animate-[slideUp_0.3s_ease-out]">
            <div className={`px-5 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-3 backdrop-blur-md ${
              toast.type === "error" ? "bg-red-50/95 border-red-200 text-red-700" : toast.type === "success" ? "bg-emerald-50/95 border-emerald-200 text-emerald-700" : "bg-indigo-50/95 border-indigo-200 text-indigo-700"
            }`}>
              <span className="text-lg">{toast.type === "error" ? "❌" : toast.type === "success" ? "✅" : "💬"}</span>
              <span className="max-w-xs truncate">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600">✕</button>
            </div>
          </div>
        )}

        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="p-6 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="text-2xl">📱</span> WhatsApp Business Integration
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Connect, manage, and monitor WhatsApp conversations</p>
              </div>
              <div className="flex items-center gap-3">
                {wsConnected && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-extrabold border border-blue-200">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Live
                  </span>
                )}
                {wsStatus === "reconnecting" && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-extrabold border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Reconnecting...
                  </span>
                )}
                {config?.connected && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Connected
                  </span>
                )}
                <button onClick={fetchAll} className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm">
                  🔄 Refresh
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 mt-4 -mb-px">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
                    tab === t.key
                      ? "border-indigo-600 text-indigo-700 bg-white"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
                {tab === "overview" && (
                  <div className="max-w-5xl w-full mx-auto space-y-6">
                    {/* Connection Status Card */}
                    <div className={`rounded-2xl p-6 border shadow-sm ${config?.connected ? "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200" : "bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-4 h-4 rounded-full ${config?.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                            <h2 className="text-sm font-extrabold text-slate-900">
                              {config?.connected ? "WhatsApp Connected" : "Not Connected"}
                            </h2>
                          </div>
                          {config?.connected ? (
                            <div className="text-xs text-slate-600 space-y-1 ml-7">
                              <p><span className="font-bold">Business:</span> {config.business_name}</p>
                              <p><span className="font-bold">Phone:</span> {config.display_phone_number || config.phone_number_id}</p>
                              <p><span className="font-bold">Webhook:</span> {config.webhook_configured ? "✅ Configured" : "⚠️ Not set up"}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 ml-7">Configure your Meta WhatsApp Business API credentials below to start messaging.</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {config?.connected && (
                            <>
                              <button onClick={handleTestConnection} className="px-3 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm">
                                🧪 Test
                              </button>
                              <button onClick={handleDisconnect} className="px-3 py-2 text-xs font-bold rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 shadow-sm">
                                ⏏️ Disconnect
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {testResult && (
                        <div className="mt-4 ml-7 px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold text-slate-700">
                          {testResult}
                        </div>
                      )}
                    </div>

                    {/* Quick Stats */}
                    {analytics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Conversations", value: analytics.total_conversations, color: "indigo" },
                          { label: "Active Chats", value: analytics.active_conversations, color: "emerald" },
                          { label: "Messages", value: analytics.total_messages, color: "purple" },
                          { label: "Templates", value: analytics.templates_available, color: "amber" },
                        ].map((s) => (
                          <div key={s.label} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{s.label}</span>
                            <div className={`text-2xl font-extrabold mt-1 text-${s.color}-600`}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Configuration Form */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-4">
                        {config?.connected ? "Update Configuration" : "Meta WhatsApp Business API Setup"}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: "business_name", label: "Business Name", placeholder: "My Company Support" },
                          { key: "phone_number", label: "Display Phone Number", placeholder: "+1 555 123 4567" },
                          { key: "phone_number_id", label: "Phone Number ID", placeholder: "From Meta Dashboard → WhatsApp → API Setup" },
                          { key: "business_account_id", label: "Business Account ID", placeholder: "From Meta Business Suite" },
                          { key: "access_token", label: "Permanent Access Token", placeholder: "EAAxxx... (Meta permanent token)", password: true },
                          { key: "app_secret", label: "App Secret", placeholder: "From Meta Dashboard → Settings → Basic", password: true },
                          { key: "verify_token", label: "Webhook Verify Token", placeholder: "Your custom string (auto-generated if empty)" },
                          { key: "webhook_url", label: "Webhook URL (for Meta)", placeholder: "https://your-domain.com/v1/whatsapp/webhook", disabled: true },
                        ].map((f) => (
                          <div key={f.key} className="space-y-1">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{f.label}</label>
                            <input
                              value={(form as any)[f.key] || ""}
                              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                              placeholder={f.placeholder}
                              type={(f as any).password ? "password" : "text"}
                              disabled={(f as any).disabled}
                              className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleSaveConfig}
                        disabled={saving || !form.access_token || !form.phone_number_id}
                        className="mt-4 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all"
                      >
                        {saving ? "Connecting..." : config?.connected ? "Update & Verify" : "Connect WhatsApp"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── CONVERSATIONS TAB ───────────────────────────────── */}
                {tab === "conversations" && (
                  <div className="max-w-6xl w-full mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)]">
                      {/* Conversation List */}
                      <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100">
                          <h3 className="text-sm font-extrabold text-slate-900">Conversations ({conversations.length})</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          {conversations.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs">
                              No WhatsApp conversations yet.
                            </div>
                          ) : (
                            conversations.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => loadConversation(c.id)}
                                className={`w-full p-4 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedConv?.id === c.id ? "bg-indigo-50 border-l-4 border-l-indigo-500" : ""}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                                      {c.customer_name?.charAt(0) || "📱"}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-900">{c.customer_name || "Unknown"}</p>
                                      <p className="text-[10px] text-slate-400">{c.customer_phone}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    {(unreadCounts[c.id] || c.unread_count) > 0 && (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold animate-bounce">{unreadCounts[c.id] || c.unread_count}</span>
                                    )}
                                    <p className="text-[10px] text-slate-400 mt-1">{new Date(c.last_message_at).toLocaleTimeString()}</p>
                                  </div>
                                </div>
                                {c.last_message && (
                                  <p className="text-[10px] text-slate-500 mt-1 ml-13 truncate">{c.last_message.text}</p>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Conversation Detail */}
                      <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        {selectedConv ? (
                          <>
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                                  {selectedConv.customer_name?.charAt(0) || "📱"}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{selectedConv.customer_name || "Unknown"}</p>
                                  <p className="text-[10px] text-slate-400">{selectedConv.customer_phone} • {selectedConv.message_count} messages</p>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${selectedConv.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {selectedConv.status}
                              </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                              {(selectedConv.messages || []).map((m: any, i: number) => (
                                <div key={i} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-xs ${
                                    m.direction === "outbound"
                                      ? "bg-indigo-600 text-white rounded-br-md"
                                      : "bg-slate-100 text-slate-800 rounded-bl-md"
                                  }`}>
                                    <p>{m.text}</p>
                                    <p className={`text-[9px] mt-1 ${m.direction === "outbound" ? "text-indigo-200" : "text-slate-400"}`}>
                                      {new Date(m.timestamp).toLocaleTimeString()}
                                      {m.status && m.direction === "outbound" && ` • ${m.status}`}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {(!selectedConv.messages || selectedConv.messages.length === 0) && (
                                <div className="text-center text-slate-400 text-xs py-8">No messages in this conversation</div>
                              )}
                            </div>

                            <div className="p-4 border-t border-slate-100">
                              <div className="flex gap-2">
                                <input
                                  value={sendForm.message}
                                  onChange={(e) => setSendForm({ ...sendForm, message: e.target.value, to_number: selectedConv.customer_phone })}
                                  placeholder="Type a reply..."
                                  className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                />
                                <button
                                  onClick={handleSendMessage}
                                  disabled={sending || !sendForm.message}
                                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
                                >
                                  {sending ? "..." : "Send"}
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                            Select a conversation to view details
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TEMPLATES TAB ──────────────────────────────────── */}
                {tab === "templates" && (
                  <div className="max-w-5xl w-full mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-extrabold text-slate-900">Message Templates ({templates.length})</h2>
                      <button onClick={handleSyncTemplates} className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm">
                        🔄 Sync from Meta
                      </button>
                    </div>

                    {/* Create Template */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">Create New Template</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} placeholder="Template name" className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <select value={tplForm.language} onChange={(e) => setTplForm({ ...tplForm, language: e.target.value })} className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="en">English</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                          <option value="ar">Arabic</option>
                        </select>
                        <select value={tplForm.category} onChange={(e) => setTplForm({ ...tplForm, category: e.target.value })} className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="UTILITY">Utility</option>
                          <option value="MARKETING">Marketing</option>
                          <option value="AUTHENTICATION">Authentication</option>
                        </select>
                        <button onClick={handleCreateTemplate} disabled={!tplForm.name} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm">
                          + Create
                        </button>
                      </div>
                    </div>

                    {/* Template List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map((t) => (
                        <div key={t.name} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-extrabold text-slate-900 font-mono">{t.name}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">{t.language}</span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">{t.category}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${t.status === "approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                                  {t.status}
                                </span>
                              </div>
                            </div>
                            <button onClick={() => handleDeleteTemplate(t.name)} className="text-slate-400 hover:text-red-500 text-xs">✕</button>
                          </div>
                          {t.parameters.length > 0 && (
                            <p className="text-[10px] text-slate-400 mt-2">Parameters: {t.parameters.length}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">Used {t.times_used} times</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── ANALYTICS TAB ──────────────────────────────────── */}
                {tab === "analytics" && analytics && (
                  <div className="max-w-5xl w-full mx-auto space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Total Conversations", value: analytics.total_conversations, icon: "💬" },
                        { label: "Active Now", value: analytics.active_conversations, icon: "🟢" },
                        { label: "Inbound Messages", value: analytics.inbound_messages, icon: "📥" },
                        { label: "Outbound Messages", value: analytics.outbound_messages, icon: "📤" },
                      ].map((s) => (
                        <div key={s.label} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
                          <span className="text-lg">{s.icon}</span>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mt-1">{s.label}</span>
                          <div className="text-2xl font-extrabold text-slate-900 mt-1">{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Message Status Breakdown */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-sm font-extrabold text-slate-900 mb-4">Delivery Status</h3>
                      <div className="space-y-3">
                        {Object.entries(analytics.message_statuses).map(([status, count]) => (
                          <div key={status} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-600 w-20 capitalize">{status}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full ${status === "read" ? "bg-indigo-500" : status === "delivered" ? "bg-emerald-500" : status === "sent" ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${analytics.outbound_messages > 0 ? ((count / analytics.outbound_messages) * 100).toFixed(0) : 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500">{count}</span>
                          </div>
                        ))}
                        {Object.keys(analytics.message_statuses).length === 0 && (
                          <p className="text-xs text-slate-400">No outbound messages yet</p>
                        )}
                      </div>
                    </div>

                    {/* Quick Send */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-sm font-extrabold text-slate-900 mb-4">Quick Send Test Message</h3>
                      <div className="flex gap-2">
                        <input value={sendForm.to_number} onChange={(e) => setSendForm({ ...sendForm, to_number: e.target.value })} placeholder="Phone number (+1...)" className="w-48 px-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <input value={sendForm.message} onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })} placeholder="Message text" className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={handleSendMessage} disabled={sending || !sendForm.to_number || !sendForm.message} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm">
                          {sending ? "..." : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── WEBHOOK TAB ─────────────────────────────────────── */}
                {tab === "webhook" && (
                  <div className="max-w-3xl w-full mx-auto space-y-6">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-sm font-extrabold text-slate-900 mb-4">Webhook Configuration</h3>
                      <p className="text-xs text-slate-500 mb-6">
                        Configure this webhook URL in your Meta Developer Dashboard under WhatsApp → Configuration → Webhook.
                      </p>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Webhook URL (for Meta)</label>
                          <div className="flex items-center gap-2 mt-2">
                            <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700">
                              {API}/v1/whatsapp/webhook
                            </code>
                            <button onClick={() => navigator.clipboard.writeText(`${API}/v1/whatsapp/webhook`)} className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100">
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Verify Token</label>
                          <div className="flex items-center gap-2 mt-2">
                            <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700">
                              {config?.verify_token || "Configure WhatsApp first to generate a verify token"}
                            </code>
                            {config?.verify_token && (
                              <button onClick={() => navigator.clipboard.writeText(config.verify_token)} className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100">
                                Copy
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Setup Instructions */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-sm font-extrabold text-slate-900 mb-4">Setup Instructions</h3>
                      <ol className="space-y-3 text-xs text-slate-600">
                        {[
                          { step: 1, text: "Go to Meta Developer Dashboard → Your App → WhatsApp → Configuration" },
                          { step: 2, text: 'Paste the Webhook URL above into the "Webhook URL" field' },
                          { step: 3, text: 'Paste the Verify Token into the "Verify Token" field and click Save' },
                          { step: 4, text: "Meta will send a verification request — your server will respond automatically" },
                          { step: 5, text: "Subscribe to webhook fields: messages, message_template_status_update" },
                          { step: 6, text: "Send a test message to your WhatsApp Business number to verify" },
                        ].map((s) => (
                          <li key={s.step} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-extrabold">{s.step}</span>
                            <span className="pt-0.5">{s.text}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Webhook Events */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                      <h3 className="text-sm font-extrabold text-slate-900 mb-3">Supported Webhook Events</h3>
                      <div className="space-y-2">
                        {[
                          { event: "messages", desc: "Incoming messages from customers", icon: "📨" },
                          { event: "statuses", desc: "Delivery and read receipts", icon: "✅" },
                          { event: "message_template_status_update", desc: "Template approval/rejection", icon: "📝" },
                        ].map((e) => (
                          <div key={e.event} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                            <span className="text-lg">{e.icon}</span>
                            <div>
                              <p className="text-xs font-bold text-slate-900 font-mono">{e.event}</p>
                              <p className="text-[10px] text-slate-500">{e.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </RoleGuard>
  )
}
