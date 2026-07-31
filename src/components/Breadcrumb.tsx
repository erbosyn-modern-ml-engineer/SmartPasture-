import { Link, useLocation, useParams } from 'react-router-dom'
import { useI18n } from '@/i18n/useI18n'

export type BreadcrumbItem = {
  label: string
  to?: string
}

type BreadcrumbProps = {
  items?: BreadcrumbItem[]
}

function formatSegment(segment: string): string {
  if (!segment) return ''
  const normalized = segment.replace(/-/g, ' ').trim()
  if (!normalized) return ''
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildAutoItems(pathname: string, siteId: string | undefined, t: (key: string) => string): BreadcrumbItem[] {
  if (pathname === '/' || pathname === '/map') return []

  if (pathname.startsWith('/site/')) {
    const siteLabel = siteId ? `${t('breadcrumb.site')} #${siteId}` : t('breadcrumb.site')
    return [{ label: 'Карта', to: '/map' }, { label: siteLabel }]
  }

  if (pathname.startsWith('/ranking')) {
    return [{ label: 'Карта', to: '/map' }, { label: 'Точки и ранжирование' }]
  }

  if (pathname.startsWith('/calculator')) {
    return [{ label: 'Карта', to: '/map' }, { label: 'Калькулятор воды' }]
  }

  if (pathname.startsWith('/compare')) {
    return [{ label: 'Карта', to: '/map' }, { label: 'Сравнить точки' }]
  }

  if (pathname.startsWith('/report')) {
    return [{ label: 'Главная', to: '/' }, { label: 'Отчёт и методология' }]
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 1) return []

  return [
    { label: t('nav.home'), to: '/' },
    { label: formatSegment(segments[segments.length - 1] ?? '') },
  ]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const location = useLocation()
  const { siteId } = useParams()
  const { t } = useI18n()
  const breadcrumbItems = items ?? buildAutoItems(location.pathname, siteId, t)

  if (breadcrumbItems.length <= 1) return null

  return (
    <nav className="breadcrumb" aria-label={t('breadcrumb.ariaLabel')}>
      <ol className="breadcrumb__list">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1
          return (
            <li key={`${item.label}-${item.to ?? index}`} className="breadcrumb__item">
              {item.to && !isLast ? (
                <Link className="breadcrumb__link" to={item.to}>{item.label}</Link>
              ) : (
                <span className="breadcrumb__current" aria-current={isLast ? 'page' : undefined}>{item.label}</span>
              )}
              {isLast ? null : <span className="breadcrumb__separator" aria-hidden="true">›</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
