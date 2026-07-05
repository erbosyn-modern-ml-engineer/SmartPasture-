import type { GisProbeCell } from '@/lib/types'

export type MlPredictionBand = 'likely' | 'uncertain' | 'unlikely'

export interface ClassicMlMetrics {
  accuracy: number
  precision: number
  recall: number
  f1: number
  auc: number
  count: number
  positiveRate: number
  confusionMatrix?: {
    tp: number
    fp: number
    tn: number
    fn: number
  }
}

export interface ClassicMlModel {
  version: string
  trainedAt: string
  modelType: string
  target: string
  thresholds: {
    likely: number
    unlikely: number
  }
  features: string[]
  engineeredFeatures?: string[]
  featureLabels: Record<string, string>
  featureGroups?: Record<string, string>
  featureStats: Record<string, { mean: number; std: number }>
  weights: Record<string, number>
  intercept: number
  gaussianParams?: {
    classes: Record<string, {
      prior: number
      means: number[]
      variances: number[]
    }>
  } | null
  featureImportance?: Array<{
    feature: string
    label: string
    group: string
    weight: number
    importance: number
    direction: 'positive' | 'risk'
  }>
  categoryMappings: {
    nearest_water_type?: Record<string, number>
    land_cover_class?: Record<string, number>
    soil_texture_class?: Record<string, number>
    lithology_class?: Record<string, number>
    geological_age?: Record<string, number>
  }
  metrics: {
    train: ClassicMlMetrics
    val: ClassicMlMetrics
    test: ClassicMlMetrics
  }
  modelComparison?: {
    chosenModel: string
    chosenReason: string
    models: Array<{
      modelType: string
      browserInference: boolean
      featureCount?: number
      selectionScore?: number
      metrics: {
        train: ClassicMlMetrics
        val: ClassicMlMetrics
        test: ClassicMlMetrics
      }
    }>
  }
  selectedModelReason?: string
  leakageExcluded: string[]
  notes: string[]
}

export interface MlFactorContribution {
  feature: string
  label: string
  group: string
  value: string
  contribution: number
}

export interface MlGroupContribution {
  group: string
  contribution: number
  positive: number
  risk: number
  featureCount: number
}

export interface MlWaterPrediction {
  probability: number
  prediction: MlPredictionBand
  confidence: number
  inputCoverage: number
  dataCompleteness: number
  modelVersion: string
  calibrationNote: string
  missingFeatures: string[]
  topPositiveFactors: MlFactorContribution[]
  topRiskFactors: MlFactorContribution[]
  groupContributions: MlGroupContribution[]
}

const MODEL_URL = '/data/ml/classic_water_model.json'

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value)
    return 1 / (1 + z)
  }
  const z = Math.exp(value)
  return z / (1 + z)
}

function slopePctToDeg(value: number) {
  return Math.atan(value / 100) * (180 / Math.PI)
}

function formatMeters(value: number) {
  if (value < 1000) return `${Math.round(value)} м`
  return `${(value / 1000).toFixed(1)} км`
}

function safeLog1p(value: number | null) {
  return value === null || value < 0 ? null : Math.log1p(value)
}

function featureGroup(feature: string, model: ClassicMlModel) {
  return model.featureGroups?.[feature] ?? 'Прочее'
}

function formatFeatureValue(feature: string, value: number) {
  if (feature.startsWith('dist_to')) return formatMeters(value)
  if (feature === 'nearest_surface_water_m') return formatMeters(value)
  if (feature === 'elevation_m') return `${Math.round(value)} м`
  if (feature === 'slope_deg') return `${value.toFixed(1)}°`
  if (feature === 'is_pasture') return value >= 0.5 ? 'да' : 'нет'
  if (feature.includes('flag') || feature === 'near_fault_flag') return value >= 0.5 ? 'да' : 'нет'
  if (feature.startsWith('log_')) return value.toFixed(2)
  if (feature.includes('index') || feature.includes('proxy')) return value.toFixed(2)
  return value.toFixed(2)
}

function mapWaterClass(cell: GisProbeCell, model: ClassicMlModel): number | null {
  const mapping = model.categoryMappings.nearest_water_type ?? {}
  const raw = cell.waterClass.toLowerCase()
  if (raw.includes('canal') && mapping.canal !== undefined) return mapping.canal
  if (raw.includes('lake') && mapping.lake !== undefined) return mapping.lake
  if ((raw.includes('river') || raw.includes('riverbank')) && mapping.river !== undefined) return mapping.river
  if ((raw.includes('water') || raw.includes('wetland')) && mapping.river !== undefined) return mapping.river
  return null
}

