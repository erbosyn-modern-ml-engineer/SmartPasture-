import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CircleMarker, GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { EmptyState, ErrorPanel, LoadingPanel, MetricCard, PageIntro, Panel, Pill, SectionTitle } from '@/components/ui'
import { useSmartPasture } from '@/context/useSmartPasture'
import { type Language } from '@/i18n/translations'
import { useI18n } from '@/i18n/useI18n'
import { loadClassicMlModel, type ClassicMlModel } from '@/lib/classicMl'
import { env } from '@/lib/env'
import { loadGisProbeDataset, prettifyProbeClass, resolveGisProbeCell } from '@/lib/gisProbe'
import { buildWaterAssessment, type WaterAssessmentResult } from '@/lib/waterAssessment'
import type { GisProbeCell, GisProbeDataset, SavedProbePoint } from '@/lib/types'

function text(language: Language, kk: string, ru: string, en: string) {
  if (language === 'kk') return kk
  if (language === 'ru') return ru
  return en
}

function formatDistance(valueKm: number) {
  return valueKm < 10 ? `${valueKm.toFixed(1)} km` : `${Math.round(valueKm)} km`
}

function localizeProbeClass(value: string, language: Language) {
  if (value === 'open_steppe') return text(language, 'ашық дала', 'открытая степь', 'open steppe')
  if (value === 'grass') return text(language, 'шөпті аумақ', 'травянистая зона', 'grass')
  return prettifyProbeClass(value)
}

function findSavedPointForCell(savedProbePoints: SavedProbePoint[], cell: GisProbeCell | null) {
  if (!cell) return null
  return savedProbePoints.find((item) => item.cell.lat === cell.lat && item.cell.lon === cell.lon) ?? null
}

function defaultPointName(cell: GisProbeCell) {
  return `Point ${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)}`
}

function finalAssessmentScore(assessment: WaterAssessmentResult) {
  const mlScore = assessment.ml.probability ?? assessment.priority.score
  return Math.round(
    assessment.priority.score * 0.42
    + mlScore * 0.36
    + (100 - assessment.risk.score) * 0.14
    + assessment.confidence.score * 0.08,
  )
}

function finalAssessmentColor(score: number) {
  if (score >= 70) return '#1f9d63'
  if (score >= 45) return '#d59b17'
  return '#c74b3f'
}

function finalAssessmentTone(score: number) {
  if (score >= 70) return 'high' as const
  if (score >= 45) return 'warning' as const
  return 'danger' as const
}

function finalAssessmentLabel(score: number) {
  if (score >= 70) return 'Подходит для первичной проверки'
  if (score >= 45) return 'Нужна дополнительная проверка'
  return 'Низкий приоритет'
}

