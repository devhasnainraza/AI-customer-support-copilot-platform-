'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, getUserRole } from '@/stores/authStore'
import { NotificationBell } from '@/components/notifications/NotificationBell'

interface TopNavBarProps {
  onOpenMobileNav: () => void
  onOpenCommandPalette: () => void
}

export function TopNavBar({ onOpenMobileNav, onOpenCommandPalette }: TopNavBarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const role = getUserRole(user) || 'customer'

  // Generate breadcrumbs from pathname
  const pathSegments = pathname.split('/').filter(Boolean)
  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/')
    const title = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    return { title, href, isLast: index === pathSegments.length - 1 }
  })

  // Role Badge Styling
  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return {
          bg: 'bg-violet-50 text-violet-700 border-violet-200',
          dot: 'bg-violet-500',
          label: 'System Admin',
        }
      case 'manager':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          dot: 'bg-purple-500',
          label: 'Manager Tier',
        }
      case 'agent':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Support Specialist',
        }
      default:
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-500',
          label: 'Client Portal',
        }
    }
  }

  const roleConfig = getRoleBadge()

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-6 transition-all duration-200 shadow-2xs">
      {/* Left: Mobile Drawer Trigger + Breadcrumb Navigation */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open sidebar"
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shrink-0 shadow-2xs"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb Trail */}
        <nav className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 overflow-hidden">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 transition-colors shrink-0 font-bold"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Copilot</span>
          </Link>
          {breadcrumbs.map((crumb) => (
            <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
              <span className="text-slate-300 font-normal">/</span>
              {crumb.isLast ? (
                <span className="text-slate-900 font-extrabold truncate bg-slate-100/70 px-2 py-0.5 rounded-md border border-slate-200/50">
                  {crumb.title}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-indigo-600 transition-colors truncate">
                  {crumb.title}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="flex-1 max-w-md mx-2 sm:mx-6">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-indigo-300 hover:shadow-sm px-3.5 py-1.5 text-xs text-slate-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline truncate font-medium">Quick search or run commands...</span>
            <span className="sm:hidden truncate font-medium">Search...</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 shadow-2xs">
              Ctrl+K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right: Role Badge + Notification Center + User Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Dynamic Role Badge */}
        <div className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs ${roleConfig.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${roleConfig.dot} radar-live`} />
          <span>{roleConfig.label}</span>
        </div>

        {/* Global Notification Bell */}
        <NotificationBell />

        {/* User initials & Sign Out Button */}
        <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
          <div className="hidden lg:flex flex-col text-right mr-1.5">
            <span className="text-[11px] font-bold text-slate-800 leading-none truncate max-w-[120px]">
              {user?.email?.split('@')[0] || 'User'}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 capitalize mt-0.5">
              {role}
            </span>
          </div>
          <button
            onClick={() => void logout()}
            title="Sign out of account"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-black transition-all cursor-pointer shrink-0 shadow-2xs"
          >
            {user?.email?.slice(0, 2).toUpperCase() || 'U'}
          </button>
        </div>
      </div>
    </header>
  )
}
