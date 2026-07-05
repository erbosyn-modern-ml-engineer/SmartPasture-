import { Link, useParams } from 'react-router-dom'
import { useSmartPasture } from '@/context/useSmartPasture'
import { actionLabel, confidenceLabel, formatScore, metricLabel, priorityColor, priorityLabel, riskLabel } from '@/lib/labels'
import { BulletList, ErrorPanel, LoadingPanel, MetricCard, PageIntro, Panel, Pill, SectionTitle } from '@/components/ui'
import { HowScoringWorks } from '@/components/HowScoringWorks'
import { useI18n } from '@/i18n/useI18n'
import { localizeCompareExample, localizeSite } from '@/i18n/translations'

function priorityTone(band: 'high' | 'medium' | 'low' | 'unknown') {
  return band === 'unknown' ? 'warning' : band
}

export function SiteDetailPage() {
  const params = useParams()
  const siteId = Number(params.siteId)
  const { status, data, error, pinnedSiteIds, togglePinnedSite } = useSmartPasture()
  const { language, t } = useI18n()

  if (status === 'loading' || !data) {
    return <LoadingPanel title={t('site.loading')} message={t('site.loadingMessage')} />
  }

  if (status === 'error') {
    return <ErrorPanel title={t('common.errorTitle')} message={error ?? t('site.error')} />
  }

  const rawSite = data.siteById[siteId]
  if (!rawSite) {
    return <ErrorPanel title={t('site.notFound')} message={t('site.notFoundBody')} />
  }

  const site = localizeSite(rawSite, language)
  const isPinned = pinnedSiteIds.includes(site.siteId)
  const relatedCompare = data.compare.examples
    .filter((example) => example.left.siteId === site.siteId || example.right.siteId === site.siteId)
    .map((example) => localizeCompareExample(example, language))
  const coreMetricCards = [
    {
      label: t('common.priority'),
      value: formatScore(site.priorityScore),
      color: priorityColor(site.priorityScore),
    },
    ...site.metrics.map((metric) => ({
      label: metricLabel(metric.label, language),
      value: formatScore(metric.value),
      color: metric.color,
    })),
  ]

  return (
    <div className="page page--site">
      <PageIntro
        eyebrow={t('site.eyebrow')}
        title={site.title}
        subtitle={`${site.district}. ${actionLabel(site.actionId, language)}. ${site.confidenceNote}`}
        actions={<Link className="button button--ghost" to="/map">{t('common.backMap')}</Link>}
      />

      <section className="site-brief-grid" data-reveal data-reveal-delay="20">
        <Panel tone="hero" className="site-brief-panel">
          <SectionTitle title={t('site.summary')} subtitle={site.summary ?? t('site.summaryFallback')} />
          <div className="button-row site-brief-panel__status">
            <Pill tone={priorityTone(site.priorityBand)} color={priorityColor(site.priorityScore)}>{priorityLabel(site.priorityBand, language)}</Pill>
            <Pill tone="selected" color="#14532d">{actionLabel(site.actionId, language)}</Pill>
            {site.isBorderline ? <Pill tone="warning" color="#d59b17">{t('site.borderline')}</Pill> : null}
          </div>
          <p className="site-brief-panel__recommendation">{site.actionSummary.summary}</p>
          <div className="button-row site-brief-panel__actions">
            <button type="button" className={`button ${isPinned ? 'button--selected' : 'button--primary'}`} aria-pressed={isPinned} onClick={() => togglePinnedSite(site.siteId)}>
              {isPinned ? t('site.removePinned') : t('site.addPinned')}
            </button>
          </div>
        </Panel>

        <Panel className="site-confidence-panel" level="secondary">
          <SectionTitle title={t('site.uncertaintyTitle')} subtitle={t('site.decisionSnapshot')} />
          <div className="table-like">
            <div className="table-like__row"><span>{t('common.risk')}</span><strong>{riskLabel(site.riskBand, language)}</strong></div>
            <div className="table-like__row"><span>{t('common.confidence')}</span><strong>{confidenceLabel(site.confidenceBand, language)}</strong></div>
            <div className="table-like__row"><span>{t('site.nextAction')}</span><strong>{actionLabel(site.actionId, language)}</strong></div>
            <div className="table-like__row"><span>{t('common.priority')}</span><strong>{formatScore(site.priorityScore)}</strong></div>
            <div className="table-like__row"><span>{t('common.score')}</span><strong>HPS {formatScore(site.scores.hps)} / PNS {formatScore(site.scores.pns)}</strong></div>
          </div>
        </Panel>
      </section>

      <Panel className="site-metric-panel" level="secondary" data-reveal data-reveal-delay="50">
        <SectionTitle title={t('site.metrics')} subtitle={t('site.metricsSub')} />
        <div className="metric-grid site-metric-panel__grid site-metric-panel__grid--expanded">
          {coreMetricCards.map((metric, index) => (
            <MetricCard
              key={`${site.siteId}-core-${index}`}
              label={metric.label}
              value={metric.value}
              color={metric.color}
            />
          ))}
        </div>
      </Panel>

      <HowScoringWorks className="site-scoring-help" />

      <div className="page-grid page-grid--split site-rationale-grid" data-reveal data-reveal-delay="80">
        <Panel level="secondary" className="site-rationale-panel">
          <SectionTitle title={t('site.positive')} subtitle={t('site.positiveSub')} />
          <BulletList items={site.positiveReasons} emptyText={t('site.noSupport')} />
        </Panel>

        <Panel level="minimal" className="site-rationale-panel site-rationale-panel--caution">
          <SectionTitle title={t('site.caution')} subtitle={t('site.cautionSub')} />
          <BulletList items={site.cautionReasons} emptyText={t('site.noCaution')} />
        </Panel>
      </div>
      <div className="site-operational-grid" data-reveal data-reveal-delay="110">
        <Panel level="secondary" className="site-next-steps-panel">
          <SectionTitle title={t('site.steps')} subtitle={t('site.stepsSub')} />
          <BulletList items={site.nextSteps} emptyText={t('site.noSteps')} />
        </Panel>
      </div>
      {relatedCompare.length ? (
        <Panel level="minimal" data-reveal data-reveal-delay="140">
          <SectionTitle title={t('site.related')} subtitle={t('site.relatedSub')} />
          <div className="chip-row">
            {relatedCompare.map((example) => (
              <Link key={example.id} className="chip chip--link" to={`/compare?example=${example.id}`}>
                {example.title}
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  )
}
