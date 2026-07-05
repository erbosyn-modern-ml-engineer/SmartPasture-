import { confidenceBandFromScore, priorityBandFromScore, riskBandFromScore } from '@/lib/labels'
import type {
  ActionId,
  EvidenceLevel,
  GisProbeCell,
  GisProbeDataset,
  ProbeScenarioCandidate,
  SavedProbePoint,
  ScenarioSourceMode,
} from '@/lib/types'

const FULL_MAP_DEDUP_RADIUS_KM = 10
const EARTH_RADIUS_KM = 6371

export type ProbeScenarioProfileKey = 'balanced' | 'safest' | 'confidence'
export type ProbeScenarioActionFilter = ActionId | 'all'
export type ProbeEvidenceFilter = EvidenceLevel | 'all'

export type ProbeScenarioInput = {
  sourceMode: ScenarioSourceMode
  query: string
  topN: number
  minPriority: number
  maxRisk: number
  minConfidence: number
  actionId: ProbeScenarioActionFilter
  evidenceLevel: ProbeEvidenceFilter
  profile: ProbeScenarioProfileKey
}

export type ProbeScenarioRun = {
  sourceMode: ScenarioSourceMode
  matches: ProbeScenarioCandidate[]
  shortlist: ProbeScenarioCandidate[]
  preDedupMatches: number
  dedupExcludedCount: number
  excludedCount: number
  baseRanking: string[]
  scenarioRanking: string[]
}

export type ProbeCompareDifference = {
  label: string
  left: number
  right: number
  winner: 'left' | 'right' | 'tie'
  lowerIsBetter?: boolean
}

type SaveProbePointFn = (cell: GisProbeCell, name: string) => void

function evidenceBonus(level: EvidenceLevel): number {
  return level === 'full' ? 0.06 : 0
}

function normalizeCandidateId(prefix: string, cell: GisProbeCell): string {
  return `${prefix}:${cell.lat.toFixed(6)}:${cell.lon.toFixed(6)}`
}

function formatCandidateSubtitle(cell: GisProbeCell): string {
  return `${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)}`
}

