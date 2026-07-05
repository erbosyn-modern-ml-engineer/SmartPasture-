export type PriorityBand = 'high' | 'medium' | 'low' | 'unknown'
export type ConfidenceBand = 'high' | 'medium' | 'low' | 'unknown'
export type RiskBand = 'low' | 'medium' | 'high' | 'unknown'
export type ActionId =
  | 'INSPECT_FIRST'
  | 'INSPECT_WITH_QUICK_VERIFICATION'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'DEFER'
  | 'NOT_RECOMMENDED_CURRENT_EVIDENCE'
  | 'UNKNOWN'

export interface StatItem {
  label: string
  value: string
  color: string
}

export interface LatLng {
  lat: number
  lon: number
}

export interface ScoreMetric {
  label: string
  value: number
  color: string
}

export interface SiteScores {
  hps: number
  pns: number
  risk: number
  confidence: number
  priority: number
}

export interface ActionSummary {
  actionId: ActionId
  summary: string
  nextSteps: string[]
  cautionNote?: string
}

export interface MapPoint {
  id: number
  name: string
  district: string
  lat: number
  lon: number
  depth: number
  tds: number
  hps: number
  pns: number
  risk: number
  confidence: number
  priorityScore: number
  scores: SiteScores
  priorityBand: PriorityBand
  actionId: ActionId
  badge: string
  status: string
}

export interface KnowledgeRow {
  range: string
  score: string
  status: string
}

export interface KnowledgeParameter {
  num: number
  icon: string
  name: string
  color: string
  background: string
  limit: string
  source: string
  description: string
  table: KnowledgeRow[]
}

export interface ZoneOption {
  value: string
  label: string
  score: number
}

export interface AnimalWaterNorm {
  key: string
  label: string
  avg: number
  min: number
  max: number
  hint: string
}

export interface AnimalGroup {
  id: string
  label: string
  emoji: string
  color: string
  background: string
  border: string
  description: string
  animals: AnimalWaterNorm[]
}

export interface HighlightCard {
  title: string
  value: string
  subtitle: string
  accent: string
  background: string
}

export interface ScenarioCase {
  name: string
  depth: number
  zone: string
  cost: number
  hps: number
  result: string
  status: string
}

export interface ScenarioSitePick {
  siteId: number
  title: string
  district: string
  priorityBand: PriorityBand
  actionId: ActionId
  reasons: string[]
}

export interface ScenarioMode {
  id: string
  title: string
  purpose: string
  accent: string
  background: string
  filters: string[]
  shortlist: ScenarioSitePick[]
  excludedCount?: number
  excludedSummary?: string
}

export interface CompareSiteSummary {
  siteId: number
  title: string
  district: string
  priorityScore: number
  priorityBand: PriorityBand
  actionId: ActionId
  scores: SiteScores
  metrics: ScoreMetric[]
}

export interface CompareDifference {
  label: string
  left: number
  right: number
  winner: 'left' | 'right' | 'tie'
}

export interface CompareExample {
  id: string
  title: string
  left: CompareSiteSummary
  right: CompareSiteSummary
  winner: 'left' | 'right' | 'tie'
  whyWins: string[]
  differences: CompareDifference[]
  humanReviewNeeded: boolean
  nextStepDifference?: string
}

export interface ImplementationStep {
  title: string
  body: string
}

export interface SiteDetail {
  siteId: number
  title: string
  district: string
  lat?: number
  lon?: number
  depth?: number
  tds?: number
  priorityScore: number
  scores: SiteScores
  priorityBand: PriorityBand
  riskBand: RiskBand
  confidenceBand: ConfidenceBand
  actionId: ActionId
  summary?: string
  isBorderline: boolean
  metrics: ScoreMetric[]
  positiveReasons: string[]
  cautionReasons: string[]
  nextSteps: string[]
  confidenceNote: string
  actionSummary: ActionSummary
}

export interface CalculatorOutput {
  id: string
  hps: number
  label: string
  color: string
  totalDemandL: number
  totalDemandM3: number
  minDemandL: number
  maxDemandL: number
  wellCapacityM3: number
  coverageRatio: number
  depthScore: number
  tdsScore: number
  zoneScore: number
  flowScore: number
  summary: string
}

export interface LivestockDemandSummary {
  totalAnimals: number
  qNeedL: number
  qNeedM3: number
  minNeedL: number
  maxNeedL: number
}

export interface LivestockPnsOutput extends LivestockDemandSummary {
  flowLps: number
  qStockL: number
  qStockM3: number
  coverageRatio: number
  pns: number
  verdict: 'needs_input' | 'insufficient' | 'borderline' | 'enough'
  summary: string
}

export interface DashboardData {
  stats: StatItem[]
  points: MapPoint[]
  boundary: LatLng[]
}

export interface KnowledgeData {
  sources: string[]
  parameters: KnowledgeParameter[]
}

export interface CalculatorData {
  zoneOptions: ZoneOption[]
  animalGroups: AnimalGroup[]
  outputs: CalculatorOutput[]
}

export interface ScenariosData {
  highlightCards: HighlightCard[]
  scenarioCases: ScenarioCase[]
  steps: ImplementationStep[]
  scenarioModes: ScenarioMode[]
}

export interface CompareData {
  examples: CompareExample[]
}

export interface SmartPastureBundle {
  dashboard: DashboardData
  knowledge: KnowledgeData
  calculator: CalculatorData
  scenarios: ScenariosData
  compare: CompareData
  siteDetails: SiteDetail[]
  siteById: Record<number, SiteDetail>
  validationIssues: string[]
}

export type EvidenceLevel = 'full' | 'partial'

export interface GisProbeScores {
  contextScore: number
  risk: number
  confidence: number
  priority: number
}

export interface GisProbeCell {
  lat: number
  lon: number
  elevationM: number | null
  slopePct: number | null
  roadKm: number
  waterKm: number
  roadClass: string
  waterClass: string
  landuseClass: string
  insideWater: boolean
  hasDem: boolean
  evidenceLevel: EvidenceLevel
  contextScoreLabel: 'favorable' | 'mixed' | 'constrained'
  scores: GisProbeScores
  actionId: ActionId
}

export interface GisProbeMeta {
  name: string
  description: string
  sourceLayers: string[]
  generatedWithStepDegrees: number
}

export interface GisProbeBounds {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

export interface GisProbePolygonGeometry {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface GisProbeMultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: number[][][][]
}

export type GisProbeGeometry = GisProbePolygonGeometry | GisProbeMultiPolygonGeometry

export interface GisProbeSummary {
  aoiCells: number
  fullEvidenceCells: number
  partialEvidenceCells: number
}

export interface GisProbeDataset {
  meta: GisProbeMeta
  boundary: GisProbeGeometry
  bounds: GisProbeBounds
  rows: number
  cols: number
  stepDeg: number
  cells: Array<GisProbeCell | null>
  summary: GisProbeSummary
}

export interface SavedProbePoint {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  cell: GisProbeCell
}

export type ScenarioSourceMode = 'full_map' | 'wishlist'

export interface ProbeScenarioCandidate {
  id: string
  displayName: string
  subtitle: string
  lat: number
  lon: number
  cell: GisProbeCell
  source: ScenarioSourceMode
  savedProbePointId?: string
}
