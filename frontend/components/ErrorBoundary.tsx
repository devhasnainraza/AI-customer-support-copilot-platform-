/**
 * ErrorBoundary — Catches render errors and shows a recovery UI.
 * Used as a wrapper around page content to prevent full-page white screens.
 */
'use client'

import React, { Component, ErrorInfo } from 'react'

interface Props {
  children: React.ReactNode
  /** Optional label shown in the error UI for debugging */
  pageName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.pageName ? ` — ${this.props.pageName}` : ''}]`, error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-[#fbfbfa] px-6">
          <div className="max-w-md text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              {this.props.pageName
                ? `An error occurred on the ${this.props.pageName} page.`
                : 'An unexpected error occurred.'}
            </p>
            {this.state.error && (
              <details className="text-left">
                <summary className="text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-600">
                  Error details
                </summary>
                <pre className="mt-2 p-3 rounded-xl bg-slate-100 text-xs text-slate-700 overflow-auto max-h-40">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold transition-all shadow-md"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition-all shadow-sm"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
