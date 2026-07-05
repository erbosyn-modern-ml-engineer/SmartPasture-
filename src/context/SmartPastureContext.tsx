import { useEffect, useState, type ReactNode } from 'react'
import { loadSmartPastureBundle } from '@/lib/repository'
import { SmartPastureContext } from '@/context/smartPastureContextObject'
import type { GisProbeCell, SavedProbePoint, SmartPastureBundle } from '@/lib/types'

const SHORTLIST_STORAGE_KEY = 'smartpasture-shortlist'
const PROBE_WISHLIST_STORAGE_KEY = 'smartpasture-probe-wishlist-v1'

function readPinnedSites(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SHORTLIST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === 'number') : []
  } catch {
    return []
  }
}

function isSavedProbePoint(value: unknown): value is SavedProbePoint {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<SavedProbePoint>
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    !!item.cell &&
    typeof item.cell.lat === 'number' &&
    typeof item.cell.lon === 'number'
  )
}

function readSavedProbePoints(): SavedProbePoint[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PROBE_WISHLIST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSavedProbePoint) : []
  } catch {
    return []
  }
}

function normalizeProbeName(name: string, cell: GisProbeCell): string {
  const trimmed = name.trim()
  return trimmed || `Point ${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)}`
}

function isSameProbeCell(left: GisProbeCell, right: GisProbeCell): boolean {
  return left.lat === right.lat && left.lon === right.lon
}

function createProbeId(cell: GisProbeCell): string {
  return `${cell.lat.toFixed(6)}:${cell.lon.toFixed(6)}:${Date.now()}`
}

export function SmartPastureProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [data, setData] = useState<SmartPastureBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pinnedSiteIds, setPinnedSiteIds] = useState<number[]>(() => readPinnedSites())
  const [savedProbePoints, setSavedProbePoints] = useState<SavedProbePoint[]>(() => readSavedProbePoints())

  useEffect(() => {
    let active = true

    loadSmartPastureBundle()
      .then((bundle) => {
        if (!active) return
        setData(bundle)
        setStatus('ready')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setStatus('error')
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить данные SmartPasture.')
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(pinnedSiteIds))
  }, [pinnedSiteIds])

  useEffect(() => {
    window.localStorage.setItem(PROBE_WISHLIST_STORAGE_KEY, JSON.stringify(savedProbePoints))
  }, [savedProbePoints])

  function togglePinnedSite(siteId: number) {
    setPinnedSiteIds((current) =>
      current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId],
    )
  }

  function saveProbePoint(cell: GisProbeCell, name: string) {
    const now = new Date().toISOString()
    const normalizedName = normalizeProbeName(name, cell)

    setSavedProbePoints((current) => {
      const existing = current.find((item) => isSameProbeCell(item.cell, cell))
      if (existing) {
        return current.map((item) => (
          item.id === existing.id
            ? { ...item, name: normalizedName, updatedAt: now, cell }
            : item
        ))
      }

      return [
        {
          id: createProbeId(cell),
          name: normalizedName,
          createdAt: now,
          updatedAt: now,
          cell,
        },
        ...current,
      ]
    })
  }

  function removeProbePoint(id: string) {
    setSavedProbePoints((current) => current.filter((item) => item.id !== id))
  }

  function renameProbePoint(id: string, name: string) {
    setSavedProbePoints((current) => current.map((item) => (
      item.id === id
        ? { ...item, name: name.trim() || item.name, updatedAt: new Date().toISOString() }
        : item
    )))
  }

  return (
    <SmartPastureContext.Provider
      value={{
        status,
        data,
        error,
        pinnedSiteIds,
        savedProbePoints,
        togglePinnedSite,
        saveProbePoint,
        removeProbePoint,
        renameProbePoint,
      }}
    >
      {children}
    </SmartPastureContext.Provider>
  )
}
