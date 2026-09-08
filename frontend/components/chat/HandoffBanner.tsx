'use client'

interface HandoffBannerProps {
  status: string
  reason?: string
  agentName?: string | null
  priority?: string
  waitTime?: number
  onResolve?: () => void
  onCancel?: () => void
  onFastConnect?: () => void
}

const STATUS_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; badgeBg: string; label: string }
> = {
  waiting: {
    bg: 'bg-amber-50/90',
    border: 'border-amber-200/80',
    text: 'text-amber-900',
    badgeBg: 'bg-amber-100 text-amber-800',
    label: 'Waiting for Human Agent',
  },
  assigned: {
    bg: 'bg-indigo-50/90',
    border: 'border-indigo-200/80',
    text: 'text-indigo-900',
    badgeBg: 'bg-indigo-100 text-indigo-800',
    label: 'Specialist Assigned',
  },
  in_progress: {
    bg: 'bg-emerald-50/90',
    border: 'border-emerald-200/80',
    text: 'text-emerald-900',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    label: 'Live Support Specialist Connected',
  },
  resolved: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    badgeBg: 'bg-slate-100 text-slate-600',
    label: 'Issue Resolved',
  },
}

export function HandoffBanner({
  status,
  reason,
  agentName,
  priority,
  waitTime,
  onResolve,
  onCancel,
  onFastConnect,
}: HandoffBannerProps) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.waiting

  const formatWait = (seconds?: number) => {
    if (!seconds) return null
    return seconds < 60 ? `${Math.round(seconds)}s` : `${Math.round(seconds / 60)}m`
  }

  return (
    <div className={`${cfg.bg} border-b ${cfg.border} px-4 sm:px-6 py-3 transition-all backdrop-blur-xs`}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Status Info */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              status === 'waiting'
                ? 'bg-amber-500 animate-ping'
                : status === 'in_progress'
                ? 'bg-emerald-500 radar-live'
                : 'bg-indigo-500'
            }`} />
            <span className={`text-xs font-black tracking-tight ${cfg.text}`}>
              {cfg.label}
              {agentName && status !== 'waiting' && (
                <span className="font-extrabold ml-1.5 text-indigo-700">
                  &bull; {agentName}
                </span>
              )}
            </span>
          </div>

          {reason && (
            <span className="text-[11px] text-slate-500 font-medium bg-white/70 px-2.5 py-0.5 rounded-lg border border-slate-200/60 truncate max-w-xs">
              Reason: {reason}
            </span>
          )}

          {priority && priority !== 'medium' && (
            <span
              className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                priority === 'critical'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : priority === 'high'
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {priority} Priority
            </span>
          )}

          {status === 'waiting' && waitTime && (
            <span className="text-[11px] text-amber-700 font-bold">
              Waited: {formatWait(waitTime)}
            </span>
          )}
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* Waiting Mode: Fast Connect Button + Cancel / Resume AI Button */}
          {status === 'waiting' && (
            <>
              {onFastConnect && (
                <button
                  onClick={onFastConnect}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  title="Connect immediately with an available support specialist"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Connect Specialist</span>
                </button>
              )}

              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-rose-600 text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                  title="Cancel handoff and resume AI conversation immediately"
                >
                  <svg className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Resume AI Chat</span>
                </button>
              )}
            </>
          )}

          {/* Assigned Mode */}
          {status === 'assigned' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-700 font-bold animate-pulse">
                Agent joining chat...
              </span>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* In Progress Mode: Mark Issue Resolved */}
          {status === 'in_progress' && onResolve && (
            <button
              onClick={onResolve}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>Mark Resolved</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
