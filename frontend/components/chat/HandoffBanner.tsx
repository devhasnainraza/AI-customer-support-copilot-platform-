/**
 * HandoffBanner Component
 * Shows handoff status with agent info, estimated wait, and live status.
 */
'use client'

interface HandoffBannerProps {
  status: string           // waiting | assigned | in_progress | resolved
  reason?: string
  agentName?: string | null
  priority?: string
  waitTime?: number        // seconds
  onResolve?: () => void
}

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  waiting: {
    bg: 'bg-amber-50',
    border: 'border-amber-200/80',
    text: 'text-amber-800',
    icon: '⏳',
    label: 'Waiting for agent',
  },
  assigned: {
    bg: 'bg-blue-50',
    border: 'border-blue-200/80',
    text: 'text-blue-800',
    icon: '👤',
    label: 'Agent assigned',
  },
  in_progress: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200/80',
    text: 'text-emerald-800',
    icon: '💬',
    label: 'Chatting with agent',
  },
  resolved: {
    bg: 'bg-slate-50',
    border: 'border-slate-200/80',
    text: 'text-slate-600',
    icon: '✅',
    label: 'Resolved',
  },
}

export function HandoffBanner({ status, reason, agentName, priority, waitTime, onResolve }: HandoffBannerProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.waiting

  const formatWait = (seconds?: number) => {
    if (!seconds) return null
    if (seconds < 60) return `${Math.round(seconds)}s`
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
  }

  return (
    <div className={`${config.bg} border-b ${config.border} px-5 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">{config.icon}</span>
          <div>
            <div className={`text-sm font-extrabold ${config.text}`}>
              {config.label}
              {agentName && status !== 'waiting' && (
                <span className="font-bold ml-1">— {agentName}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {reason && (
                <span className="text-xs font-medium text-slate-500">
                  Reason: {reason}
                </span>
              )}
              {priority && priority !== 'medium' && (
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  priority === 'critical' ? 'bg-red-100 text-red-700' :
                  priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {priority}
                </span>
              )}
              {status === 'waiting' && waitTime && (
                <span className="text-[11px] font-semibold text-amber-600">
                  Waited: {formatWait(waitTime)}
                </span>
              )}
            </div>
          </div>
        </div>

        {status === 'in_progress' && onResolve && (
          <button
            onClick={onResolve}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
          >
            Mark Resolved
          </button>
        )}

        {status === 'waiting' && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold text-amber-600">Looking for available agent...</span>
          </div>
        )}

        {status === 'assigned' && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-blue-600">Agent is joining the chat...</span>
          </div>
        )}
      </div>
    </div>
  )
}
