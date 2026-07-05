import { deriveActionId } from '@/lib/labels'
import type { GisProbeCell } from '@/lib/types'

export type ValidationStatusFilter = 'all' | 'success' | 'failed'

export interface ValidationWell {
  id: string
  lat: number
  lon: number
  region: string
  district: string
  year: number
  depthM: number
  yieldLps: number
  tdsGL: number | null
  waterQualityNote: string
  success: boolean
  elevationM: number | null
  sourceType: string
  sourceDescription: string
  dataStatus: string
  slopeDeg: number | null
  twi: number | null
  distanceToRiverM: number | null
  annualPrecipMm: number | null
  aridityIndex: number | null
  ndviMean: number | null
  landCoverClass: string
  aquiferProxy: number | null
  distanceToFaultM: number | null
  soilTextureClass: string
  lithologyClass: string
}

export interface ValidationSummary {
  total: number
  successCount: number
  failedCount: number
  successRate: number
  averageDepthM: number | null
  averageYieldLps: number | null
  averageTdsGL: number | null
  missingTdsCount: number
  syntheticCount: number
}

export interface ValidationRegionSummary extends ValidationSummary {
  region: string
}

export type ValidationPriorityBand = 'high' | 'medium' | 'low'

export interface ValidationPriorityScore {
  score: number
  band: ValidationPriorityBand
  confidence: number
  availableInputs: number
  missingInputs: number
}

export interface ValidationRankingSummary {
  total: number
  baselineSuccessRate: number
  top10Count: number
  top10SuccessRate: number
  top20Count: number
  top20SuccessRate: number
  highPriorityCount: number
  highPrioritySuccessRate: number | null
  averagePriorityScore: number | null
}

type RawWellFeature = {
  type?: string
  geometry?: {
    type?: string
    coordinates?: number[]
  }
  properties?: Record<string, unknown>
}

type RawWellCollection = {
  type?: string
  features?: RawWellFeature[]
}

const VALIDATION_WELLS_URL = '/data/validation/smartpasture_wells.geojson'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function average(values: Array<number | null>): number | null {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (clean.length === 0) return null
  return clean.reduce((sum, value) => sum + value, 0) / clean.length
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function scale(value: number | null, min: number, max: number, inverse = false): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const ratio = clamp((value - min) / (max - min), 0, 1)
  return (inverse ? 1 - ratio : ratio) * 100
}

function categoricalScore(value: string, scores: Record<string, number>): number | null {
  const key = value.trim().toLowerCase()
  if (!key || key === 'unknown') return null
  return scores[key] ?? null
}

function scoreDistanceToRiver(value: number | null): number | null {
  const scaled = scale(value, 8_000, 260_000, true)
  return scaled === null ? null : clamp(25 + scaled * 0.7)
}

function scoreDistanceToFault(value: number | null): number | null {
  const scaled = scale(value, 10_000, 320_000, true)
  return scaled === null ? null : clamp(24 + scaled * 0.62)
}

const SOIL_SCORES: Record<string, number> = {
  sandy_loam: 82,
  loam: 72,
  sandy: 55,
  clay: 38,
}

const LITHOLOGY_SCORES: Record<string, number> = {
  alluvial: 86,
  fluvial_sand: 84,
  conglomerate: 70,
  limestone: 64,
  loess: 58,
  lacustrine: 52,
  metamorphic: 38,
  granite: 30,
}

const LAND_COVER_SCORES: Record<string, number> = {
  herbaceous_vegetation: 80,
  shrubland: 68,
  cropland: 58,
  bare_sparse_vegetation: 38,
}

