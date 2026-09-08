'use client'

import { useState, useEffect } from 'react'
import { GlobalSidebar } from './GlobalSidebar'
import { TopNavBar } from './TopNavBar'
import { CommandPalette } from './CommandPalette'

interface AppShellProps {
  children: React.ReactNode
  fullBleed?: boolean
  activeRole?: 'admin' | 'manager' | 'agent' | 'customer'
}

export function AppShell({ children, fullBleed = false }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)

  // Load collapsed preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('copilot.sidebar.collapsed')
      if (saved !== null) {
        setIsCollapsed(saved === 'true')
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Listen for global Ctrl+K / Cmd+K to open spotlight command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('copilot.sidebar.collapsed', String(next))
      } catch {
        // Ignore
      }
      return next
    })
  }

  return (
    <div className="flex h-screen h-[100dvh] w-full bg-[#f8fafc] bg-dot-grid text-slate-900 font-sans antialiased overflow-hidden">
      {/* Universal Global Collapsible Sidebar (Strict 100vh height) */}
      <GlobalSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main App Content Area (Locked to 100vh with internal scroll) */}
      <div className="flex flex-1 flex-col min-w-0 h-screen h-[100dvh] overflow-hidden">
        {/* Universal Top Nav Command Bar */}
        <TopNavBar
          onOpenMobileNav={() => setIsMobileOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        {/* Content Viewport - Full width scroll container so scrollbar is at the end right corner */}
        <main
          className={`flex-1 min-h-0 w-full ${
            fullBleed
              ? 'flex flex-col overflow-hidden'
              : 'overflow-y-auto overflow-x-hidden'
          }`}
        >
          {fullBleed ? (
            children
          ) : (
            <div className="max-w-[1600px] mx-auto w-full p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  )
}
