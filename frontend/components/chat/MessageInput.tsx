'use client'

import { useState, KeyboardEvent } from 'react'

interface MessageInputProps {
  onSend: (message: string) => Promise<void>
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({ onSend, disabled, placeholder }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const handleSend = async () => {
    const trimmed = message.trim()
    if (!trimmed || isSending || disabled) return
    try {
      setIsSending(true)
      setSendError(null)
      await onSend(trimmed)
      setMessage('')
    } catch {
      setSendError('Message not sent. Check your connection.')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-2 max-w-4xl w-full mx-auto">
      {sendError && (
        <p role="alert" className="text-xs font-bold text-rose-600 px-2">
          {sendError}
        </p>
      )}
      <div className="flex items-center gap-2 sm:gap-3 bg-white border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-sm hover:border-indigo-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder || (disabled ? 'Please wait for the support agent...' : 'Ask AI Copilot anything... (Enter to send, Shift+Enter for new line)')}
          aria-label="Message"
          disabled={disabled || isSending}
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none placeholder:text-slate-400 disabled:cursor-not-allowed transition"
          style={{ minHeight: '38px', maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isSending}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-[0.98]"
        >
          <span>{isSending ? 'Sending...' : 'Send'}</span>
          {!isSending && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