export function scoreValidationWell(well: ValidationWell): ValidationPriorityScore {
  const inputs: Array<{ value: number | null; weight: number }> = [
    { value: scoreDistanceToRiver(well.distanceToRiverM), weight: 0.14 },
    { value: scale(well.twi, 4, 13.5), weight: 0.14 },
    { value: scale(well.annualPrecipMm, 80, 360), weight: 0.12 },
    { value: scale(well.aridityIndex, 0.12, 0.62), weight: 0.1 },
    { value: scale(well.ndviMean, 0.12, 0.38), weight: 0.08 },
    { value: scale(well.slopeDeg, 0, 15, true), weight: 0.09 },
    { value: scoreDistanceToFault(well.distanceToFaultM), weight: 0.1 },
    { value: scale(well.aquiferProxy, 0.2, 0.9), weight: 0.12 },
    { value: categoricalScore(well.soilTextureClass, SOIL_SCORES), weight: 0.05 },
    { value: categoricalScore(well.lithologyClass, LITHOLOGY_SCORES), weight: 0.06 },
    { value: categoricalScore(well.landCoverClass, LAND_COVER_SCORES), weight: 0.04 },
  ]

  const present = inputs.filter((input) => input.value !== null)
  const totalWeight = inputs.reduce((sum, input) => sum + input.weight, 0)
  const presentWeight = present.reduce((sum, input) => sum + input.weight, 0)
  const score = presentWeight > 0
    ? present.reduce((sum, input) => sum + (input.value ?? 0) * input.weight, 0) / presentWeight
    : 0
  const roundedScore = Math.round(score)

  return {
    score: roundedScore,
    band: roundedScore >= 72 ? 'high' : roundedScore >= 55 ? 'medium' : 'low',
    confidence: Math.round((presentWeight / totalWeight) * 100),
    availableInputs: present.length,
    missingInputs: inputs.length - present.length,
  }
}

function slopeDegToPct(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Math.tan(value * Math.PI / 180) * 100
}

function validationLandCoverToProbeClass(value: string) {
  const key = value.trim().toLowerCase()
  if (key === 'herbaceous_vegetation') return 'grass'
  if (key === 'cropland') return 'cropland'
  if (key === 'shrubland') return 'shrubland'
  if (key === 'bare_sparse_vegetation') return 'bare'
  return 'unknown'
}

export function validationWellToGisProbeCell(well: ValidationWell): GisProbeCell {
  const priority = scoreValidationWell(well)
  const priorityScore = priority.score / 100
  const confidence = priority.confidence / 100
  const risk = clamp01(0.76 - priorityScore * 0.58 + (1 - confidence) * 0.18)
  const contextScore = clamp01(priorityScore * 0.82 + confidence * 0.18)

  return {
    lat: well.lat,
    lon: well.lon,
    elevationM: well.elevationM,
    slopePct: slopeDegToPct(well.slopeDeg),
    roadKm: -1,
    waterKm: well.distanceToRiverM === null ? -1 : well.distanceToRiverM / 1000,
    roadClass: 'unknown',
    waterClass: 'river',
    landuseClass: validationLandCoverToProbeClass(well.landCoverClass),
    insideWater: false,
    hasDem: well.elevationM !== null && well.slopeDeg !== null,
    evidenceLevel: priority.missingInputs <= 2 ? 'full' : 'partial',
    contextScoreLabel: contextScore >= 0.7 ? 'favorable' : contextScore >= 0.45 ? 'mixed' : 'constrained',
    scores: {
      contextScore,
      risk,
      confidence,
      priority: priorityScore,
    },
    actionId: deriveActionId(priorityScore, risk, confidence),
  }
}

function successRate(wells: ValidationWell[]): number {
  if (wells.length === 0) return 0
  return wells.filter((well) => well.success).length / wells.length
}

export function summarizePriorityRanking(wells: ValidationWell[]): ValidationRankingSummary {
  const ranked = [...wells].sort((left, right) => scoreValidationWell(right).score - scoreValidationWell(left).score)
  const top10Count = Math.min(10, ranked.length)
  const top20Count = Math.min(20, ranked.length)
  const highPriority = ranked.filter((well) => scoreValidationWell(well).band === 'high')

  return {
    total: ranked.length,
    baselineSuccessRate: successRate(ranked),
    top10Count,
    top10SuccessRate: successRate(ranked.slice(0, top10Count)),
    top20Count,
    top20SuccessRate: successRate(ranked.slice(0, top20Count)),
    highPriorityCount: highPriority.length,
    highPrioritySuccessRate: highPriority.length > 0 ? successRate(highPriority) : null,
    averagePriorityScore: average(ranked.map((well) => scoreValidationWell(well).score)),
  }
}

