'use client'

import { getAuthToken } from '@/lib/api'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TalkToHumanProps {
  onRequestHandoff: (reason: string, priority: string) => Promise<string | void>
  onCancelHandoff?: () => Promise<void> | void
  onFastConnect?: () => void
  isHandoffActive?: boolean
  handoffStatus?: string | null
  assignedAgent?: string | null
}

const REASON_PRESETS = [
  { id: 'billing', label: 'Billing & Invoices', icon: '💳', priority: 'medium' },
  { id: 'technical', label: 'Technical Bug / Outage', icon: '⚡', priority: 'high' },
  { id: 'account', label: 'Account Access & Security', icon: '🔒', priority: 'high' },
  { id: 'refund', label: 'Refund & Subscription', icon: '💰', priority: 'medium' },
  { id: 'manager', label: 'Escalate to Manager', icon: '👔', priority: 'critical' },
  { id: 'general', label: 'General Live Assistance', icon: '💬', priority: 'medium' },
]

export function TalkToHuman({
  onRequestHandoff,
  onCancelHandoff,
  onFastConnect,
  isHandoffActive = false,
  handoffStatus,
  assignedAgent,
}: TalkToHumanProps) {
  const [showModal, setShowModal] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('general')
  const [customReason, setCustomReason] = useState('')
  const [priority, setPriority] = useState('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [queueStats, setQueueStats] = useState<{ waiting: number; avg_wait_seconds: number; total_today: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (showModal) {
      getAuthToken()
        .then((t) =>
          fetch(
            (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') +
              '/v1/handoff/queue/stats',
            {
              headers: { Authorization: 'Bearer ' + (t || '') },
            }
          )
        )
        .then((r) => r.json())
        .then((data) => {
          setQueueStats(data)
        })
        .catch(() => {})
    }
  }, [showModal])

  const handleSelectPreset = (preset: typeof REASON_PRESETS[0]) => {
    setSelectedPreset(preset.id)
    setPriority(preset.priority)
    if (!customReason) {
      setCustomReason(preset.label)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const effectiveReason = customReason.trim() || REASON_PRESETS.find(p => p.id === selectedPreset)?.label || 'Live Specialist Assistance'
    try {
      await onRequestHandoff(effectiveReason, priority)
      setShowModal(false)
      setCustomReason('')
    } catch (err) {
      console.error('Handoff request failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Active Session Status Modal Content
  const activeSessionModalContent = showModal && mounted ? (
    <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-sm sm:text-base font-extrabold text-slate-900">
                Live Specialist Session
              </h3>
              <p className="text-xs text-slate-500">
                {handoffStatus === 'in_progress'
                  ? 'Connected with Tier-2 Support.'
                  : 'Your request is in the live queue.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 text-lg font-bold leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Session State:</span>
              <span className={`font-black uppercase px-2.5 py-0.5 rounded-full text-[10px] ${
                handoffStatus === 'in_progress'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {handoffStatus === 'in_progress' ? 'Active Specialist Chat' : 'Waiting for Agent'}
              </span>
            </div>
            {assignedAgent && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assigned Specialist:</span>
                <span className="font-bold text-slate-900">{assignedAgent}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2 shrink-0">
          {onFastConnect && handoffStatus === 'waiting' && (
            <button
              onClick={() => {
                onFastConnect()
                setShowModal(false)
              }}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Instant Connect Specialist</span>
            </button>
          )}

          {onCancelHandoff && (
            <button
              onClick={async () => {
                await onCancelHandoff()
                setShowModal(false)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>End Specialist Session &amp; Resume AI Chat</span>
            </button>
          )}

          <button
            onClick={() => setShowModal(false)}
            className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null

  // Request Specialist Modal Content (Centered, Fully Visible on all Screen Heights)
  const requestModalContent = showModal && mounted ? (
    <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Fixed Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-sm sm:text-base font-extrabold text-slate-900">
                Request Live Human Specialist
              </h3>
              <p className="text-xs text-slate-500">
                Direct transfer to a Tier-2 support specialist.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 text-lg font-bold leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Live Queue Status Metrics */}
          <div className="grid grid-cols-3 gap-2.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Estimated Wait</p>
              <p className="text-xs font-black text-indigo-600 mt-0.5">
                {queueStats?.avg_wait_seconds ? `${Math.ceil(queueStats.avg_wait_seconds / 60)} min` : '< 1 min'}
              </p>
            </div>
            <div className="border-x border-slate-200/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase">In Queue</p>
              <p className="text-xs font-black text-slate-800 mt-0.5">
                {queueStats?.waiting !== undefined ? `${queueStats.waiting} waiting` : '0 ahead'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Status</p>
              <p className="text-xs font-black text-emerald-600 mt-0.5 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 radar-live" />
                Online
              </p>
            </div>
          </div>

          {/* Category Presets */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Select Issue Topic
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REASON_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-sm">{preset.icon}</span>
                    <span className="truncate text-[11px]">{preset.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Priority Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Priority Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'low', label: 'Normal' },
                { id: 'high', label: 'High Priority' },
                { id: 'critical', label: 'Critical' },
              ].map((p) => {
                const isSelected = priority === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      isSelected
                        ? p.id === 'critical'
                          ? 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500'
                          : 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-1 ring-indigo-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Specific Note / Reason */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Additional Details (Optional)
            </label>
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe specific details for the specialist..."
              rows={2}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 transition resize-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Fixed Bottom Action Buttons */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="flex-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 disabled:opacity-50 transition cursor-pointer"
          >
            {isSubmitting ? 'Transferring...' : 'Request Specialist →'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (isHandoffActive) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
            handoffStatus === 'in_progress'
              ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800 animate-pulse'
          }`}
          title="Click to view specialist status or session controls"
        >
          <span className={`w-2 h-2 rounded-full ${
            handoffStatus === 'in_progress' ? 'bg-emerald-500 radar-live' : 'bg-amber-500 animate-ping'
          }`} />
          <span>
            {handoffStatus === 'waiting' && 'In Specialist Queue (View)'}
            {handoffStatus === 'assigned' && (assignedAgent ? `Specialist: ${assignedAgent}` : 'Specialist Assigned')}
            {handoffStatus === 'in_progress' && (assignedAgent ? `Specialist: ${assignedAgent}` : 'Live Specialist Connected')}
            {!handoffStatus && 'Connecting...'}
          </span>
        </button>

        {activeSessionModalContent && createPortal(activeSessionModalContent, document.body)}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-700 text-xs font-bold shadow-xs transition-all cursor-pointer group"
      >
        <svg className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Talk to Human</span>
      </button>

      {requestModalContent && createPortal(requestModalContent, document.body)}
    </>
  )
}
