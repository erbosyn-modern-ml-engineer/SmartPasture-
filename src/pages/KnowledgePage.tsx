import { AlertTriangle, Droplets, ShieldCheck, Sprout, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { methodologyImage } from '@/assets/smartpasture'
import { useSmartPasture } from '@/context/useSmartPasture'
import { ErrorPanel, LoadingPanel, PageIntro, Panel, Pill, SectionTitle } from '@/components/ui'
import { useI18n } from '@/i18n/useI18n'
import { localizeKnowledgeParameter, localizeKnowledgeSources } from '@/i18n/translations'

export function KnowledgePage() {
  const { status, data, error } = useSmartPasture()
  const { language, t } = useI18n()

  if (status === 'loading' || !data) {
    return <LoadingPanel title={t('knowledge.loading')} message={t('knowledge.loadingMessage')} />
  }

  if (status === 'error') {
    return <ErrorPanel title={t('common.errorTitle')} message={error ?? t('knowledge.error')} />
  }

  const architectureItems = [
    { icon: Droplets, title: t('home.hydroTitle'), body: t('home.hydroBody'), color: '#0d6f83' },
    { icon: Sprout, title: t('home.pastureTitle'), body: t('home.pastureBody'), color: '#2f7d53' },
    { icon: AlertTriangle, title: t('common.risk'), body: t('home.riskCardBody'), color: '#a96d2f' },
    { icon: ShieldCheck, title: t('common.confidence'), body: t('home.confidenceCardBody'), color: '#356f92' },
    { icon: Target, title: t('knowledge.recommendation'), body: t('knowledge.recommendationValue'), color: '#14532d' },
  ]

  return (
    <div className="page page--methodology">
      <PageIntro
        eyebrow={t('knowledge.eyebrow')}
        title={t('knowledge.title')}
        subtitle={t('knowledge.subtitle')}
        actions={<Link className="button button--secondary" to="/map">{t('common.openMap')}</Link>}
      />

      <section className="methodology-hero methodology-truth-grid" data-reveal data-reveal-delay="20">
        <Panel className="methodology-hero__copy methodology-truth-panel" level="secondary" tone="hero">
          <SectionTitle title={t('knowledge.methodTitle')} subtitle={t('knowledge.methodSub')} />
          <div className="table-like">
            <div className="table-like__row"><span>{t('knowledge.does')}</span><strong>{t('knowledge.doesValue')}</strong></div>
            <div className="table-like__row"><span>{t('knowledge.doesNot')}</span><strong>{t('knowledge.doesNotValue')}</strong></div>
            <div className="table-like__row"><span>{t('knowledge.users')}</span><strong>{t('knowledge.usersValue')}</strong></div>
          </div>
          <div className="button-row methodology-truth-panel__chips">
            <Pill tone="selected">{t('home.chipExplainable')}</Pill>
            <Pill tone="warning">{t('home.oracleTitle')}</Pill>
            <Pill tone="confidence">{t('home.chipField')}</Pill>
          </div>
        </Panel>
        <div className="methodology-hero__image">
          <img src={methodologyImage} alt="" loading="lazy" />
        </div>
      </section>

      <Panel className="methodology-architecture-panel" level="secondary" data-reveal data-reveal-delay="50">
        <SectionTitle title={t('knowledge.scoringTitle')} subtitle={t('knowledge.scoringSub')} />
        <div className="methodology-architecture-grid">
          {architectureItems.map((item) => (
            <article key={item.title} className="methodology-architecture-item">
              <item.icon size={18} style={{ color: item.color }} />
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </Panel>

      <div className="knowledge-flow methodology-flow" data-reveal data-reveal-delay="80">
        <Panel className="knowledge-flow__item" level="minimal">
          <span>01</span>
          <strong>{t('knowledge.sources')}</strong>
          <p>{t('knowledge.sourcesSub')}</p>
        </Panel>
        <Panel className="knowledge-flow__item" level="minimal">
          <span>02</span>
          <strong>{t('knowledge.flowScores')}</strong>
          <p>{t('knowledge.flowScoresBody')}</p>
        </Panel>
        <Panel className="knowledge-flow__item" level="minimal">
          <span>03</span>
          <strong>{t('knowledge.flowField')}</strong>
          <p>{t('knowledge.remember3')}</p>
        </Panel>
      </div>

      <Panel className="method-card" level="minimal" data-reveal data-reveal-delay="110">
          <SectionTitle title={t('knowledge.remember')} subtitle={t('knowledge.rememberSub')} />
          <ul className="bullet-list">
            <li>{t('knowledge.remember1')}</li>
            <li>{t('knowledge.remember2')}</li>
            <li>{t('knowledge.remember3')}</li>
            <li>{t('knowledge.remember4')}</li>
          </ul>
        </Panel>

      <Panel level="secondary" data-reveal data-reveal-delay="130">
          <SectionTitle title={t('knowledge.sources')} subtitle={t('knowledge.sourcesSub')} />
          <ul className="bullet-list">
            {localizeKnowledgeSources(language, data.knowledge.sources).map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </Panel>

      <div className="list-grid methodology-parameter-grid" data-reveal data-reveal-delay="150">
        {data.knowledge.parameters.map((rawParameter) => {
          const parameter = localizeKnowledgeParameter(rawParameter, language)
          return (
            <Panel key={parameter.num} className="knowledge-card" level="minimal">
              <SectionTitle title={`${parameter.icon} ${parameter.name}`} subtitle={parameter.description} />
              <div className="button-row">
                <Pill color={parameter.color}>{parameter.limit}</Pill>
                <Pill color={parameter.color}>{parameter.source}</Pill>
              </div>
              <div className="table-like">
                {parameter.table.map((row) => (
                  <div key={`${parameter.name}-${row.range}`} className="table-like__row">
                    <span>{row.range}</span>
                    <strong>{row.score}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
