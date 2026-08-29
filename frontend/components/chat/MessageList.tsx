/**
 * MessageList Component
 * T064 & T069: Display list of messages in Modern Light Theme with AI avatars, confidence badges, quick prompts, and source citations
 */
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
  '🔑 How do I reset my account password?',
  '⚡ What are the current API rate limits?',
  '🔒 How to configure custom domain SSL?',
  '🎧 I need to talk to a human support agent'
]

export function MessageList({ messages, isTyping, typingAgent, onSelectPrompt }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 200) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }, [messages, isTyping])

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
    >
      {messages.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-xl shadow-indigo-200 mb-4 animate-pulse">
            AI
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            How can I assist you today?
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-md">
            I am your AI Support Copilot. Ask me questions about account settings, API integration, or request live agent handoff.
          </p>

          {/* Quick Suggested Prompt Chips */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => onSelectPrompt?.(prompt.replace(/^[^\s]+\s*/, ''))}
                className="p-3.5 text-left text-xs font-semibold rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-500 text-slate-700 hover:text-indigo-600 shadow-sm hover:shadow-md transition-all duration-200 group flex items-center gap-2 cursor-pointer"
              >
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} onSelectPrompt={onSelectPrompt} />
      ))}

      {/* Typing indicator */}
      {isTyping && (
        <div className="flex items-end gap-3 justify-start animate-fade-in" role="status" aria-label="AI assistant is typing">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-extrabold shadow-md shrink-0">
            AI
          </div>
          <div className="rounded-2xl rounded-bl-none bg-white border border-slate-200/80 px-4.5 py-3.5 shadow-sm">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600" style={{ animationDelay: '0ms' }}></div>
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-600" style={{ animationDelay: '150ms' }}></div>
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-500" style={{ animationDelay: '300ms' }}></div>
              </div>
              {typingAgent && (
                <span className="text-[11px] font-semibold text-slate-500 animate-pulse">
                  {typingAgent}...
                </span>
              )}
              {!typingAgent && (
                <span className="text-[11px] font-semibold text-slate-400">
                  Thinking...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

const SENTIMENT_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  positive: { emoji: '😊', label: 'Positive', color: 'bg-green-50 text-green-700 border-green-200/60' },
  neutral: { emoji: '😐', label: 'Neutral', color: 'bg-slate-50 text-slate-600 border-slate-200/60' },
  negative: { emoji: '😞', label: 'Unhappy', color: 'bg-amber-50 text-amber-700 border-amber-200/60' },
  frustrated: { emoji: '😤', label: 'Frustrated', color: 'bg-orange-50 text-orange-700 border-orange-200/60' },
  angry: { emoji: '😡', label: 'Angry', color: 'bg-red-50 text-red-700 border-red-200/60' },
}

const TOOL_ICONS: Record<string, string> = {
  lookup_account: '📋',
  check_order_status: '📦',
  schedule_callback: '📞',
  create_ticket: '🎫',
}

function MessageBubble({ message, onSelectPrompt }: { message: Message; onSelectPrompt?: (text: string) => void }) {
  const isCustomer = message.sender_type === 'customer'
  const isAI = message.sender_type === 'ai'
  const isHuman = message.sender_type === 'human_agent'

  const sentimentData = message.sentiment ? SENTIMENT_CONFIG[message.sentiment] : null

  return (
    <div className={`flex items-end gap-3 ${isCustomer ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {!isCustomer && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-extrabold shadow-md shrink-0 mb-1 ${
          isHuman
            ? 'bg-gradient-to-tr from-emerald-500 to-teal-500'
            : 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500'
        }`}>
          {isHuman ? (message.agent_name?.charAt(0)?.toUpperCase() || '👤') : 'AI'}
        </div>
      )}

      <div className={`max-w-xl ${isCustomer ? 'order-2' : 'order-1'}`}>
        {/* Sentiment badge (before bubble) */}
        {isAI && sentimentData && message.sentiment !== 'neutral' && (
          <div className={`mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sentimentData.color}`}>
            <span>{sentimentData.emoji}</span>
            <span>{sentimentData.label}</span>
            {message.sentiment_urgency && message.sentiment_urgency !== 'low' && (
              <span className="ml-1 uppercase">· {message.sentiment_urgency}</span>
            )}
          </div>
        )}

        {/* Tools used badge */}
        {isAI && message.tools_used && message.tools_used.length > 0 && (
          <div className="mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[10px] font-bold">
            {message.tools_used.map((tool) => (
              <span key={tool} className="flex items-center gap-0.5">
                {TOOL_ICONS[tool] || '🔧'} {tool.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Agent name badge for human agents */}
        {isHuman && message.agent_name && (
          <div className="mb-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold">
            👤 {message.agent_name} • Support Agent
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-5 py-4 shadow-sm text-xs sm:text-sm font-medium leading-relaxed ${
            isCustomer
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow-indigo-600/10'
              : isHuman
                ? 'bg-emerald-50 border border-emerald-200/80 text-slate-800 rounded-bl-none shadow-emerald-100/30'
                : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-none shadow-slate-900/5'
          }`}
        >
          {isAI ? (
            <div className="markdown-content whitespace-pre-wrap break-words [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_strong]:font-bold [&_strong]:text-slate-900 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1">
              <Markdown>{message.content}</Markdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Source Citations */}
          {isAI && message.sources && message.sources.length > 0 && (
            <SourceCitation sources={message.sources} />
          )}

          {/* AI confidence score */}
          {isAI && message.confidence_score !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold flex items-center gap-1">
                <span>⚡ AI Confidence:</span>
                <span>{(message.confidence_score * 100).toFixed(0)}%</span>
              </span>
            </div>
          )}
        </div>

        {/* Proactive Follow-up Suggestions */}
        {isAI && message.suggested_followups && message.suggested_followups.length > 0 && onSelectPrompt && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.suggested_followups.map((followup, i) => (
              <button
                key={i}
                onClick={() => onSelectPrompt(followup)}
                className="px-3 py-1.5 text-[11px] font-semibold rounded-full bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200/50 hover:border-indigo-300 transition-all duration-150 cursor-pointer hover:shadow-sm"
              >
                {followup}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={`mt-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider ${isCustomer ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  )
}
