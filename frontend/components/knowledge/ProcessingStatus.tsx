/**
 * ProcessingStatus Component
 * T094 & T098: Compact indicator of file ingestion progress
 */
'use client'


interface ProcessingStatusProps {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string | null
}

export function ProcessingStatus({ status, error }: ProcessingStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          dot: 'bg-emerald-500',
          label: 'Completed'
        }
      case 'processing':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse',
          dot: 'bg-amber-500 animate-ping',
          label: 'Processing'
        }
      case 'failed':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-100',
          dot: 'bg-rose-500',
          label: 'Failed'
        }
      case 'pending':
      default:
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-100',
          dot: 'bg-blue-500',
          label: 'Pending'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="flex flex-col items-start gap-1">
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.bg}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </div>
      {status === 'failed' && error && (
        <span className="text-[10px] text-rose-500 max-w-[200px] truncate block" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
