import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { ClassicMlPanel } from '@/components/ClassicMlPanel'
import {
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  MetricCard,
  PageIntro,
  Panel,
  Pill,
  SectionTitle,
} from '@/components/ui'
import { useSmartPasture } from '@/context/useSmartPasture'
import { env } from '@/lib/env'
import { loadGisProbeDataset, prettifyProbeClass } from '@/lib/gisProbe'
import { loadClassicMlModel, predictWaterSuccess, type ClassicMlModel, type MlWaterPrediction } from '@/lib/classicMl'
import {
  buildFullMapScenarioCandidates,
  findSavedPointForScenarioCandidate,
  runProbeScenario,
  saveScenarioCandidateToWishlist,
  type ProbeEvidenceFilter,
  type ProbeScenarioActionFilter,
  type ProbeScenarioProfileKey,
} from '@/lib/probePlanning'
import {
  actionLabel,
  confidenceColor,
  priorityColor,
  priorityLabel,
  riskColor,
  riskLabel,
} from '@/lib/labels'
import type { ActionId, GisProbeCell, GisProbeDataset, ProbeScenarioCandidate } from '@/lib/types'

type RankingFilters = {
  topN: number
  minPriority: number
  maxRisk: number
  minConfidence: number
  actionId: ProbeScenarioActionFilter
  evidenceLevel: ProbeEvidenceFilter
  profile: ProbeScenarioProfileKey
}

const MAP_MARKER_COUNT = 140
const DEFAULT_FILTERS: RankingFilters = {
  topN: 12,
  minPriority: 0.65,
  maxRisk: 0.45,
  minConfidence: 0.45,
  actionId: 'all',
  evidenceLevel: 'all',
  profile: 'balanced',
}

const ACTION_OPTIONS: ActionId[] = [
  'INSPECT_FIRST',
  'INSPECT_WITH_QUICK_VERIFICATION',
  'HUMAN_REVIEW_REQUIRED',
  'DEFER',
  'NOT_RECOMMENDED_CURRENT_EVIDENCE',
]

function scorePercent(score: number) {
  return String(Math.round(score * 100))
}

function percentLabel(score: number) {
  return `${Math.round(score * 100)}%`
}

function formatKm(value: number) {
  if (value < 1) return `${Math.round(value * 1000)} м`
  if (value < 10) return `${value.toFixed(1)} км`
  return `${Math.round(value)} км`
}

function formatMaybeMetric(value: number | null, suffix: string, empty = 'нет данных') {
  if (value === null) return empty
  return `${value.toFixed(value < 10 ? 1 : 0)}${suffix}`
}

function priorityTone(score: number) {
  if (score >= 0.7) return 'high' as const
  if (score >= 0.4) return 'medium' as const
  return 'low' as const
}

function riskTone(score: number) {
  if (score >= 0.65) return 'danger' as const
  if (score >= 0.4) return 'warning' as const
  return 'high' as const
}

function evidenceTone(level: GisProbeCell['evidenceLevel']) {
  return level === 'full' ? 'confidence' as const : 'warning' as const
}

function evidenceLabel(level: GisProbeCell['evidenceLevel']) {
  return level === 'full' ? 'Данные полные' : 'Данные частичные'
}

function contextLabel(label: GisProbeCell['contextScoreLabel']) {
  if (label === 'favorable') return 'Благоприятные условия'
  if (label === 'mixed') return 'Смешанные условия'
  return 'Ограниченные условия'
}

function landuseLabel(value: string) {
  if (value === 'open_steppe') return 'открытая степь'
  if (value === 'grass') return 'травянистая зона'
  if (value === 'cropland') return 'пашня'
  if (value === 'residential') return 'населенный пункт'
  return prettifyProbeClass(value).toLowerCase()
}

function riskBand(score: number) {
  if (score >= 0.65) return 'high'
  if (score >= 0.4) return 'medium'
  return 'low'
}

