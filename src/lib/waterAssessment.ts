import {
  mlPredictionColor,
  mlPredictionLabel,
  predictWaterSuccess,
  type ClassicMlModel,
  type MlFactorContribution,
  type MlWaterPrediction,
} from '@/lib/classicMl'
import {
  confidenceBandFromScore,
  confidenceColor,
  priorityBandFromScore,
  priorityColor,
  riskBandFromScore,
  riskColor,
} from '@/lib/labels'
import type { GisProbeCell } from '@/lib/types'

export type WaterAssessmentRecommendation = 'field_recon' | 'needs_more_data' | 'low_priority'

export interface WaterAssessmentResult {
  recommendation: WaterAssessmentRecommendation
  recommendationLabel: string
  recommendationTone: 'high' | 'warning' | 'danger'
  coordinates: {
    lat: number
    lon: number
  }
  priority: {
    score: number
    label: string
    color: string
  }
  ml: {
    probability: number | null
    predictionLabel: string
    confidence: number | null
    color: string
  }
  risk: {
    score: number
    label: string
    color: string
  }
  confidence: {
    score: number
    label: string
    color: string
  }
  missingData: string[]
  factors: {
    positive: MlFactorContribution[]
    risk: MlFactorContribution[]
  }
  fieldChecks: string[]
  limitation: string
}

function percent(value: number) {
  return Math.round(value * 100)
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
}

function buildMissingData(cell: GisProbeCell, prediction: MlWaterPrediction | null) {
  const missing: string[] = []

  if (!cell.hasDem) {
    missing.push('DEM / рельеф')
  }

  if (cell.evidenceLevel === 'partial') {
    missing.push('часть GIS-слоев')
  }

  if (prediction?.missingFeatures.length) {
    missing.push(...prediction.missingFeatures)
  }

  return unique(missing)
}

function recommendationFor(cell: GisProbeCell, prediction: MlWaterPrediction | null): WaterAssessmentRecommendation {
  const mlProbability = prediction?.probability ?? 0.5
  const mlConfidence = prediction?.confidence ?? 0

  if (
    cell.scores.priority >= 0.68 &&
    mlProbability >= 0.62 &&
    cell.scores.risk <= 0.48 &&
    Math.max(cell.scores.confidence, mlConfidence) >= 0.45
  ) {
    return 'field_recon'
  }

  if (
    cell.scores.priority < 0.35 ||
    cell.scores.risk >= 0.7 ||
    (mlProbability <= 0.42 && cell.scores.confidence >= 0.45)
  ) {
    return 'low_priority'
  }

  return 'needs_more_data'
}

function recommendationLabel(recommendation: WaterAssessmentRecommendation) {
  if (recommendation === 'field_recon') return 'Рекомендуется для рекогносцировки'
  if (recommendation === 'low_priority') return 'Низкий приоритет для выезда'
  return 'Требует дополнительных данных'
}

function recommendationTone(recommendation: WaterAssessmentRecommendation) {
  if (recommendation === 'field_recon') return 'high' as const
  if (recommendation === 'low_priority') return 'danger' as const
  return 'warning' as const
}

function fieldChecks(cell: GisProbeCell, missingData: string[], recommendation: WaterAssessmentRecommendation) {
  const checks = [
    'сверить архивные гидрогеологические материалы по району',
    'уточнить доступность подъезда и маршрут рекогносцировки',
    'проверить ограничения участка перед полевыми работами',
  ]

  if (missingData.length > 0) {
    checks.push('закрыть недостающие GIS-слои перед финальным решением')
  }

  if (cell.scores.risk >= 0.55) {
    checks.push('дополнительно оценить риск минерализации и глубины')
  }

  if (recommendation === 'field_recon') {
    checks.push('рассмотреть точку как кандидат для первичного выезда специалиста')
  }

  return checks.slice(0, 5)
}

export function buildWaterAssessment(cell: GisProbeCell, model: ClassicMlModel | null): WaterAssessmentResult {
  const prediction = model ? predictWaterSuccess(cell, model) : null
  const recommendation = recommendationFor(cell, prediction)
  const missingData = buildMissingData(cell, prediction)
  const priorityBand = priorityBandFromScore(cell.scores.priority)
  const riskBand = riskBandFromScore(cell.scores.risk)
  const confidenceBand = confidenceBandFromScore(cell.scores.confidence)

  return {
    recommendation,
    recommendationLabel: recommendationLabel(recommendation),
    recommendationTone: recommendationTone(recommendation),
    coordinates: {
      lat: cell.lat,
      lon: cell.lon,
    },
    priority: {
      score: percent(cell.scores.priority),
      label: priorityBand === 'high' ? 'Высокий приоритет' : priorityBand === 'medium' ? 'Средний приоритет' : 'Низкий приоритет',
      color: priorityColor(cell.scores.priority),
    },
    ml: {
      probability: prediction ? percent(prediction.probability) : null,
      predictionLabel: prediction ? mlPredictionLabel(prediction.prediction) : 'ML-модель не загружена',
      confidence: prediction ? percent(prediction.confidence) : null,
      color: prediction ? mlPredictionColor(prediction.prediction) : '#5e7080',
    },
    risk: {
      score: percent(cell.scores.risk),
      label: riskBand === 'high' ? 'Высокий риск' : riskBand === 'medium' ? 'Средний риск' : 'Низкий риск',
      color: riskColor(cell.scores.risk),
    },
    confidence: {
      score: percent(cell.scores.confidence),
      label: confidenceBand === 'high' ? 'Высокая уверенность' : confidenceBand === 'medium' ? 'Средняя уверенность' : 'Низкая уверенность',
      color: confidenceColor(cell.scores.confidence),
    },
    missingData,
    factors: {
      positive: prediction?.topPositiveFactors ?? [],
      risk: prediction?.topRiskFactors ?? [],
    },
    fieldChecks: fieldChecks(cell, missingData, recommendation),
    limitation: 'Предполевое заключение SmartPasture не заменяет гидрогеологическое заключение, геофизические работы, архивный анализ и лабораторную проверку воды.',
  }
}
