import { useContext } from 'react'
import { LanguageContext } from '@/i18n/languageContextObject'

export function useI18n() {
  const value = useContext(LanguageContext)
  if (!value) {
    throw new Error('useI18n must be used inside LanguageProvider')
  }
  return value
}