function filterLabel(filters: RankingFilters) {
  const parts = [
    `приоритет от ${scorePercent(filters.minPriority)}`,
    `риск до ${scorePercent(filters.maxRisk)}`,
    `уверенность от ${scorePercent(filters.minConfidence)}`,
  ]

  if (filters.evidenceLevel === 'full') parts.push('только полные данные')
  if (filters.evidenceLevel === 'partial') parts.push('только частичные данные')
  if (filters.actionId !== 'all') parts.push(actionLabel(filters.actionId, 'ru').toLowerCase())

  return parts.join(' • ')
}

function recommendationText(actionId: ActionId) {
  if (actionId === 'INSPECT_FIRST') {
    return 'Поставить в первую очередь для рекогносцировки и быстрой полевой проверки.'
  }
  if (actionId === 'INSPECT_WITH_QUICK_VERIFICATION') {
    return 'Проверить после лидеров рейтинга или включить в маршрут как резервную точку.'
  }
  if (actionId === 'HUMAN_REVIEW_REQUIRED') {
    return 'Перед выездом нужен ручной просмотр карты и архивных материалов специалистом.'
  }
  if (actionId === 'DEFER') {
    return 'Отложить до появления дополнительных данных или более сильной потребности в воде.'
  }
  if (actionId === 'NOT_RECOMMENDED_CURRENT_EVIDENCE') {
    return 'Не рассматривать как приоритетную точку по текущим данным.'
  }
  return 'Нужна дополнительная проверка.'
}

function defaultCandidateName(candidate: ProbeScenarioCandidate, rank?: number) {
  return rank ? `Кандидат #${rank}` : `Точка ${candidate.lat.toFixed(3)}, ${candidate.lon.toFixed(3)}`
}

function buildCandidateReasons(cell: GisProbeCell) {
  const positive: string[] = []
  const caution: string[] = []

  if (cell.scores.priority >= 0.75) positive.push('Высокий общий приоритет по природным условиям и доступности.')
  if (cell.scores.contextScore >= 0.72) positive.push('GIS-контекст выглядит сильным для первичной проверки.')
  if (cell.roadKm <= 2) positive.push('Рядом есть дорожный доступ, выезд проще спланировать.')
  if (cell.waterKm <= 2 && !cell.insideWater) positive.push('Поверхностная вода рядом, это усиливает контекст обследования.')
  if (cell.hasDem) positive.push('Есть DEM-данные, поэтому рельеф учтен точнее.')
  if (cell.scores.confidence >= 0.7) positive.push('Уверенность высокая: ключевые слои доступны.')

  if (!cell.hasDem) caution.push('Нет DEM-покрытия: уклон и высота не подтверждены для этой ячейки.')
  if (cell.evidenceLevel === 'partial') caution.push('Часть слоев отсутствует, поэтому вывод нужно подтвердить специалисту.')
  if (cell.insideWater) caution.push('Точка попадает в водный полигон, ее нельзя трактовать как место бурения.')
  if (cell.roadKm > 8) caution.push('Далеко от дороги, выезд может быть дороже и сложнее.')
  if (cell.waterKm > 10) caution.push('Поверхностная вода далеко, практический риск выше.')
  if (cell.scores.risk >= 0.4) caution.push('Риск выше среднего, нужна дополнительная проверка до выезда.')
  if (cell.scores.confidence < 0.45) caution.push('Низкая уверенность из-за ограниченного качества данных.')

  return {
    positive: positive.slice(0, 4),
    caution: caution.slice(0, 4),
  }
}

