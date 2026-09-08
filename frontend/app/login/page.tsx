/**
 * Public Customer Authentication Portal
 * Strictly customer-facing: Sign In & Sign Up for AI Copilot & Support Tickets.
 * Internal staff/admin credentials and roles are completely isolated.
 */
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore, getUserRole } from '@/stores/authStore'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

function CustomerLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect')

  const { login, loginWithGoogle, register, requestPasswordReset, isAuthenticated, isLoading } = useAuthStore()

  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    if (searchParams.get('error') === 'account_suspended') {
      return 'Your account has been suspended by an administrator. Access is blocked.'
    }
    return null
  })
  const [success, setSuccess] = useState<string | null>(null)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const getDestination = () => {
    if (rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')) {
      return rawRedirect
    }
    return '/customer/chat'
  }

  useEffect(() => {
    if (searchParams.get('error') === 'account_suspended') {
      setError('Your account has been suspended by an administrator. Access is blocked.')
    }
  }, [searchParams])

  useEffect(() => {
    if (isAuthenticated) {
      import('@/lib/supabase')
        .then(({ supabase }) =>
          supabase.auth.getSession().then(({ data: { session } }) => {
            const role = getUserRole(session?.user || null)
            if (role === 'suspended') {
              setError('Your account has been suspended by an administrator. Access is blocked.')
              return
            }
            if (role === 'admin') router.push('/admin')
            else if (role === 'manager') router.push('/manager')
            else if (role === 'agent') router.push('/agent')
            else router.push(getDestination())
          })
        )
        .catch(() => router.push('/customer/chat'))
    }
  }, [isAuthenticated, router])

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
        // Direct backend service-role signup to guarantee customer role & table sync
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/auth/admin-signup`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password,
              full_name: fullName || 'Customer User',
              role: 'customer',
            }),
          }
        )

        if (!res.ok) {
          // Fallback to client signup
          await register(email, password, {
            full_name: fullName || 'Customer User',
            role: 'customer',
          })
        } else {
          await login(email, password)
        }

        setSuccess('Account registered successfully! Opening support copilot...')
      } else {
        await login(email, password)
        setSuccess('Authenticated! Opening workspace...')
      }

      router.push(getDestination())
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please check your credentials.'
      if (msg.includes('suspended')) {
        setError('Your account has been suspended by an administrator. Access is blocked.')
      } else if (msg.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please try again or reset your password.')
      } else {
        setError(msg)
      }
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!resetEmail) {
      setError('Please enter your email address to receive reset instructions.')
      return
    }

    setIsResetting(true)
    try {
      const msg = await requestPasswordReset(resetEmail)
      setSuccess(msg || 'Password reset link dispatched to your inbox!')
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch reset email. Please verify the email address.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafc] flex flex-col justify-between selection:bg-indigo-600 selection:text-white">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Logo variant="full" height={36} className="group-hover:opacity-90 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              ← Back to Help Center
            </Link>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-6 sm:p-9 shadow-2xl shadow-slate-200/50 space-y-6">

          {/* Header Title */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Customer Portal
            </div>
            <h2 className="font-display text-2xl font-black text-slate-900 tracking-tight">
              {isForgotPassword
                ? 'Reset Password'
                : isSignUp
                  ? 'Create Customer Account'
                  : 'Welcome Back'}
            </h2>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
              {isForgotPassword
                ? 'Enter your account email to receive a password reset link'
                : isSignUp
                  ? 'Sign up to ask AI Copilot questions and track your support tickets'
                  : 'Log in to access instant AI support and your tickets'}
            </p>
          </div>

          {/* Error & Success Banners */}
          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-700 animate-fade-in flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-700 animate-fade-in flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Continue with Google */}
          {!isForgotPassword && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setError(null)
                    await loginWithGoogle('/customer/chat')
                  } catch (err: any) {
                    setError(err?.message || 'Google sign in failed. Please try again.')
                  }
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer"
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
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="w-full border-t border-slate-200/80" />
                <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 absolute">
                  or continue with email
                </span>
              </div>
            </div>
          )}

          {/* Form */}
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Account Email</label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-3.5 shadow-md shadow-indigo-100 transition-all cursor-pointer"
              >
                {isResetting ? 'Sending Reset Link...' : 'Send Password Reset Email →'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setResetEmail(email)
                        setError(null)
                        setSuccess(null)
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-xs font-semibold text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
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
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-3.5 shadow-md shadow-indigo-100 transition-all cursor-pointer"
              >
                {isLoading
                  ? 'Verifying Credentials...'
                  : isSignUp
                    ? 'Create Customer Account →'
                    : 'Sign In to Customer Portal →'}
              </button>
            </form>
          )}

          {/* Toggle between Sign In & Sign Up */}
          {!isForgotPassword && (
            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-xs text-slate-500 font-medium">
                {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up Free'}
                </button>
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/80 bg-white/60 backdrop-blur-md px-6 py-4 text-center">
        <p className="text-[11px] text-slate-400 font-medium">
          © {new Date().getFullYear()} AI Customer Support Copilot Platform. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-bold text-xs text-slate-400">Loading Portal...</div>}>
      <CustomerLoginContent />
    </Suspense>
  )
}
