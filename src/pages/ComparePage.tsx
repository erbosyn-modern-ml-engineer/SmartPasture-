import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSmartPasture } from '@/context/useSmartPasture'
import { actionLabel, confidenceColor, formatScore, priorityColor, priorityLabel, riskColor } from '@/lib/labels'
import { buildProbeCompareDifferences, probeNeedsHumanReview, probePreferredPoint, probeWhyPreferred } from '@/lib/probePlanning'
import { EmptyState, ErrorPanel, LoadingPanel, MetricCard, PageIntro, Panel, Pill, SectionTitle } from '@/components/ui'
import { useI18n } from '@/i18n/useI18n'
import type { Language, } from '@/i18n/translations'
import type { SavedProbePoint } from '@/lib/types'

function text(language: Language, kk: string, ru: string, en: string) {
  if (language === 'kk') return kk
  if (language === 'ru') return ru
  return en
}

function priorityTone(score: number) {
  if (score >= 0.7) return 'high' as const
  if (score >= 0.4) return 'medium' as const
  return 'low' as const
}

function pointById(points: SavedProbePoint[], id: string | null) {
  return points.find((point) => point.id === id) ?? null
}

export function ComparePage() {
  const { status, error, savedProbePoints } = useSmartPasture()
  const { language } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()

  const left = useMemo(() => pointById(savedProbePoints, searchParams.get('left')) ?? savedProbePoints[0] ?? null, [savedProbePoints, searchParams])
  const right = useMemo(() => {
    const selected = pointById(savedProbePoints, searchParams.get('right'))
    if (selected && selected.id !== left?.id) return selected
    return savedProbePoints.find((point) => point.id !== left?.id) ?? null
  }, [left?.id, savedProbePoints, searchParams])

  if (status === 'loading') return <LoadingPanel title="Wishlist compare" message="Loading saved points." />
  if (status === 'error') return <ErrorPanel title="Wishlist compare" message={error ?? 'Failed to load SmartPasture data'} />

  if (savedProbePoints.length < 2 || !left || !right) {
    return (
      <Panel level="minimal">
        <EmptyState title={text(language, 'Салыстыруға кемі 2 нүкте керек', 'Для сравнения нужны минимум 2 точки', 'You need at least 2 saved points to compare')} description={text(language, 'Алдымен картадан wishlist-ке екі нүкте сақтаңыз.', 'Сначала сохраните в wishlist хотя бы две точки с карты.', 'Save at least two points from the map into the wishlist first.')} />
        <div className="button-row state-panel__actions">
          <Link className="button button--primary" to="/map">Open map</Link>
        </div>
      </Panel>
    )
  }

  const preferred = probePreferredPoint(left, right)
  const alternate = preferred?.id === left.id ? right : left
  const differences = buildProbeCompareDifferences(left, right)
  const why = preferred ? probeWhyPreferred(preferred, alternate) : [text(language, 'Екі нүкте бір-біріне өте жақын, сондықтан manual review керек.', 'Две точки слишком близки по силе, поэтому нужен manual review.', 'The two points are too close in strength, so manual review is needed.')]
  const needsReview = probeNeedsHumanReview(left, right)

  function updateSelection(key: 'left' | 'right', value: string) {
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="page page--compare">
      <PageIntro
        eyebrow="Wishlist Compare"
        title={text(language, 'Wishlist нүктелерін салыстыру', 'Сравнение wishlist точек', 'Compare wishlist points')}
        subtitle={text(language, 'Салыстыру енді картадан сақталған және өзіңіз атау берген нүктелер бойынша жүреді.', 'Сравнение теперь идет по точкам, которые вы сохранили с карты и сами назвали.', 'Comparison now works from the points you saved from the map and named yourself.')}
      />

      <div className="compare-top-grid">
        <Panel level="secondary" className="compare-selector-panel">
          <SectionTitle title={text(language, 'Нүктелерді таңдаңыз', 'Выберите точки', 'Choose points')} subtitle={text(language, 'Compare тек wishlist points-пен жұмыс істейді.', 'Compare работает только по wishlist points.', 'Compare works only with wishlist points.')} />
          <div className="form-grid form-grid--scenario">
            <label className="field">
              <span>{text(language, 'Сол жақ', 'Левая точка', 'Left point')}</span>
              <select value={left.id} onChange={(event) => updateSelection('left', event.target.value)}>
                {savedProbePoints.map((point) => <option key={`left-${point.id}`} value={point.id}>{point.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{text(language, 'Оң жақ', 'Правая точка', 'Right point')}</span>
              <select value={right.id} onChange={(event) => updateSelection('right', event.target.value)}>
                {savedProbePoints.filter((point) => point.id !== left.id).map((point) => <option key={`right-${point.id}`} value={point.id}>{point.name}</option>)}
              </select>
            </label>
          </div>
        </Panel>

        <Panel tone="hero" className="compare-winner-panel">
          <SectionTitle title={preferred ? `${text(language, 'Артық нүкте', 'Предпочтительная точка', 'Preferred point')}: ${preferred.name}` : text(language, 'Нәтиже тең', 'Результат близок', 'Very close result')} subtitle={needsReview ? text(language, 'Айырмашылық аз немесе review керек.', 'Разница небольшая или нужен review.', 'The difference is small or a review is needed.') : text(language, 'Current evidence бойынша бұл нүкте күштілеу.', 'По текущему evidence эта точка выглядит сильнее.', 'This point looks stronger on current evidence.')} />
        </Panel>
      </div>

      <div className="page-grid page-grid--split compare-site-grid">
        {[left, right].map((point) => {
          const isPreferred = preferred?.id === point.id
          return (
            <Panel key={point.id} className={`compare-site-card ${isPreferred ? 'compare-site-card--winner' : ''}`} level={isPreferred ? 'secondary' : 'minimal'}>
              <SectionTitle title={point.name} subtitle={`${point.cell.lat.toFixed(3)}, ${point.cell.lon.toFixed(3)}`} />
              <div className="button-row compare-site-card__meta">
                {isPreferred ? <Pill tone="selected">{text(language, 'Артық', 'Предпочтительно', 'Preferred')}</Pill> : null}
                <Pill tone={priorityTone(point.cell.scores.priority)} color={priorityColor(point.cell.scores.priority)}>{priorityLabel(point.cell.scores.priority >= 0.7 ? 'high' : point.cell.scores.priority >= 0.4 ? 'medium' : 'low', language)}</Pill>
                <Pill tone={point.cell.evidenceLevel === 'full' ? 'confidence' : 'warning'}>{point.cell.evidenceLevel}</Pill>
              </div>
              <div className="metric-grid compare-site-card__metrics">
                <MetricCard label="Priority" value={formatScore(point.cell.scores.priority)} color={priorityColor(point.cell.scores.priority)} />
                <MetricCard label="GIS Context" value={formatScore(point.cell.scores.contextScore)} color={priorityColor(point.cell.scores.contextScore)} />
                <MetricCard label="Risk" value={formatScore(point.cell.scores.risk)} color={riskColor(point.cell.scores.risk)} />
                <MetricCard label="Confidence" value={formatScore(point.cell.scores.confidence)} color={confidenceColor(point.cell.scores.confidence)} />
              </div>
              <div className="table-like">
                <div className="table-like__row"><span>Action</span><strong>{actionLabel(point.cell.actionId, language)}</strong></div>
                <div className="table-like__row"><span>Road</span><strong>{point.cell.roadKm.toFixed(2)} km</strong></div>
                <div className="table-like__row"><span>Water</span><strong>{point.cell.waterKm.toFixed(2)} km</strong></div>
              </div>
            </Panel>
          )
        })}
      </div>

      <div className="page-grid page-grid--split compare-analysis-grid">
        <Panel level="secondary" className="compare-why-panel">
          <SectionTitle title={text(language, 'Неге артық', 'Почему точка сильнее', 'Why it is stronger')} />
          <ul className="bullet-list">
            {why.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Panel>

        <Panel level="minimal" className="compare-diff-panel">
          <SectionTitle title={text(language, 'Айырмашылықтар', 'Различия', 'Differences')} subtitle={needsReview ? text(language, 'Decision close enough for manual review.', 'Результат достаточно близок для manual review.', 'The result is close enough to justify manual review.') : undefined} />
          <div className="compare-diff-list">
            {differences.map((difference) => (
              <article key={difference.label} className="compare-diff-row">
                <header className="compare-diff-row__head">
                  <span>{difference.label}</span>
                  <strong>{formatScore(difference.left)} / {formatScore(difference.right)}</strong>
                </header>
                <div className="compare-diff-row__bars">
                  <div className={`compare-diff-row__track ${difference.winner === 'left' ? 'compare-diff-row__track--win' : ''}`}>
                    <i className="compare-diff-row__fill" style={{ width: `${Math.max(12, (difference.left / Math.max(difference.left, difference.right, 0.001)) * 100)}%` }} />
                  </div>
                  <div className={`compare-diff-row__track ${difference.winner === 'right' ? 'compare-diff-row__track--win' : ''}`}>
                    <i className="compare-diff-row__fill" style={{ width: `${Math.max(12, (difference.right / Math.max(difference.left, difference.right, 0.001)) * 100)}%` }} />
                  </div>
                </div>
                <div className="compare-diff-row__labels">
                  <small>{left.name}</small>
                  <small>{right.name}</small>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      <Panel tone="hero" className="compare-conclusion-panel">
        <SectionTitle title={text(language, 'Келесі қадам', 'Следующий шаг', 'Next step')} subtitle={text(language, 'Compare-ден кейін shortlist-ті scenario бетінде фильтрлеуге болады.', 'После compare можно фильтровать shortlist на странице scenario.', 'After compare, you can filter the shortlist on the scenario page.')} />
        <div className="button-row compare-conclusion-panel__actions">
          <Link className="button button--secondary" to="/map">Back to map</Link>
          <Link className="button button--primary" to="/scenarios">Open scenario</Link>
        </div>
      </Panel>
    </div>
  )
}
