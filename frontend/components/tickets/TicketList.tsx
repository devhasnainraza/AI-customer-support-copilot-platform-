/**
 * TicketList Component
 * Displays a clean, premium table of tickets with micro-interactions.
 */
'use client'

import { Ticket } from '@/lib/api'
import { TicketStatusPill, TicketPriorityPill } from './TicketStatus'

interface TicketListProps {
  tickets: Ticket[]
  onSelectTicket: (id: string) => void
}

export function TicketList({ tickets, onSelectTicket }: TicketListProps) {
  return (
    <div className="rounded-3xl border border-slate-200/50 bg-white shadow-sm overflow-hidden transition-all duration-300">
      <div className="border-b border-slate-100 px-6 py-5">
        <h3 className="font-display text-lg font-bold text-slate-900">Your Support Tickets</h3>
        <p className="text-xs text-slate-500 mt-1">Review active and resolved support inquiries connected to your chat history.</p>
      </div>

      {tickets.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center text-sm text-slate-500 p-8 text-center bg-slate-50/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 mb-3 shadow-inner">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <p className="font-bold text-slate-700">No tickets found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            If your issue is complex, you can ask the support AI to connect you to a human agent, which will automatically open a ticket.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Ticket ID</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 font-semibold text-slate-700">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors duration-200">
                  <td className="px-6 py-4.5 font-bold text-slate-900 tracking-tight">
                    {ticket.ticket_number}
                  </td>
                  <td className="px-6 py-4.5">
                    <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      {ticket.category || 'general'}
                    </span>
                  </td>
                  <td className="px-6 py-4.5">
                    <TicketPriorityPill priority={ticket.priority} />
                  </td>
                  <td className="px-6 py-4.5">
                    <TicketStatusPill status={ticket.status} />
                  </td>
                  <td className="px-6 py-4.5 text-slate-400 font-medium">
                    {new Date(ticket.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4.5 text-right">
                    <button
                      onClick={() => onSelectTicket(ticket.id)}
                      className="rounded-xl bg-slate-900 hover:bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
