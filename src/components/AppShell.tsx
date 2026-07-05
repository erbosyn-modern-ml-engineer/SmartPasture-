import { Suspense, useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  ClipboardList,
  Globe,
  GitCompareArrows,
  Home,
  ListFilter,
  Map,
  Menu,
  ShieldAlert,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { smartPastureLogo } from '@/assets/smartpasture'
import { Breadcrumb } from '@/components/Breadcrumb'
import { useSmartPasture } from '@/context/useSmartPasture'
import { LoadingPanel } from '@/components/ui'
import { cx } from '@/lib/cx'
import { useRevealOnScroll } from '@/lib/useUiMotion'
import { useI18n } from '@/i18n/useI18n'
import { LANGUAGES, type Language } from '@/i18n/translations'

type NavigationItem = {
  to: string
  labelKey?: string
  label?: string
  icon: typeof Home
  end?: boolean
}

const primaryNavigation: NavigationItem[] = [
  { to: '/', labelKey: 'nav.home', icon: Home, end: true },
  { to: '/map', labelKey: 'nav.map', icon: Map },
  { to: '/ranking', label: 'Рейтинг', icon: ListFilter },
  { to: '/risk-confidence', label: 'Риски', icon: ShieldAlert },
  { to: '/validation', label: 'Проверка', icon: BarChart3 },
  { to: '/compare', labelKey: 'nav.compare', icon: GitCompareArrows },
  { to: '/scenarios', labelKey: 'nav.scenarios', icon: ClipboardList },
]

const mobileNavigation: NavigationItem[] = primaryNavigation.filter((item) => (
  item.to === '/' || item.to === '/map' || item.to === '/ranking' || item.to === '/risk-confidence'
))

export function AppShell() {
  const location = useLocation()
  const { status } = useSmartPasture()
  const { language, setLanguage, t } = useI18n()
  const contentRef = useRef<HTMLElement | null>(null)
  const locationKey = `${location.pathname}${location.search}:${location.key}`
  const languageLocationKey = `${location.pathname}${location.search}`
  const routeTransitionKey = location.pathname
  const revealKey = `${location.pathname}:${status}`
  const [menuState, setMenuState] = useState({ open: false, locationKey: '' })
  const [languageMenuState, setLanguageMenuState] = useState({ open: false, locationKey: '' })
  const firstMenuLinkRef = useRef<HTMLAnchorElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const drawerRef = useRef<HTMLElement | null>(null)
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const menuOpen = menuState.open && menuState.locationKey === locationKey
  const isLanguageMenuOpen = languageMenuState.open && languageMenuState.locationKey === languageLocationKey
  const closeMenu = () => setMenuState({ open: false, locationKey: '' })
  const closeLanguageMenu = () => setLanguageMenuState({ open: false, locationKey: '' })
  const compactFooterRoutes = ['/map', '/ranking', '/risk-confidence']
  const compactFooter = compactFooterRoutes.some((route) => location.pathname.startsWith(route))
  const toggleMenu = () => {
    setMenuState((current) => (
      current.open && current.locationKey === locationKey
        ? { open: false, locationKey: '' }
        : { open: true, locationKey }
    ))
  }
  const toggleLanguageMenu = () => {
    setLanguageMenuState((current) => (
      current.open && current.locationKey === languageLocationKey
        ? { open: false, locationKey: '' }
        : { open: true, locationKey: languageLocationKey }
    ))
  }

  useRevealOnScroll(contentRef, revealKey)

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const previousFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const menuButtonElement = menuButtonRef.current
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    firstMenuLinkRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
        return
      }

      if (event.key === 'Tab') {
        const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )

        if (!focusableElements || focusableElements.length === 0) {
          return
        }

        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]
        const activeElement = document.activeElement

        if (event.shiftKey && activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      ;(previousFocusedElement ?? menuButtonElement)?.focus()
    }
  }, [menuOpen])

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        closeLanguageMenu()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLanguageMenu()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isLanguageMenuOpen])


  return (
    <div className={cx('shell', menuOpen && 'shell--menu-open')}>
      <header className="app-header">
        <NavLink to="/" className="brand-lockup" aria-label="SmartPasture">
          <img className="brand-lockup__logo" src={smartPastureLogo} alt="" />
          <span className="brand-lockup__text">
            <strong>{t('app.title')}</strong>
            <small>Предполевой гидрогеологический скрининг</small>
          </span>
        </NavLink>

        <nav className="app-header__nav" aria-label={t('nav.title')}>
          {primaryNavigation.map((item) => (
            <NavLink
              key={`header-${item.to}`}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx('header-nav-link', isActive && 'header-nav-link--active')}
            >
              <item.icon size={16} />
              <span>{item.label ?? (item.labelKey ? t(item.labelKey) : '')}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-header__right">
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

          <div ref={languageMenuRef} className={cx('language-switcher-mobile', isLanguageMenuOpen && 'language-switcher-mobile--open')}>
            <button
              type="button"
              className="language-switcher-mobile__toggle"
              aria-label={t('nav.languageSwitcher')}
              aria-expanded={isLanguageMenuOpen}
              aria-controls="language-switcher-mobile-menu"
              onClick={toggleLanguageMenu}
            >
              <Globe size={17} />
            </button>
            <div
              id="language-switcher-mobile-menu"
              className={cx('language-switcher-mobile__menu', isLanguageMenuOpen && 'language-switcher-mobile__menu--open')}
              role="menu"
              aria-label={t('nav.languageSwitcher')}
            >
              {LANGUAGES.map((item) => {
                const label = item === 'kk' ? 'Қазақша' : item === 'ru' ? 'Русский' : 'English'
                return (
                  <button
                    key={`mobile-${item}`}
                    type="button"
                    className={cx('language-switcher-mobile__option', language === item && 'language-switcher-mobile__option--active')}
                    role="menuitemradio"
                    aria-checked={language === item}
                    onClick={() => {
                      setLanguage(item as Language)
                      closeLanguageMenu()
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="menu-button menu-button--mobile"
            aria-label={t('nav.menuToggle')}
            aria-controls="primary-navigation"
            aria-expanded={menuOpen}
            onClick={toggleMenu}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <button
        type="button"
        className={cx('menu-backdrop', menuOpen && 'menu-backdrop--open')}
        aria-label={t('nav.closeMenu')}
        onClick={closeMenu}
      />

      <aside
        ref={drawerRef}
        id="primary-navigation"
        className={cx('nav-drawer', menuOpen && 'nav-drawer--open')}
        aria-label={t('nav.title')}
        aria-hidden={!menuOpen}
      >
        <div className="nav-drawer__header">
          <div className="brand-lockup brand-lockup--drawer">
            <img className="brand-lockup__logo" src={smartPastureLogo} alt="" />
            <span className="brand-lockup__text">
              <strong>{t('app.title')}</strong>
              <small>Предполевой гидрогеологический скрининг</small>
            </span>
          </div>
          <button type="button" className="icon-button" aria-label={t('nav.closeMenu')} onClick={closeMenu}>
            <X size={20} />
          </button>
        </div>

        <nav className="nav-drawer__links" aria-label={t('nav.title')}>
          {primaryNavigation.map((item, index) => (
            <NavLink
              key={item.to}
              ref={index === 0 ? firstMenuLinkRef : undefined}
              to={item.to}
              end={item.end}
              onClick={closeMenu}
              className={({ isActive }) => cx('drawer-link', isActive && 'drawer-link--active')}
            >
              <item.icon size={19} />
              <span>{item.label ?? (item.labelKey ? t(item.labelKey) : '')}</span>
            </NavLink>
          ))}
        </nav>


      </aside>

      <main ref={contentRef} className="shell__content">
        <Breadcrumb />
        <Suspense fallback={<LoadingPanel title={t('app.loadingRouteTitle')} message={t('app.loadingRouteMessage')} compact />}>
          <div key={routeTransitionKey} className="route-transition">
            <Outlet />
          </div>
        </Suspense>
      </main>

      <footer className={cx('app-footer', compactFooter && 'app-footer--compact')}>
        <div className="app-footer__content">
          <div className="app-footer__branding">
            {!compactFooter ? <img src={smartPastureLogo} alt="SmartPasture" className="app-footer__logo" /> : null}
            <div>
              <strong>SmartPasture</strong>
              <div>Инструмент поддержки решений для гидрогеологических служб</div>
              <div className="app-footer__copyright">© 2026 SmartPasture. Все права защищены.</div>
            </div>
          </div>
          <div className="app-footer__links">
            <NavLink to="/">Главная</NavLink>
            <NavLink to="/ranking">Рейтинг</NavLink>
            <NavLink to="/validation">Проверка</NavLink>
          </div>
        </div>
      </footer>

      <nav className="app-mobile-nav" aria-label={t('nav.mobile')}>
        {mobileNavigation.map((item) => (
          <NavLink
            key={`mobile-${item.to}`}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cx('app-mobile-nav__item', isActive && 'app-mobile-nav__item--active')}
          >
            <item.icon size={20} />
            <span>{item.label ?? (item.labelKey ? t(item.labelKey) : '')}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
