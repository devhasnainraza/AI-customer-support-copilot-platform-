/**
 * DocumentUpload Component
 * T093 & T097: File upload zone with drag-and-drop and progress bar
 */
'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { api } from '@/lib/api'

interface DocumentUploadProps {
  onUploadSuccess: () => void
}

export function DocumentUpload({ onUploadSuccess }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState('en')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_SIZE_MB = 10
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/html'
  ]

  const validateFile = (selectedFile: File): boolean => {
    setError(null)

    // Validate size
    if (selectedFile.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds the ${MAX_SIZE_MB}MB limit.`)
      return false
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(selectedFile.type) && !selectedFile.name.endsWith('.md')) {
      setError('Unsupported file type. Please upload a PDF, DOCX, TXT, MD, or HTML file.')
      return false
    }

    return true
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      if (validateFile(droppedFile)) {
        setFile(droppedFile)
      }
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (validateFile(selectedFile)) {
        setFile(selectedFile)
      }
    }
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      setIsUploading(true)
      setError(null)

      await api.knowledge.uploadDocument(file, language)
      
      // Reset
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onUploadSuccess()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to upload document. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900 mb-4">Upload New Document</h3>

      {/* Language selector */}
      <div className="mb-4">
        <label htmlFor="language" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Document Language
        </label>
        <select
          id="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          disabled={isUploading}
        >
          <option value="en">English (EN)</option>
          <option value="es">Spanish (ES)</option>
          <option value="fr">French (FR)</option>
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label="Upload document: click, press Enter, or drag and drop a file"
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
          isDragging
            ? 'border-violet-500 bg-violet-50/50 scale-[0.99]'
            : file
            ? 'border-emerald-500 bg-emerald-50/10'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.txt,.md,.html"
          className="hidden"
          disabled={isUploading}
        />

        {file ? (
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mb-3 animate-pulse">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800 break-all">{file.name}</p>
            <p className="text-xs text-slate-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Click to upload or drag & drop</p>
            <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT, MD, HTML up to {MAX_SIZE_MB}MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-600 border border-rose-100">
          {error}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none cursor-pointer"
      >
        {isUploading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Uploading & Chunking...
          </>
        ) : (
          'Submit Document'
        )}
      </button>
    </div>
  )
}
