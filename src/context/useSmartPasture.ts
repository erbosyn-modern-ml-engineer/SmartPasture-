import { useContext } from 'react'
import { SmartPastureContext } from '@/context/smartPastureContextObject'

export function useSmartPasture() {
  const context = useContext(SmartPastureContext)
  if (!context) {
    throw new Error('useSmartPasture must be used inside SmartPastureProvider')
  }
  return context
}
