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
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth()

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

  // `query` is passed explicitly so callers (e.g. Clear) aren't at the mercy
  // of a stale closure over searchQuery.
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

        // Status breakdown from one page (server-side total for the headline
        // count, so it stays correct past the 100-ticket page size).
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
      // Data fetch on mount/filter change; state updates land after the await.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchTickets(searchQuery, statusFilter, priorityFilter)
    }
    // searchQuery intentionally excluded: search runs on submit, not keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <svg className="h-8 w-8 animate-spin text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-semibold text-slate-600">Verifying session...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="relative min-h-screen bg-[#fbfbfa] bg-dot-grid text-slate-800 overflow-hidden font-sans">
      {/* Background Aurora Blobs */}
      <div className="absolute top-[-10%] left-[-15%] w-[50%] h-[40%] rounded-full glow-blob-indigo pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[40%] rounded-full glow-blob-rose pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-rose-500 text-white font-extrabold text-xl shadow-md shadow-indigo-100">
                C
              </div>
              <div>
                <span className="font-display text-base font-bold tracking-tight text-slate-900">
                  Copilot Portal
                </span>
                <p className="text-[9px] text-indigo-600 font-extrabold tracking-widest uppercase">
                  AI Customer Support
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/chat"
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100/50"
            >
              Support Chat
            </Link>
            <Link
              href="/tickets"
              className="text-sm font-bold text-indigo-600 bg-indigo-50/50 border border-indigo-100/30 px-3.5 py-1.5 rounded-xl transition-all"
            >
              My Tickets
            </Link>

            <button
              onClick={() => void logout()}
              className="rounded-xl border border-rose-200/80 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ml-2"
              title="Sign Out"
            >
              <span>Sign Out</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Dashboard Panel */}
      <main className="relative z-10 flex-1 px-6 py-10">
        <div className="mx-auto max-w-7xl space-y-8">
          
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
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Support Tickets Hub</h2>
                  <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                    Manage your ongoing customer service requests, check progress, and read resolution history.
                  </p>
                </div>

                {/* Stats Counters Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200/50 bg-white p-5 shadow-sm space-y-1 hover:shadow-md transition-all duration-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tickets</span>
                    <p className="text-3xl font-black text-slate-800 tracking-tight">{stats.total}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/50 bg-white p-5 shadow-sm space-y-1 hover:shadow-md transition-all duration-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New / Open</span>
                    <p className="text-3xl font-black text-indigo-600 tracking-tight">{stats.open}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/50 bg-white p-5 shadow-sm space-y-1 hover:shadow-md transition-all duration-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Progress</span>
                    <p className="text-3xl font-black text-amber-500 tracking-tight">{stats.inProgress}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/50 bg-white p-5 shadow-sm space-y-1 hover:shadow-md transition-all duration-300">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resolved</span>
                    <p className="text-3xl font-black text-emerald-600 tracking-tight">{stats.resolved}</p>
                  </div>
                </div>
              </div>

              {/* Filters and Search toolbar */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-3xl border border-slate-200/50 bg-white/85 backdrop-blur-sm p-6 shadow-sm">
                <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md flex items-center gap-2">
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="Search ticket # or contents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white pl-4 pr-12 py-3 text-xs sm:text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 hover:bg-indigo-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition-colors cursor-pointer"
                  >
                    Search
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority:</span>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
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
                <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 flex items-center justify-between shadow-sm">
                  <span>{ticketsError}</span>
                  <button
                    onClick={() => fetchTickets(searchQuery, statusFilter, priorityFilter)}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
              {isLoadingTickets ? (
                <div className="flex h-48 flex-col items-center justify-center rounded-3xl border border-slate-200/50 bg-white p-6 text-slate-500 shadow-sm">
                  <svg className="h-7 w-7 animate-spin text-indigo-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs font-semibold text-slate-500">Refreshing support ticket list...</span>
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
      </main>
    </div>
  )
}

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#fbfbfa]">
        <div className="text-gray-600 font-medium">Loading tickets hub...</div>
      </div>
    }>
      <TicketsContent />
    </Suspense>
  )
}
