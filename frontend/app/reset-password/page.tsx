/**
 * Password Reset Confirmation Page
 * User lands here after clicking the password reset link from their email.
 * Supabase automatically handles the PASSWORD_RECOVERY auth event via
 * detectSessionInUrl, so the user is already authenticated with a
 * recovery session by the time this page renders.
 */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, updatePassword } from '@/lib/supabase'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRecoverySession, setIsRecoverySession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event which fires when Supabase
    // processes the recovery token from the URL fragment (#access_token=...).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, _session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoverySession(true)
          setCheckingSession(false)
        }
      }
    )

    // Also check if user already has an active session (e.g. page refresh)
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsRecoverySession(true)
      }
      setCheckingSession(false)
    }

    // Give Supabase a moment to process the URL fragment, then fallback
    const timer = setTimeout(checkExistingSession, 1500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setIsLoading(true)
      await updatePassword(newPassword)
      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      const message =
        err?.message ||
        (typeof err === 'string' ? err : null) ||
        'Failed to update password.'
      setError(typeof message === 'string' ? message : JSON.stringify(message))
    } finally {
      setIsLoading(false)
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

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/50 bg-white/90 backdrop-blur-md p-8 shadow-md shadow-slate-100/50 hover:border-indigo-200 transition-all duration-300">
          {/* Loading / Checking Session */}
          {checkingSession ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 mb-4">
                <svg
                  className="w-6 h-6 text-indigo-600 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                Verifying your reset link...
              </p>
            </div>
          ) : !isRecoverySession ? (
            /* Invalid / Expired Link */
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-5">
                <svg
                  className="w-7 h-7 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-black tracking-tight text-slate-900 mb-2">
                Invalid or Expired Link
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-6">
                This password reset link is no longer valid. Please request a new one.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-indigo-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Back to Login
              </Link>
            </div>
          ) : success ? (
            /* Success State */
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 mb-5">
                <svg
                  className="w-7 h-7 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-black tracking-tight text-slate-900 mb-2">
                Password Updated!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-2">
                Your password has been successfully changed.
              </p>
              <p className="text-xs text-indigo-600 font-bold animate-pulse">
                Redirecting to login...
              </p>
            </div>
          ) : (
            /* Reset Password Form */
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 mb-5">
                  <svg
                    className="w-7 h-7 text-indigo-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Set New Password
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 font-semibold">
                  Choose a strong password for your account
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-bold text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor="newPassword"
                    className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                  >
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs sm:text-sm font-semibold transition-all"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor="confirmPassword"
                    className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs sm:text-sm font-semibold transition-all"
                  />
                </div>

                {/* Password strength hint */}
                <p className="text-[10px] text-slate-400 font-semibold">
                  Must be at least 6 characters long
                </p>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center rounded-xl bg-slate-900 hover:bg-indigo-600 py-3.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>

              <div className="mt-8 text-center text-xs font-bold text-slate-500">
                Remember your password?{' '}
                <Link
                  href="/login"
                  className="text-indigo-600 hover:text-indigo-800 underline"
                >
                  Back to Log In
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-6 text-center text-xs text-slate-400 font-semibold">
        <p>&copy; 2026 AI Customer Support Copilot Platform. All rights reserved.</p>
      </footer>
    </div>
  )
}
