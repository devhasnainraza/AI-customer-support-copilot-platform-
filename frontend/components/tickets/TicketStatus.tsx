/**
 * TicketStatus Component
 * T117: Badge indicators for ticket priority and status states
 */
'use client'

export function TicketStatusPill({ status }: { status: string }) {
  const getStyle = () => {
    switch (status) {
      case 'open':
        return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'in_progress':
        return 'bg-amber-50 text-amber-700 border-amber-100'
      case 'waiting_customer':
        return 'bg-purple-50 text-purple-700 border-purple-100'
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'closed':
        return 'bg-slate-100 text-slate-700 border-slate-200'
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100'
    }
  }

  const formatText = (txt: string) => {
    return txt.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wider ${getStyle()}`}>
      {formatText(status)}
    </span>
  )
}

export function TicketPriorityPill({ priority }: { priority: string }) {
  const getStyle = () => {
    switch (priority) {
      case 'low':
        return 'bg-slate-50 text-slate-600 border-slate-200'
      case 'medium':
        return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'high':
        return 'bg-amber-50 text-amber-600 border-amber-100'
      case 'critical':
        return 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
      default:
        return 'bg-slate-50 text-slate-600'
    }
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${getStyle()}`}>
      {priority}
    </span>
  )
}
