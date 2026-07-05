import { createContext } from 'react'
import type { Language, TFunction } from '@/i18n/translations'

export type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: TFunction
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)
