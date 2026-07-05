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
import { loadClassicMlModel, predictWaterSuccess, type ClassicMlModel, type MlWaterPrediction } from '@/lib/classicMl'
import { env } from '@/lib/env'
import { loadGisProbeDataset, prettifyProbeClass } from '@/lib/gisProbe'
import { confidenceColor, confidenceLabel, riskColor, riskLabel } from '@/lib/labels'
import {
  buildRiskConfidenceProfile,
  summarizeRiskConfidence,
  type RiskConfidenceFactor,
  type RiskConfidenceView,
} from '@/lib/riskConfidence'
import type { EvidenceLevel, GisProbeCell, GisProbeDataset } from '@/lib/types'

type EvidenceFilter = EvidenceLevel | 'all'

const MAP_CELL_LIMIT = 220
const LIST_CELL_LIMIT = 14

function scorePercent(score: number) {
  return String(Math.round(score * 100))
}

function formatKm(value: number) {
  if (value < 1) return `${Math.round(value * 1000)} м`
  if (value < 10) return `${value.toFixed(1)} км`
  return `${Math.round(value)} км`
}

function formatMaybeMetric(value: number | null, suffix: string) {
  if (value === null) return 'нет данных'
  return `${value.toFixed(value < 10 ? 1 : 0)}${suffix}`
}

function evidenceLabel(level: EvidenceLevel) {
  return level === 'full' ? 'Полные данные' : 'Частичные данные'
}

function landuseLabel(value: string) {
  if (value === 'open_steppe') return 'открытая степь'
  if (value === 'grass') return 'травянистая зона'
  if (value === 'cropland') return 'пашня'
  return prettifyProbeClass(value).toLowerCase()
}

function factorToneClass(factor: RiskConfidenceFactor) {
  return `risk-factor--${factor.tone}`
}

function viewScore(cell: GisProbeCell, view: RiskConfidenceView) {
  return view === 'risk' ? cell.scores.risk : cell.scores.confidence
}

function viewColor(cell: GisProbeCell, view: RiskConfidenceView) {
  return view === 'risk' ? riskColor(cell.scores.risk) : confidenceColor(cell.scores.confidence)
}

function sortCells(cells: GisProbeCell[], view: RiskConfidenceView) {
  return [...cells].sort((left, right) => viewScore(right, view) - viewScore(left, view))
}

function RiskConfidenceViewport({
  dataset,
  selectedCell,
}: {
  dataset: GisProbeDataset
  selectedCell: GisProbeCell | null
}) {
  const map = useMap()

  useEffect(() => {
    if (selectedCell) {
      map.flyTo([selectedCell.lat, selectedCell.lon], Math.max(map.getZoom(), 8), { duration: 0.65 })
      return
    }

    map.fitBounds(
      [
        [dataset.bounds.minLat, dataset.bounds.minLon],
        [dataset.bounds.maxLat, dataset.bounds.maxLon],
      ],
      { padding: [24, 24] },
    )
  }, [dataset.bounds.maxLat, dataset.bounds.maxLon, dataset.bounds.minLat, dataset.bounds.minLon, map, selectedCell])

  return null
}