function mapLandCover(cell: GisProbeCell, model: ClassicMlModel): number | null {
  const mapping = model.categoryMappings.land_cover_class ?? {}
  const raw = cell.landuseClass.toLowerCase()
  if ((raw === 'open_steppe' || raw === 'grass') && mapping.herbaceous_vegetation !== undefined) {
    return mapping.herbaceous_vegetation
  }
  if (raw.includes('crop') && mapping.cropland !== undefined) return mapping.cropland
  if (raw.includes('shrub') && mapping.shrubland !== undefined) return mapping.shrubland
  if (raw.includes('bare') && mapping.bare_sparse_vegetation !== undefined) return mapping.bare_sparse_vegetation
  return null
}

function distanceForWaterType(cell: GisProbeCell, type: 'river' | 'lake' | 'canal') {
  const raw = cell.waterClass.toLowerCase()
  if (type === 'river' && (raw.includes('river') || raw.includes('water') || raw.includes('wetland'))) return cell.waterKm * 1000
  if (type === 'lake' && raw.includes('lake')) return cell.waterKm * 1000
  if (type === 'canal' && raw.includes('canal')) return cell.waterKm * 1000
  return null
}

function nearestSurfaceWater(cell: GisProbeCell) {
  return Number.isFinite(cell.waterKm) && cell.waterKm >= 0 ? cell.waterKm * 1000 : null
}

function rawFeatureValue(feature: string, cell: GisProbeCell, model: ClassicMlModel): number | null {
  const nearestWater = nearestSurfaceWater(cell)
  const roadMeters = Number.isFinite(cell.roadKm) && cell.roadKm >= 0 ? cell.roadKm * 1000 : null
  const isPasture = cell.landuseClass === 'open_steppe' || cell.landuseClass === 'grass' ? 1 : 0

  switch (feature) {
    case 'slope_deg':
      return cell.slopePct === null ? null : slopePctToDeg(cell.slopePct)
    case 'elevation_m':
      return cell.elevationM
    case 'dist_to_river_m':
      return distanceForWaterType(cell, 'river') ?? nearestWater
    case 'dist_to_lake_m':
      return distanceForWaterType(cell, 'lake')
    case 'dist_to_canal_m':
      return distanceForWaterType(cell, 'canal')
    case 'dist_to_road_m':
      return roadMeters
    case 'is_pasture':
      return isPasture
    case 'nearest_water_type_enc':
      return mapWaterClass(cell, model)
    case 'land_cover_class_enc':
      return mapLandCover(cell, model)
    case 'nearest_surface_water_m':
      return nearestWater
    case 'log_nearest_surface_water_m':
      return safeLog1p(nearestWater)
    case 'access_cost_index':
      return safeLog1p(roadMeters === null ? null : roadMeters * 0.65)
    case 'pasture_x_water_access':
      return nearestWater === null ? null : isPasture / (1 + nearestWater / 50_000)
    default:
      return null
  }
}

function missingFeatureLabel(feature: string, model: ClassicMlModel) {
  return model.featureLabels[feature] ?? feature
}

export async function loadClassicMlModel(): Promise<ClassicMlModel> {
  const response = await fetch(MODEL_URL)
  if (!response.ok) {
    throw new Error(`Failed to load Classic ML model: ${response.status}`)
  }
  return response.json() as Promise<ClassicMlModel>
}

function gaussianLogDensity(value: number, mean: number, variance: number) {
  const safeVariance = Math.max(variance, 0.0001)
  return -0.5 * Math.log(2 * Math.PI * safeVariance) - ((value - mean) ** 2) / (2 * safeVariance)
}

function groupContributions(contributions: MlFactorContribution[]): MlGroupContribution[] {
  const groups = new Map<string, MlGroupContribution>()

  for (const factor of contributions) {
    const current = groups.get(factor.group) ?? {
      group: factor.group,
      contribution: 0,
      positive: 0,
      risk: 0,
      featureCount: 0,
    }
    current.contribution += factor.contribution
    current.featureCount += 1
    if (factor.contribution >= 0) current.positive += factor.contribution
    else current.risk += Math.abs(factor.contribution)
    groups.set(factor.group, current)
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      contribution: Number(item.contribution.toFixed(4)),
      positive: Number(item.positive.toFixed(4)),
      risk: Number(item.risk.toFixed(4)),
    }))
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
}

