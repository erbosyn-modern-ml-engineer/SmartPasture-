import { confidenceBandFromScore, riskBandFromScore } from '@/lib/labels'
import type { ConfidenceBand, GisProbeCell, GisProbeDataset, RiskBand } from '@/lib/types'

export type RiskConfidenceView = 'risk' | 'confidence'
export type FactorSeverity = 'low' | 'medium' | 'high'
export type FactorTone = 'good' | 'watch' | 'bad' | 'neutral'

export interface RiskConfidenceFactor {
  id: string
  label: string
  value: string
  score: number
  severity: FactorSeverity
  tone: FactorTone
  description: string
}

export interface RiskConfidenceProfile {
  riskScore: number
  riskBand: RiskBand
  confidenceScore: number
  confidenceBand: ConfidenceBand
  dataQualityLabel: string
  riskFactors: RiskConfidenceFactor[]
  confidenceFactors: RiskConfidenceFactor[]
  missingLayers: string[]
  nextChecks: string[]
}

export interface RiskConfidenceSummary {
  total: number
  lowRiskCount: number
  mediumRiskCount: number
  highRiskCount: number
  highConfidenceCount: number
  fullEvidenceCount: number
  demCoverageCount: number
  averageRisk: number
  averageConfidence: number
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function percent(value: number) {
  return Math.round(clamp(value * 100))
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function severityFromScore(score: number): FactorSeverity {
  if (score >= 65) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function toneFromRiskScore(score: number): FactorTone {
  if (score >= 65) return 'bad'
  if (score >= 40) return 'watch'
  return 'good'
}

function toneFromConfidenceScore(score: number): FactorTone {
  if (score >= 70) return 'good'
  if (score >= 45) return 'watch'
  return 'bad'
}

function scoreDistanceToWater(waterKm: number, insideWater: boolean) {
  if (insideWater) return 92
  if (waterKm <= 2) return 12
  if (waterKm <= 8) return 32
  if (waterKm <= 18) return 58
  return 82
}

function scoreRoadAccess(roadKm: number) {
  if (roadKm <= 3) return 10
  if (roadKm <= 10) return 36
  if (roadKm <= 20) return 62
  return 84
}

function scoreLanduse(value: string, insideWater: boolean) {
  if (insideWater) return 90
  if (value === 'open_steppe' || value === 'grass') return 16
  if (value === 'cropland' || value === 'orchard') return 42
  if (value === 'residential' || value === 'industrial' || value === 'commercial') return 78
  return 38
}

function scoreTerrain(cell: GisProbeCell) {
  if (!cell.hasDem || cell.slopePct === null) return 58
  if (cell.slopePct <= 4) return 12
  if (cell.slopePct <= 8) return 36
  if (cell.slopePct <= 15) return 58
  return 78
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

function landuseLabel(value: string) {
  if (value === 'open_steppe') return 'открытая степь'
  if (value === 'grass') return 'травянистая зона'
  if (value === 'cropland') return 'пашня'
  if (value === 'residential') return 'населенный пункт'
  return value.replace(/_/g, ' ')
}

function riskFactor(
  id: string,
  label: string,
  value: string,
  score: number,
  description: string,
): RiskConfidenceFactor {
  return {
    id,
    label,
    value,
    score: Math.round(score),
    severity: severityFromScore(score),
    tone: toneFromRiskScore(score),
    description,
  }
}

function confidenceFactor(
  id: string,
  label: string,
  value: string,
  score: number,
  description: string,
): RiskConfidenceFactor {
  return {
    id,
    label,
    value,
    score: Math.round(score),
    severity: severityFromScore(100 - score),
    tone: toneFromConfidenceScore(score),
    description,
  }
}

export function buildRiskConfidenceProfile(cell: GisProbeCell): RiskConfidenceProfile {
  const waterRisk = scoreDistanceToWater(cell.waterKm, cell.insideWater)
  const roadRisk = scoreRoadAccess(cell.roadKm)
  const landuseRisk = scoreLanduse(cell.landuseClass, cell.insideWater)
  const terrainRisk = scoreTerrain(cell)
  const dataGapRisk = cell.evidenceLevel === 'full' ? 16 : 62
  const contextRisk = clamp((1 - cell.scores.contextScore) * 100)

  const demConfidence = cell.hasDem ? 92 : 24
  const evidenceConfidence = cell.evidenceLevel === 'full' ? 94 : 42
  const contextConfidence = percent(cell.scores.contextScore)
  const modelStability = percent((cell.scores.confidence * 0.65) + ((1 - cell.scores.risk) * 0.35))
  const waterLayerConfidence = cell.insideWater ? 34 : 82
  const accessLayerConfidence = Number.isFinite(cell.roadKm) ? 80 : 20

  const missingLayers: string[] = []
  if (!cell.hasDem) missingLayers.push('DEM: высота, уклон и часть рельефных признаков')
  if (cell.evidenceLevel === 'partial') missingLayers.push('Часть GIS-слоев доступна только частично')
  if (cell.elevationM === null) missingLayers.push('Высота точки')
  if (cell.slopePct === null) missingLayers.push('Уклон поверхности')
  missingLayers.push('Климатический слой засушливости для этой сетки пока не подключен')
  missingLayers.push('Исторические результаты бурения рядом с точкой пока не подключены')

  const riskFactors = [
    riskFactor(
      'water',
      'Близость к воде',
      cell.insideWater ? 'точка внутри водного полигона' : formatKm(cell.waterKm),
      waterRisk,
      cell.insideWater
        ? 'Точка попадает в водный объект, поэтому ее нельзя напрямую трактовать как место проверки.'
        : 'Слишком большое расстояние до поверхностной воды повышает практический риск и стоимость маршрута.',
    ),
    riskFactor(
      'road',
      'Доступность выезда',
      formatKm(cell.roadKm),
      roadRisk,
      'Чем дальше точка от дороги, тем сложнее и дороже первичная проверка на местности.',
    ),
    riskFactor(
      'terrain',
      'Рельеф и DEM',
      cell.hasDem ? `уклон ${formatMaybeMetric(cell.slopePct, '%')}` : 'DEM отсутствует',
      terrainRisk,
      cell.hasDem
        ? 'Рельеф учтен по DEM; сильный уклон может усложнить обследование и доступ.'
        : 'Без DEM система хуже понимает высоту, уклон и рельефную логику точки.',
    ),
    riskFactor(
      'landuse',
      'Тип территории',
      landuseLabel(cell.landuseClass),
      landuseRisk,
      'Landuse помогает отсечь водные, городские и менее подходящие зоны до выезда.',
    ),
    riskFactor(
      'data-gaps',
      'Недостающие слои',
      cell.evidenceLevel === 'full' ? 'полные данные' : 'частичные данные',
      dataGapRisk,
      'Если часть слоев отсутствует, риск ошибки предварительного вывода становится выше.',
    ),
    riskFactor(
      'context',
      'Общий GIS-контекст',
      `${percent(cell.scores.contextScore)}/100`,
      contextRisk,
      'Слабый контекст означает, что признаки точки хуже поддерживают первичную проверку.',
    ),
  ]

  const confidenceFactors = [
    confidenceFactor(
      'dem',
      'DEM coverage',
      cell.hasDem ? 'есть' : 'нет',
      demConfidence,
      'DEM повышает уверенность, потому что система видит высоту и уклон.',
    ),
    confidenceFactor(
      'evidence',
      'Полнота слоев',
      cell.evidenceLevel === 'full' ? 'полная' : 'частичная',
      evidenceConfidence,
      'Уверенность выше, когда ключевые GIS-слои доступны одновременно.',
    ),
    confidenceFactor(
      'context',
      'Ясность контекста',
      `${contextConfidence}/100`,
      contextConfidence,
      'Высокий GIS-контекст означает, что признаки точки согласуются друг с другом.',
    ),
    confidenceFactor(
      'stability',
      'Стабильность вывода',
      `${modelStability}/100`,
      modelStability,
      'Вывод надежнее, когда риск низкий, а уверенность базовой сетки высокая.',
    ),
    confidenceFactor(
      'water-layer',
      'Слой воды',
      cell.insideWater ? 'конфликт' : 'доступен',
      waterLayerConfidence,
      'Если точка попадает в водный полигон, интерпретация требует ручной проверки.',
    ),
    confidenceFactor(
      'access-layer',
      'Слой дорог',
      cell.roadClass.replace(/_/g, ' '),
      accessLayerConfidence,
      'Дорожный слой помогает оценить практичность выезда.',
    ),
  ]

  const nextChecks: string[] = []
  if (!cell.hasDem) nextChecks.push('Подключить DEM или вручную проверить рельеф в QGIS/Google Earth.')
  if (cell.evidenceLevel === 'partial') nextChecks.push('Проверить недостающие слои перед полевым выездом.')
  if (cell.insideWater) nextChecks.push('Сместить точку из водного полигона на ближайшую сухую площадку.')
  if (cell.waterKm > 10) nextChecks.push('Проверить гидрографию и практическую потребность в воде.')
  if (cell.roadKm > 8) nextChecks.push('Оценить подъездной маршрут и стоимость выезда.')
  if (cell.scores.risk >= 0.4) nextChecks.push('Перед бурением требуется экспертный гидрогеологический review.')
  nextChecks.push('Сверить точку с архивными скважинами и полевыми наблюдениями.')

  return {
    riskScore: percent(cell.scores.risk),
    riskBand: riskBandFromScore(cell.scores.risk),
    confidenceScore: percent(cell.scores.confidence),
    confidenceBand: confidenceBandFromScore(cell.scores.confidence),
    dataQualityLabel: cell.evidenceLevel === 'full' ? 'Слои данных достаточно полные' : 'Данные частичные, нужна осторожность',
    riskFactors,
    confidenceFactors,
    missingLayers: Array.from(new Set(missingLayers)),
    nextChecks: Array.from(new Set(nextChecks)).slice(0, 6),
  }
}

export function summarizeRiskConfidence(dataset: GisProbeDataset): RiskConfidenceSummary {
  const cells = dataset.cells.filter((cell): cell is GisProbeCell => cell !== null)

  return {
    total: cells.length,
    lowRiskCount: cells.filter((cell) => riskBandFromScore(cell.scores.risk) === 'low').length,
    mediumRiskCount: cells.filter((cell) => riskBandFromScore(cell.scores.risk) === 'medium').length,
    highRiskCount: cells.filter((cell) => riskBandFromScore(cell.scores.risk) === 'high').length,
    highConfidenceCount: cells.filter((cell) => confidenceBandFromScore(cell.scores.confidence) === 'high').length,
    fullEvidenceCount: cells.filter((cell) => cell.evidenceLevel === 'full').length,
    demCoverageCount: cells.filter((cell) => cell.hasDem).length,
    averageRisk: percent(average(cells.map((cell) => cell.scores.risk))),
    averageConfidence: percent(average(cells.map((cell) => cell.scores.confidence))),
  }
}