function CandidateMapViewport({
  dataset,
  selectedCandidate,
}: {
  dataset: GisProbeDataset
  selectedCandidate: ProbeScenarioCandidate | null
}) {
  const map = useMap()

  useEffect(() => {
    if (selectedCandidate) {
      map.flyTo([selectedCandidate.lat, selectedCandidate.lon], Math.max(map.getZoom(), 8), { duration: 0.65 })
      return
    }

    map.fitBounds(
      [
        [dataset.bounds.minLat, dataset.bounds.minLon],
        [dataset.bounds.maxLat, dataset.bounds.maxLon],
      ],
      { padding: [24, 24] },
    )
  }, [dataset.bounds.maxLat, dataset.bounds.maxLon, dataset.bounds.minLat, dataset.bounds.minLon, map, selectedCandidate])

  return null
}

function RankingLegend() {
  return (
    <div className="ranking-map-legend" aria-label="Легенда рейтинга">
      <span><i className="ranking-dot ranking-dot--high" /> высокий приоритет</span>
      <span><i className="ranking-dot ranking-dot--medium" /> средний</span>
      <span><i className="ranking-dot ranking-dot--low" /> низкий</span>
    </div>
  )
}

function PriorityBar({ score }: { score: number }) {
  return (
    <div className="ranking-priority-bar" aria-hidden="true">
      <span style={{ width: `${scorePercent(score)}%`, background: priorityColor(score) }} />
    </div>
  )
}

