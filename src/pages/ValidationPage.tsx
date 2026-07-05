import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
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
import { env } from '@/lib/env'
import {
  loadClassicMlModel,
  mlPredictionColor,
  mlPredictionLabel,
  predictWaterSuccess,
  type ClassicMlModel,
  type MlWaterPrediction,
} from '@/lib/classicMl'
import {
  filterValidationWells,
  loadValidationWells,
  scoreValidationWell,
  summarizePriorityRanking,
  summarizeValidationWells,
  validationWellToGisProbeCell,
  type ValidationPriorityBand,
  type ValidationPriorityScore,
  type ValidationRankingSummary,
  type ValidationStatusFilter,
  type ValidationWell,
} from '@/lib/validationData'

const SUCCESS_COLOR = '#1f9d63'
const RISK_COLOR = '#c74b3f'
const WATER_COLOR = '#177a8a'
const WARNING_COLOR = '#d59b17'

function formatCompact(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return '-'
  return value.toFixed(digits)
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${Math.round(value * 100)}%`
}

function mlSuccessPrediction(prediction: MlWaterPrediction) {
  return prediction.probability >= 0.5
}

function mlProbabilityLabel(prediction: MlWaterPrediction | null) {
  return prediction ? `${Math.round(prediction.probability * 100)}%` : '-'
}

function explainMlError(well: ValidationWell, prediction: MlWaterPrediction, model: ClassicMlModel | null) {
  if (prediction.confidence < 0.45) return 'низкая уверенность модели'
  if (prediction.missingFeatures.length > 0) return `не хватает: ${prediction.missingFeatures.slice(0, 2).join(', ')}`
  if (model && model.metrics.test.auc < 0.6) return 'baseline AUC пока слабый'
  return well.success ? 'модель занизила перспективную точку' : 'модель переоценила рискованную точку'
}

function formatDistanceMeters(value: number | null) {
  if (value === null) return '-'
  if (value < 1000) return `${Math.round(value)} м`
  return `${(value / 1000).toFixed(1)} км`
}

function markerColor(well: ValidationWell) {
  return well.success ? SUCCESS_COLOR : RISK_COLOR
}

function markerRadius(well: ValidationWell) {
  if (well.yieldLps <= 0) return 5
  return Math.min(12, 5 + well.yieldLps * 2.8)
}

function resultLabel(well: ValidationWell) {
  return well.success ? 'Удачная скважина' : 'Рискованная скважина'
}

function resultTone(well: ValidationWell) {
  return well.success ? 'high' as const : 'danger' as const
}

function priorityLabel(band: ValidationPriorityBand) {
  if (band === 'high') return 'Высокий приоритет'
  if (band === 'medium') return 'Средний приоритет'
  return 'Низкий приоритет'
}

function priorityTone(band: ValidationPriorityBand) {
  if (band === 'high') return 'high' as const
  if (band === 'medium') return 'medium' as const
  return 'low' as const
}

function priorityColor(band: ValidationPriorityBand) {
  if (band === 'high') return SUCCESS_COLOR
  if (band === 'medium') return WARNING_COLOR
  return RISK_COLOR
}

function ValidationMapViewport({ wells }: { wells: ValidationWell[] }) {
  const map = useMap()

  useEffect(() => {
    if (wells.length === 0) return

    if (wells.length === 1) {
      map.flyTo([wells[0].lat, wells[0].lon], 7, { duration: 0.6 })
      return
    }

    map.fitBounds(wells.map((well) => [well.lat, well.lon] as [number, number]), {
      padding: [28, 28],
      maxZoom: 7,
    })
  }, [map, wells])

  return null
}

function MapLegend() {
  return (
    <div className="validation-map-legend" aria-label="Легенда карты">
      <span><i className="validation-dot validation-dot--success" /> Удачная скважина</span>
      <span><i className="validation-dot validation-dot--risk" /> Рискованная скважина</span>
      <span><i className="validation-dot validation-dot--size" /> Размер = дебит</span>
    </div>
  )
}

function PriorityScoreCard({ priority }: { priority: ValidationPriorityScore }) {
  return (
    <div className="validation-priority-card">
      <div className="validation-priority-card__head">
        <span>Оценка SmartPasture</span>
        <strong>{priority.score}/100</strong>
      </div>
      <div className="validation-priority-card__bar" aria-hidden="true">
        <span
          style={{
            width: `${priority.score}%`,
            background: priorityColor(priority.band),
          }}
        />
      </div>
      <div className="validation-priority-card__footer">
        <Pill tone={priorityTone(priority.band)} color={priorityColor(priority.band)} size="sm">
          {priorityLabel(priority.band)}
        </Pill>
        <small>Уверенность: {priority.confidence}%</small>
      </div>
    </div>
  )
}

function RankingPanel({ ranking }: { ranking: ValidationRankingSummary }) {
  if (ranking.total === 0) {
    return null
  }

  return (
    <Panel level="secondary" className="validation-ranking-panel">
      <div className="validation-ranking-head">
        <SectionTitle
          title="Проверка рейтинга"
          subtitle="Смотрим, чаще ли удачные скважины попадают в верх SmartPasture Score. Оценка считается только по данным, которые можно знать до бурения."
        />
        <Pill tone="confidence" color={WATER_COLOR}>без глубины, дебита и минерализации</Pill>
      </div>

      <div className="metric-grid validation-ranking-grid">
        <MetricCard label="Без рейтинга" value={formatPercent(ranking.baselineSuccessRate)} color={WATER_COLOR} helper="удачных" />
        <MetricCard label={`Топ-${ranking.top10Count}`} value={formatPercent(ranking.top10SuccessRate)} color={SUCCESS_COLOR} helper="удачных" />
        <MetricCard label={`Топ-${ranking.top20Count}`} value={formatPercent(ranking.top20SuccessRate)} color={SUCCESS_COLOR} helper="удачных" />
        <MetricCard
          label="Высокий приоритет"
          value={formatPercent(ranking.highPrioritySuccessRate)}
          color={ranking.highPrioritySuccessRate === null ? WATER_COLOR : SUCCESS_COLOR}
          helper={`${ranking.highPriorityCount} точек`}
        />
      </div>
    </Panel>
  )
}

function ClassicMlBaselinePanel({ model }: { model: ClassicMlModel | null }) {
  if (!model) {
    return (
      <Panel level="minimal" className="validation-ml-panel">
        <SectionTitle title="Сравнение Classic ML моделей" subtitle="ML-метрики загружаются." />
      </Panel>
    )
  }

  const test = model.metrics.test
  const confusion = test.confusionMatrix ?? { tp: 0, fp: 0, tn: 0, fn: 0 }
  const comparisonModels = model.modelComparison?.models ?? []

  return (
    <Panel level="secondary" className="validation-ml-panel">
      <div className="validation-ranking-head">
        <SectionTitle
          title="Сравнение Classic ML моделей"
          subtitle="v1 показывает простой baseline, v2 использует feature engineering до бурения. Выбранная модель остается демонстрационным baseline и требует калибровки на архивных скважинах."
        />
        <Pill tone="confidence" color={WATER_COLOR}>{model.modelType}</Pill>
      </div>
      <div className="metric-grid validation-ranking-grid">
        <MetricCard label="Accuracy" value={`${Math.round(test.accuracy * 100)}`} color={WATER_COLOR} helper="/100" />
        <MetricCard label="Precision" value={`${Math.round(test.precision * 100)}`} color={SUCCESS_COLOR} helper="/100" />
        <MetricCard label="Recall" value={`${Math.round(test.recall * 100)}`} color={SUCCESS_COLOR} helper="/100" />
        <MetricCard label="AUC" value={`${Math.round(test.auc * 100)}`} color={WARNING_COLOR} helper="/100" />
      </div>
      <div className="validation-confusion">
        <div className="validation-confusion__head">
          <strong>Confusion matrix на test split</strong>
          <span>порог 50%</span>
        </div>
        <div className="validation-confusion__grid">
          <div><span>TP</span><strong>{confusion.tp}</strong><small>верно найденные удачные</small></div>
          <div><span>FP</span><strong>{confusion.fp}</strong><small>переоцененные рискованные</small></div>
          <div><span>TN</span><strong>{confusion.tn}</strong><small>верно отсеянные рискованные</small></div>
          <div><span>FN</span><strong>{confusion.fn}</strong><small>пропущенные удачные</small></div>
        </div>
      </div>
      {comparisonModels.length ? (
        <div className="validation-model-comparison">
          <strong>v1 vs v2: тестовый split</strong>
          <div>
            {comparisonModels.map((item) => (
              <span key={item.modelType}>
                {item.modelType}: AUC {Math.round(item.metrics.test.auc * 100)}/100, precision {Math.round(item.metrics.test.precision * 100)}/100, recall {Math.round(item.metrics.test.recall * 100)}/100{item.featureCount ? `, ${item.featureCount} признаков` : ''}
              </span>
            ))}
          </div>
          {model.modelComparison?.chosenReason ? <small>{model.modelComparison.chosenReason}</small> : null}
        </div>
      ) : null}
      <p className="validation-ml-note">
        Исключены leakage-поля: {model.leakageExcluded.slice(0, 6).join(', ')} и служебные источники. Для промышленной калибровки нужны реальные архивные скважины гидрогеологических служб.
      </p>
    </Panel>
  )
}

function MlErrorsPanel({
  wells,
  predictionsById,
  model,
}: {
  wells: ValidationWell[]
  predictionsById: Map<string, MlWaterPrediction>
  model: ClassicMlModel | null
}) {
  const errors = wells
    .map((well) => ({ well, prediction: predictionsById.get(well.id) ?? null }))
    .filter((item): item is { well: ValidationWell; prediction: MlWaterPrediction } => {
      return item.prediction !== null && mlSuccessPrediction(item.prediction) !== item.well.success
    })
    .sort((left, right) => left.prediction.confidence - right.prediction.confidence)
    .slice(0, 8)

  if (errors.length === 0) {
    return (
      <Panel level="minimal" className="validation-errors-panel">
        <SectionTitle title="Ошибки модели" subtitle="По текущим фильтрам явных несовпадений ML-прогноза с фактом не найдено." />
      </Panel>
    )
  }

  return (
    <Panel level="secondary" className="validation-errors-panel">
      <SectionTitle
        title="Ошибки модели"
        subtitle="Показываем точки, где Classic ML baseline не совпал с известным результатом. Это помогает понять, какие признаки нужно усилить."
      />
      <div className="validation-error-list">
        {errors.map(({ well, prediction }) => (
          <div key={well.id} className="validation-error-row">
            <strong>{well.district}</strong>
            <span>факт: {well.success ? 'удачная' : 'рискованная'}</span>
            <span>ML: {mlProbabilityLabel(prediction)} / {mlPredictionLabel(prediction.prediction)}</span>
            <em>{explainMlError(well, prediction, model)}</em>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function SelectedWellPanel({ well }: { well: ValidationWell | null }) {
  if (!well) {
    return (
      <Panel level="minimal" className="validation-selected-panel">
        <EmptyState
          title="Скважина не выбрана"
          description="Нажмите на точку на карте или строку в списке."
          compact
        />
      </Panel>
    )
  }

  const priority = scoreValidationWell(well)

  return (
    <Panel level="secondary" className="validation-selected-panel" tone="hero">
      <SectionTitle title={resultLabel(well)} subtitle={`${well.district}, ${well.region}`} />

      <div className="button-row validation-selected-status">
        <Pill tone={resultTone(well)} color={markerColor(well)}>
          {well.success ? 'Хороший результат' : 'Нужна осторожность'}
        </Pill>
      </div>

      <PriorityScoreCard priority={priority} />

      <div className="metric-grid validation-selected-metrics">
        <MetricCard label="Глубина" value={formatCompact(well.depthM, 0)} color={WATER_COLOR} helper="м" />
        <MetricCard label="Дебит" value={formatCompact(well.yieldLps, 2)} color={SUCCESS_COLOR} helper="л/с" />
        <MetricCard label="Минерализация" value={formatCompact(well.tdsGL, 2)} color={WARNING_COLOR} helper="г/л" />
        <MetricCard label="Год" value={well.year ? String(well.year) : '-'} color={WATER_COLOR} />
      </div>

      <div className="table-like">
        <div className="table-like__row"><span>Район</span><strong>{well.district}</strong></div>
        <div className="table-like__row"><span>Область</span><strong>{well.region}</strong></div>
        <div className="table-like__row"><span>Описание</span><strong>{well.waterQualityNote}</strong></div>
        <div className="table-like__row"><span>До ближайшей реки</span><strong>{formatDistanceMeters(well.distanceToRiverM)}</strong></div>
      </div>

      <details className="validation-extra-details">
        <summary>Дополнительные данные</summary>
        <div className="table-like">
          <div className="table-like__row"><span>TWI</span><strong>{formatCompact(well.twi, 2)}</strong></div>
          <div className="table-like__row"><span>NDVI</span><strong>{formatCompact(well.ndviMean, 2)}</strong></div>
          <div className="table-like__row"><span>Индекс засушливости</span><strong>{formatCompact(well.aridityIndex, 2)}</strong></div>
          <div className="table-like__row"><span>Почва</span><strong>{well.soilTextureClass}</strong></div>
          <div className="table-like__row"><span>Геология</span><strong>{well.lithologyClass}</strong></div>
        </div>
      </details>
    </Panel>
  )
}

export function ValidationPage() {
  const [wells, setWells] = useState<ValidationWell[]>([])
  const [selectedWell, setSelectedWell] = useState<ValidationWell | null>(null)
  const [statusFilter, setStatusFilter] = useState<ValidationStatusFilter>('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mlModel, setMlModel] = useState<ClassicMlModel | null>(null)

  useEffect(() => {
    let cancelled = false

    loadValidationWells()
      .then((payload) => {
        if (cancelled) return
        setWells(payload)
        setSelectedWell(payload[0] ?? null)
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить примеры скважин')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadClassicMlModel()
      .then((model) => {
        if (!cancelled) setMlModel(model)
      })
      .catch(() => {
        if (!cancelled) setMlModel(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const regions = useMemo(() => Array.from(new Set(wells.map((well) => well.region))).sort(), [wells])

  const filteredWells = useMemo(
    () => filterValidationWells(wells, regionFilter, statusFilter, query),
    [query, regionFilter, statusFilter, wells],
  )

  const summary = useMemo(() => summarizeValidationWells(filteredWells), [filteredWells])
  const ranking = useMemo(() => summarizePriorityRanking(filteredWells), [filteredWells])
  const mlPredictionsByWellId = useMemo(() => {
    const predictions = new Map<string, MlWaterPrediction>()
    if (!mlModel) return predictions

    for (const well of filteredWells) {
      predictions.set(well.id, predictWaterSuccess(validationWellToGisProbeCell(well), mlModel))
    }

    return predictions
  }, [filteredWells, mlModel])

  useEffect(() => {
    if (filteredWells.length === 0) {
      setSelectedWell(null)
      return
    }

    if (!selectedWell || !filteredWells.some((well) => well.id === selectedWell.id)) {
      setSelectedWell(filteredWells[0])
    }
  }, [filteredWells, selectedWell])

  if (loading) {
    return <LoadingPanel title="Проверка SmartPasture" message="Загружаем примеры скважин." />
  }

  if (error) {
    return <ErrorPanel title="Проверка SmartPasture" message={error} />
  }

  return (
    <div className="page page--validation">
      <PageIntro
        eyebrow="Валидация"
        title="Валидация SmartPasture на известных скважинах"
        subtitle="Гидрогеологическая служба видит, как предварительный рейтинг и Classic ML baseline соотносятся с известными результатами скважин: зеленые точки дали хороший результат, красные требуют осторожности."
      />

      <div className="metric-grid validation-kpi-grid">
        <MetricCard label="Всего примеров" value={String(summary.total)} color={WATER_COLOR} />
        <MetricCard label="Удачных скважин" value={String(summary.successCount)} color={SUCCESS_COLOR} />
        <MetricCard label="Рискованных скважин" value={String(summary.failedCount)} color={RISK_COLOR} />
        <MetricCard label="Средняя глубина" value={formatCompact(summary.averageDepthM, 0)} color={WATER_COLOR} helper="м" />
      </div>

      <RankingPanel ranking={ranking} />

      <ClassicMlBaselinePanel model={mlModel} />

      <MlErrorsPanel wells={filteredWells} predictionsById={mlPredictionsByWellId} model={mlModel} />

      <Panel level="secondary" className="validation-filters-panel">
        <SectionTitle title="Фильтры" subtitle="Выберите область или покажите только удачные либо рискованные примеры." />
        <div className="form-grid validation-filter-grid">
          <label className="field">
            <span>Поиск</span>
            <input value={query} placeholder="ID, район или область" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="field">
            <span>Область</span>
            <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
              <option value="all">Все области</option>
              {regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Результат</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ValidationStatusFilter)}>
              <option value="all">Все примеры</option>
              <option value="success">Удачные</option>
              <option value="failed">Рискованные</option>
            </select>
          </label>
        </div>
      </Panel>

      <div className="validation-dashboard-grid">
        <Panel className="validation-map-panel">
          <div className="validation-map-head">
            <SectionTitle title="Карта примеров" subtitle="Это не точки для нового бурения, а примеры для проверки системы." />
            <MapLegend />
          </div>
          <div className="map-frame validation-map-frame">
            {filteredWells.length ? (
              <MapContainer center={[44.6, 66.2]} zoom={5} scrollWheelZoom className="leaflet-map validation-map">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url={env.mapTileUrl}
                />
                <ValidationMapViewport wells={filteredWells} />
                {filteredWells.map((well) => (
                  <CircleMarker
                    key={well.id}
                    center={[well.lat, well.lon]}
                    radius={markerRadius(well)}
                    pathOptions={{
                      color: selectedWell?.id === well.id ? '#08292f' : markerColor(well),
                      fillColor: markerColor(well),
                      fillOpacity: 0.86,
                      opacity: 0.96,
                      weight: selectedWell?.id === well.id ? 3 : 1.5,
                    }}
                    eventHandlers={{ click: () => setSelectedWell(well) }}
                  >
                    <Popup>
                      <strong>{resultLabel(well)}</strong>
                      <br />
                      {well.region}, {well.district}
                      <br />
                      Оценка: {scoreValidationWell(well).score}/100
                      <br />
                      Дебит: {formatCompact(well.yieldLps, 2)} л/с
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            ) : (
              <EmptyState title="Нет примеров по этим фильтрам" description="Очистите поиск или поменяйте область/результат." />
            )}
          </div>
        </Panel>

        <SelectedWellPanel well={selectedWell} />
      </div>

      <Panel className="validation-table-panel">
        <SectionTitle title="Список примеров" subtitle="Нажмите на строку, чтобы открыть скважину на карточке." />
        <div className="validation-table-wrap">
          <table className="validation-table">
            <thead>
              <tr>
                <th>Результат</th>
                <th>Оценка</th>
                <th>ML прогноз</th>
                <th>Район</th>
                <th>Глубина</th>
                <th>Дебит</th>
                <th>Минерализация</th>
              </tr>
            </thead>
            <tbody>
              {filteredWells.map((well) => {
                const prediction = mlPredictionsByWellId.get(well.id) ?? null
                return (
                <tr
                  key={well.id}
                  className={selectedWell?.id === well.id ? 'validation-table__row--selected' : undefined}
                  onClick={() => setSelectedWell(well)}
                >
                  <td>
                    <span className={`validation-status-dot ${well.success ? 'validation-status-dot--success' : 'validation-status-dot--risk'}`} />
                    {well.success ? 'Удачная' : 'Рискованная'}
                  </td>
                  <td>
                    <span className="validation-table-score">
                      {scoreValidationWell(well).score}
                    </span>
                  </td>
                  <td>
                    {prediction ? (
                      <span className="validation-ml-pill" style={{ '--ml-color': mlPredictionColor(prediction.prediction) } as CSSProperties}>
                        {mlProbabilityLabel(prediction)}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{well.district}</td>
                  <td>{formatCompact(well.depthM, 0)} м</td>
                  <td>{formatCompact(well.yieldLps, 2)} л/с</td>
                  <td>{formatCompact(well.tdsGL, 2)} г/л</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="validation-demo-note">
        После подключения расширенной базы архивных скважин эта страница будет использоваться для регулярной проверки качества рейтинга и ML-прогноза.
      </p>
    </div>
  )
}
