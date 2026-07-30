import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSmartPasture } from '@/context/useSmartPasture'
import { actionLabel, confidenceColor, formatScore, priorityColor, priorityLabel, riskColor } from '@/lib/labels'
import {
  buildProbeCompareDifferences,
  probeCompareScore,
  probeNeedsHumanReview,
  probePreferredPoint,
  probeWhyPreferred,
} from '@/lib/probePlanning'
import { EmptyState, ErrorPanel, LoadingPanel, MetricCard, PageIntro, Panel, Pill, SectionTitle } from '@/components/ui'
import { useI18n } from '@/i18n/useI18n'
import type { Language } from '@/i18n/translations'
import type { SavedProbePoint } from '@/lib/types'

const MANUAL_REVIEW_THRESHOLD = 0.08

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

function localizedReason(reason: string, language: Language) {
  const map: Record<string, [string, string, string]> = {
    'Higher overall priority for the next drill check.': [
      'Келесі далалық тексеріс үшін жалпы басымдығы жоғары.',
      'Выше общий приоритет для следующей полевой проверки.',
      'Higher overall priority for the next field check.',
    ],
    'Stronger GIS context from roads, water, and landuse.': [
      'Жол, су және жер пайдалану бойынша GIS-контекст күштірек.',
      'Сильнее ГИС-контекст по дорогам, воде и землепользованию.',
      'Stronger GIS context from roads, water, and land use.',
    ],
    'Higher confidence on current evidence.': [
      'Қазіргі деректер бойынша сенімділік жоғары.',
      'Выше уверенность по текущим данным.',
      'Higher confidence on current evidence.',
    ],
    'Lower overall screening risk.': [
      'Алдын ала скрининг тәуекелі төмен.',
      'Ниже общий риск предварительного скрининга.',
      'Lower overall screening risk.',
    ],
    'Has full evidence with DEM-backed slope instead of partial evidence.': [
      'DEM арқылы расталған толық деректер бар.',
      'Есть полные данные с уклоном, подтверждённым DEM.',
      'Has full evidence with DEM-backed slope.',
    ],
  }
  const copy = map[reason]
  return copy ? text(language, copy[0], copy[1], copy[2]) : reason
}

function metricName(label: string, language: Language) {
  const labels: Record<string, [string, string, string]> = {
    Priority: ['Басымдық', 'Приоритет', 'Priority'],
    'GIS Context': ['GIS-контекст', 'ГИС-контекст', 'GIS context'],
    Confidence: ['Сенімділік', 'Уверенность', 'Confidence'],
    Risk: ['Тәуекел', 'Риск', 'Risk'],
    'Road km': ['Жолға дейін', 'До дороги', 'Road distance'],
    'Water km': ['Суға дейін', 'До воды', 'Water distance'],
  }
  const copy = labels[label]
  return copy ? text(language, copy[0], copy[1], copy[2]) : label
}

