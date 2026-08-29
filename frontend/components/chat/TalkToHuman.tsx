/**
 * TalkToHuman Component
 * Button to request human agent + confirmation modal with estimated wait time.
 */
'use client'
import { getAuthToken } from '@/lib/api'

import { useState, useEffect } from 'react'

interface TalkToHumanProps {
  onRequestHandoff: (reason: string, priority: string) => Promise<void>
  isHandoffActive?: boolean
  handoffStatus?: string | null
  assignedAgent?: string | null
}

export function TalkToHuman({
  onRequestHandoff,
  isHandoffActive = false,
  handoffStatus,
  assignedAgent,
}: TalkToHumanProps) {
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [estimatedWait, setEstimatedWait] = useState<string | null>(null)

  // Fetch queue stats for estimated wait
  useEffect(() => {
    if (showModal) {
      getAuthToken().then(t =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/handoff/queue/stats`, {
          headers: { Authorization: `Bearer ${t || ''}` },
        })
      )
        .then(r => r.json())
        .then(data => {
          const avgWait = data.avg_wait_seconds || 0
          if (avgWait > 0) {
            const mins = Math.ceil(avgWait / 60)
            setEstimatedWait(`${mins} min`)
          } else {
            setEstimatedWait('< 1 min')
          }
        })
        .catch(() => setEstimatedWait('2-3 min'))
    }
  }, [showModal])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onRequestHandoff(reason || 'Customer requested human agent', 'medium')
      setShowModal(false)
      setReason('')
    } catch (err) {
      console.error('Handoff request failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // If handoff is already active, show status badge instead of button
  if (isHandoffActive) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-bold">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        {handoffStatus === 'waiting' && 'Waiting for agent...'}
        {handoffStatus === 'assigned' && assignedAgent && `Agent ${assignedAgent} is joining...`}
        {handoffStatus === 'in_progress' && 'Connected with support agent'}
        {!handoffStatus && 'Requesting human agent...'}
      </div>
    )
  }

  return (
    <>
      {/* Talk to Human Button */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs font-extrabold shadow-md shadow-rose-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Talk to Human</span>
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-5 border border-slate-200/80">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Talk to a Human Agent</h3>
                <p className="text-xs text-slate-500 font-medium">We&apos;ll connect you with a support specialist</p>
              </div>
            </div>

            {/* Wait time estimate */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold text-slate-600">
                Estimated wait: <span className="text-indigo-600 font-bold">{estimatedWait || '...'}</span>
              </span>
            </div>

            {/* Reason textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe your issue..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmitting ? 'Requesting...' : 'Request Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