function FactorList({ title, factors }: { title: string; factors: RiskConfidenceFactor[] }) {
  return (
    <div className="risk-factor-group">
      <strong>{title}</strong>
      <div className="risk-factor-list">
        {factors.map((factor) => (
          <article key={factor.id} className={`risk-factor ${factorToneClass(factor)}`}>
            <div className="risk-factor__head">
              <span>{factor.label}</span>
              <strong>{factor.score}/100</strong>
            </div>
            <div className="risk-factor__bar" aria-hidden="true">
              <i style={{ width: `${factor.score}%` }} />
            </div>
            <p><b>{factor.value}</b> — {factor.description}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function SelectedRiskPanel({
  cell,
  mlPrediction,
  mlModel,
  mlLoading,
  mlError,
}: {
  cell: GisProbeCell | null
  mlPrediction: MlWaterPrediction | null
  mlModel: ClassicMlModel | null
  mlLoading: boolean
  mlError: string | null
}) {
  if (!cell) {
    return (
      <Panel level="minimal" className="risk-selected-panel">
        <EmptyState
          title="Точка не выбрана"
          description="Нажмите на маркер или строку в списке, чтобы увидеть разбор риска и уверенности."
          compact
        />
      </Panel>
    )
  }

  const profile = buildRiskConfidenceProfile(cell)

  return (
    <Panel level="secondary" tone="hero" className="risk-selected-panel">
      <SectionTitle
        title={`${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)}`}
        subtitle={`${landuseLabel(cell.landuseClass)} • ${profile.dataQualityLabel}`}
      />

      <div className="button-row risk-selected-pills">
        <Pill tone={profile.riskBand === 'high' ? 'danger' : profile.riskBand === 'medium' ? 'warning' : 'high'} color={riskColor(cell.scores.risk)}>
          {riskLabel(profile.riskBand, 'ru')}
        </Pill>
        <Pill tone={profile.confidenceBand === 'high' ? 'confidence' : profile.confidenceBand === 'medium' ? 'medium' : 'warning'} color={confidenceColor(cell.scores.confidence)}>
          {confidenceLabel(profile.confidenceBand, 'ru')}
        </Pill>
        <Pill tone={cell.evidenceLevel === 'full' ? 'confidence' : 'warning'}>
          {evidenceLabel(cell.evidenceLevel)}
        </Pill>
      </div>

      <div className="metric-grid risk-selected-metrics">
        <MetricCard label="Риск" value={String(profile.riskScore)} color={riskColor(cell.scores.risk)} helper="/100" />
        <MetricCard label="Уверенность" value={String(profile.confidenceScore)} color={confidenceColor(cell.scores.confidence)} helper="/100" />
        <MetricCard label="До воды" value={formatKm(cell.waterKm).replace(' км', '').replace(' м', '')} color="#177a8a" helper={cell.waterKm < 1 ? 'м' : 'км'} />
        <MetricCard label="До дороги" value={formatKm(cell.roadKm).replace(' км', '').replace(' м', '')} color="#1f9d63" helper={cell.roadKm < 1 ? 'м' : 'км'} />
      </div>

      <ClassicMlPanel
        prediction={mlPrediction}
        model={mlModel}
        loading={mlLoading}
        error={mlError}
        compact
        title="ML уверенность по точке"
      />

      <FactorList title="Что повышает или снижает риск" factors={profile.riskFactors} />
      <FactorList title="Что влияет на уверенность" factors={profile.confidenceFactors} />

      <div className="risk-check-grid">
        <div>
          <strong>Недостающие слои</strong>
          <ul className="bullet-list">
            {profile.missingLayers.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <strong>Что проверить дальше</strong>
          <ul className="bullet-list">
            {profile.nextChecks.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div className="table-like">
        <div className="table-like__row"><span>Высота</span><strong>{formatMaybeMetric(cell.elevationM, ' м')}</strong></div>
        <div className="table-like__row"><span>Уклон</span><strong>{formatMaybeMetric(cell.slopePct, '%')}</strong></div>
        <div className="table-like__row"><span>Класс дороги</span><strong>{cell.roadClass.replace(/_/g, ' ')}</strong></div>
        <div className="table-like__row"><span>Класс воды</span><strong>{cell.waterClass.replace(/_/g, ' ')}</strong></div>
      </div>
    </Panel>
  )
}

export function RiskConfidencePage() {
  const { status, error } = useSmartPasture()
  const [dataset, setDataset] = useState<GisProbeDataset | null>(null)
  const [datasetError, setDatasetError] = useState<string | null>(null)
  const [view, setView] = useState<RiskConfidenceView>('risk')
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>('all')
  const [selectedCell, setSelectedCell] = useState<GisProbeCell | null>(null)
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

  const cells = useMemo(
    () => dataset?.cells.filter((cell): cell is GisProbeCell => cell !== null) ?? [],
    [dataset],
  )

  const filteredCells = useMemo(
    () => cells.filter((cell) => evidenceFilter === 'all' || cell.evidenceLevel === evidenceFilter),
    [cells, evidenceFilter],
  )

  const displayCells = useMemo(
    () => sortCells(filteredCells, view).slice(0, MAP_CELL_LIMIT),
    [filteredCells, view],
  )

  const listCells = useMemo(
    () => sortCells(filteredCells, view).slice(0, LIST_CELL_LIMIT),
    [filteredCells, view],
  )

  const summary = useMemo(() => (dataset ? summarizeRiskConfidence(dataset) : null), [dataset])

  const selectedMlPrediction = useMemo(
    () => (selectedCell && mlModel ? predictWaterSuccess(selectedCell, mlModel) : null),
    [mlModel, selectedCell],
  )

  useEffect(() => {
    if (displayCells.length === 0) {
      setSelectedCell(null)
      return
    }

    if (!selectedCell || !displayCells.some((cell) => cell.lat === selectedCell.lat && cell.lon === selectedCell.lon)) {
      setSelectedCell(listCells[0] ?? displayCells[0])
    }
  }, [displayCells, listCells, selectedCell])

  if (status === 'loading') {
    return <LoadingPanel title="Риск и уверенность" message="Загружаем SmartPasture." />
  }

  if (status === 'error') {
    return <ErrorPanel title="Риск и уверенность" message={error ?? 'Не удалось загрузить SmartPasture.'} />
  }

  if (datasetError) {
    return <ErrorPanel title="Риск и уверенность" message={datasetError} />
  }

  if (!dataset || !summary) {
    return <LoadingPanel title="Риск и уверенность" message="Загружаем GIS-сетку области." />
  }

  const center: [number, number] = [
    (dataset.bounds.minLat + dataset.bounds.maxLat) / 2,
    (dataset.bounds.minLon + dataset.bounds.maxLon) / 2,
  ]

  return (
    <div className="page page--risk-confidence">
      <PageIntro
        eyebrow="Контроль данных перед выездом"
        title="Модель риска и уверенности"
        subtitle="Этот слой объясняет, почему SmartPasture доверяет или не доверяет предварительной оценке точки: какие данные есть, какие отсутствуют, что повышает риск и что нужно проверить специалисту."
        actions={<Link className="button button--secondary" to="/ranking">Открыть рейтинг точек</Link>}
      />

      <div className="metric-grid risk-kpi-grid">
        <MetricCard label="Оценено ячеек" value={String(summary.total)} color="#177a8a" />
        <MetricCard label="Низкий риск" value={String(summary.lowRiskCount)} color="#1f9d63" />
        <MetricCard label="Высокая уверенность" value={String(summary.highConfidenceCount)} color="#177a8a" />
        <MetricCard label="DEM покрытие" value={String(summary.demCoverageCount)} color="#d59b17" />
      </div>

      <Panel level="secondary" className="risk-controls-panel">
        <div className="risk-controls-head">
          <SectionTitle
            title="Что показывать на карте"
            subtitle="Риск показывает, где вывод требует осторожности. Уверенность показывает, где данные лучше поддерживают предварительную оценку."
          />
          <div className="button-row">
            <button type="button" className={`button ${view === 'risk' ? 'button--selected' : 'button--secondary'}`} onClick={() => setView('risk')}>
              Риск
            </button>
            <button type="button" className={`button ${view === 'confidence' ? 'button--selected' : 'button--secondary'}`} onClick={() => setView('confidence')}>
              Уверенность
            </button>
          </div>
        </div>

        <div className="form-grid risk-controls-grid">
          <label className="field">
            <span>Качество данных</span>
            <select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value as EvidenceFilter)}>
              <option value="all">Все ячейки</option>
              <option value="full">Только полные данные</option>
              <option value="partial">Только частичные данные</option>
            </select>
          </label>
          <div className="risk-summary-strip">
            <span>Средний риск: <strong>{summary.averageRisk}/100</strong></span>
            <span>Средняя уверенность: <strong>{summary.averageConfidence}/100</strong></span>
            <span>Полные данные: <strong>{summary.fullEvidenceCount}</strong></span>
          </div>
        </div>
      </Panel>

      <div className="risk-workspace">
        <Panel className="risk-map-panel">
          <div className="risk-map-head">
            <SectionTitle
              title={view === 'risk' ? 'Карта риска' : 'Карта уверенности'}
              subtitle={`Показаны ${displayCells.length} наиболее важных ячеек по выбранному режиму.`}
            />
            <div className="ranking-map-legend">
              <span><i className="ranking-dot ranking-dot--high" /> лучше</span>
              <span><i className="ranking-dot ranking-dot--medium" /> средне</span>
              <span><i className="ranking-dot ranking-dot--low" /> хуже</span>
            </div>
          </div>

          <div className="map-frame risk-map-frame">
            {displayCells.length ? (
              <MapContainer center={center} zoom={6} scrollWheelZoom className="leaflet-map risk-map">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url={env.mapTileUrl}
                />
                <RiskConfidenceViewport dataset={dataset} selectedCell={selectedCell} />
                <GeoJSON
                  data={dataset.boundary as never}
                  pathOptions={{ color: '#0d6f83', weight: 2.1, fillColor: '#0d6f83', fillOpacity: 0.04 }}
                />
                {displayCells.map((cell) => {
                  const isSelected = selectedCell?.lat === cell.lat && selectedCell.lon === cell.lon
                  const score = viewScore(cell, view)
                  return (
                    <CircleMarker
                      key={`${cell.lat}-${cell.lon}`}
                      center={[cell.lat, cell.lon]}
                      radius={isSelected ? 12 : 5 + score * 5}
                      pathOptions={{
                        color: isSelected ? '#08292f' : viewColor(cell, view),
                        fillColor: viewColor(cell, view),
                        fillOpacity: isSelected ? 0.95 : 0.75,
                        opacity: 0.95,
                        weight: isSelected ? 3 : 1.2,
                      }}
                      eventHandlers={{ click: () => setSelectedCell(cell) }}
                    >
                      <Popup>
                        <strong>{cell.lat.toFixed(3)}, {cell.lon.toFixed(3)}</strong>
                        <br />
                        Риск: {scorePercent(cell.scores.risk)}/100
                        <br />
                        Уверенность: {scorePercent(cell.scores.confidence)}/100
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            ) : (
              <EmptyState title="Нет ячеек" description="Поменяйте фильтр качества данных." />
            )}
          </div>
        </Panel>

        <SelectedRiskPanel
          cell={selectedCell}
          mlPrediction={selectedMlPrediction}
          mlModel={mlModel}
          mlLoading={mlLoading}
          mlError={mlError}
        />
      </div>

      <Panel className="risk-list-panel">
        <SectionTitle
          title={view === 'risk' ? 'Самые рискованные точки' : 'Самые уверенные точки'}
          subtitle="Нажмите на строку, чтобы увидеть полный разбор справа."
        />
        <div className="risk-list">
          {listCells.map((cell, index) => {
            const isSelected = selectedCell?.lat === cell.lat && selectedCell.lon === cell.lon
            const profile = buildRiskConfidenceProfile(cell)
            return (
              <button
                key={`${cell.lat}-${cell.lon}`}
                type="button"
                className={`risk-row ${isSelected ? 'risk-row--active' : ''}`}
                onClick={() => setSelectedCell(cell)}
              >
                <span className="site-rank">#{index + 1}</span>
                <strong>{cell.lat.toFixed(3)}, {cell.lon.toFixed(3)}</strong>
                <span>Риск <b>{profile.riskScore}</b></span>
                <span>Уверенность <b>{profile.confidenceScore}</b></span>
                <span>{evidenceLabel(cell.evidenceLevel)}</span>
              </button>
            )
          })}
        </div>
      </Panel>

      <p className="validation-demo-note">
        Модель риска и уверенности не использует глубину, дебит или минерализацию для новых точек. Она оценивает только предварительные слои, доступные до бурения.
      </p>
    </div>
  )
}
