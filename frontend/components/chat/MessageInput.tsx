/**
 * MessageInput Component
 * T065: Message input with gradient send button in Modern Light Theme
 */
'use client'

import { useState, KeyboardEvent } from 'react'

interface MessageInputProps {
  onSend: (message: string) => Promise<void>
  disabled?: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
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
    } catch (error) {
      console.error('Failed to send message:', error)
      setSendError('Message not sent — check your connection and try again.')
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
    <div className="space-y-2">
      {sendError && (
        <p role="alert" className="text-xs font-bold text-rose-600 px-1">
          {sendError}
        </p>
      )}
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-2 shadow-lg shadow-slate-900/5">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={disabled ? 'Please wait for the support agent...' : 'Ask AI Support a question...'}
          aria-label="Message"
          disabled={disabled || isSending}
          rows={1}
          className="flex-1 resize-none bg-transparent px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none placeholder:text-slate-400 disabled:cursor-not-allowed transition-all"
          style={{
            minHeight: '44px',
            maxHeight: '120px',
          }}
        />

        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isSending}
          className="rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-700 hover:to-pink-600 px-5 py-3 text-xs sm:text-sm text-white font-extrabold disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md shadow-indigo-600/20 shrink-0 flex items-center gap-1.5"
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