function candidateMatchesQuery(candidate: ProbeScenarioCandidate, query: string): boolean {
  if (!query) return true

  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return (
    candidate.displayName.toLowerCase().includes(normalizedQuery) ||
    candidate.subtitle.toLowerCase().includes(normalizedQuery)
  )
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function haversineDistanceKm(left: ProbeScenarioCandidate, right: ProbeScenarioCandidate): number {
  const latDelta = toRadians(right.lat - left.lat)
  const lonDelta = toRadians(right.lon - left.lon)
  const leftLat = toRadians(left.lat)
  const rightLat = toRadians(right.lat)

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lonDelta / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isNearSelectedCandidate(
  candidate: ProbeScenarioCandidate,
  selectedCandidates: ProbeScenarioCandidate[],
  radiusKm: number,
): boolean {
  return selectedCandidates.some((selectedCandidate) => haversineDistanceKm(candidate, selectedCandidate) < radiusKm)
}

function dedupeFullMapShortlist(
  rankedCandidates: ProbeScenarioCandidate[],
  topN: number,
): Pick<ProbeScenarioRun, 'shortlist' | 'dedupExcludedCount' | 'scenarioRanking'> {
  const shortlist: ProbeScenarioCandidate[] = []
  const scenarioRanking: string[] = []
  let dedupExcludedCount = 0

  for (const candidate of rankedCandidates) {
    if (isNearSelectedCandidate(candidate, shortlist, FULL_MAP_DEDUP_RADIUS_KM)) {
      dedupExcludedCount += 1
      continue
    }

    shortlist.push(candidate)
    scenarioRanking.push(candidate.id)

    if (shortlist.length >= topN) {
      break
    }
  }

  return {
    shortlist,
    dedupExcludedCount,
    scenarioRanking,
  }
}

export function buildFullMapScenarioCandidates(dataset: GisProbeDataset): ProbeScenarioCandidate[] {
  let candidateIndex = 0

  return dataset.cells.flatMap((cell) => {
    if (!cell) return []

    candidateIndex += 1
    return [{
      id: normalizeCandidateId('full-map', cell),
      displayName: `Candidate ${candidateIndex}`,
      subtitle: formatCandidateSubtitle(cell),
      lat: cell.lat,
      lon: cell.lon,
      cell,
      source: 'full_map' as const,
    }]
  })
}

export function buildWishlistScenarioCandidates(points: SavedProbePoint[]): ProbeScenarioCandidate[] {
  return points.map((point) => ({
    id: point.id,
    displayName: point.name,
    subtitle: formatCandidateSubtitle(point.cell),
    lat: point.cell.lat,
    lon: point.cell.lon,
    cell: point.cell,
    source: 'wishlist' as const,
    savedProbePointId: point.id,
  }))
}

export function probeScenarioScore(candidate: ProbeScenarioCandidate, profile: ProbeScenarioProfileKey): number {
  const { priority, contextScore, confidence, risk } = candidate.cell.scores
  const bonus = evidenceBonus(candidate.cell.evidenceLevel)

  if (profile === 'safest') {
    return priority * 0.3 + contextScore * 0.18 + confidence * 0.24 + (1 - risk) * 0.28 + bonus
  }

  if (profile === 'confidence') {
    return priority * 0.28 + contextScore * 0.18 + confidence * 0.34 + (1 - risk) * 0.14 + bonus
  }

  return priority * 0.4 + contextScore * 0.24 + confidence * 0.16 + (1 - risk) * 0.2 + bonus
}

export function runProbeScenario(
  candidates: ProbeScenarioCandidate[],
  input: ProbeScenarioInput,
): ProbeScenarioRun {
  const matches = candidates.filter((candidate) => {
    const cell = candidate.cell

    return (
      candidateMatchesQuery(candidate, input.query) &&
      cell.scores.priority >= input.minPriority &&
      cell.scores.risk <= input.maxRisk &&
      cell.scores.confidence >= input.minConfidence &&
      (input.actionId === 'all' || cell.actionId === input.actionId) &&
      (input.evidenceLevel === 'all' || cell.evidenceLevel === input.evidenceLevel)
    )
  })

  const sorted = [...matches].sort((left, right) => {
    const scoreDelta = probeScenarioScore(right, input.profile) - probeScenarioScore(left, input.profile)
    if (Math.abs(scoreDelta) > 0.0001) {
      return scoreDelta
    }
    return right.cell.scores.priority - left.cell.scores.priority
  })

  const baseRanking = [...candidates]
    .sort((left, right) => right.cell.scores.priority - left.cell.scores.priority)
    .map((candidate) => candidate.id)

  if (input.sourceMode === 'full_map') {
    const deduped = dedupeFullMapShortlist(sorted, input.topN)

    return {
      sourceMode: input.sourceMode,
      matches,
      shortlist: deduped.shortlist,
      preDedupMatches: matches.length,
      dedupExcludedCount: deduped.dedupExcludedCount,
      excludedCount: Math.max(0, matches.length - deduped.shortlist.length),
      baseRanking,
      scenarioRanking: deduped.scenarioRanking,
    }
  }

  const shortlist = sorted.slice(0, input.topN)

  return {
    sourceMode: input.sourceMode,
    matches,
    shortlist,
    preDedupMatches: matches.length,
    dedupExcludedCount: 0,
    excludedCount: Math.max(0, matches.length - shortlist.length),
    baseRanking,
    scenarioRanking: shortlist.map((candidate) => candidate.id),
  }
}

function compareMetric(left: number, right: number, lowerIsBetter = false): 'left' | 'right' | 'tie' {
  if (Math.abs(left - right) < 0.0001) return 'tie'
  if (lowerIsBetter) return left < right ? 'left' : 'right'
  return left > right ? 'left' : 'right'
}

export function buildProbeCompareDifferences(left: SavedProbePoint, right: SavedProbePoint): ProbeCompareDifference[] {
  return [
    { label: 'Priority', left: left.cell.scores.priority, right: right.cell.scores.priority, winner: compareMetric(left.cell.scores.priority, right.cell.scores.priority) },
    { label: 'GIS Context', left: left.cell.scores.contextScore, right: right.cell.scores.contextScore, winner: compareMetric(left.cell.scores.contextScore, right.cell.scores.contextScore) },
    { label: 'Confidence', left: left.cell.scores.confidence, right: right.cell.scores.confidence, winner: compareMetric(left.cell.scores.confidence, right.cell.scores.confidence) },
    { label: 'Risk', left: left.cell.scores.risk, right: right.cell.scores.risk, winner: compareMetric(left.cell.scores.risk, right.cell.scores.risk, true), lowerIsBetter: true },
    { label: 'Road km', left: left.cell.roadKm, right: right.cell.roadKm, winner: compareMetric(left.cell.roadKm, right.cell.roadKm, true), lowerIsBetter: true },
    { label: 'Water km', left: left.cell.waterKm, right: right.cell.waterKm, winner: compareMetric(left.cell.waterKm, right.cell.waterKm, true), lowerIsBetter: true },
  ]
}

export function probeCompareScore(point: SavedProbePoint): number {
  return probeScenarioScore(
    {
      id: point.id,
      displayName: point.name,
      subtitle: formatCandidateSubtitle(point.cell),
      lat: point.cell.lat,
      lon: point.cell.lon,
      cell: point.cell,
      source: 'wishlist',
      savedProbePointId: point.id,
    },
    'balanced',
  )
}

export function probePreferredPoint(left: SavedProbePoint, right: SavedProbePoint): SavedProbePoint | null {
  const leftScore = probeCompareScore(left)
  const rightScore = probeCompareScore(right)
  if (Math.abs(leftScore - rightScore) < 0.0001) return null
  return leftScore > rightScore ? left : right
}

export function probeWhyPreferred(preferred: SavedProbePoint, alternate: SavedProbePoint): string[] {
  const reasons: string[] = []
  if (preferred.cell.scores.priority > alternate.cell.scores.priority) reasons.push('Higher overall priority for the next drill check.')
  if (preferred.cell.scores.contextScore > alternate.cell.scores.contextScore) reasons.push('Stronger GIS context from roads, water, and landuse.')
  if (preferred.cell.scores.confidence > alternate.cell.scores.confidence) reasons.push('Higher confidence on current evidence.')
  if (preferred.cell.scores.risk < alternate.cell.scores.risk) reasons.push('Lower overall screening risk.')
  if (preferred.cell.evidenceLevel === 'full' && alternate.cell.evidenceLevel !== 'full') reasons.push('Has full evidence with DEM-backed slope instead of partial evidence.')
  return reasons.slice(0, 4)
}

export function probeNeedsHumanReview(left: SavedProbePoint, right: SavedProbePoint): boolean {
  return (
    Math.abs(probeCompareScore(left) - probeCompareScore(right)) < 0.08 ||
    left.cell.actionId === 'HUMAN_REVIEW_REQUIRED' ||
    right.cell.actionId === 'HUMAN_REVIEW_REQUIRED'
  )
}

export function probePriorityBand(point: SavedProbePoint) {
  return priorityBandFromScore(point.cell.scores.priority)
}

export function probeConfidenceBand(point: SavedProbePoint) {
  return confidenceBandFromScore(point.cell.scores.confidence)
}

export function probeRiskBand(point: SavedProbePoint) {
  return riskBandFromScore(point.cell.scores.risk)
}

export function findSavedPointForScenarioCandidate(
  savedProbePoints: SavedProbePoint[],
  candidate: ProbeScenarioCandidate,
): SavedProbePoint | null {
  return savedProbePoints.find((point) => point.cell.lat === candidate.lat && point.cell.lon === candidate.lon) ?? null
}

export function saveScenarioCandidateToWishlist(
  candidate: ProbeScenarioCandidate,
  savedProbePoints: SavedProbePoint[],
  saveProbePoint: SaveProbePointFn,
  optionalName?: string,
): boolean {
  if (findSavedPointForScenarioCandidate(savedProbePoints, candidate)) {
    return false
  }

  const nextName = optionalName?.trim() || candidate.displayName
  saveProbePoint(candidate.cell, nextName)
  return true
}
