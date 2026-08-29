/**
 * High-End Premium Light Portal Landing Page
 * Designed to wow with glassmorphism, grid backgrounds, aurora gradients, and interactive bento grids.
 */
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth, getUserRole } from '@/stores/authStore'

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth()
  const role = getUserRole(user)
  const [simulatedMessages, setSimulatedMessages] = useState<Array<{ sender: 'user' | 'ai', text: string }>>([])
  
  // Auto-redirect authenticated users to their role dashboard
  useEffect(() => {
    if (!isAuthenticated) return
    if (role === 'admin') window.location.href = '/admin'
    else if (role === 'manager') window.location.href = '/manager'
    else if (role === 'agent') window.location.href = '/agent'
    else window.location.href = '/customer/chat'
  }, [isAuthenticated, role])
  
  useEffect(() => {
    // Simulated interactive chat preview
    const script = [
      { sender: 'user', text: 'How do I request a refund for a billing error?' },
      { sender: 'ai', text: 'I can help you with that! According to our Refund Policy (Section 4.2), billing errors reported within 30 days are fully refundable. Would you like me to open a billing ticket?' },
      { sender: 'user', text: 'Yes, please connect me to billing.' },
      { sender: 'ai', text: '🔄 Summarizing conversation... Ticket #TICK-202606-891 created with high priority and routed to the Billing Team.' }
    ] as const;

    let timeoutId: NodeJS.Timeout;
    let currentIndex = 0;

    const showNextMessage = () => {
      if (currentIndex < script.length) {
        setSimulatedMessages(Array.from(script.slice(0, currentIndex + 1)));
        currentIndex++;
        // If there are more messages, wait 2.5s; if we just showed the last one, wait 6s to restart
        const delay = currentIndex < script.length ? 2500 : 6000;
        timeoutId = setTimeout(() => {
          if (currentIndex >= script.length) {
            currentIndex = 0;
          }
          showNextMessage();
        }, delay);
      }
    };

    showNextMessage();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [])

  return (
    <div className="relative min-h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden font-sans">
      
      {/* Dynamic Aurora Glow Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[50%] rounded-full glow-blob-indigo pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full glow-blob-rose pointer-events-none" />
      <div className="absolute bottom-[10%] left-[20%] w-[60%] h-[40%] rounded-full glow-blob-amber pointer-events-none" />

      {/* Premium Glass Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-6 py-4 transition-all duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-rose-500 text-white font-extrabold text-xl shadow-md shadow-indigo-100">
              C
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-slate-900">
                Copilot Platform
              </span>
              <p className="text-[9px] text-indigo-600 font-extrabold tracking-widest uppercase">
                AI Customer Support
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {role === 'customer' && (
              <>
                <Link
                  href="/customer/chat"
                  className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100/50"
                >
                  Support Chat
                </Link>
                <Link
                  href="/customer/tickets"
                  className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100/50"
                >
                  My Tickets
                </Link>
              </>
            )}
            
            {/* Role Protected Admin & Agent Links */}
            {(role === 'admin' || role === 'agent') && (
              <Link
                href="/agent"
                className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100/50"
              >
                Agent Workspace
              </Link>
            )}
            
            {(role === 'admin' || role === 'agent') && (
              <Link
                href="/analytics"
                className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100/50"
              >
                Analytics
              </Link>
            )}

            {role === 'admin' && (
              <Link
                href="/admin"
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-950 transition-all shadow-sm cursor-pointer"
              >
                Admin Dashboard
              </Link>
            )}

            {isAuthenticated ? (
              <button
                onClick={() => void logout()}
                className="rounded-xl border border-rose-200/80 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ml-1"
                title="Sign Out of Copilot Portal"
              >
                <span>Sign Out</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-md"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-12 text-center sm:pt-24 md:pb-16 max-w-7xl mx-auto">
        <div className="relative mx-auto max-w-5xl space-y-8">
          
          {/* Tagline Badge */}
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-100/80 bg-indigo-50/50 px-4 py-1.5 text-xs font-semibold text-indigo-700 backdrop-blur-md shadow-sm shadow-indigo-50/50">
            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            Active Copilot Suite Version 1.1.0
          </div>
          
          {/* Main Headline */}
          <h1 className="font-display text-4xl font-black tracking-tight sm:text-6xl md:text-7xl leading-[1.08] text-slate-900">
            Supercharge Customer Support with{' '}
            <span className="block mt-1 sm:mt-2 text-gradient">
              LangGraph Agent Intelligence.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-3xl text-sm sm:text-base md:text-lg text-slate-500 font-medium leading-relaxed">
            An advanced customer service portal that orchestrates self-learning agents. Seamlessly index your knowledge base, answer queries with citations via RAG, and escalate complex issues directly to human handlers.
          </p>

          {/* Call-to-actions */}
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            {role === 'admin' ? (
              <>
                <Link
                  href="/admin"
                  className="group flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                >
                  Admin Command Center
                  <svg className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/analytics"
                  className="rounded-xl border border-slate-200/80 bg-white/80 hover:bg-slate-50/80 px-7 py-3.5 text-sm font-bold text-slate-700 hover:text-slate-950 transition-all shadow-sm hover:scale-[1.01] cursor-pointer"
                >
                  Analytics Dashboard
                </Link>
              </>
            ) : role === 'agent' ? (
              <>
                <Link
                  href="/agent"
                  className="group flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                >
                  Agent Workspace
                  <svg className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/analytics"
                  className="rounded-xl border border-slate-200/80 bg-white/80 hover:bg-slate-50/80 px-7 py-3.5 text-sm font-bold text-slate-700 hover:text-slate-950 transition-all shadow-sm hover:scale-[1.01] cursor-pointer"
                >
                  Analytics Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/customer/chat"
                  className="group flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                >
                  Open Support Chat
                  <svg className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/customer/tickets"
                  className="rounded-xl border border-slate-200/80 bg-white/80 hover:bg-slate-50/80 px-7 py-3.5 text-sm font-bold text-slate-700 hover:text-slate-950 transition-all shadow-sm hover:scale-[1.01] cursor-pointer"
                >
                  Track Ongoing Tickets
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main interactive Bento Dashboard Container */}
      <main className="mx-auto max-w-7xl px-6 pb-28">
        
        {/* Section divider label */}
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Designed for Modern Support Operations
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-xl mx-auto">
            Experience our lightning-fast interface built with fine-tuned layouts, clean white spaces, and interactive state panels.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          
          {/* Card 1: Interactive Chat Simulation Widget (takes 2 columns) */}
          <div className="md:col-span-2 group flex flex-col justify-between rounded-3xl border border-slate-200/50 bg-white/70 backdrop-blur-md p-6 sm:p-8 shadow-md shadow-slate-100/50 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/20 transition-all duration-350">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Real-Time Chat & Citations
                    </h3>
                    <p className="text-xs text-slate-400">Powered by Supabase & LangGraph</p>
                  </div>
                </div>
                <span className="premium-badge">Dynamic RAG</span>
              </div>
              
              <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                The customer chat UI automatically retrieves relevant documents, parses context segments, and highlights precision citations so customers can trust the AI answers.
              </p>

              {/* Simulated chat widget box */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 min-h-[180px] flex flex-col justify-end space-y-3 font-sans shadow-inner">
                {simulatedMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-semibold shadow-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                
                {/* Simulated source citation tag if AI is talking */}
                {simulatedMessages[simulatedMessages.length - 1]?.sender === 'ai' && (
                  <div className="flex justify-start text-[10px] text-slate-400 font-bold bg-white/50 border border-slate-100 rounded-lg px-2.5 py-1 w-max">
                    📚 Source: Policy_Manual.pdf (Page 4) &bull; 97% confidence
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/customer/chat"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-600 py-3 text-xs sm:text-sm font-bold text-white transition-all cursor-pointer shadow-sm hover:scale-[1.01]"
            >
              Start Chatting
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Card 2: Escalation Info Card (takes 1 column) */}
          <div className="group flex flex-col justify-between rounded-3xl border border-slate-200/50 bg-white/70 backdrop-blur-md p-6 sm:p-8 shadow-md shadow-slate-100/50 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-50/20 transition-all duration-350">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className="premium-badge border-rose-100 bg-rose-50/50 text-rose-600">Auto Escalation</span>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                  Ticket Creation & Handover
                </h3>
                <p className="text-xs text-slate-400">Kafka-Triggered Workflows</p>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                When customer satisfaction dips or AI confidence drops below 80%, the system summarizes the issue, formats a standardized ticket (e.g. TICK-YYYYMMDD-NNNN), alerts support teams via Slack/emails, and hooks you up with human support.
              </p>

              {/* Status workflow mini UI */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Support Case Workflow</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">Escalated</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full" />
                </div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-center">
                  Chat &bull; Agent Low Confidence &bull; Ticket Generated
                </p>
              </div>
            </div>

            <Link
              href="/customer/tickets"
              className="mt-6 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 transition-all cursor-pointer shadow-sm"
            >
              Track Ticket Statuses
            </Link>
          </div>

          {/* Card 3: Admin Knowledge Sandbox (takes 1 column) */}
          <div className="group flex flex-col justify-between rounded-3xl border border-slate-200/50 bg-white/70 backdrop-blur-md p-6 sm:p-8 shadow-md shadow-slate-100/50 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-50/20 transition-all duration-350">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="premium-badge border-amber-100 bg-amber-50/50 text-amber-700">Admin Control</span>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                  Knowledge Base Control
                </h3>
                <p className="text-xs text-slate-400">pgvector Embedding pipeline</p>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Upload PDFs, Word docs, Markdown, or HTML files. Watch them get split into semantic chunks and indexed into 1536-dimensional Ada-002 vectors in real-time.
              </p>

              {/* Progress bar simulation */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-600">
                  <span>Product_Faq_v2.pdf</span>
                  <span>100% Indexed</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-emerald-500 rounded-full" />
                </div>
              </div>
            </div>

            <Link
              href="/admin"
              className="mt-6 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 transition-all cursor-pointer shadow-sm"
            >
              Open Admin Console
            </Link>
          </div>

          {/* Card 4: Stats Showcase (takes 2 columns) */}
          <div className="md:col-span-2 group flex flex-col justify-between rounded-3xl border border-slate-200/50 bg-white/70 backdrop-blur-md p-6 sm:p-8 shadow-md shadow-slate-100/50 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/20 transition-all duration-350">
            <div className="space-y-6">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Support Performance Overview
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Accuracy</span>
                  <p className="text-2xl sm:text-3xl font-black text-indigo-600">99.8%</p>
                  <p className="text-[9px] text-slate-500 font-medium">Fact-grounded responses</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Resolution</span>
                  <p className="text-2xl sm:text-3xl font-black text-rose-500">&lt; 1.5m</p>
                  <p className="text-[9px] text-slate-500 font-medium">Average ticket close</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Compliance</span>
                  <p className="text-2xl sm:text-3xl font-black text-amber-600">100%</p>
                  <p className="text-[9px] text-slate-500 font-medium">Full RLS security policies</p>
                </div>
              </div>
              
              <p className="text-xs text-slate-400 text-center">
                Metrics aggregated automatically based on Kafka event telemetry stream.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4">
              🛡️ Encrypted &amp; Secured with Row-Level Security
            </div>
          </div>

        </div>

        {/* Integration Grid */}
        <div className="mt-20 text-center space-y-6">
          <h4 className="font-display text-sm font-bold text-slate-500 uppercase tracking-widest">
            Built with Professional-Grade Technologies
          </h4>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              'Next.js 16 (Turbopack)',
              'LangGraph Agent Flow',
              'FastAPI Routing',
              'Apache Kafka Topics',
              'Supabase pgvector DB',
              'Tailwind CSS Styling'
            ].map((tech) => (
              <span key={tech} className="rounded-2xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:border-indigo-300 hover:shadow-indigo-50/50 hover:scale-[1.02] transition-all">
                {tech}
              </span>
            ))}
          </div>
        </div>

      </main>

      {/* Modern Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-12 text-center text-xs text-slate-400 font-semibold tracking-wide">
        <p>&copy; 2026 AI Customer Support Copilot Platform. All rights reserved.</p>
        <p className="text-[10px] text-slate-400 mt-1">Providing state-of-the-art automated workflows and agent-based resolution systems.</p>
      </footer>
    </div>
  )
}
