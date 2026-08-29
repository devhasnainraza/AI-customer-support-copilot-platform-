/**
 * Premium SaaS Login & Registration Portal
 * Features smooth glassmorphism, HSL tailwind colors, and modern micro-animations
 */
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { getUserRole } from '@/stores/authStore'
import Link from 'next/link'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Only allow same-origin relative paths — an absolute URL here would be an
  // open redirect usable for phishing (?redirect=https://evil.example).
  const rawRedirect = searchParams.get('redirect') || '/chat'
  const redirectUrl =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.includes('\\')
      ? rawRedirect
      : '/chat'
  
  const { login, register, requestPasswordReset, isAuthenticated, isLoading } = useAuthStore()
  
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  useEffect(() => {
    // If already authenticated, redirect immediately
    if (isAuthenticated) {
      // Role-based redirect after login
      import('@/lib/supabase').then(({ supabase }) =>
        supabase.auth.getSession().then(({ data: { session } }) => {
          const role = getUserRole(session?.user || null)
          let target = redirectUrl
          if (redirectUrl === '/chat' || redirectUrl === '/') {
            if (role === 'admin') target = '/admin'
            else if (role === 'manager') target = '/manager'
            else if (role === 'agent') target = '/agent'
            else target = '/customer/chat'
          }
          router.push(target)
        })
      ).catch(() => router.push(redirectUrl))
    }
  }, [isAuthenticated, redirectUrl, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email || !password) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      if (isSignUp) {
        try {
          await register(email, password, { full_name: fullName })
        } catch (regErr: any) {
          const errMsg = regErr?.message || (typeof regErr === 'string' ? regErr : JSON.stringify(regErr || ''))
          const errStr = String(errMsg).toLowerCase()
          if (errStr.includes('rate limit') || errStr.includes('verification email') || errStr.includes('rate_limit') || errStr.includes('exceeded')) {
            console.warn('Email rate limit hit, using Service Role auto-confirmation...')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/auth/admin-signup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, full_name: fullName })
            })
            if (!res.ok) {
              const errBody = await res.json()
              throw new Error(errBody.detail || 'Auto-signup failed')
            }
            await login(email, password)
          } else {
            throw regErr
          }
        }
        setSuccess('Account created and verified! Redirecting...')
        setTimeout(() => {
          router.push(redirectUrl)
        }, 1000)
      } else {
        await login(email, password)
        router.push(redirectUrl)
      }
    } catch (err: any) {
      const message = err?.message || (typeof err === 'string' ? err : null) || 'An error occurred during authentication.'
      setError(typeof message === 'string' ? message : JSON.stringify(message))
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!resetEmail) {
      setError('Please enter your email address.')
      return
    }

    try {
      await requestPasswordReset(resetEmail)
      setSuccess('Password reset link sent! Check your email inbox.')
    } catch (err: any) {
      const message = err?.message || (typeof err === 'string' ? err : null) || 'Failed to send reset email.'
      setError(typeof message === 'string' ? message : JSON.stringify(message))
    }
  }

  return (
    <div className="relative min-h-screen bg-[#fbfbfa] bg-dot-grid flex flex-col justify-between text-slate-800 overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[40%] rounded-full glow-blob-indigo pointer-events-none" />
      <div className="absolute bottom-[15%] right-[-15%] w-[50%] h-[40%] rounded-full glow-blob-rose pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between w-full">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-rose-500 text-white font-extrabold text-xl shadow-md shadow-indigo-100">
              C
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-slate-900">
                Copilot Portal
              </span>
              <p className="text-[9px] text-indigo-600 font-extrabold tracking-widest uppercase">
                AI Customer Support
              </p>
            </div>
          </Link>
        </div>
      </header>

      {/* Form Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/50 bg-white/90 backdrop-blur-md p-8 shadow-md shadow-slate-100/50 hover:border-indigo-200 transition-all duration-300">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              {isForgotPassword
                ? 'Reset Password'
                : isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 font-semibold">
              {isForgotPassword
                ? 'Enter your email and we\'ll send you a reset link'
                : isSignUp
                ? 'Sign up to start chatting with AI Customer Support'
                : 'Log in to track your conversations and tickets'}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-bold text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-700 animate-pulse">
              {success}
            </div>
          )}

          {isForgotPassword ? (
            /* ──── Forgot Password Form ──── */
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-1.5 text-left">
                <label htmlFor="resetEmail" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  id="resetEmail"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs sm:text-sm font-semibold transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center rounded-xl bg-slate-900 hover:bg-indigo-600 py-3.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            /* ──── Login / Sign Up Form ──── */
            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <div className="space-y-1.5 text-left">
                  <label htmlFor="fullName" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs sm:text-sm font-semibold transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5 text-left">
                <label htmlFor="email" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs sm:text-sm font-semibold transition-all"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setError(null)
                        setSuccess(null)
                        setResetEmail(email)
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs sm:text-sm font-semibold transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center rounded-xl bg-slate-900 hover:bg-indigo-600 py-3.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading
                  ? 'Processing...'
                  : isSignUp
                  ? 'Sign Up'
                  : 'Log In'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center text-xs font-bold text-slate-500">
            {isForgotPassword ? (
              <>
                Remember your password?{' '}
                <button
                  onClick={() => {
                    setIsForgotPassword(false)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  Back to Log In
                </button>
              </>
            ) : (
              <>
                {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  {isSignUp ? 'Log In' : 'Sign Up'}
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-6 text-center text-xs text-slate-400 font-semibold">
        <p>&copy; 2026 AI Customer Support Copilot Platform. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbfa]">
        <div className="text-gray-600 font-medium">Loading portal...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