function ProbeViewport({
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

function ProbeMapEvents({
  dataset,
  onSelect,
  onOutside,
}: {
  dataset: GisProbeDataset
  onSelect: (cell: GisProbeCell) => void
  onOutside: () => void
}) {
  useMapEvents({
    click(event) {
      const cell = resolveGisProbeCell(dataset, event.latlng.lat, event.latlng.lng)
      if (cell) onSelect(cell)
      else onOutside()
    },
  })

  return null
}

function FinalAssessmentCard({
  assessment,
  cell,
  modelReady,
}: {
  assessment: WaterAssessmentResult
  cell: GisProbeCell
  modelReady: boolean
}) {
  const score = finalAssessmentScore(assessment)
  const color = finalAssessmentColor(score)

  return (
    <div className="point-decision-card point-decision-card--simple">
      <div className="point-decision-card__head">
        <div>
          <p className="eyebrow">Итоговая оценка</p>
          <h2>{finalAssessmentLabel(score)}</h2>
        </div>
        <Pill tone={finalAssessmentTone(score)} color={color}>{score}/100</Pill>
      </div>

      <div className="final-score-card" style={{ '--score-color': color } as CSSProperties}>
        <strong>{score}</strong>
        <span>единый балл SmartPasture</span>
      </div>

      <p>
        Система объединяет доступные данные в один рабочий вывод для предварительного выбора места.
        Это не решение о бурении: точку должен проверить специалист по архивам, рекогносцировке и геофизике.
      </p>

      <div className="table-like point-basic-context">
        <div className="table-like__row"><span>Координаты</span><strong>{cell.lat.toFixed(5)}, {cell.lon.toFixed(5)}</strong></div>
        <div className="table-like__row"><span>Тип территории</span><strong>{localizeProbeClass(cell.landuseClass, 'ru')}</strong></div>
        <div className="table-like__row"><span>До дороги</span><strong>{formatDistance(cell.roadKm)}</strong></div>
        <div className="table-like__row"><span>До поверхностной воды</span><strong>{formatDistance(cell.waterKm)}</strong></div>
      </div>

      <small className="point-decision-card__note">
        {modelReady ? 'Расчет выполнен по объединенной модели SmartPasture.' : 'Итог временно рассчитан по базовым GIS-данным.'}
      </small>
    </div>
  )
}

function AssessmentReportDialog({
  assessment,
  cell,
  saved,
  onClose,
  onPrint,
  onSave,
}: {
  assessment: WaterAssessmentResult
  cell: GisProbeCell
  saved: boolean
  onClose: () => void
  onPrint: () => void
  onSave: () => void
}) {
  const score = finalAssessmentScore(assessment)
  const color = finalAssessmentColor(score)

  return (
    <div className="assessment-modal" role="dialog" aria-modal="true" aria-label="Предполевое заключение SmartPasture">
      <div className="assessment-modal__backdrop" onClick={onClose} />
      <section className="assessment-report assessment-report--simple">
        <div className="assessment-report__head">
          <div>
            <p className="eyebrow">Предполевое заключение</p>
            <h2>{finalAssessmentLabel(score)}</h2>
            <p>
              Точка {cell.lat.toFixed(5)}, {cell.lon.toFixed(5)} получила единую предварительную оценку SmartPasture.
            </p>
          </div>
          <Pill tone={finalAssessmentTone(score)} color={color}>{score}/100</Pill>
        </div>

        <div className="metric-grid assessment-report__metrics assessment-report__metrics--simple">
          <MetricCard label="Итоговая оценка" value={String(score)} color={color} helper="/100" />
        </div>

        <div className="assessment-report__grid">
          <div className="table-like">
            <div className="table-like__row"><span>Координаты</span><strong>{cell.lat.toFixed(5)}, {cell.lon.toFixed(5)}</strong></div>
            <div className="table-like__row"><span>Тип территории</span><strong>{localizeProbeClass(cell.landuseClass, 'ru')}</strong></div>
            <div className="table-like__row"><span>До дороги</span><strong>{formatDistance(cell.roadKm)}</strong></div>
            <div className="table-like__row"><span>До поверхностной воды</span><strong>{formatDistance(cell.waterKm)}</strong></div>
          </div>

          <div className="assessment-report__next">
            <strong>Что сделать дальше</strong>
            <ul className="bullet-list">
              {assessment.fieldChecks.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>

        <p className="assessment-report__note">{assessment.limitation}</p>

        <div className="assessment-report__actions">
          <button type="button" className="button button--primary" onClick={onSave} disabled={saved}>
            {saved ? 'Уже в рабочем списке' : 'Сохранить в рабочий список'}
          </button>
          <button type="button" className="button button--secondary" onClick={onPrint}>Печать</button>
          <button type="button" className="button button--ghost" onClick={onClose}>Закрыть</button>
        </div>
      </section>
    </div>
  )
}

export function GisProbePage() {
  const { language } = useI18n()
  const { status, error, savedProbePoints, saveProbePoint } = useSmartPasture()
  const [dataset, setDataset] = useState<GisProbeDataset | null>(null)
  const [selectedCell, setSelectedCell] = useState<GisProbeCell | null>(null)
  const [datasetError, setDatasetError] = useState<string | null>(null)
  const [outOfBounds, setOutOfBounds] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [mlModel, setMlModel] = useState<ClassicMlModel | null>(null)
  const [mlLoading, setMlLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    loadGisProbeDataset()
      .then((payload) => {
        if (cancelled) return
        setDataset(payload)
        setSelectedCell(null)
        setDraftName('')
        setDatasetError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setDatasetError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить GIS-слой области.')
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
      })
      .catch(() => {
        if (cancelled) return
        setMlModel(null)
      })
      .finally(() => {
        if (!cancelled) setMlLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectedSavedPoint = useMemo(
    () => findSavedPointForCell(savedProbePoints, selectedCell),
    [savedProbePoints, selectedCell],
  )

  const selectedAssessment = useMemo(
    () => (selectedCell ? buildWaterAssessment(selectedCell, mlModel) : null),
    [mlModel, selectedCell],
  )

  if (status === 'loading') {
    return <LoadingPanel title="Рабочая карта" message="Загружаем карту выбора точки." />
  }

  if (status === 'error') {
    return <ErrorPanel title="Рабочая карта" message={error ?? 'Не удалось загрузить данные SmartPasture.'} />
  }

  if (datasetError) {
    return <ErrorPanel title="Рабочая карта" message={datasetError} />
  }

  if (!dataset) {
    return <LoadingPanel title="Рабочая карта" message="Загружаем карту выбора точки." />
  }

  const center: [number, number] = [
    (dataset.bounds.minLat + dataset.bounds.maxLat) / 2,
    (dataset.bounds.minLon + dataset.bounds.maxLon) / 2,
  ]

  function selectCell(cell: GisProbeCell) {
    const saved = findSavedPointForCell(savedProbePoints, cell)
    setSelectedCell(cell)
    setDraftName(saved?.name ?? defaultPointName(cell))
    setOutOfBounds(false)
  }

  function handleOutsideMapClick() {
    setOutOfBounds(true)
    setReportOpen(false)
  }

  function clearSelection() {
    setSelectedCell(null)
    setDraftName('')
    setOutOfBounds(false)
    setReportOpen(false)
  }

  function saveSelectedToWorklist() {
    if (!selectedCell) return
    saveProbePoint(selectedCell, draftName || defaultPointName(selectedCell))
  }

  return (
    <div className="page page--map page--gis-probe">
      <PageIntro
        eyebrow="Рабочая карта"
        title={text(
          language,
          'Нүктені таңдап, қорытынды бағасын алыңыз',
          'Выберите точку и получите итоговую оценку',
          'Select a point and get one final assessment',
        )}
        subtitle={text(
          language,
          'Карта бастапқыда бос: нүктені өзіңіз таңдаңыз, ал SmartPasture бір ғана қорытынды баға береді.',
          'Карта специально пустая: нажмите на любое место внутри зоны покрытия, и SmartPasture покажет одну итоговую оценку без отдельных технических слоев.',
          'The map starts empty: click inside the coverage area and SmartPasture returns one final assessment.',
        )}
      />

      <div className="gis-probe-layout gis-probe-layout--simple">
        <Panel className="gis-probe-map-panel">
          <SectionTitle
            title="Карта выбора точки"
            subtitle={outOfBounds ? 'Вы кликнули вне зоны покрытия. Нажмите внутри зеленого контура.' : 'Нажмите на любое место внутри зеленого контура. На карте нет готовых точек - только выбранная вами точка.'}
          />
          <div className="map-frame gis-probe-map-frame">
            <div className="gis-map-click-hint">Нажмите внутри контура</div>
            <MapContainer center={center} zoom={6} scrollWheelZoom className="leaflet-map gis-probe-map">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url={env.mapTileUrl}
              />
              <ProbeViewport dataset={dataset} selectedCell={selectedCell} />
              <GeoJSON
                data={dataset.boundary as never}
                pathOptions={{ color: '#0d6f83', weight: 2.2, fillColor: '#0d6f83', fillOpacity: 0.05 }}
              />
              <ProbeMapEvents dataset={dataset} onSelect={selectCell} onOutside={handleOutsideMapClick} />
              {selectedCell && selectedAssessment ? (
                <CircleMarker
                  center={[selectedCell.lat, selectedCell.lon]}
                  radius={10}
                  pathOptions={{
                    color: '#08292f',
                    fillColor: finalAssessmentColor(finalAssessmentScore(selectedAssessment)),
                    fillOpacity: 0.95,
                    opacity: 0.95,
                    weight: 3,
                  }}
                />
              ) : null}
            </MapContainer>
          </div>
        </Panel>

        <aside className="gis-probe-detail">
          {selectedCell && selectedAssessment ? (
            <Panel level="secondary" className="gis-probe-detail-panel" tone="hero">
              <FinalAssessmentCard assessment={selectedAssessment} cell={selectedCell} modelReady={!mlLoading && Boolean(mlModel)} />

              <SectionTitle
                title={selectedSavedPoint?.name ?? `${selectedCell.lat.toFixed(3)}, ${selectedCell.lon.toFixed(3)}`}
                subtitle="Выбранная точка для предварительной проверки"
              />

              <div className="form-grid">
                <label className="field">
                  <span>Название точки</span>
                  <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                </label>
              </div>

              <div className="button-row">
                <button type="button" className="button button--primary" onClick={saveSelectedToWorklist}>
                  {selectedSavedPoint ? 'Обновить в списке' : 'Сохранить точку'}
                </button>
                <button type="button" className="button button--secondary" onClick={() => setReportOpen(true)}>
                  Заключение
                </button>
                <button type="button" className="button button--ghost" onClick={clearSelection}>
                  Сбросить
                </button>
              </div>
            </Panel>
          ) : (
            <Panel level="minimal" className="gis-probe-detail-panel">
              <EmptyState
                title="Точка не выбрана"
                description="Нажмите на карту внутри зеленого контура. После клика здесь появится одна итоговая оценка SmartPasture."
              />
            </Panel>
          )}
        </aside>
      </div>

      {reportOpen && selectedCell && selectedAssessment ? (
        <AssessmentReportDialog
          assessment={selectedAssessment}
          cell={selectedCell}
          saved={Boolean(selectedSavedPoint)}
          onClose={() => setReportOpen(false)}
          onPrint={() => window.print()}
          onSave={saveSelectedToWorklist}
        />
      ) : null}
    </div>
  )
}