function SelectedCandidatePanel({
  candidate,
  rank,
  saved,
  onSave,
  mlPrediction,
  mlModel,
  mlLoading,
  mlError,
}: {
  candidate: ProbeScenarioCandidate | null
  rank?: number
  saved: boolean
  onSave: () => void
  mlPrediction: MlWaterPrediction | null
  mlModel: ClassicMlModel | null
  mlLoading: boolean
  mlError: string | null
}) {
  if (!candidate) {
    return (
      <Panel level="minimal" className="ranking-selected-panel">
        <EmptyState
          title="Точка не выбрана"
          description="Нажмите на маркер на карте или строку в рейтинге."
          compact
        />
      </Panel>
    )
  }

  const cell = candidate.cell
  const reasons = buildCandidateReasons(cell)
  const priorityBand = priorityTone(cell.scores.priority)
  const title = defaultCandidateName(candidate, rank)

  return (
    <Panel level="secondary" tone="hero" className="ranking-selected-panel">
      <SectionTitle
        title={title}
        subtitle={`${candidate.lat.toFixed(3)}, ${candidate.lon.toFixed(3)} • ${landuseLabel(cell.landuseClass)}`}
      />

      <div className="button-row ranking-selected-pills">
        <Pill tone={priorityBand} color={priorityColor(cell.scores.priority)}>
          {priorityLabel(priorityBand, 'ru')}
        </Pill>
        <Pill tone={riskTone(cell.scores.risk)} color={riskColor(cell.scores.risk)}>
          {riskLabel(riskBand(cell.scores.risk), 'ru')}
        </Pill>
        <Pill tone={evidenceTone(cell.evidenceLevel)}>
          {evidenceLabel(cell.evidenceLevel)}
        </Pill>
      </div>

      <div className="ranking-score-card">
        <div className="ranking-score-card__head">
          <span>Приоритет для выезда</span>
          <strong>{scorePercent(cell.scores.priority)}/100</strong>
        </div>
        <PriorityBar score={cell.scores.priority} />
        <p>{recommendationText(cell.actionId)}</p>
      </div>

      <ClassicMlPanel
        prediction={mlPrediction}
        model={mlModel}
        loading={mlLoading}
        error={mlError}
        compact
        title="Classic ML прогноз"
      />

      <div className="metric-grid ranking-selected-metrics">
        <MetricCard label="Риск" value={scorePercent(cell.scores.risk)} color={riskColor(cell.scores.risk)} helper="/100" />
        <MetricCard label="Уверенность" value={scorePercent(cell.scores.confidence)} color={confidenceColor(cell.scores.confidence)} helper="/100" />
        <MetricCard label="До воды" value={formatKm(cell.waterKm).replace(' км', '').replace(' м', '')} color="#177a8a" helper={cell.waterKm < 1 ? 'м' : 'км'} />
        <MetricCard label="До дороги" value={formatKm(cell.roadKm).replace(' км', '').replace(' м', '')} color="#1f9d63" helper={cell.roadKm < 1 ? 'м' : 'км'} />
      </div>

      <div className="ranking-reason-grid">
        <div>
          <strong>Почему выше в рейтинге</strong>
          <ul className="bullet-list">
            {(reasons.positive.length ? reasons.positive : ['Показатели точки проходят выбранные фильтры.']).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <strong>Что проверить</strong>
          <ul className="bullet-list">
            {(reasons.caution.length ? reasons.caution : ['Существенных ограничений по текущим слоям не выявлено.']).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div className="table-like">
        <div className="table-like__row"><span>Действие</span><strong>{actionLabel(cell.actionId, 'ru')}</strong></div>
        <div className="table-like__row"><span>Контекст</span><strong>{contextLabel(cell.contextScoreLabel)}</strong></div>
        <div className="table-like__row"><span>Высота</span><strong>{formatMaybeMetric(cell.elevationM, ' м')}</strong></div>
        <div className="table-like__row"><span>Уклон</span><strong>{formatMaybeMetric(cell.slopePct, '%')}</strong></div>
      </div>

      <div className="button-row">
        <button type="button" className="button button--primary" onClick={onSave} disabled={saved}>
          {saved ? 'Уже сохранено' : 'Сохранить в сравнение'}
        </button>
        <Link className="button button--secondary" to="/compare">Открыть сравнение</Link>
      </div>
    </Panel>
  )
}

export function RankingPage() {
  const { status, error, savedProbePoints, saveProbePoint } = useSmartPasture()
  const [dataset, setDataset] = useState<GisProbeDataset | null>(null)
  const [datasetError, setDatasetError] = useState<string | null>(null)
  const [filters, setFilters] = useState<RankingFilters>(DEFAULT_FILTERS)
  const [selectedCandidate, setSelectedCandidate] = useState<ProbeScenarioCandidate | null>(null)
  const [mlModel, setMlModel] = useState<ClassicMlModel | null>(null)
  const [mlLoading, setMlLoading] = useState(true)
  const [mlError, setMlError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadGisProbeDataset()
      .then((payload) => {
        if (cancelled) return
        setDataset(payload)
        setDatasetError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setDatasetError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить GIS-сетку')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadClassicMlModel()
      .then((model) => {
        if (cancelled) return
        setMlModel(model)
        setMlError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setMlError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить ML-модель')
      })
      .finally(() => {
        if (!cancelled) setMlLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const allCandidates = useMemo(
    () => (dataset ? buildFullMapScenarioCandidates(dataset) : []),
    [dataset],
  )

  const shortlistResult = useMemo(() => runProbeScenario(allCandidates, {
    sourceMode: 'full_map',
    query: '',
    topN: filters.topN,
    minPriority: filters.minPriority,
    maxRisk: filters.maxRisk,
    minConfidence: filters.minConfidence,
    actionId: filters.actionId,
    evidenceLevel: filters.evidenceLevel,
    profile: filters.profile,
  }), [allCandidates, filters])

  const mapResult = useMemo(() => runProbeScenario(allCandidates, {
    sourceMode: 'full_map',
    query: '',
    topN: MAP_MARKER_COUNT,
    minPriority: filters.minPriority,
    maxRisk: filters.maxRisk,
    minConfidence: filters.minConfidence,
    actionId: filters.actionId,
    evidenceLevel: filters.evidenceLevel,
    profile: filters.profile,
  }), [allCandidates, filters])

  const selectedRank = useMemo(() => {
    if (!selectedCandidate) return undefined
    const index = shortlistResult.shortlist.findIndex((candidate) => candidate.id === selectedCandidate.id)
    return index >= 0 ? index + 1 : undefined
  }, [selectedCandidate, shortlistResult.shortlist])

  const savedSelected = useMemo(
    () => (selectedCandidate ? !!findSavedPointForScenarioCandidate(savedProbePoints, selectedCandidate) : false),
    [savedProbePoints, selectedCandidate],
  )

  const highConfidenceCount = useMemo(
    () => shortlistResult.shortlist.filter((candidate) => candidate.cell.scores.confidence >= 0.7).length,
    [shortlistResult.shortlist],
  )

  const selectedMlPrediction = useMemo(
    () => (selectedCandidate && mlModel ? predictWaterSuccess(selectedCandidate.cell, mlModel) : null),
    [mlModel, selectedCandidate],
  )

  useEffect(() => {
    if (mapResult.shortlist.length === 0) {
      setSelectedCandidate(null)
      return
    }

    if (!selectedCandidate || !mapResult.shortlist.some((candidate) => candidate.id === selectedCandidate.id)) {
      setSelectedCandidate(shortlistResult.shortlist[0] ?? mapResult.shortlist[0] ?? null)
    }
  }, [mapResult.shortlist, selectedCandidate, shortlistResult.shortlist])

  if (status === 'loading') {
    return <LoadingPanel title="Рейтинг точек" message="Загружаем SmartPasture." />
  }

  if (status === 'error') {
    return <ErrorPanel title="Рейтинг точек" message={error ?? 'Не удалось загрузить SmartPasture.'} />
  }

  if (datasetError) {
    return <ErrorPanel title="Рейтинг точек" message={datasetError} />
  }

  if (!dataset) {
    return <LoadingPanel title="Рейтинг точек" message="Загружаем GIS-сетку области." />
  }

  const center: [number, number] = [
    (dataset.bounds.minLat + dataset.bounds.maxLat) / 2,
    (dataset.bounds.minLon + dataset.bounds.maxLon) / 2,
  ]

  function setPreset(nextFilters: Partial<RankingFilters>) {
    setFilters((current) => ({ ...current, ...nextFilters }))
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  function saveSelectedCandidate() {
    if (!selectedCandidate) return
    saveScenarioCandidateToWishlist(
      selectedCandidate,
      savedProbePoints,
      saveProbePoint,
      defaultCandidateName(selectedCandidate, selectedRank),
    )
  }

  return (
    <div className="page page--ranking">
      <PageIntro
        eyebrow="Shortlist кандидатных точек"
        title="Рейтинг точек для первичной проверки"
        subtitle="SmartPasture просматривает GIS-сетку области и показывает, какие зоны рациональнее проверить первыми. Это не финальное полевое решение, а shortlist для гидрогеолога перед выездом."
        actions={(
          <>
            <Link className="button button--secondary" to="/risk-confidence">Риск и уверенность</Link>
            <Link className="button button--secondary" to="/validation">Как проверяем надежность</Link>
          </>
        )}
      />

      <div className="metric-grid ranking-kpi-grid">
        <MetricCard label="Просмотрено ячеек" value={String(allCandidates.length)} color="#177a8a" />
        <MetricCard label="Подходящих по фильтрам" value={String(shortlistResult.preDedupMatches)} color="#1f9d63" />
        <MetricCard label="В shortlist" value={String(shortlistResult.shortlist.length)} color="#1f9d63" />
        <MetricCard label="Высокая уверенность" value={String(highConfidenceCount)} color="#177a8a" />
      </div>

      <Panel level="secondary" className="ranking-filter-panel">
        <div className="ranking-filter-head">
          <SectionTitle
            title="Настройка отбора"
            subtitle={`Сейчас: ${filterLabel(filters)}. Близкие точки автоматически объединяются, чтобы shortlist не состоял из соседних ячеек.`}
          />
          <button type="button" className="button button--ghost" onClick={resetFilters}>Сбросить</button>
        </div>

        <div className="ranking-preset-grid">
          <button type="button" className="ranking-preset" onClick={() => setPreset(DEFAULT_FILTERS)}>
            <strong>Сбалансированный</strong>
            <span>Хороший старт для общего анализа территории.</span>
          </button>
          <button
            type="button"
            className="ranking-preset"
            onClick={() => setPreset({ minPriority: 0.75, maxRisk: 0.35, minConfidence: 0.6, actionId: 'INSPECT_FIRST', profile: 'balanced' })}
          >
            <strong>Быстрый выезд</strong>
            <span>Только самые сильные точки для первой проверки.</span>
          </button>
          <button
            type="button"
            className="ranking-preset"
            onClick={() => setPreset({ minPriority: 0.55, maxRisk: 0.45, minConfidence: 0.7, actionId: 'all', evidenceLevel: 'all', profile: 'confidence' })}
          >
            <strong>Больше уверенности</strong>
            <span>Смещает рейтинг в сторону качества данных.</span>
          </button>
          <button
            type="button"
            className="ranking-preset"
            onClick={() => setPreset({ minPriority: 0.55, maxRisk: 0.25, minConfidence: 0.45, actionId: 'all', profile: 'safest' })}
          >
            <strong>Минимум риска</strong>
            <span>Отсекает точки с повышенным риском.</span>
          </button>
        </div>

        <div className="form-grid ranking-filter-grid">
          <label className="field">
            <span>Количество точек <small>{filters.topN}</small></span>
            <input
              type="range"
              min="3"
              max="24"
              step="1"
              value={filters.topN}
              onChange={(event) => setFilters((current) => ({ ...current, topN: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>Минимальный приоритет <small>{scorePercent(filters.minPriority)}</small></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filters.minPriority}
              onChange={(event) => setFilters((current) => ({ ...current, minPriority: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>Максимальный риск <small>{scorePercent(filters.maxRisk)}</small></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filters.maxRisk}
              onChange={(event) => setFilters((current) => ({ ...current, maxRisk: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>Минимальная уверенность <small>{scorePercent(filters.minConfidence)}</small></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filters.minConfidence}
              onChange={(event) => setFilters((current) => ({ ...current, minConfidence: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>Действие</span>
            <select value={filters.actionId} onChange={(event) => setFilters((current) => ({ ...current, actionId: event.target.value as ProbeScenarioActionFilter }))}>
              <option value="all">Все действия</option>
              {ACTION_OPTIONS.map((actionId) => (
                <option key={actionId} value={actionId}>{actionLabel(actionId, 'ru')}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Качество данных</span>
            <select value={filters.evidenceLevel} onChange={(event) => setFilters((current) => ({ ...current, evidenceLevel: event.target.value as ProbeEvidenceFilter }))}>
              <option value="all">Все уровни</option>
              <option value="full">Только полные данные</option>
              <option value="partial">Только частичные данные</option>
            </select>
          </label>
        </div>
      </Panel>

      <div className="ranking-workspace">
        <Panel className="ranking-map-panel">
          <div className="ranking-map-head">
            <SectionTitle
              title="Карта кандидатных точек"
              subtitle={`Показаны ${mapResult.shortlist.length} лучших разнесенных точек по текущим фильтрам.`}
            />
            <RankingLegend />
          </div>

          <div className="map-frame ranking-map-frame">
            {mapResult.shortlist.length ? (
              <MapContainer center={center} zoom={6} scrollWheelZoom className="leaflet-map ranking-map">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url={env.mapTileUrl}
                />
                <CandidateMapViewport dataset={dataset} selectedCandidate={selectedCandidate} />
                <GeoJSON
                  data={dataset.boundary as never}
                  pathOptions={{ color: '#0d6f83', weight: 2.1, fillColor: '#0d6f83', fillOpacity: 0.04 }}
                />
                {mapResult.shortlist.map((candidate) => {
                  const isSelected = selectedCandidate?.id === candidate.id
                  return (
                    <CircleMarker
                      key={candidate.id}
                      center={[candidate.lat, candidate.lon]}
                      radius={isSelected ? 12 : 5 + candidate.cell.scores.priority * 5}
                      pathOptions={{
                        color: isSelected ? '#08292f' : priorityColor(candidate.cell.scores.priority),
                        fillColor: priorityColor(candidate.cell.scores.priority),
                        fillOpacity: isSelected ? 0.96 : 0.78,
                        opacity: 0.95,
                        weight: isSelected ? 3 : 1.2,
                      }}
                      eventHandlers={{ click: () => setSelectedCandidate(candidate) }}
                    >
                      <Popup>
                        <strong>{defaultCandidateName(candidate)}</strong>
                        <br />
                        Приоритет: {scorePercent(candidate.cell.scores.priority)}/100
                        <br />
                        Риск: {scorePercent(candidate.cell.scores.risk)}/100
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            ) : (
              <EmptyState
                title="Нет точек по этим фильтрам"
                description="Снизьте минимальный приоритет, увеличьте допустимый риск или сбросьте фильтры."
              />
            )}
          </div>
        </Panel>

        <SelectedCandidatePanel
          candidate={selectedCandidate}
          rank={selectedRank}
          saved={savedSelected}
          onSave={saveSelectedCandidate}
          mlPrediction={selectedMlPrediction}
          mlModel={mlModel}
          mlLoading={mlLoading}
          mlError={mlError}
        />
      </div>

      <Panel className="ranking-list-panel">
        <div className="ranking-list-head">
          <SectionTitle
            title="Shortlist для выезда"
            subtitle={`${shortlistResult.shortlist.length} точек после фильтров и удаления близких дублей.`}
          />
          <div className="button-row">
            <Link className="button button--secondary" to="/compare">Сравнение</Link>
            <Link className="button button--secondary" to="/scenarios">Сценарии</Link>
          </div>
        </div>

        {shortlistResult.shortlist.length ? (
          <div className="ranking-card-grid">
            {shortlistResult.shortlist.map((candidate, index) => {
              const isSelected = selectedCandidate?.id === candidate.id
              const saved = !!findSavedPointForScenarioCandidate(savedProbePoints, candidate)
              const band = priorityTone(candidate.cell.scores.priority)
              const mlPrediction = mlModel ? predictWaterSuccess(candidate.cell, mlModel) : null
              return (
                <button
                  key={candidate.id}
                  type="button"
                  className={`ranking-candidate-card ${isSelected ? 'ranking-candidate-card--active' : ''}`}
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <div className="ranking-candidate-card__head">
                    <span className="site-rank">#{index + 1}</span>
                    <Pill tone={band} color={priorityColor(candidate.cell.scores.priority)} size="sm">
                      {priorityLabel(band, 'ru')}
                    </Pill>
                  </div>
                  <strong>{defaultCandidateName(candidate, index + 1)}</strong>
                  <small>{candidate.lat.toFixed(3)}, {candidate.lon.toFixed(3)}</small>
                  <PriorityBar score={candidate.cell.scores.priority} />
                  <div className="ranking-candidate-card__metrics">
                    <span>Приоритет <b>{scorePercent(candidate.cell.scores.priority)}</b></span>
                    <span>ML <b>{mlPrediction ? percentLabel(mlPrediction.probability) : '-'}</b></span>
                    <span>Риск <b>{scorePercent(candidate.cell.scores.risk)}</b></span>
                    <span>Увер. <b>{scorePercent(candidate.cell.scores.confidence)}</b></span>
                  </div>
                  <em>{saved ? 'сохранено' : actionLabel(candidate.cell.actionId, 'ru')}</em>
                </button>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="Shortlist пуст"
            description="Смягчите фильтры или выберите другой пресет."
          />
        )}
      </Panel>

      <p className="validation-demo-note">
        Рейтинг использует предварительные GIS-признаки: расстояние до воды и дороги, landuse, DEM coverage, рельефный контекст, риск и уверенность данных. Глубина, дебит и минерализация не используются для новых кандидатных точек.
      </p>
    </div>
  )
}
