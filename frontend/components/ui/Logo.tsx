'use client'

import React from 'react'

interface LogoProps {
  variant?: 'full' | 'icon' | 'compact'
  height?: number | string
  className?: string
  iconClassName?: string
  textColor?: string
  accentText?: string
  subtitle?: string
}

export function Logo({
  variant = 'full',
  height = 36,
  className = '',
  iconClassName = '',
  textColor = '#0E2A47',
  accentText = 'SUPPORT',
  subtitle,
}: LogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        height={height}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 ${iconClassName} ${className}`}
        style={{ aspectRatio: '1 / 1' }}
      >
        <defs>
          <linearGradient id="cs-grad-icon-comp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
        </defs>
        <g transform="translate(4,4)">
          <path
            d="M28 0C12.536 0 0 11.85 0 26.5c0 6.94 2.79 13.27 7.42 18.06L4 56l12.53-4.86C20.02 52.66 23.9 53.5 28 53.5 43.464 53.5 56 41.65 56 27S43.464 0 28 0z"
            fill="url(#cs-grad-icon-comp)"
          />
          <circle cx="16.5" cy="27" r="4.2" fill="#FFFFFF" />
          <circle cx="39.5" cy="27" r="4.2" fill="#FFFFFF" />
          <path
            d="M16.5 27a11.5 11.5 0 0 1 20.2-7.5"
            stroke="#FFFFFF"
            strokeWidth="3.4"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="28" cy="14.2" r="2.6" fill="#FFFFFF" />
        </g>
      </svg>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <Logo variant="icon" height={height} className={iconClassName} />
        <div className="flex flex-col min-w-0">
          <span className="font-display font-bold text-slate-900 leading-tight tracking-tight text-sm">
            Copilot
          </span>
          <span className="text-[10px] font-bold tracking-wider bg-gradient-to-r from-cyan-500 to-blue-800 bg-clip-text text-transparent">
            {subtitle || accentText}
          </span>
        </div>
      </div>
    )
  }

  // Full SVG with vector wordmark
  return (
    <svg
      height={height}
      viewBox="0 0 320 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      style={{ aspectRatio: '320 / 64' }}
    >
      <defs>
        <linearGradient id="cs-grad-full-comp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>

      {/* Icon */}
      <g transform="translate(4,4)">
        <path
          d="M28 0C12.536 0 0 11.85 0 26.5c0 6.94 2.79 13.27 7.42 18.06L4 56l12.53-4.86C20.02 52.66 23.9 53.5 28 53.5 43.464 53.5 56 41.65 56 27S43.464 0 28 0z"
          fill="url(#cs-grad-full-comp)"
        />
        <circle cx="16.5" cy="27" r="4.2" fill="#FFFFFF" />
        <circle cx="39.5" cy="27" r="4.2" fill="#FFFFFF" />
        <path
          d="M16.5 27a11.5 11.5 0 0 1 20.2-7.5"
          stroke="#FFFFFF"
          strokeWidth="3.4"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="28" cy="14.2" r="2.6" fill="#FFFFFF" />
      </g>

      {/* Wordmark */}
      <g transform="translate(72,0)">
        <text
          x="0"
          y="30"
          fontFamily="'Segoe UI', Helvetica, Arial, sans-serif"
          fontSize="22"
          fontWeight="700"
          letterSpacing="0.3"
          fill={textColor}
        >
          Copilot
        </text>
        <text
          x="0"
          y="52"
          fontFamily="'Segoe UI', Helvetica, Arial, sans-serif"
          fontSize="22"
          fontWeight="300"
          letterSpacing="1.5"
          fill="url(#cs-grad-full-comp)"
        >
          {subtitle || accentText}
        </text>
      </g>
    </svg>
  )
}
export default Logo
