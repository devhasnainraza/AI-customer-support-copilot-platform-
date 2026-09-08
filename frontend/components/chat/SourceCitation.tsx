/**
 * SourceCitation Component
 * T066: Display RAG grounded knowledge citations in Modern Light Theme
 */
'use client'

import { useState } from 'react'

interface Source {
  chunk_id: string
  similarity: number
  content: string
}

interface SourceCitationProps {
  sources: Source[]
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false)

  if (!sources || sources.length === 0) {
    return null
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-xs font-bold text-indigo-700 hover:text-indigo-900 transition-colors bg-indigo-50/70 hover:bg-indigo-100/80 px-3 py-2 rounded-xl border border-indigo-100"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>{sources.length} Grounded Knowledge Source{sources.length > 1 ? 's' : ''} Used</span>
        </span>

        <svg
          className={`h-4 w-4 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-2">
          {sources.map((source, index) => (
            <div
              key={source.chunk_id || index}
              className="rounded-xl border border-slate-200/80 bg-white p-3 text-xs shadow-sm"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-[11px]">
                  Knowledge Chunk #{index + 1}
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {(source.similarity * 100).toFixed(0)}% Match
                </span>
              </div>
              <p className="text-slate-600 line-clamp-3 leading-relaxed mt-1">{source.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
