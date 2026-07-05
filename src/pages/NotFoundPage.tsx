import { Link } from 'react-router-dom'
import { MapPinned } from 'lucide-react'
import { PageIntro, Panel, SectionTitle } from '@/components/ui'
import { useI18n } from '@/i18n/useI18n'

export function NotFoundPage() {
  const { t } = useI18n()

  return (
    <div className="page">
      <PageIntro
        eyebrow={t('notFound.eyebrow')}
        title={t('notFound.title')}
        subtitle={t('notFound.subtitle')}
        actions={<Link className="button button--primary" to="/map"><MapPinned size={16} />{t('notFound.mapCta')}</Link>}
      />

      <Panel tone="hero" data-reveal data-reveal-delay="20">
        <SectionTitle title={t('notFound.panelTitle')} subtitle={t('notFound.panelSubtitle')} />
        <div className="button-row">
          <Link className="button button--ghost" to="/">{t('notFound.homeCta')}</Link>
        </div>
      </Panel>
    </div>
  )
}
