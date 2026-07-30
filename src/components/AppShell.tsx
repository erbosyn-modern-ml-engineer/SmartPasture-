import { Suspense, useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  Calculator,
  FileText,
  GitCompareArrows,
  Globe,
  Home,
  ListFilter,
  Map,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { smartPastureLogo } from '@/assets/smartpasture'
import { Breadcrumb } from '@/components/Breadcrumb'
import { LoadingPanel } from '@/components/ui'
import { cx } from '@/lib/cx'
import { useRevealOnScroll } from '@/lib/useUiMotion'
import { useI18n } from '@/i18n/useI18n'
import { LANGUAGES, type Language } from '@/i18n/translations'

type NavigationItem = {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

type Theme = 'dark' | 'light'

const THEME_KEY = 'smartpasture-theme'

const primaryNavigation: NavigationItem[] = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/map', label: 'Карта', icon: Map },
  { to: '/ranking', label: 'Точки', icon: ListFilter },
  { to: '/calculator', label: 'Калькулятор', icon: Calculator },
  { to: '/validation', label: 'Валидация', icon: BarChart3 },
  { to: '/compare', label: 'Сравнить', icon: GitCompareArrows },
  { to: '/report', label: 'Отчёт', icon: FileText },
]

const mobileNavigation = primaryNavigation.slice(0, 4)

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem(THEME_KEY)
  return saved === 'light' ? 'light' : 'dark'
}

export function AppShell() {
  const location = useLocation()
  const { language, setLanguage, t } = useI18n()
  const contentRef = useRef<HTMLElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  useRevealOnScroll(contentRef, location.pathname)

  useEffect(() => {
    setMenuOpen(false)
    setLanguageOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  return (
    <div className={cx('shell', menuOpen && 'shell--menu-open')}>
      <header className="app-header app-header--simplified">
        <NavLink to="/" className="brand-lockup" aria-label="SmartPasture">
          <img className="brand-lockup__logo" src={smartPastureLogo} alt="" />
          <span className="brand-lockup__text">
            <strong>{t('app.title')}</strong>
            <small>Предполевой гидрогеологический скрининг</small>
          </span>
        </NavLink>

        <nav className="app-header__nav" aria-label="Основная навигация">
          {primaryNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx('header-nav-link', isActive && 'header-nav-link--active')}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-header__right">
          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="language-switcher language-switcher--desktop" aria-label={t('nav.languageSwitcher')}>
            {LANGUAGES.map((item) => (
              <button
                key={item}
                type="button"
                className={cx('language-switcher__button', language === item && 'language-switcher__button--active')}
                aria-pressed={language === item}
                onClick={() => setLanguage(item as Language)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="language-switcher-mobile">
            <button
              type="button"
              className="language-switcher-mobile__toggle"
              aria-label={t('nav.languageSwitcher')}
              aria-expanded={languageOpen}
              onClick={() => setLanguageOpen((current) => !current)}
            >
              <Globe size={18} />
            </button>
            {languageOpen ? (
              <div className="language-switcher-mobile__menu language-switcher-mobile__menu--open" role="menu">
                {LANGUAGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={cx('language-switcher-mobile__option', language === item && 'language-switcher-mobile__option--active')}
                    onClick={() => {
                      setLanguage(item as Language)
                      setLanguageOpen(false)
                    }}
                  >
                    {item === 'kk' ? 'Қазақша' : item === 'ru' ? 'Русский' : 'English'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="menu-button menu-button--mobile"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <button
        type="button"
        className={cx('menu-backdrop', menuOpen && 'menu-backdrop--open')}
        aria-label="Закрыть меню"
        onClick={() => setMenuOpen(false)}
      />

      <aside className={cx('nav-drawer', menuOpen && 'nav-drawer--open')} aria-hidden={!menuOpen}>
        <div className="nav-drawer__header">
          <div className="brand-lockup brand-lockup--drawer">
            <img className="brand-lockup__logo" src={smartPastureLogo} alt="" />
            <span className="brand-lockup__text"><strong>SmartPasture</strong><small>Что делать дальше — в одном меню</small></span>
          </div>
          <button type="button" className="icon-button" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <nav className="nav-drawer__links" aria-label="Мобильная навигация">
          {primaryNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx('drawer-link', isActive && 'drawer-link--active')}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main ref={contentRef} className="shell__content">
        <Breadcrumb />
        <Suspense fallback={<LoadingPanel title={t('app.loadingRouteTitle')} message={t('app.loadingRouteMessage')} compact />}>
          <div key={location.pathname} className="route-transition"><Outlet /></div>
        </Suspense>
      </main>

      <footer className="app-footer">
        <div className="app-footer__content">
          <div className="app-footer__branding">
            <img src={smartPastureLogo} alt="SmartPasture" className="app-footer__logo" />
            <div><strong>SmartPasture</strong><div>Предварительный инструмент поддержки решений, не гарантия наличия воды.</div></div>
          </div>
          <div className="app-footer__links">
            <NavLink to="/calculator">Калькулятор</NavLink>
            <NavLink to="/validation">Валидация</NavLink>
            <NavLink to="/report">Отчёт</NavLink>
          </div>
        </div>
      </footer>

      <nav className="app-mobile-nav" aria-label="Быстрая навигация">
        {mobileNavigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cx('app-mobile-nav__item', isActive && 'app-mobile-nav__item--active')}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
