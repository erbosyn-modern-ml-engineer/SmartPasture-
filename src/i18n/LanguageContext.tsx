import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_LANGUAGE, LANGUAGES, translate, type Language } from '@/i18n/translations'
import { LanguageContext, type LanguageContextValue } from '@/i18n/languageContextObject'

const LANGUAGE_STORAGE_KEY = 'smartpasture-language'

function isLanguage(value: string | null): value is Language {
  return LANGUAGES.includes(value as Language)
}

function readInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => readInitialLanguage())

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key) => translate(language, key),
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
