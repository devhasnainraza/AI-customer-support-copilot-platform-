/**
 * TicketDetail Component
 * T116: Displays detailed support ticket state, conversation summary, timeline, and agent notes log
 */
'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { TicketStatusPill, TicketPriorityPill } from './TicketStatus'
import Markdown from 'react-markdown'

interface TimelineItem {
  timestamp: string
  event: string
  from_value?: string | null
  to_value: string
  actor_name?: string | null
}

interface AgentNote {
  timestamp: string
  agent_id: string
  agent_name: string
  content: string
}

interface TicketDetailData {
  id: string
  ticket_number: string
  conversation_id: string
  priority: string
  status: string
  category?: string | null
  assigned_team?: string | null
  assigned_agent_id?: string | null
  assigned_agent_name?: string | null
  created_at: string
  resolved_at?: string | null
  created_by?: string | null
  ai_summary?: string | null
  customer?: {
    id: string
    name: string
    email: string
  }
  conversation_preview?: {
    message_count?: number
    last_message_at?: string
    last_message_preview?: string
  }
  timeline?: TimelineItem[]
  notes?: AgentNote[]
}

interface TicketDetailProps {
  ticketId: string
  onBack: () => void
}

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTicketDetails() {
      try {
        setIsLoading(true)
        setError(null)
        const data = await api.tickets.getTicket(ticketId)
        setTicket(data as unknown as TicketDetailData)
      } catch (err) {
        console.error('Error fetching ticket details:', err)
        setError(err instanceof Error ? err.message : 'Failed to load ticket details.')
      } finally {
        setIsLoading(false)
      }
    }

    if (ticketId) {
      fetchTicketDetails()
    }
  }, [ticketId])

  const formatEventName = (event: string) => {
    switch (event) {
      case 'status_changed':
        return 'Status Updated'
      case 'priority_changed':
        return 'Priority Updated'
      case 'assigned_agent_id_changed':
        return 'Agent Reassigned'
      default:
        return event.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }
  }

  const formatValue = (field: string, val: string | null | undefined) => {
    if (!val) return 'None'
    if (field === 'status') {
      return val.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }
    return val.toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center p-6 text-slate-500">
        <svg className="h-8 w-8 animate-spin text-violet-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium">Fetching ticket details...</span>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-rose-800">Error Loading Ticket</h3>
        <p className="text-xs text-rose-600 mt-1">{error || 'Ticket not found.'}</p>
        <button
          onClick={onBack}
          className="mt-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="group inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-all cursor-pointer"
              title="Back to Tickets"
            >
              <svg className="h-4 w-4 transform group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">
                Support Ticket
              </span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {ticket.ticket_number}
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Created on {new Date(ticket.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 uppercase border border-slate-200">
            {ticket.category || 'general'}
          </span>
          <TicketPriorityPill priority={ticket.priority} />
          <TicketStatusPill status={ticket.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Summary & Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Conversation Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Conversation Transcript Summary</h3>
            </div>
            
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <div className="text-sm text-slate-700 leading-relaxed italic markdown-content [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_strong]:font-bold [&_strong]:text-slate-900">
                &ldquo;
                {ticket.ai_summary ? (
                  <Markdown>{ticket.ai_summary}</Markdown>
                ) : (
                  <span>No transcript summary was generated for this ticket.</span>
                )}
                &rdquo;
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block text-slate-400 font-medium">Linked Conversation</span>
                <span className="font-semibold text-slate-700 break-all">{ticket.conversation_id}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-medium">Exchange Details</span>
                <span className="font-semibold text-slate-700">
                  {ticket.conversation_preview?.message_count ?? 0} messages
                  {ticket.conversation_preview?.last_message_at
                    ? ` (last active ${new Date(ticket.conversation_preview.last_message_at).toLocaleDateString()})`
                    : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Agent Notes Log */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Agent Resolution Notes</h3>
            </div>

            {(!ticket.notes || ticket.notes.length === 0) ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400 text-xs">
                No active resolution notes from support agents yet. Notes will appear here as agents investigate and work on your request.
              </div>
            ) : (
              <div className="space-y-4">
                {ticket.notes.map((note, idx) => (
                  <div key={idx} className="rounded-xl bg-slate-50/50 border border-slate-100 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{note.agent_name}</span>
                      <span className="text-slate-400">{new Date(note.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed break-words whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Metadata, Assigned Agent, and Timeline */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Assignment Details</h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Assigned Agent</span>
                <span className="font-semibold text-slate-700">
                  {ticket.assigned_agent_name || 'Unassigned (Waiting)'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Assigned Team</span>
                <span className="font-semibold text-slate-700 uppercase">
                  {ticket.assigned_team || 'General Tier'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Opened By</span>
                <span className="font-semibold text-slate-700 uppercase">
                  {(ticket.created_by || 'unknown').replace('_', ' ')}
                </span>
              </div>
              {ticket.resolved_at && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400 font-medium">Resolved At</span>
                  <span className="font-semibold text-emerald-600">
                    {new Date(ticket.resolved_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Activity History</h3>

            {!ticket.timeline || ticket.timeline.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">No logged state changes.</div>
            ) : (
              <div className="relative border-l border-slate-200 ml-2 pl-4 space-y-6 py-2">
                {ticket.timeline.map((item, idx) => (
                  <div key={idx} className="relative">
                    {/* Stepper Dot */}
                    <div className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-violet-600 ring-4 ring-white" />
                    
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        {formatEventName(item.event)}
                      </p>
                      
                      {item.event === 'status_changed' && (
                        <p className="text-[11px] text-slate-500">
                          Changed status from <span className="font-semibold text-slate-700">{formatValue('status', item.from_value)}</span> to <span className="font-semibold text-slate-700">{formatValue('status', item.to_value)}</span>
                        </p>
                      )}

                      {item.event === 'priority_changed' && (
                        <p className="text-[11px] text-slate-500">
                          Changed priority from <span className="font-semibold text-slate-700">{formatValue('priority', item.from_value)}</span> to <span className="font-semibold text-slate-700">{formatValue('priority', item.to_value)}</span>
                        </p>
                      )}

                      {item.event === 'assigned_agent_id_changed' && (
                        <p className="text-[11px] text-slate-500">
                          Assigned to agent ID <span className="font-semibold text-slate-700 break-all">{item.to_value || 'None'}</span>
                        </p>
                      )}

                      <p className="text-[10px] text-slate-400">
                        {new Date(item.timestamp).toLocaleString()} by {item.actor_name || 'System'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
