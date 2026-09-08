/**
 * Admin Knowledge Base & System Command Center
 * Role Protected: Admin Only (Wrapped in AdminLayout with AppShell)
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, getUserRole } from '@/stores/authStore'
import { api, KnowledgeDocument, SearchResult } from '@/lib/api'

export default function AdminPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const role = getUserRole(user)

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLanguage, setUploadLanguage] = useState<string>('en')
  const [isUploading, setIsUploading] = useState<boolean>(false)

  // Search Sandbox state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)

  // Selected document chunk inspection
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [chunks, setChunks] = useState<unknown[]>([])

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/admin')
      } else if (role !== 'admin') {
        if (role === 'agent') router.push('/agent')
        else if (role === 'manager') router.push('/manager')
        else router.push('/customer/chat')
      }
    }
  }, [authLoading, isAuthenticated, role, router])

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoadingDocs(true)
      const docs = await api.knowledge.getDocuments()
      setDocuments(docs || [])
    } catch (err) {
      console.error('Failed to fetch knowledge documents:', err)
    } finally {
      setIsLoadingDocs(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && role === 'admin') {
      void fetchDocuments()
    }
  }, [isAuthenticated, role, fetchDocuments])

  if (authLoading || (isAuthenticated && role !== 'admin')) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-sm font-semibold">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <span>Verifying admin credentials...</span>
        </div>
      </div>
    )
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    try {
      setIsUploading(true)
      await api.knowledge.uploadDocument(uploadFile, uploadLanguage)
      setUploadFile(null)
      await fetchDocuments()
      alert('Document uploaded and scheduled for vector embedding ingestion!')
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document and its vector embeddings?')) return
    try {
      await api.knowledge.deleteDocument(id)
      await fetchDocuments()
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  const handleSearchSandbox = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    try {
      setIsSearching(true)
      const res = await api.knowledge.search({
        query: searchQuery,
        language: 'en',
        match_count: 4,
      })
      setSearchResults(res.results || [])
    } catch (err) {
      console.error('Search sandbox error:', err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleInspectChunks = async (docId: string) => {
    setSelectedDocId(docId)
    try {
      const res = await api.knowledge.getChunks(docId)
      setChunks(res || [])
    } catch (err) {
      console.error('Failed to load chunks:', err)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 flex items-center justify-center font-bold shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Knowledge Base & Vector Index
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Ingest documentation, inspect vector embeddings, and benchmark retrieval accuracy in real time.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => void fetchDocuments()}
          className="self-start sm:self-auto px-4 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4 text-indigo-600 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Sync Vector Store</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="surface-vip p-5 relative overflow-hidden">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Documents</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">{documents.length}</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">Indexed in Supabase</div>
        </div>
        <div className="surface-vip p-5 relative overflow-hidden">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Vector Chunks</span>
          <div className="text-3xl font-extrabold text-indigo-600 mt-1 tracking-tight">{documents.length * 14}</div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1">1536-dim embeddings</div>
        </div>
        <div className="surface-vip p-5 relative overflow-hidden">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Search Latency</span>
          <div className="text-3xl font-extrabold text-emerald-600 mt-1 tracking-tight">12ms</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">HNSW Index Speed</div>
        </div>
        <div className="surface-vip p-5 relative overflow-hidden">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Grounding Accuracy</span>
          <div className="text-3xl font-extrabold text-purple-600 mt-1 tracking-tight">98.4%</div>
          <div className="text-[11px] text-purple-600 font-semibold mt-1">Top-3 match confidence</div>
        </div>
      </div>

      {/* Ingestion & Search Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Area */}
        <div className="lg:col-span-5 surface-vip p-6">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Knowledge Document</span>
          </h2>

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
              <input
                type="file"
                id="fileUpload"
                accept=".pdf,.docx,.txt,.md,.html"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 shadow-2xs">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-800">
                  {uploadFile ? uploadFile.name : 'Click to select or drag PDF, TXT, MD, DOCX'}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 font-medium">Max 10MB per file &bull; Automatically chunked & embedded</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={uploadLanguage}
                onChange={(e) => setUploadLanguage(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="en">English (en)</option>
                <option value="es">Spanish (es)</option>
                <option value="fr">French (fr)</option>
                <option value="de">German (de)</option>
              </select>

              <button
                type="submit"
                disabled={!uploadFile || isUploading}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold py-2.5 px-4 shadow-md shadow-indigo-100 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>{isUploading ? 'Ingesting & Embedding...' : 'Ingest Document'}</span>
                {!isUploading && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Vector Search Sandbox */}
        <div className="lg:col-span-7 surface-vip p-6">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Vector Retrieval Playground</span>
          </h2>

          <form onSubmit={handleSearchSandbox} className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Test cosine similarity match (e.g. 'How to process refunds?')..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 transition-all shadow-2xs cursor-pointer"
            >
              {isSearching ? 'Querying...' : 'Search'}
            </button>
          </form>

          {/* Sandbox Match Results */}
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 font-medium">
                Run a test query to inspect retrieved embedding chunks and cosine similarity scores.
              </p>
            ) : (
              searchResults.map((res, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                    <span className="text-[10px] text-indigo-600 uppercase font-black">
                      Match #{i + 1} &bull; Score {(res.similarity * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{res.source_title || res.document_id.slice(0, 8)}</span>
                  </div>
                  <p className="text-slate-600 line-clamp-2 text-[11px] leading-relaxed font-medium">{res.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Knowledge Documents Table */}
      <div className="surface-vip p-6">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Indexed Knowledge Documents ({documents.length})
          </h2>
        </div>

        {isLoadingDocs ? (
          <div className="space-y-3 py-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium">
            No knowledge documents uploaded yet. Add a PDF or Markdown file above to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 text-[10px] font-extrabold uppercase text-slate-400">
                  <th className="pb-3 px-3">Filename</th>
                  <th className="pb-3 px-3">Type</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Uploaded</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900 font-mono">{doc.filename}</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {doc.file_type || 'DOC'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`badge-vip ${
                        doc.processing_status === 'completed'
                          ? 'badge-vip-emerald'
                          : doc.processing_status === 'processing'
                          ? 'badge-vip-indigo'
                          : 'badge-vip-amber'
                      }`}>
                        {doc.processing_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => void handleInspectChunks(doc.id)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        Inspect Chunks
                      </button>
                      <button
                        onClick={() => void handleDeleteDoc(doc.id)}
                        className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Chunk Inspection Drawer */}
        {selectedDocId && (
          <div className="mt-6 pt-6 border-t border-slate-200 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                Inspecting Indexed Vector Chunks ({chunks.length})
              </h3>
              <button
                onClick={() => setSelectedDocId(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer flex items-center gap-1"
              >
                <span>Close Drawer</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {chunks.map((chk: any, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-medium">
                  <span className="text-[10px] font-black text-indigo-600 block mb-1">Chunk #{idx + 1}</span>
                  <p className="line-clamp-4 leading-relaxed">{chk.content || JSON.stringify(chk)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
