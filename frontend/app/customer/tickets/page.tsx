"use client"

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/stores/authStore'
import { api } from '@/lib/api'

export default function CustomerTicketsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/customer/tickets')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      api.tickets
        .getTickets()
        .then((d) => setTickets(d?.data || []))
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [isAuthenticated])

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'open').length,
      in_progress: tickets.filter((t) => ['in_progress', 'waiting_customer'].includes(t.status)).length,
      resolved: tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length,
    }
  }, [tickets])

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Filter by status tab
      if (statusFilter === 'open' && t.status !== 'open') return false
      if (statusFilter === 'in_progress' && !['in_progress', 'waiting_customer'].includes(t.status)) return false
      if (statusFilter === 'resolved' && !['resolved', 'closed'].includes(t.status)) return false

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNumber = String(t.ticket_number || '').toLowerCase().includes(q)
        const matchCategory = String(t.category || '').toLowerCase().includes(q)
        const matchSummary = String(t.ai_summary || '').toLowerCase().includes(q)
        return matchNumber || matchCategory || matchSummary
      }
      return true
    })
  }, [tickets, statusFilter, searchQuery])

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-xs font-semibold">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <span>Loading ticket portfolio...</span>
        </div>
      </div>
    )
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const pc: Record<string, string> = {
    critical: 'badge-vip-rose',
    high: 'badge-vip-amber',
    medium: 'badge-vip-indigo',
    low: 'badge-vip-slate',
  }

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold shadow-2xs">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  My Support Tickets
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Track your escalated requests, read specialist comments, and monitor resolution timelines.
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/customer/chat"
            className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Open Live Support Chat</span>
          </Link>
        </div>

        {/* Quick KPI Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`surface-vip p-4 text-left transition-all cursor-pointer ${
              statusFilter === 'all' ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : 'hover:border-slate-300'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Tickets</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight mt-1 block">{stats.total}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`surface-vip p-4 text-left transition-all cursor-pointer ${
              statusFilter === 'open' ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : 'hover:border-slate-300'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">New / Open</span>
            <span className="text-2xl font-black text-indigo-600 tracking-tight mt-1 block">{stats.open}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_progress')}
            className={`surface-vip p-4 text-left transition-all cursor-pointer ${
              statusFilter === 'in_progress' ? 'ring-2 ring-amber-500 bg-amber-50/20' : 'hover:border-slate-300'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">In Progress</span>
            <span className="text-2xl font-black text-amber-600 tracking-tight mt-1 block">{stats.in_progress}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('resolved')}
            className={`surface-vip p-4 text-left transition-all cursor-pointer ${
              statusFilter === 'resolved' ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : 'hover:border-slate-300'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">Resolved</span>
            <span className="text-2xl font-black text-emerald-600 tracking-tight mt-1 block">{stats.resolved}</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="surface-vip p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket # or topic category..."
              className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 shrink-0">
            {(['all', 'open', 'in_progress', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                  statusFilter === tab ? 'bg-white text-indigo-600 shadow-2xs font-extrabold' : 'hover:text-slate-900'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Tickets Container */}
        <div className="surface-vip overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Tickets ({filteredTickets.length})
            </h2>
          </div>
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading ticket portfolio...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-indigo-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-800">
                {searchQuery || statusFilter !== 'all' ? 'No matching tickets found' : 'No support tickets yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters or search keywords.'
                  : 'Start a conversation in Support Chat and any human specialist escalations will appear here automatically.'}
              </p>
              <Link
                href="/customer/chat"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 transition-all"
              >
                <span>Start Live AI Chat</span>
                <span>→</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTickets.map((t: any) => (
                <Link
                  key={t.id}
                  href={`/tickets?id=${t.id}`}
                  className="block p-4.5 hover:bg-slate-50/80 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-indigo-600 font-mono group-hover:underline">
                      #{t.ticket_number}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`badge-vip ${pc[t.priority] || 'badge-vip-slate'}`}>
                        {t.priority}
                      </span>
                      <span className="badge-vip badge-vip-emerald">
                        {t.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-800 line-clamp-1">{t.category || 'Customer Inquiry'}</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">{fmt(t.created_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
