/**
 * SearchPreview Component
 * T095: Vector query preview playground for testing semantic matching
 */
'use client'

import { useState } from 'react'
import { api, SearchResult } from '@/lib/api'

export function SearchPreview() {
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('en')
  const [threshold, setThreshold] = useState(0.7)
  const [matchCount, setMatchCount] = useState(5)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    try {
      setIsSearching(true)
      setError(null)
      setResults([])

      const response = await api.knowledge.search({
        query: trimmed,
        language,
        match_count: matchCount,
        similarity_threshold: threshold
      })

      setResults(response.results || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to perform semantic search.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900 mb-2">Vector Search Preview</h3>
      <p className="text-xs text-slate-500 mb-6">Test how the AI retrieves contexts by executing a semantic query against the vector database.</p>

      {/* Query panel */}
      <div className="space-y-4">
        <div>
          <label htmlFor="query" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Semantic Query / Test Question
          </label>
          <div className="flex gap-2">
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. How can I reset my password?"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="rounded-xl bg-violet-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Configuration grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
          {/* Language selection */}
          <div>
            <label htmlFor="search-lang" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Search Collection
            </label>
            <select
              id="search-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="en">English (EN)</option>
              <option value="es">Spanish (ES)</option>
              <option value="fr">French (FR)</option>
            </select>
          </div>

          {/* Similarity Threshold */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="threshold" className="block text-[10px] font-bold text-slate-400 uppercase">
                Threshold: {threshold.toFixed(2)}
              </label>
            </div>
            <input
              id="threshold"
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
            />
          </div>

          {/* Match Count */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="match-count" className="block text-[10px] font-bold text-slate-400 uppercase">
                Max Results: {matchCount}
              </label>
            </div>
            <input
              id="match-count"
              type="range"
              min="1"
              max="10"
              step="1"
              value={matchCount}
              onChange={(e) => setMatchCount(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-600 border border-rose-100">
          {error}
        </div>
      )}

      {/* Results view */}
      <div className="mt-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Relevance Matches</h4>
        
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <svg className="h-8 w-8 animate-spin text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs font-semibold text-slate-600">Generating embeddings and querying index...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-8 text-center text-xs text-slate-400">
            {query.trim() ? 'No chunks matched the similarity parameters.' : 'Enter a query and run search to preview results.'}
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {results.map((result, idx) => (
              <div key={result.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700 max-w-[180px] truncate" title={result.source_title ?? undefined}>
                      {result.source_title || 'Untitled source'}
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                    {(result.similarity * 100).toFixed(1)}% match
                  </span>
                </div>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{result.content}</p>
                <div className="mt-2 text-[10px] text-slate-400 font-medium">
                  Position: {result.position} | Chunk ID: {result.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