export function summarizeValidationWells(wells: ValidationWell[]): ValidationSummary {
  const total = wells.length
  const successCount = wells.filter((well) => well.success).length
  const failedCount = total - successCount

  return {
    total,
    successCount,
    failedCount,
    successRate: total > 0 ? successCount / total : 0,
    averageDepthM: average(wells.map((well) => well.depthM)),
    averageYieldLps: average(wells.map((well) => well.yieldLps)),
    averageTdsGL: average(wells.map((well) => well.tdsGL)),
    missingTdsCount: wells.filter((well) => well.tdsGL === null).length,
    syntheticCount: wells.filter((well) => well.dataStatus === 'SYNTHETIC_DEMO').length,
  }
}

export function summarizeRegions(wells: ValidationWell[]): ValidationRegionSummary[] {
  const groups = new Map<string, ValidationWell[]>()

  for (const well of wells) {
    const current = groups.get(well.region) ?? []
    current.push(well)
    groups.set(well.region, current)
  }

  return Array.from(groups.entries())
    .map(([region, regionWells]) => ({ region, ...summarizeValidationWells(regionWells) }))
    .sort((left, right) => right.total - left.total)
}

export function filterValidationWells(
  wells: ValidationWell[],
  region: string,
  status: ValidationStatusFilter,
  query: string,
): ValidationWell[] {
  const normalizedQuery = query.trim().toLowerCase()

  return wells.filter((well) => {
    if (region !== 'all' && well.region !== region) return false
    if (status === 'success' && !well.success) return false
    if (status === 'failed' && well.success) return false
    if (!normalizedQuery) return true

    return [
      well.id,
      well.region,
      well.district,
      well.waterQualityNote,
      well.sourceType,
      well.landCoverClass,
      well.lithologyClass,
    ].some((value) => value.toLowerCase().includes(normalizedQuery))
  })
}

function parseWellFeature(feature: RawWellFeature): ValidationWell | null {
  const properties = feature.properties ?? {}
  const coordinates = feature.geometry?.coordinates
  const lon = asNumber(coordinates?.[0])
  const lat = asNumber(coordinates?.[1])

  if (lat === null || lon === null) return null

  return {
    id: asString(properties.id, `well-${lat.toFixed(4)}-${lon.toFixed(4)}`),
    lat,
    lon,
    region: asString(properties.region, 'Unknown region'),
    district: asString(properties.district, 'Unknown district'),
    year: asNumber(properties.year) ?? 0,
    depthM: asNumber(properties.depth_m) ?? 0,
    yieldLps: asNumber(properties.yield_lps) ?? 0,
    tdsGL: asNumber(properties.tds_g_l),
    waterQualityNote: asString(properties.water_quality_note, 'No quality note'),
    success: asNumber(properties.success) === 1,
    elevationM: asNumber(properties.elevation_m),
    sourceType: asString(properties.source_type, 'unknown'),
    sourceDescription: asString(properties.source_description, 'No source description'),
    dataStatus: asString(properties.data_status, 'UNKNOWN'),
    slopeDeg: asNumber(properties.slope_deg),
    twi: asNumber(properties.twi),
    distanceToRiverM: asNumber(properties.dist_to_river_m),
    annualPrecipMm: asNumber(properties.annual_precip_mm),
    aridityIndex: asNumber(properties.aridity_index),
    ndviMean: asNumber(properties.ndvi_mean_growing_season),
    landCoverClass: asString(properties.land_cover_class, 'unknown'),
    aquiferProxy: asNumber(properties.aquifer_proxy),
    distanceToFaultM: asNumber(properties.dist_to_fault_m),
    soilTextureClass: asString(properties.soil_texture_class, 'unknown'),
    lithologyClass: asString(properties.lithology_class, 'unknown'),
  }
}

export async function loadValidationWells(): Promise<ValidationWell[]> {
  const response = await fetch(VALIDATION_WELLS_URL)
  if (!response.ok) {
    throw new Error(`Failed to load validation wells: ${response.status}`)
  }

  const payload = await response.json() as RawWellCollection
  return (payload.features ?? [])
    .map(parseWellFeature)
    .filter((well): well is ValidationWell => well !== null)
}
