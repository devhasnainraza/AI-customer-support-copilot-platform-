/**
 * Dedicated Internal Staff & Manager Authentication Gateway
 * Exclusively for Support Specialists (Agents) and Support Managers.
 * Customer and Admin authentication are isolated from this portal.
 */
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore, getUserRole } from '@/stores/authStore'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

type StaffRole = 'agent' | 'manager'

interface StaffRoleOption {
  id: StaffRole
  title: string
  subtitle: string
  targetRoute: string
  icon: React.ReactNode
}

const STAFF_ROLES: StaffRoleOption[] = [
  {
    id: 'agent',
    title: 'Support Specialist',
    subtitle: 'Manage live queue, claim tickets & live handoff chat',
    targetRoute: '/agent',
    icon: (
      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'manager',
    title: 'Support Manager',
    subtitle: 'Team capacity, escalation reviews & performance reports',
    targetRoute: '/manager',
    icon: (
      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

function StaffLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect')

  const { login, loginWithGoogle, isAuthenticated, isLoading } = useAuthStore()

  const [selectedRole, setSelectedRole] = useState<StaffRole>('agent')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const getDestination = (role: string) => {
    if (rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')) {
      return rawRedirect
    }
    return role === 'manager' ? '/manager' : '/agent'
  }

  useEffect(() => {
    if (isAuthenticated) {
      import('@/lib/supabase')
        .then(({ supabase }) =>
          supabase.auth.getSession().then(({ data: { session } }) => {
            const role = getUserRole(session?.user || null)
            if (role === 'suspended') {
              setError('Your staff account has been suspended by an administrator. Access is blocked.')
              return
            }
            if (role === 'admin') router.push('/admin')
            else if (role === 'manager') router.push('/manager')
            else if (role === 'agent') router.push('/agent')
            else {
              setError('This portal is restricted to authorized staff members only.')
            }
          })
        )
        .catch(() => {})
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email || !password) {
      setError('Please provide your work email and password.')
      return
    }

    try {
      await login(email, password)
      
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const userRole = getUserRole(session?.user || null)

      if (userRole === 'suspended') {
        throw new Error('Your staff account has been suspended by an administrator.')
      }

      if (userRole === 'customer') {
        throw new Error('Access denied. Customer accounts cannot access the internal staff portal.')
      }

      setSuccess(`Authenticated as ${userRole.toUpperCase()}! Opening workspace...`)
      router.push(getDestination(userRole))
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please verify your staff credentials.'
      if (msg.includes('suspended')) {
        setError('Your staff account has been suspended by an administrator. Access is blocked.')
      } else if (msg.includes('Invalid login credentials')) {
        setError('Incorrect work email or password. Please contact your system administrator.')
      } else {
        setError(msg)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-600 selection:text-white">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo variant="full" height={36} textColor="#FFFFFF" subtitle="STAFF GATEWAY" className="hover:opacity-90 transition-opacity" />
          </Link>
          <div>
            <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-lg">
              INTERNAL USE ONLY
            </span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-9 shadow-2xl shadow-black/50 space-y-6">

          {/* Header Title */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 radar-live" />
              Staff Gateway
            </div>
            <h2 className="font-display text-2xl font-black text-white tracking-tight">
              Sign In to Staff Workspace
            </h2>
            <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
              Select your operational role and log in with your authorized corporate credentials.
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950/60 rounded-2xl border border-slate-800">
            {STAFF_ROLES.map((r) => {
              const isSelected = selectedRole === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {r.icon}
                  <span>{r.title}</span>
                </button>
              )
            })}
          </div>

          {/* Error & Success Banners */}
          {error && (
            <div className="rounded-2xl bg-rose-950/50 border border-rose-800/60 p-4 text-xs font-bold text-rose-300 animate-fade-in flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-2xl bg-emerald-950/50 border border-emerald-800/60 p-4 text-xs font-bold text-emerald-300 animate-fade-in flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Google Workspace SSO Button */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={async () => {
                try {
                  setError(null)
                  await loginWithGoogle(selectedRole === 'manager' ? '/manager' : '/agent')
                } catch (err: any) {
                  setError(err?.message || 'Google SSO failed.')
                }
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 hover:bg-slate-800/60 text-slate-200 text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google Workspace</span>
            </button>

            <div className="relative flex items-center justify-center my-2">
              <div className="w-full border-t border-slate-800" />
              <span className="bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 absolute">
                or sign in with staff email
              </span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Work Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@company.com"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Staff Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 pr-10 text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-3.5 shadow-lg shadow-indigo-950 transition-all cursor-pointer"
            >
              {isLoading
                ? 'Verifying Authorization...'
                : `Sign In as ${selectedRole === 'manager' ? 'Support Manager' : 'Support Specialist'} →`}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-6 py-4 text-center">
        <p className="text-[11px] text-slate-500 font-medium">
          Confidential & Proprietary. Unauthorized access attempts are monitored and logged.
        </p>
      </footer>
    </div>
  )
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-bold text-xs text-slate-400 bg-slate-950">Loading Staff Gateway...</div>}>
      <StaffLoginContent />
    </Suspense>
  )
}
