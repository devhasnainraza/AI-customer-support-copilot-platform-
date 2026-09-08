/**
 * Customer Tickets Page
 * T119: Customer dashboard for checking ticket status, conversation history, and resolution timeline
 */
'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/stores/authStore'
import { api, ApiError, Ticket } from '@/lib/api'
import { TicketList } from '@/components/tickets/TicketList'
import { TicketDetail } from '@/components/tickets/TicketDetail'

function TicketsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState(true)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  // Initialized from the URL (?id=...) so deep links open the detail view.
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    () => searchParams.get('id')
  )

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/tickets')
    }
  }, [authLoading, isAuthenticated, router])

  const fetchTickets = useCallback(
    async (query: string, status: string, priority: string) => {
      try {
        setIsLoadingTickets(true)
        setTicketsError(null)

        let fetched: Ticket[] = []
        if (query.trim()) {
          const searchRes = await api.tickets.search(query)
          fetched = searchRes.results || []
        } else {
          const params: Parameters<typeof api.tickets.getTickets>[0] = {}
          if (status !== 'all') params.status = status
          if (priority !== 'all') params.priority = priority
          const listRes = await api.tickets.getTickets(params)
          fetched = listRes.data || []
        }

        setTickets(fetched)

        const allRes = await api.tickets.getTickets({ limit: 100 })
        const allTickets = allRes.data || []
        setStats({
          total: allRes.pagination?.total ?? allTickets.length,
          open: allTickets.filter((t) => t.status === 'open').length,
          inProgress: allTickets.filter((t) => (t.status as string) === 'in_progress' || (t.status as string) === 'waiting_customer').length,
          resolved: allTickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length
        })
      } catch (error) {
        console.error('Failed to fetch tickets:', error)
        setTicketsError(
          error instanceof ApiError ? error.message : 'Failed to load tickets. Please try again.'
        )
      } finally {
        setIsLoadingTickets(false)
      }
    },
    []
  )

  useEffect(() => {
    if (isAuthenticated) {
      void fetchTickets(searchQuery, statusFilter, priorityFilter)
    }
  }, [isAuthenticated, statusFilter, priorityFilter, fetchTickets])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchTickets(searchQuery, statusFilter, priorityFilter)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    fetchTickets('', statusFilter, priorityFilter)
  }

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Verifying session...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {selectedTicketId ? (
        <TicketDetail
          ticketId={selectedTicketId}
          onBack={() => {
            setSelectedTicketId(null)
            fetchTickets(searchQuery, statusFilter, priorityFilter)
          }}
        />
      ) : (
        <>
          {/* Dashboard Banner & Quick Stats */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                      Support Tickets Hub
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      Manage ongoing customer service requests, check SLA timers, and review resolution history.
                    </p>
                  </div>
                </div>
              </div>
              <Link
                href="/customer/chat"
                className="self-start sm:self-auto px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Ticket Session</span>
              </Link>
            </div>

            {/* Stats Counters Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="surface-vip p-5 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Tickets</span>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{stats.total}</p>
              </div>
              <div className="surface-vip p-5 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">New / Open</span>
                <p className="text-3xl font-extrabold text-indigo-600 tracking-tight">{stats.open}</p>
              </div>
              <div className="surface-vip p-5 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">In Progress</span>
                <p className="text-3xl font-extrabold text-amber-500 tracking-tight">{stats.inProgress}</p>
              </div>
              <div className="surface-vip p-5 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Resolved</span>
                <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">{stats.resolved}</p>
              </div>
            </div>
          </div>

          {/* Filters and Search toolbar */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between surface-vip p-5">
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md flex items-center gap-2">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search ticket # or contents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white pl-4 pr-12 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors cursor-pointer"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_customer">Waiting Customer</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tickets Table / List View */}
          {ticketsError && (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 flex items-center justify-between shadow-2xs">
              <span>{ticketsError}</span>
              <button
                onClick={() => fetchTickets(searchQuery, statusFilter, priorityFilter)}
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {isLoadingTickets ? (
            <div className="flex h-48 flex-col items-center justify-center surface-vip p-6 text-slate-500">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
              <span className="text-xs font-semibold text-slate-500">Refreshing support ticket roster...</span>
            </div>
          ) : (
            <TicketList 
              tickets={tickets} 
              onSelectTicket={(id) => setSelectedTicketId(id)} 
            />
          )}
        </>
      )}
    </div>
  )
}

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center text-slate-500 text-xs font-semibold">
        Loading tickets hub...
      </div>
    }>
      <TicketsContent />
    </Suspense>
  )
}
