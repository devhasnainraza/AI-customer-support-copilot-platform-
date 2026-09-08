/**
 * Advanced Modern Homepage & Enterprise Help Center Portal
 * Unified VIP Design System matching all application routes:
 * - Customer Portal (/customer/chat, /customer/tickets)
 * - Agent Command Center (/agent)
 * - Manager Portal (/manager, /analytics)
 * - Admin Knowledge Base (/admin)
 */
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, getUserRole } from '@/stores/authStore'
import { Logo } from '@/components/ui/Logo'

export default function Home() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const role = getUserRole(user)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'customer' | 'agent' | 'manager' | 'admin'>('customer')
  const [activeStepIndex, setActiveStepIndex] = useState(0)

  // Auto-cycle through the multi-agent pipeline steps for dynamic visual flair
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % 6)
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/customer/chat?initial=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/customer/chat')
    }
  }

  const quickQuestions = [
    { label: 'Refund Policy', query: 'How do I request a refund for a recent charge?' },
    { label: 'Talk to Human Specialist', query: 'I need to talk to a human support specialist.' },
    { label: 'Password Reset & 2FA', query: 'How do I reset my password and configure two-factor auth?' },
    { label: 'API & Webhooks', query: 'Where can I find documentation for API webhooks and integrations?' },
  ]

  const popularTopics = [
    {
      title: 'Billing & Subscriptions',
      desc: 'Invoices, refunds, payment methods, and automated plan renewals.',
      badge: 'Finance',
      badgeColor: 'badge-vip-indigo',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      query: 'How do billing, invoices, and refunds work?',
    },
    {
      title: 'Account & Access Security',
      desc: 'Password recovery, multi-factor auth, session management, and RBAC.',
      badge: 'Security',
      badgeColor: 'badge-vip-emerald',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      query: 'How do I manage my account security and password?',
    },
    {
      title: 'Knowledge Base & Setup',
      desc: 'Quickstart setup, documentation embeddings, and vector grounding.',
      badge: 'Docs',
      badgeColor: 'badge-vip-amber',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      query: 'What are the quickstart steps to get started with the platform?',
    },
    {
      title: 'Support Tickets & Orders',
      desc: 'Real-time case lookup, specialist assignment, and resolution history.',
      badge: 'Live Status',
      badgeColor: 'badge-vip-rose',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      href: '/customer/tickets',
    },
  ]

  const rolePortals = [
    {
      id: 'customer' as const,
      roleName: 'Customer Portal',
      tagline: 'Instant AI Assistance & Live Support Handshake',
      color: 'from-blue-600 to-indigo-600',
      badge: 'Public & Auth',
      badgeClass: 'badge-vip-indigo',
      link: '/customer/chat',
      buttonLabel: 'Launch Customer Chat',
      features: [
        'Real-time streaming AI answers grounded in verified docs',
        'Direct source citations with click-to-verify chunk preview',
        'Automatic ticket creation upon complex inquiry',
        'Instant one-click handoff to human support specialists',
      ],
      metrics: [
        { label: 'Avg Latency', value: '< 1.8s' },
        { label: 'Resolution Rate', value: '84.2%' },
        { label: 'Satisfaction', value: '4.9/5' },
      ],
    },
    {
      id: 'agent' as const,
      roleName: 'Agent Command Center',
      tagline: 'Real-time Escalation Queue & Bidirectional Chat',
      color: 'from-indigo-600 to-violet-600',
      badge: 'Agent Access',
      badgeClass: 'badge-vip-indigo',
      link: '/agent',
      buttonLabel: 'Open Agent Workspace',
      features: [
        'Live WebSocket queue with instant priority sorting',
        'AI Copilot suggested replies with one-click injection',
        'Customer context panel & full session exchange history',
        'Private internal notes & supervisor collaboration',
      ],
      metrics: [
        { label: 'Handoff Time', value: '< 30s' },
        { label: 'Queue Capacity', value: '500+ live' },
        { label: 'Agent Efficiency', value: '+62%' },
      ],
    },
    {
      id: 'manager' as const,
      roleName: 'Manager Dashboard',
      tagline: 'Team Roster, Escalations & SLA Telemetry',
      color: 'from-emerald-600 to-teal-600',
      badge: 'Manager Access',
      badgeClass: 'badge-vip-emerald',
      link: '/manager',
      buttonLabel: 'Open Manager Portal',
      features: [
        'Real-time agent roster with live status & active session counts',
        'Supervisor escalation takeover & priority overrides',
        'Hourly SLA compliance tracking & resolution velocity',
        'CSAT trends & automated performance reporting',
      ],
      metrics: [
        { label: 'SLA Adherence', value: '99.4%' },
        { label: 'First Contact', value: '91.8%' },
        { label: 'Daily Volume', value: '12.4k' },
      ],
    },
    {
      id: 'admin' as const,
      roleName: 'Admin Knowledge Engine',
      tagline: 'Vector Embeddings, System Config & WhatsApp Bridge',
      color: 'from-amber-600 to-rose-600',
      badge: 'Admin Access',
      badgeClass: 'badge-vip-amber',
      link: '/admin',
      buttonLabel: 'Open Admin Portal',
      features: [
        'Multi-format document ingestion (PDF, DOCX, TXT, MD)',
        '1536-dim vector embeddings with HNSW indexing',
        'Vector search sandbox with similarity scoring & chunk inspector',
        'WhatsApp Cloud API integration & webhook delivery telemetry',
      ],
      metrics: [
        { label: 'Vector Index', value: '12ms' },
        { label: 'Embeddings', value: '24.8k' },
        { label: 'Accuracy', value: '98.4%' },
      ],
    },
  ]

  const pipelineSteps = [
    {
      step: '01',
      title: 'Intent Router',
      desc: 'Classifies query intent (support, escalation, greeting, feedback) via LLM reasoning.',
      agent: 'Planner Agent',
      accent: 'border-blue-500 text-blue-600 bg-blue-50/50',
    },
    {
      step: '02',
      title: 'Sentiment Analysis',
      desc: 'Detects customer emotional valence, urgency levels, and frustration triggers.',
      agent: 'Sentiment Agent',
      accent: 'border-indigo-500 text-indigo-600 bg-indigo-50/50',
    },
    {
      step: '03',
      title: 'Vector RAG Retrieval',
      desc: 'Extracts top-k semantic chunks from pgvector using cosine distance matching.',
      agent: 'Retrieval Engine',
      accent: 'border-violet-500 text-violet-600 bg-violet-50/50',
    },
    {
      step: '04',
      title: 'Grounded Synthesis',
      desc: 'Synthesizes accurate answers with inline citations from verified source docs.',
      agent: 'Support Co-Pilot',
      accent: 'border-emerald-500 text-emerald-600 bg-emerald-50/50',
    },
    {
      step: '05',
      title: 'Quality Reflection',
      desc: 'Evaluates output against hallucination guards and groundedness thresholds.',
      agent: 'Reflection Agent',
      accent: 'border-amber-500 text-amber-600 bg-amber-50/50',
    },
    {
      step: '06',
      title: 'Ticket & Escalation',
      desc: 'Instantly creates tracked support ticket and alerts live agent queue if needed.',
      agent: 'Handoff Service',
      accent: 'border-rose-500 text-rose-600 bg-rose-50/50',
    },
  ]

  const activePortal = rolePortals.find((p) => p.id === activeTab) || rolePortals[0]

  return (
    <div className="min-h-screen bg-[#f8fafc] bg-dot-grid text-slate-900 font-sans antialiased flex flex-col justify-between selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      
      {/* ── TOP AMBIENT GLOW MESH ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[480px] ambient-glow-mesh pointer-events-none -z-10 opacity-70" />

      {/* ── FLOATING GLASS NAVIGATION ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl px-4 sm:px-8 py-3.5 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand Logo & Telemetry Status */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative">
              <Logo variant="icon" height={42} className="group-hover:scale-105 transition-transform" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg text-slate-950 tracking-tight block leading-tight">
                  Copilot <span className="bg-gradient-to-r from-cyan-600 to-blue-800 bg-clip-text text-transparent">SUPPORT</span>
                </span>
                <span className="badge-vip badge-vip-indigo text-[10px] hidden sm:inline-flex">
                  Enterprise
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold tracking-wide flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Operational &bull; 99.98% Uptime
              </span>
            </div>
          </Link>

          {/* Center Role Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80 text-xs font-bold text-slate-600">
            <Link
              href="/customer/chat"
              className="px-3.5 py-1.5 rounded-xl hover:text-indigo-600 hover:bg-white transition-all"
            >
              Customer Chat
            </Link>
            <Link
              href="/customer/tickets"
              className="px-3.5 py-1.5 rounded-xl hover:text-indigo-600 hover:bg-white transition-all"
            >
              Tickets
            </Link>
            <Link
              href="/agent"
              className="px-3.5 py-1.5 rounded-xl hover:text-indigo-600 hover:bg-white transition-all flex items-center gap-1"
            >
              <span>Agent Queue</span>
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-black">WS</span>
            </Link>
            <Link
              href="/manager"
              className="px-3.5 py-1.5 rounded-xl hover:text-indigo-600 hover:bg-white transition-all"
            >
              Manager
            </Link>
            <Link
              href="/admin"
              className="px-3.5 py-1.5 rounded-xl hover:text-indigo-600 hover:bg-white transition-all"
            >
              Admin RAG
            </Link>
          </nav>

          {/* Right User Actions */}
          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {(() => {
                  const target = role === 'admin' ? '/admin' : role === 'manager' ? '/manager' : role === 'agent' ? '/agent' : '/customer/chat'
                  const label = role === 'admin' ? 'Admin Portal' : role === 'manager' ? 'Manager Portal' : role === 'agent' ? 'Agent Workspace' : 'Open Chat'
                  return (
                    <Link
                      href={target}
                      className="btn-vip-primary px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span>{label}</span>
                    </Link>
                  )
                })()}
                <button
                  onClick={() => void logout()}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 border border-slate-200/80 transition-colors"
                  title="Sign Out"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="btn-vip-secondary px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/customer/chat"
                  className="btn-vip-primary px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5"
                >
                  <span>Start Chat</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* ── MAIN BODY CONTENT ── */}
      <main className="flex-1 space-y-16 sm:space-y-24 pb-20">
        
        {/* ── HERO SECTION & INSTANT AI PROMPT ── */}
        <section className="pt-12 sm:pt-20 px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-8">
          
          {/* Telemetry Status Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full surface-glass shadow-xs border border-indigo-100 text-xs font-bold text-slate-700">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="radar-live absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-slate-900 font-extrabold">Enterprise Multi-Agent Platform</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-indigo-600 font-mono font-bold">LangGraph RAG v2.4</span>
          </div>

          {/* Hero Main Heading */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="font-display text-4xl sm:text-6xl font-black tracking-tight text-slate-950 leading-[1.1]">
              Next-Gen AI Customer Support &amp;{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Intelligent Human Escalation
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
              Resolve inquiries instantly with citation-grounded RAG, automated ticket workflows, and seamless real-time handoff to live support specialists.
            </p>
          </div>

          {/* Interactive AI Search / Question Box */}
          <div className="max-w-3xl mx-auto pt-2">
            <form
              onSubmit={handleSearchSubmit}
              className="relative surface-vip p-2.5 shadow-xl shadow-indigo-500/5 transition-all focus-within:ring-4 focus-within:ring-indigo-100 focus-within:border-indigo-500"
            >
              <div className="relative flex items-center">
                <div className="pl-3.5 text-indigo-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask anything (e.g., 'How do I request a refund?' or 'Talk to human specialist')..."
                  className="w-full px-4 py-3.5 text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                />
                <button
                  type="submit"
                  className="btn-vip-primary px-5 sm:px-7 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shrink-0 cursor-pointer shadow-md shadow-indigo-200"
                >
                  <span>Ask AI</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Quick Prompt Suggestions */}
            <div className="pt-3.5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <span>⚡ Try:</span>
              </span>
              {quickQuestions.map((q) => (
                <button
                  key={q.label}
                  onClick={() => router.push(`/customer/chat?initial=${encodeURIComponent(q.query)}`)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/90 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <span className="text-indigo-600 font-bold">&bull;</span>
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Real-Time Metrics Strip */}
          <div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="surface-vip p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black font-display text-slate-900 tracking-tight">&lt; 1.8s</div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">p95 AI Response</div>
            </div>
            <div className="surface-vip p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black font-display text-indigo-600 tracking-tight">98.4%</div>
              <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mt-0.5">Grounded Accuracy</div>
            </div>
            <div className="surface-vip p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black font-display text-emerald-600 tracking-tight">24.8k+</div>
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5">Vector Chunks</div>
            </div>
            <div className="surface-vip p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black font-display text-violet-600 tracking-tight">&lt; 30s</div>
              <div className="text-[11px] font-bold text-violet-600 uppercase tracking-wider mt-0.5">Live Agent Handoff</div>
            </div>
          </div>

        </section>

        {/* ── 4-ROLE ARCHITECTURE SHOWCASE (MATCHING ALL APP ROUTES) ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="surface-vip p-6 sm:p-10 border border-slate-200/80 shadow-lg shadow-slate-200/40 relative overflow-hidden">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/80 pb-6 mb-8">
              <div>
                <div className="flex items-center gap-2">
                  <span className="badge-vip badge-vip-indigo">Unified Architecture</span>
                  <span className="text-xs text-slate-400 font-bold">4 Dedicated Portals</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950 mt-2">
                  Enterprise Role-Based Command System
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl font-medium">
                  Experience a purpose-built workspace for every stakeholder, from public customer self-service to agent queues and manager analytics.
                </p>
              </div>

              {/* Role Navigation Tab Switcher */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
                {rolePortals.map((portal) => (
                  <button
                    key={portal.id}
                    onClick={() => setActiveTab(portal.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === portal.id
                        ? 'bg-white text-slate-900 shadow-sm shadow-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {portal.roleName}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Portal Detail Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Column: Feature Highlights & Launch */}
              <div className="lg:col-span-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`badge-vip ${activePortal.badgeClass}`}>
                      {activePortal.badge}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      Route: {activePortal.link}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950">
                    {activePortal.roleName}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">
                    {activePortal.tagline}
                  </p>
                </div>

                {/* Features List */}
                <div className="space-y-3">
                  {activePortal.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                      <div className="h-5 w-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {activePortal.metrics.map((m, i) => (
                    <div key={i} className="surface-inset p-3 rounded-xl text-center">
                      <div className="font-mono text-base sm:text-lg font-extrabold text-slate-900">{m.value}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* CTA Action */}
                <div className="pt-2 flex items-center gap-3">
                  <Link
                    href={activePortal.link}
                    className="btn-vip-primary px-6 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-200"
                  >
                    <span>{activePortal.buttonLabel}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                  <Link
                    href="/login"
                    className="btn-vip-secondary px-4 py-3 rounded-xl text-xs font-bold"
                  >
                    Login to Role
                  </Link>
                </div>
              </div>

              {/* Right Column: Visual Mockup / Portal Preview */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl border border-slate-200/90 bg-slate-900 text-white p-5 sm:p-7 shadow-2xl space-y-4 relative overflow-hidden font-mono text-xs">
                  
                  {/* Mock Window Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-rose-500 inline-block" />
                      <span className="h-3 w-3 rounded-full bg-amber-500 inline-block" />
                      <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-slate-400 font-sans font-bold text-[11px] ml-2">
                        https://copilot.enterprise{activePortal.link}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md">
                      ● LIVE WS
                    </span>
                  </div>

                  {/* Dynamic Mockup Body per Role */}
                  {activeTab === 'customer' && (
                    <div className="space-y-3 font-sans">
                      <div className="flex items-start gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                          YOU
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-800 text-slate-100 text-xs max-w-[85%]">
                          I need to talk to a human support specialist about my enterprise billing.
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="h-7 w-7 rounded-2xl bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                          AI
                        </div>
                        <div className="p-3.5 rounded-2xl bg-indigo-950/70 border border-indigo-700/60 text-indigo-100 text-xs space-y-2 max-w-[90%]">
                          <p>I have transferred your request to our live human support team (Ticket #TICK-20260907-0003). Alex Morgan is joining the session now.</p>
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[10px] font-bold">
                            <span>🤝 Live Specialist Connected &bull; Alex Morgan</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'agent' && (
                    <div className="space-y-3 font-sans">
                      <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                        <span className="text-xs font-bold text-slate-200">Active Ticket #TICK-0003 (HIGH)</span>
                        <span className="badge-vip badge-vip-rose text-[10px]">Human Handoff</span>
                      </div>
                      <div className="p-3 bg-indigo-950/50 border border-indigo-800 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">AI Copilot Suggested Reply:</span>
                        <p className="text-xs text-slate-200">&quot;Hello Alex! I have your billing ledger open and can issue the adjustment right away.&quot;</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold text-center">
                          Inject &amp; Send Reply
                        </button>
                        <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold text-center">
                          Resolve Case
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'manager' && (
                    <div className="space-y-3 font-sans">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                          <div className="text-lg font-bold text-emerald-400">14 Active</div>
                          <div className="text-[10px] text-slate-400">Specialists Online</div>
                        </div>
                        <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                          <div className="text-lg font-bold text-indigo-400">1m 12s</div>
                          <div className="text-[10px] text-slate-400">Avg Resolution</div>
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700 text-xs space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span>Alex Morgan</span>
                          <span className="text-emerald-400">3 Sessions (Active)</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Sarah Jenkins</span>
                          <span className="text-emerald-400">2 Sessions (Active)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'admin' && (
                    <div className="space-y-3 font-sans">
                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-amber-400">enterprise_sla_manual.pdf</span>
                          <span className="text-emerald-400">Indexed (100%)</span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full w-full" />
                        </div>
                        <div className="text-[10px] text-slate-400 flex justify-between">
                          <span>14 chunks created</span>
                          <span>1536-dim vector embeddings</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-800/50 rounded-xl text-[11px] text-slate-300 flex items-center justify-between">
                        <span>WhatsApp Business Cloud API</span>
                        <span className="text-emerald-400 font-bold">● Connected</span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ── LIVE MULTI-AGENT ORCHESTRATION PIPELINE ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-2">
            <span className="badge-vip badge-vip-indigo">LangGraph Agentic Flow</span>
            <h2 className="font-display text-2xl sm:text-4xl font-black text-slate-950">
              6-Stage Autonomous AI Support Pipeline
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Every incoming customer prompt is processed in sub-2s through dedicated agent nodes with deterministic guardrails.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {pipelineSteps.map((s, idx) => {
              const isActive = activeStepIndex === idx
              return (
                <div
                  key={s.step}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`surface-vip p-5 transition-all cursor-pointer flex flex-col justify-between relative ${
                    isActive
                      ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-200'
                      : 'hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-base text-slate-400">
                        {s.step}
                      </span>
                      {isActive && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                      )}
                    </div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      {s.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      {s.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-bold font-mono text-indigo-600 flex items-center justify-between">
                    <span>{s.agent}</span>
                    <span>&rarr;</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── BROWSE BY HELP CATEGORY ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-slate-900">
                Explore Knowledge &amp; Support Categories
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Instant verified answers curated directly from official documentation.
              </p>
            </div>
            <Link
              href="/customer/chat"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
            >
              <span>Launch Live Chat</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {popularTopics.map((topic) => {
              if (topic.href) {
                return (
                  <Link
                    key={topic.title}
                    href={topic.href}
                    className="surface-vip surface-vip-interactive p-6 flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs border border-indigo-100">
                          {topic.icon}
                        </div>
                        <span className={`badge-vip ${topic.badgeColor}`}>
                          {topic.badge}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {topic.title}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        {topic.desc}
                      </p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-bold text-indigo-600 flex items-center justify-between">
                      <span>View Status</span>
                      <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </div>
                  </Link>
                )
              }

              return (
                <button
                  key={topic.title}
                  onClick={() => router.push(`/customer/chat?initial=${encodeURIComponent(topic.query || topic.title)}`)}
                  className="surface-vip surface-vip-interactive p-6 text-left flex flex-col justify-between group cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs border border-indigo-100">
                        {topic.icon}
                      </div>
                      <span className={`badge-vip ${topic.badgeColor}`}>
                        {topic.badge}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {topic.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      {topic.desc}
                    </p>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-bold text-indigo-600 flex items-center justify-between w-full">
                    <span>Ask AI Co-Pilot</span>
                    <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── 2 CORE ENTRY CARDS (CHAT & TICKETS) ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: 24/7 AI Live Chat */}
            <div className="surface-vip p-8 flex flex-col justify-between space-y-6 relative overflow-hidden group">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="badge-vip badge-vip-emerald">Instant Response</span>
                  <span className="text-xs font-mono font-bold text-slate-400">&bull; Grounded RAG</span>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-slate-950">
                  24/7 Autonomous AI Support Chat
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Have a technical, account, or billing inquiry? Chat in real time with our intelligent copilot. Every answer includes verifiable source citations and automatic handoff triggers for live specialist intervention.
                </p>
              </div>

              <Link
                href="/customer/chat"
                className="btn-vip-primary w-full py-3.5 rounded-xl text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
              >
                <span>Launch Customer Live Chat</span>
                <span>&rarr;</span>
              </Link>
            </div>

            {/* Card 2: Track Support Tickets */}
            <div className="surface-vip p-8 flex flex-col justify-between space-y-6 relative overflow-hidden group">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="badge-vip badge-vip-indigo">Case Tracking</span>
                  <span className="text-xs font-mono font-bold text-slate-400">&bull; Live Queue</span>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-slate-950">
                  Track Escalations &amp; Support Tickets
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Review open tickets, read internal resolution notes from assigned support engineers, check SLA turnaround times, and follow up on escalated conversations.
                </p>
              </div>

              <Link
                href="/customer/tickets"
                className="btn-vip-secondary w-full py-3.5 rounded-xl text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2"
              >
                <span>Check My Support Tickets</span>
                <span>&rarr;</span>
              </Link>
            </div>

          </div>
        </section>

      </main>

      {/* ── ENTERPRISE GLASS FOOTER ── */}
      <footer className="border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-10 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            
            {/* Col 1: Brand Info */}
            <div className="col-span-2 space-y-3">
              <Link href="/" className="inline-block">
                <Logo variant="full" height={40} className="hover:opacity-90 transition-opacity" />
              </Link>
              <p className="text-xs text-slate-500 max-w-sm font-medium leading-relaxed">
                Enterprise-grade AI customer support platform with multi-agent LangGraph orchestration, vector knowledge retrieval, and live human specialist escalation.
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>All API Systems Operational</span>
              </div>
            </div>

            {/* Col 2: Customer Portals */}
            <div className="space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">Customer</span>
              <ul className="space-y-1.5 font-medium">
                <li><Link href="/customer/chat" className="hover:text-indigo-600 transition-colors">AI Live Chat</Link></li>
                <li><Link href="/customer/tickets" className="hover:text-indigo-600 transition-colors">My Support Tickets</Link></li>
                <li><Link href="/login" className="hover:text-indigo-600 transition-colors">Customer Sign In</Link></li>
              </ul>
            </div>

            {/* Col 3: Staff & Management */}
            <div className="space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">Operations</span>
              <ul className="space-y-1.5 font-medium">
                <li><Link href="/agent" className="hover:text-indigo-600 transition-colors">Agent Command Center</Link></li>
                <li><Link href="/manager" className="hover:text-indigo-600 transition-colors">Manager Dashboard</Link></li>
                <li><Link href="/analytics" className="hover:text-indigo-600 transition-colors">Analytics &amp; CSAT</Link></li>
              </ul>
            </div>

            {/* Col 4: Platform & Engineering */}
            <div className="space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">Engineering</span>
              <ul className="space-y-1.5 font-medium">
                <li><Link href="/admin" className="hover:text-indigo-600 transition-colors">Knowledge Base Admin</Link></li>
                <li><Link href="/admin/whatsapp" className="hover:text-indigo-600 transition-colors">WhatsApp Bridge</Link></li>
                <li><a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer" className="hover:text-indigo-600 transition-colors">OpenAPI Docs</a></li>
              </ul>
            </div>

          </div>

          <div className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
            <p>&copy; 2026 SupportCopilot Enterprise. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span>PostgreSQL + pgvector</span>
              <span>&bull;</span>
              <span>FastAPI + Next.js</span>
              <span>&bull;</span>
              <span>LangGraph Orchestration</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  )
}