export function predictWaterSuccess(cell: GisProbeCell, model: ClassicMlModel): MlWaterPrediction {
  const contributions: MlFactorContribution[] = []
  const missingFeatures: string[] = []
  const normalizedValues: number[] = []
  let present = 0

  for (const feature of model.features) {
    const stats = model.featureStats[feature] ?? { mean: 0, std: 1 }
    const std = Math.abs(stats.std) < 1e-9 ? 1 : stats.std
    const raw = rawFeatureValue(feature, cell, model)
    const value = raw ?? stats.mean
    const normalized = (value - stats.mean) / std
    normalizedValues.push(normalized)

    if (raw === null) {
      missingFeatures.push(missingFeatureLabel(feature, model))
    } else {
      present += 1
    }
  }

  let logit = model.intercept

  if (model.modelType === 'GaussianNaiveBayes' && model.gaussianParams) {
    const class0 = model.gaussianParams.classes['0']
    const class1 = model.gaussianParams.classes['1']
    logit = Math.log(Math.max(class1.prior, 1e-6) / Math.max(class0.prior, 1e-6))

    for (const [index, feature] of model.features.entries()) {
      const contribution = gaussianLogDensity(normalizedValues[index], class1.means[index], class1.variances[index])
        - gaussianLogDensity(normalizedValues[index], class0.means[index], class0.variances[index])
      logit += contribution

      const raw = rawFeatureValue(feature, cell, model)
      contributions.push({
        feature,
        label: model.featureLabels[feature] ?? feature,
        group: featureGroup(feature, model),
        value: raw === null ? 'заполнено средним' : formatFeatureValue(feature, raw),
        contribution,
      })
    }
  } else {
    for (const [index, feature] of model.features.entries()) {
      const contribution = normalizedValues[index] * (model.weights[feature] ?? 0)
      logit += contribution

      const raw = rawFeatureValue(feature, cell, model)
      contributions.push({
        feature,
        label: model.featureLabels[feature] ?? feature,
        group: featureGroup(feature, model),
        value: raw === null ? 'заполнено средним' : formatFeatureValue(feature, raw),
        contribution,
      })
    }
  }

  const probability = sigmoid(logit)
  const prediction: MlPredictionBand = probability >= model.thresholds.likely
    ? 'likely'
    : probability <= model.thresholds.unlikely
      ? 'unlikely'
      : 'uncertain'
  const inputCoverage = present / model.features.length
  const certainty = Math.abs(probability - 0.5) * 2
  const evidencePenalty = cell.evidenceLevel === 'partial' ? 0.12 : 0
  const demPenalty = cell.hasDem ? 0 : 0.1
  const coveragePenalty = inputCoverage < 0.35 ? 0.12 : 0
  const confidence = clamp((certainty * 0.42) + (cell.scores.confidence * 0.32) + (inputCoverage * 0.26) - evidencePenalty - demPenalty - coveragePenalty)

  return {
    probability,
    prediction,
    confidence,
    inputCoverage,
    dataCompleteness: inputCoverage,
    modelVersion: model.version,
    calibrationNote: model.modelType === 'GaussianNaiveBayes'
      ? 'Feature-engineered classic ML v2; недостающие слои на карте заполняются средними значениями и снижают уверенность.'
      : 'Classic ML baseline; недостающие слои на карте заполняются средними значениями и снижают уверенность.',
    missingFeatures,
    topPositiveFactors: contributions
      .filter((factor) => factor.contribution > 0)
      .sort((left, right) => right.contribution - left.contribution)
      .slice(0, 4),
    topRiskFactors: contributions
      .filter((factor) => factor.contribution < 0)
      .sort((left, right) => left.contribution - right.contribution)
      .slice(0, 4),
    groupContributions: groupContributions(contributions),
  }
}

export function mlPredictionLabel(prediction: MlPredictionBand) {
  if (prediction === 'likely') return 'Вероятно подходит'
  if (prediction === 'unlikely') return 'Низкий потенциал'
  return 'Неопределенно'
}

export function mlPredictionTone(prediction: MlPredictionBand) {
  if (prediction === 'likely') return 'high' as const
  if (prediction === 'unlikely') return 'danger' as const
  return 'warning' as const
}

export function mlPredictionColor(prediction: MlPredictionBand) {
  if (prediction === 'likely') return '#1f9d63'
  if (prediction === 'unlikely') return '#c74b3f'
  return '#d59b17'
}
