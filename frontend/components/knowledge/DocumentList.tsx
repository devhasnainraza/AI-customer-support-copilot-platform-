/**
 * DocumentList Component
 * T092: Display list of documents with status checks and delete operations
 */
'use client'

import { useState } from 'react'
import { api, ApiError, KnowledgeDocument } from '@/lib/api'
import { ProcessingStatus } from './ProcessingStatus'

interface DocumentListProps {
  documents: KnowledgeDocument[]
  isLoading: boolean
  onRefresh: () => void
}

interface Chunk {
  id: string
  position: number
  content: string
}

export function DocumentList({ documents, isLoading, onRefresh }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document? All associated chunks and vector embeddings will be permanently removed.')) {
      return
    }

    try {
      setDeletingId(id)
      setActionError(null)
      await api.knowledge.deleteDocument(id)
      onRefresh()
    } catch (error) {
      console.error('Failed to delete document:', error)
      setActionError(
        error instanceof ApiError ? error.message : 'Failed to delete document. Please try again.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleExpandDoc = async (id: string) => {
    if (expandedDocId === id) {
      setExpandedDocId(null)
      setChunks([])
      return
    }

    try {
      setExpandedDocId(id)
      setLoadingChunks(true)
      setChunks([])
      const result = await api.knowledge.getChunks(id)
      setChunks(result as Chunk[])
    } catch (error) {
      console.error('Failed to load chunks:', error)
      setActionError(
        error instanceof ApiError ? error.message : 'Failed to load chunks for this document.'
      )
    } finally {
      setLoadingChunks(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 font-bold text-xs">
            PDF
          </span>
        )
      case 'docx':
        return (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-xs">
            DOC
          </span>
        )
      default:
        return (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 font-bold text-xs">
            TXT
          </span>
        )
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h3 className="text-base font-semibold text-slate-900">Indexed Knowledge Documents</h3>
        <button
          onClick={onRefresh}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Refresh List"
          aria-label="Refresh document list"
          disabled={isLoading}
        >
          <svg className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.235" />
          </svg>
        </button>
      </div>

      {actionError && (
        <div role="alert" className="border-b border-rose-100 bg-rose-50 px-6 py-3 text-xs font-semibold text-rose-700">
          {actionError}
        </div>
      )}

      {isLoading && documents.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center text-sm text-slate-500 p-6 text-center">
          <svg className="h-10 w-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-semibold text-slate-700">No documents uploaded yet</p>
          <p className="text-xs text-slate-400 mt-1">Upload a PDF or text file to initialize the support agent&apos;s knowledge base.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3">Document</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Language</th>
                <th className="px-6 py-3">Uploaded</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {getFileIcon(doc.file_type)}
                      <div>
                        <p className="font-semibold text-slate-800 break-all">{doc.filename}</p>
                        <p className="text-[10px] text-slate-400">ID: {doc.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{formatBytes(doc.file_size_bytes)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 uppercase">
                      {doc.language}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <ProcessingStatus status={doc.processing_status} error={doc.processing_error} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {doc.processing_status === 'completed' && (
                        <button
                          onClick={() => handleExpandDoc(doc.id)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-slate-200 transition-colors hover:bg-slate-100 ${
                            expandedDocId === doc.id ? 'bg-slate-100 text-slate-800' : 'bg-white text-slate-600'
                          }`}
                        >
                          {expandedDocId === doc.id ? 'Hide Chunks' : 'Inspect Chunks'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 transition-colors"
                        title="Delete Document"
                        aria-label={`Delete document ${doc.filename}`}
                      >
                        {deletingId === doc.id ? (
                          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expanded chunks view */}
      {expandedDocId && (
        <div className="border-t border-slate-200 bg-slate-50/50 p-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Extracted Semantic Chunks</h4>
          {loadingChunks ? (
            <div className="text-xs text-slate-500">Loading chunk vectors...</div>
          ) : chunks.length === 0 ? (
            <div className="text-xs text-slate-500">No chunks found for this document.</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {chunks.map((chunk, idx) => (
                <div key={chunk.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Chunk {idx + 1} (Pos: {chunk.position})</span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {chunk.id}</span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{chunk.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
