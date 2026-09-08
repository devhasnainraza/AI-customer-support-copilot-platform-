'use client'

import { useEffect, useRef } from 'react'
import { Message } from '@/stores/chatStore'
import { SourceCitation } from './SourceCitation'
import Markdown from 'react-markdown'

interface MessageListProps {
  messages: Message[]
  isTyping?: boolean
  typingAgent?: string | null
  onSelectPrompt?: (prompt: string) => void
}

const SUGGESTED_PROMPTS = [
  'How do I reset my account password?',
  'What are the current API rate limits?',
  'How to configure custom domain SSL?',
  'I need to talk to a human support specialist',
]

export function MessageList({ messages, isTyping, typingAgent, onSelectPrompt }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const d = container.scrollHeight - container.scrollTop - container.clientHeight
    if (d < 250) {
      const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      messagesEndRef.current?.scrollIntoView({ behavior: rm ? 'auto' : 'smooth' })
    }
  }, [messages, isTyping])

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      className="flex-1 overflow-y-auto overflow-x-hidden w-full"
    >
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center py-10 sm:py-16 px-4 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-100 mb-4 ring-4 ring-indigo-50">
              C
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              How can I help you today?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md font-medium leading-relaxed">
              I am your AI Support Copilot. Ask about documentation, billing, troubleshooting, or request live agent assistance.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSelectPrompt?.(prompt)}
                  className="p-3.5 text-left text-xs font-bold text-slate-700 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md hover:shadow-indigo-50 transition-all cursor-pointer group flex items-center justify-between shadow-2xs"
                >
                  <span>{prompt}</span>
                  <span className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all text-xs font-black">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onSelectPrompt={onSelectPrompt} />
        ))}

        {isTyping && (
          <div className="flex items-end gap-3 justify-start animate-fade-in" role="status" aria-label="AI is typing">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-xs">
              AI
            </div>
            <div className="rounded-2xl rounded-bl-xs bg-white border border-slate-200/90 px-4 py-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-pink-500" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {typingAgent ? `${typingAgent} is responding...` : 'AI Copilot is thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  negative: { label: 'Concerned', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  frustrated: { label: 'Frustrated', color: 'bg-orange-50 text-orange-700 border border-orange-200' },
  angry: { label: 'Urgent Attention', color: 'bg-rose-50 text-rose-700 border border-rose-200' },
}

function MessageBubble({
  message,
  onSelectPrompt,
}: {
  message: Message
  onSelectPrompt?: (text: string) => void
}) {
  const isCustomer = message.sender_type === 'customer'
  const isAI = message.sender_type === 'ai'
  const isHuman = message.sender_type === 'human_agent'
  const sentimentData = message.sentiment ? SENTIMENT_CONFIG[message.sentiment] : null

  return (
    <div className={`flex items-end gap-3 ${isCustomer ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {!isCustomer && (
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-xs ${
            isHuman
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-600'
              : 'bg-gradient-to-tr from-indigo-600 to-violet-600'
          }`}
        >
          {isHuman ? message.agent_name?.charAt(0)?.toUpperCase() || 'H' : 'AI'}
        </div>
      )}

      <div className={`max-w-[85%] sm:max-w-xl ${isCustomer ? 'order-2' : 'order-1'}`}>
        {isAI && sentimentData && message.sentiment !== 'neutral' && (
          <div className={`mb-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${sentimentData.color}`}>
            {sentimentData.label}
          </div>
        )}

        {isHuman && message.agent_name && (
          <div className="mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
            <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{message.agent_name} (Specialist)</span>
          </div>
        )}

        <div
          className={`rounded-2xl px-4.5 py-3.5 text-xs sm:text-sm leading-relaxed ${
            isCustomer
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-xs shadow-md shadow-indigo-100 font-medium'
              : isHuman
              ? 'bg-emerald-50/90 border border-emerald-200 text-slate-900 rounded-bl-xs shadow-xs'
              : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs shadow-xs'
          }`}
        >
          {isAI ? (
            <div className="whitespace-pre-wrap break-words [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-black [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-slate-100 [&_code]:border [&_code]:border-slate-200/80 [&_code]:rounded-md [&_code]:font-mono [&_code]:text-xs">
              <Markdown>{message.content}</Markdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words font-medium">{message.content}</p>
          )}

          {isAI && message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <SourceCitation sources={message.sources} />
            </div>
          )}

          {isAI && message.confidence_score !== undefined && (
            <div className="mt-2 text-[10px] font-bold text-slate-400">
              Verified Grounded &bull; {(message.confidence_score * 100).toFixed(0)}% confidence
            </div>
          )}
        </div>

        {isAI && message.suggested_followups && message.suggested_followups.length > 0 && onSelectPrompt && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {message.suggested_followups.map((followup, i) => (
              <button
                key={i}
                onClick={() => onSelectPrompt(followup)}
                className="px-3 py-1.5 text-[11px] font-bold rounded-full bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>{followup}</span>
              </button>
            ))}
          </div>
        )}

        <p suppressHydrationWarning className={`mt-1.5 text-[10px] font-semibold text-slate-400 ${isCustomer ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