export function ComparePage() {
  const { status, error, savedProbePoints } = useSmartPasture()
  const { language } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()

  const left = useMemo(
    () => pointById(savedProbePoints, searchParams.get('left')) ?? savedProbePoints[0] ?? null,
    [savedProbePoints, searchParams],
  )
  const right = useMemo(() => {
    const selected = pointById(savedProbePoints, searchParams.get('right'))
    if (selected && selected.id !== left?.id) return selected
    return savedProbePoints.find((point) => point.id !== left?.id) ?? null
  }, [left?.id, savedProbePoints, searchParams])

  if (status === 'loading') {
    return <LoadingPanel title={text(language, 'Нүктелерді салыстыру', 'Сравнение точек', 'Compare points')} message={text(language, 'Сақталған нүктелер жүктелуде.', 'Загружаем сохранённые точки.', 'Loading saved points.')} />
  }
  if (status === 'error') {
    return <ErrorPanel title={text(language, 'Нүктелерді салыстыру', 'Сравнение точек', 'Compare points')} message={error ?? text(language, 'Деректер жүктелмеді.', 'Не удалось загрузить данные.', 'Failed to load data.')} />
  }

  if (savedProbePoints.length < 2 || !left || !right) {
    return (
      <Panel level="minimal">
        <EmptyState
          title={text(language, 'Салыстыруға кемі 2 нүкте керек', 'Для сравнения нужны минимум 2 точки', 'You need at least 2 saved points')}
          description={text(
            language,
            'Алдымен картадан немесе «Нүктелер» бөлімінен екі нүктені сақтаңыз.',
            'Сначала сохраните 2+ точки с карты или из раздела «Точки», затем вернитесь сюда.',
            'Save at least two points from the map or ranking first, then return here.',
          )}
        />
        <div className="button-row state-panel__actions">
          <Link className="button button--primary" to="/map">{text(language, 'Картаға өту', 'Перейти к карте', 'Open map')}</Link>
          <Link className="button button--secondary" to="/ranking">{text(language, 'Нүктелерді ашу', 'Открыть ранжирование', 'Open ranking')}</Link>
        </div>
      </Panel>
    )
  }

  const preferred = probePreferredPoint(left, right)
  const alternate = preferred?.id === left.id ? right : left
  const differences = buildProbeCompareDifferences(left, right)
  const scoreDelta = Math.abs(probeCompareScore(left) - probeCompareScore(right))
  const needsReview = probeNeedsHumanReview(left, right)
  const why = preferred
    ? probeWhyPreferred(preferred, alternate).map((reason) => localizedReason(reason, language))
    : [text(language, 'Нүктелердің қорытынды ұпайы тең.', 'Итоговые баллы точек практически равны.', 'The final scores are effectively tied.')]

  function updateSelection(key: 'left' | 'right', value: string) {
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="page page--compare">
      <PageIntro
        eyebrow={text(language, 'Сақталған нүктелер', 'Сохранённые точки', 'Saved points')}
        title={text(language, 'Екі нүктені салыстыру', 'Сравнить точки', 'Compare points')}
        subtitle={text(
          language,
          'Салыстыру картада сақталған нүктелер бойынша жүргізіледі.',
          'Сравнение работает по точкам, которые вы сохранили с карты или из ранжирования.',
          'Comparison uses points saved from the map or ranking.',
        )}
      />

      <div className="compare-top-grid">
        <Panel level="secondary" className="compare-selector-panel">
          <SectionTitle
            title={text(language, 'Нүктелерді таңдаңыз', 'Выберите точки', 'Choose points')}
            subtitle={text(language, 'Бір нүктені екі рет таңдауға болмайды.', 'Одна и та же точка не может стоять с обеих сторон.', 'The same point cannot be selected twice.')}
          />
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
          <SectionTitle
            title={preferred
              ? `${text(language, 'Ұсынылатын нүкте', 'Предпочтительная точка', 'Preferred point')}: ${preferred.name}`
              : text(language, 'Нәтиже тең', 'Результат практически равный', 'Effectively tied')}
            subtitle={needsReview
              ? text(
                language,
                `Айырмашылық ${scoreDelta.toFixed(3)}. 0,08-ден аз айырмашылық қолмен тексеріледі.`,
                `Разница итогового балла ${scoreDelta.toFixed(3)}. Если она меньше ${MANUAL_REVIEW_THRESHOLD.toFixed(2)}, нужна ручная проверка.`,
                `Final score difference: ${scoreDelta.toFixed(3)}. Differences below ${MANUAL_REVIEW_THRESHOLD.toFixed(2)} require manual review.`,
              )
              : text(language, 'Айырмашылық қолмен тексеру шегінен жоғары.', 'Разница выше порога ручной проверки.', 'The difference is above the manual-review threshold.')}
          />
        </Panel>
      </div>

      <div className="page-grid page-grid--split compare-site-grid">
        {[left, right].map((point) => {
          const isPreferred = preferred?.id === point.id
          return (
            <Panel key={point.id} className={`compare-site-card ${isPreferred ? 'compare-site-card--winner' : ''}`} level={isPreferred ? 'secondary' : 'minimal'}>
              <SectionTitle title={point.name} subtitle={`${point.cell.lat.toFixed(3)}, ${point.cell.lon.toFixed(3)}`} />
              <div className="button-row compare-site-card__meta">
                {isPreferred ? <Pill tone="selected">{text(language, 'Ұсынылады', 'Предпочтительно', 'Preferred')}</Pill> : null}
                <Pill tone={priorityTone(point.cell.scores.priority)} color={priorityColor(point.cell.scores.priority)}>
                  {priorityLabel(point.cell.scores.priority >= 0.7 ? 'high' : point.cell.scores.priority >= 0.4 ? 'medium' : 'low', language)}
                </Pill>
                <Pill tone={point.cell.evidenceLevel === 'full' ? 'confidence' : 'warning'}>
                  {point.cell.evidenceLevel === 'full' ? text(language, 'Толық деректер', 'Полные данные', 'Full evidence') : text(language, 'Жартылай деректер', 'Частичные данные', 'Partial evidence')}
                </Pill>
              </div>
              <div className="metric-grid compare-site-card__metrics">
                <MetricCard label={text(language, 'Басымдық', 'Приоритет', 'Priority')} value={formatScore(point.cell.scores.priority)} color={priorityColor(point.cell.scores.priority)} />
                <MetricCard label={text(language, 'GIS-контекст', 'ГИС-контекст', 'GIS context')} value={formatScore(point.cell.scores.contextScore)} color={priorityColor(point.cell.scores.contextScore)} />
                <MetricCard label={text(language, 'Тәуекел', 'Риск', 'Risk')} value={formatScore(point.cell.scores.risk)} color={riskColor(point.cell.scores.risk)} />
                <MetricCard label={text(language, 'Сенімділік', 'Уверенность', 'Confidence')} value={formatScore(point.cell.scores.confidence)} color={confidenceColor(point.cell.scores.confidence)} />
              </div>
              <div className="table-like">
                <div className="table-like__row"><span>{text(language, 'Әрекет', 'Действие', 'Action')}</span><strong>{actionLabel(point.cell.actionId, language)}</strong></div>
                <div className="table-like__row"><span>{text(language, 'Жолға дейін', 'До дороги', 'Road distance')}</span><strong>{point.cell.roadKm.toFixed(2)} км</strong></div>
                <div className="table-like__row"><span>{text(language, 'Суға дейін', 'До воды', 'Water distance')}</span><strong>{point.cell.waterKm.toFixed(2)} км</strong></div>
              </div>
            </Panel>
          )
        })}
      </div>

      <div className="page-grid page-grid--split compare-analysis-grid">
        <Panel level="secondary" className="compare-why-panel">
          <SectionTitle title={text(language, 'Неге күштірек', 'Почему точка сильнее', 'Why it is stronger')} />
          <ul className="bullet-list">{why.map((item) => <li key={item}>{item}</li>)}</ul>
        </Panel>

        <Panel level="minimal" className="compare-diff-panel">
          <SectionTitle
            title={text(language, 'Көрсеткіштер айырмасы', 'Различия по показателям', 'Metric differences')}
            subtitle={text(
              language,
              'Тәуекел мен қашықтық үшін төмен мән жақсы.',
              'Для риска и расстояний меньшее значение лучше.',
              'Lower values are better for risk and distances.',
            )}
          />
          <div className="compare-diff-list">
            {differences.map((difference) => (
              <article key={difference.label} className="compare-diff-row">
                <header className="compare-diff-row__head">
                  <span>{metricName(difference.label, language)}</span>
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
                <div className="compare-diff-row__labels"><small>{left.name}</small><small>{right.name}</small></div>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      <Panel tone="hero" className="compare-conclusion-panel">
        <SectionTitle
          title={text(language, 'Келесі қадам', 'Следующий шаг', 'Next step')}
          subtitle={needsReview
            ? text(language, 'Екі нүктені картада және далада тексеріңіз.', 'Не выбирайте автоматически: проверьте обе точки на карте и в поле.', 'Do not choose automatically: review both points on the map and in the field.')
            : text(language, 'Ұсынылған нүктені маршрутқа қосуға болады.', 'Предпочтительную точку можно добавить в маршрут первичной проверки.', 'The preferred point can be added to the first inspection route.')}
        />
        <div className="button-row compare-conclusion-panel__actions">
          <Link className="button button--secondary" to="/map">{text(language, 'Картаға қайту', 'Вернуться к карте', 'Back to map')}</Link>
          <Link className="button button--primary" to="/ranking">{text(language, 'Нүктелерді ашу', 'Открыть ранжирование', 'Open ranking')}</Link>
        </div>
      </Panel>
    </div>
  )
}
