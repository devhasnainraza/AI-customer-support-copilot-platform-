/**
 * Admin Layout Component
 * T091: Responsive layout for the admin section (guarded, mobile nav works)
 */
'use client'

import Link from 'next/link'
import { ReactNode, useState } from 'react'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { useAuth } from '@/stores/authStore'

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-4 py-4">
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition-colors"
      >
        <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Knowledge Base
      </Link>
      <Link
        href="/chat"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Customer Chat
      </Link>
    </nav>
  )
}

function UserBadge() {
  const { user } = useAuth()
  const email = user?.email ?? ''
  const name = (user?.user_metadata?.full_name as string | undefined) || 'Support Admin'
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold">
        {initials || 'AD'}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-900">{name}</p>
        <p className="text-[10px] text-slate-500">{email}</p>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
        {/* Sidebar - navigation menu (desktop) */}
        <aside className="hidden w-64 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="flex h-16 items-center border-b border-slate-200 px-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-lg font-bold text-transparent tracking-tight">
                Copilot Admin
              </span>
            </Link>
          </div>
          <AdminNav />
          <div className="border-t border-slate-200 p-4">
            <UserBadge />
          </div>
        </aside>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              aria-label="Close navigation"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-lg font-bold text-transparent tracking-tight">
                  Copilot Admin
                </span>
                <button
                  aria-label="Close navigation"
                  className="text-slate-500"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <AdminNav onNavigate={() => setMobileNavOpen(false)} />
              <div className="border-t border-slate-200 p-4">
                <UserBadge />
              </div>
            </div>
          </div>
        )}

        {/* Main content wrapper */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div className="flex items-center gap-4">
              <button
                className="md:hidden text-slate-600"
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen(true)}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Admin Console</h2>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/chat"
                className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-all duration-200"
              >
                Exit Console
              </Link>
            </div>
          </header>

          {/* Content body */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
