import { createContext } from 'react'
import type { GisProbeCell, SavedProbePoint, SmartPastureBundle } from '@/lib/types'

export interface SmartPastureContextValue {
  status: 'loading' | 'ready' | 'error'
  data: SmartPastureBundle | null
  error: string | null
  pinnedSiteIds: number[]
  savedProbePoints: SavedProbePoint[]
  togglePinnedSite: (siteId: number) => void
  saveProbePoint: (cell: GisProbeCell, name: string) => void
  removeProbePoint: (id: string) => void
  renameProbePoint: (id: string, name: string) => void
}

export const SmartPastureContext = createContext<SmartPastureContextValue | null>(null)
