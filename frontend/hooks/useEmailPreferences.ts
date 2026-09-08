"use client"

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface EmailPreference {
  id?: string
  category: string
  category_name?: string
  label?: string
  description?: string
  enabled: boolean
  email?: string
  is_default?: boolean
}

export interface UseEmailPreferencesReturn {
  preferences: EmailPreference[]
  isLoading: boolean
  error: string | null
  fetchPreferences: () => Promise<void>
  updatePreference: (category: string, enabled: boolean) => Promise<boolean>
  bulkUpdate: (updates: Record<string, boolean>) => Promise<boolean>
  togglePreference: (category: string) => Promise<boolean>
  getEnabledCount: () => number
  getDisabledCount: () => number
}

export function useEmailPreferences(userId: string, role: string = 'customer', email: string = ''): UseEmailPreferencesReturn {
  const [preferences, setPreferences] = useState<EmailPreference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPreferences = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams({ role, email })
      const res = await fetch(`${API}/v1/notifications/email/preferences/${userId}?${params}`, {
        headers,
      })
      if (!res.ok) throw new Error('Failed to fetch preferences')
      const data = await res.json()
      setPreferences(data.preferences || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setIsLoading(false)
    }
  }, [userId, role, email])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  const updatePreference = useCallback(async (category: string, enabled: boolean, newEmail?: string): Promise<boolean> => {
    if (!userId) return false

    try {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams({ category })
      const body = JSON.stringify({ enabled, email: newEmail || email })
      const res = await fetch(`${API}/v1/notifications/email/preferences/${userId}?${params}`, {
        method: 'POST',
        headers,
        body,
      })
      if (!res.ok) throw new Error('Failed to update preference')

      // Update local state optimistically
      setPreferences(prev => prev.map(p => {
        if (p.category === category) {
          return { ...p, enabled, email: newEmail || p.email, is_default: false }
        }
        return p
      }))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preference')
      return false
    }
  }, [userId, email])

  const bulkUpdate = useCallback(async (updates: Record<string, boolean>, newEmail?: string): Promise<boolean> => {
    if (!userId) return false

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/v1/notifications/email/preferences/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ preferences: updates, email: newEmail || email }),
      })
      if (!res.ok) throw new Error('Failed to bulk update preferences')

      // Update local state
      setPreferences(prev => prev.map(p => {
        if (updates.hasOwnProperty(p.category)) {
          return { ...p, enabled: updates[p.category], is_default: false }
        }
        return p
      }))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk update preferences')
      return false
    }
  }, [userId, email])

  const togglePreference = useCallback(async (category: string): Promise<boolean> => {
    const pref = preferences.find(p => p.category === category)
    if (!pref) return false
    return updatePreference(category, !pref.enabled)
  }, [preferences, updatePreference])

  const getEnabledCount = useCallback(() => {
    return preferences.filter(p => p.enabled).length
  }, [preferences])

  const getDisabledCount = useCallback(() => {
    return preferences.filter(p => !p.enabled).length
  }, [preferences])

  return {
    preferences,
    isLoading,
    error,
    fetchPreferences,
    updatePreference,
    bulkUpdate,
    togglePreference,
    getEnabledCount,
    getDisabledCount,
  }
}

export default useEmailPreferences
