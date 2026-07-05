import {
  actionLabel,
  clampNormalizedScore,
  confidenceBandFromScore,
  metricColor,
  normalizeActionId,
  priorityBandFromScore,
  priorityLabel,
  riskBandFromScore,
  deriveActionId,
  canonicalToken,
} from '@/lib/labels'
import { buildActionSummary, buildSiteExplanation } from '@/lib/explanation-engine'
import type {
  AnimalGroup,
  CalculatorData,
  CalculatorOutput,
  CompareData,
  CompareDifference,
  CompareExample,
  CompareSiteSummary,
  DashboardData,
  HighlightCard,
  ImplementationStep,
  KnowledgeData,
  KnowledgeParameter,
  LatLng,
  MapPoint,
  ScenarioCase,
  ScenarioMode,
  ScenarioSitePick,
  ScoreMetric,
  SiteScores,
  SiteDetail,
  SmartPastureBundle,
  StatItem,
  ZoneOption,
} from '@/lib/types'

interface RawMapPoint {
  id: number
  name: string
  district: string
  lat: number
  lon: number
  depth_m: number
  tds_gpl: number
  hps: number
  status: string
  badge: string
  pns?: number
  risk?: number
  confidence?: number
  priority_score?: number
  action_id?: string
  action?: string
}

interface RawMapPayload {
  stats?: StatItem[]
  points?: RawMapPoint[]
  boundary?: LatLng[]
}

interface RawKnowledgeParameter {
  num: number
  icon: string
  name: string
  color: string
  background: string
  limit: string
  source: string
  description: string
  table: Array<{ range: string; score: string; status: string }>
}

interface RawAnimalWaterNorm {
  key: string
  label: string
  avg: number
  min: number
  max: number
  hint: string
}

interface RawAnimalGroup {
  id: string
  label: string
  emoji: string
  color: string
  background: string
  border: string
  description: string
  animals: RawAnimalWaterNorm[]
}

interface RawMetric {
  label: string
  value: number
}

interface RawSiteDetail {
  site_id: number
  title: string
  district: string
  summary?: string
  priority_score?: number
  action?: string
  action_id?: string
  borderline?: boolean
  metrics?: RawMetric[]
  positive_reasons?: string[]
  caution_reasons?: string[]
  next_steps?: string[]
  confidence_note?: string
}

interface RawSiteCardsPayload {
  knowledge_sources?: string[]
  knowledge_parameters?: RawKnowledgeParameter[]
  zone_options?: ZoneOption[]
  animal_groups?: RawAnimalGroup[]
  site_details?: RawSiteDetail[]
}

interface RawHighlightCard {
  title: string
  value: string
  subtitle: string
  accent: string
  background: string
}

interface RawScenarioCase {
  name: string
  depth_m: number
  zone: string
  cost_tenge: number
  hps: number
  result: string
  status: string
}

interface RawScenarioPick {
  site_id: number
  title?: string
  district?: string
  action?: string
  action_id?: string
  reasons?: string[]
  selection_reasons?: string[]
}

interface RawScenarioMode {
  id: string
  title: string
  purpose: string
  accent: string
  background: string
  filters?: string[]
  shortlist?: RawScenarioPick[]
  excluded_count?: number
  excluded_summary?: string
}

interface RawScenarioOutputsPayload {
  highlight_cards?: RawHighlightCard[]
  scenario_cases?: RawScenarioCase[]
  calculator_outputs?: Array<{
    id: string
    hps: number
    label: string
    color: string
    total_demand_l: number
    total_demand_m3: number
    min_demand_l: number
    max_demand_l: number
    well_capacity_m3: number
    coverage_ratio: number
    depth_score: number
    tds_score: number
    zone_score: number
    flow_score: number
    summary: string
  }>
  scenario_modes?: RawScenarioMode[]
}

interface RawCompareSide {
  site_id: number
}

interface RawCompareExample {
  id: string
  title: string
  left: RawCompareSide
  right: RawCompareSide
  winner: string
  why_wins?: string[]
  human_review_needed?: boolean
  next_step_difference?: string
}

interface RawComparePayload {
  steps?: ImplementationStep[]
  implementation_steps?: ImplementationStep[]
  examples?: RawCompareExample[]
  compare_examples?: RawCompareExample[]
}

interface NormalizedSiteTruth {
  siteId: number
  title: string
  district: string
  lat?: number
  lon?: number
  depth?: number
  tds?: number
  hps: number
  pns: number
  risk: number
  confidence: number
  priorityScore: number
  actionId: SiteDetail['actionId']
  summary?: string
  positiveReasons: string[]
  cautionReasons: string[]
  nextSteps: string[]
  confidenceNote: string
  isBorderline: boolean
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${path}: ${response.status}`)
  }
  return response.json() as Promise<T>
}

function metricValue(metrics: RawMetric[] | undefined, label: string): number | undefined {
  return metrics?.find((metric) => metric.label.toUpperCase() === label.toUpperCase())?.value
}

function inferPns(point?: RawMapPoint, priorityScore = 0): number {
  if (!point) return 0.39
  if (/Тараз|Байзак/i.test(point.district)) return 0.71
  if (/Мойынкум|Сарысу/i.test(point.district)) return 0.62
  if (priorityScore >= 0.7) return 0.68
  if (priorityScore >= 0.4) return 0.56
  return 0.39
}

function inferConfidence(point: RawMapPoint | undefined, priorityScore: number, risk: number): number {
  if (typeof point?.confidence === 'number') return clampNormalizedScore(point.confidence)
  if (priorityScore >= 0.75 && risk <= 0.3) return 0.78
  if (priorityScore >= 0.45) return 0.56
  return 0.42
}

function toMetrics(site: Pick<NormalizedSiteTruth, 'hps' | 'pns' | 'risk' | 'confidence'>): ScoreMetric[] {
  return [
    { label: 'HPS', value: site.hps, color: metricColor('HPS', site.hps) },
    { label: 'PNS', value: site.pns, color: metricColor('PNS', site.pns) },
    { label: 'Risk', value: site.risk, color: metricColor('Risk', site.risk) },
    { label: 'Confidence', value: site.confidence, color: metricColor('Confidence', site.confidence) },
  ]
}

function toScores(site: Pick<NormalizedSiteTruth, 'hps' | 'pns' | 'risk' | 'confidence' | 'priorityScore'>): SiteScores {
  return {
    hps: site.hps,
    pns: site.pns,
    risk: site.risk,
    confidence: site.confidence,
    priority: site.priorityScore,
  }
}

function buildNormalizedSites(mapPayload: RawMapPayload, siteCards: RawSiteCardsPayload): Map<number, NormalizedSiteTruth> {
  const mapById = new Map((mapPayload.points ?? []).map((point) => [point.id, point]))
  const detailById = new Map((siteCards.site_details ?? []).map((detail) => [detail.site_id, detail]))
  const siteIds = [...new Set([...mapById.keys(), ...detailById.keys()])].sort((left, right) => left - right)

  return new Map(
    siteIds.map((siteId) => {
      const point = mapById.get(siteId)
      const detail = detailById.get(siteId)
      const hps = clampNormalizedScore(metricValue(detail?.metrics, 'HPS') ?? point?.hps ?? 0)
      const priorityScore = clampNormalizedScore(detail?.priority_score ?? point?.priority_score ?? hps)
      const pns = clampNormalizedScore(metricValue(detail?.metrics, 'PNS') ?? point?.pns ?? inferPns(point, priorityScore))
      const risk = clampNormalizedScore(metricValue(detail?.metrics, 'Risk') ?? point?.risk ?? 0.5)
      const confidence = clampNormalizedScore(metricValue(detail?.metrics, 'Confidence') ?? inferConfidence(point, priorityScore, risk))
      const normalizedAction = normalizeActionId(detail?.action_id, detail?.action, point?.action_id, point?.action)
      const actionId = normalizedAction === 'UNKNOWN' ? deriveActionId(priorityScore, risk, confidence) : normalizedAction
      const explanation = buildSiteExplanation({
        depth: point?.depth_m,
        tds: point?.tds_gpl,
        hps,
        pns,
        risk,
        confidence,
        actionId,
      })

      return [
        siteId,
        {
          siteId,
          title: detail?.title || point?.name || `Site ${siteId}`,
          district: detail?.district || point?.district || 'Неизвестный район',
          lat: point?.lat,
          lon: point?.lon,
          depth: point?.depth_m,
          tds: point?.tds_gpl,
          hps,
          pns,
          risk,
          confidence,
          priorityScore,
          actionId,
          summary: detail?.summary,
          positiveReasons: detail?.positive_reasons?.filter(Boolean) ?? explanation.positiveReasons,
          cautionReasons: detail?.caution_reasons?.filter(Boolean) ?? explanation.cautionReasons,
          nextSteps: detail?.next_steps?.filter(Boolean) ?? explanation.nextSteps,
          confidenceNote: detail?.confidence_note || explanation.confidenceNote,
          isBorderline: Boolean(detail?.borderline) || (priorityScore >= 0.45 && priorityScore <= 0.65) || (risk >= 0.45 && risk <= 0.65),
        } satisfies NormalizedSiteTruth,
      ]
    }),
  )
}

function toMapPoint(site: NormalizedSiteTruth, rawPoint: RawMapPoint): MapPoint {
  return {
    id: site.siteId,
    name: site.title,
    district: site.district,
    lat: rawPoint.lat,
    lon: rawPoint.lon,
    depth: rawPoint.depth_m,
    tds: rawPoint.tds_gpl,
    hps: site.hps,
    pns: site.pns,
    risk: site.risk,
    confidence: site.confidence,
    priorityScore: site.priorityScore,
    scores: toScores(site),
    priorityBand: priorityBandFromScore(site.priorityScore),
    actionId: site.actionId,
    badge: priorityLabel(priorityBandFromScore(site.priorityScore)),
    status: rawPoint.status || priorityBandFromScore(site.priorityScore).toUpperCase(),
  }
}

function toSiteDetail(site: NormalizedSiteTruth): SiteDetail {
  const priorityBand = priorityBandFromScore(site.priorityScore)
  const riskBand = riskBandFromScore(site.risk)
  const confidenceBand = confidenceBandFromScore(site.confidence)

  return {
    siteId: site.siteId,
    title: site.title,
    district: site.district,
    lat: site.lat,
    lon: site.lon,
    depth: site.depth,
    tds: site.tds,
    priorityScore: site.priorityScore,
    scores: toScores(site),
    priorityBand,
    riskBand,
    confidenceBand,
    actionId: site.actionId,
    summary: site.summary,
    isBorderline: site.isBorderline,
    metrics: toMetrics(site),
    positiveReasons: site.positiveReasons.slice(0, 3),
    cautionReasons: site.cautionReasons.slice(0, 3),
    nextSteps: site.nextSteps.slice(0, 3),
    confidenceNote: site.confidenceNote,
    actionSummary: buildActionSummary(site.actionId, site.nextSteps, site.confidenceNote),
  }
}

function buildDashboard(mapPayload: RawMapPayload, normalizedSites: Map<number, NormalizedSiteTruth>): DashboardData {
  return {
    stats: mapPayload.stats ?? [],
    points: (mapPayload.points ?? [])
      .map((point) => {
        const site = normalizedSites.get(point.id)
        return site ? toMapPoint(site, point) : null
      })
      .filter((point): point is MapPoint => point !== null),
    boundary: mapPayload.boundary ?? [],
  }
}

function buildKnowledge(siteCards: RawSiteCardsPayload): KnowledgeData {
  return {
    sources: siteCards.knowledge_sources ?? [],
    parameters: (siteCards.knowledge_parameters ?? []).map(
      (parameter): KnowledgeParameter => ({
        num: parameter.num,
        icon: parameter.icon,
        name: parameter.name,
        color: parameter.color,
        background: parameter.background,
        limit: parameter.limit,
        source: parameter.source,
        description: parameter.description,
        table: parameter.table ?? [],
      }),
    ),
  }
}

function buildCalculator(siteCards: RawSiteCardsPayload, scenarioOutputs: RawScenarioOutputsPayload): CalculatorData {
  return {
    zoneOptions: siteCards.zone_options ?? [],
    animalGroups: (siteCards.animal_groups ?? []).map(
      (group): AnimalGroup => ({
        ...group,
        animals: group.animals ?? [],
      }),
    ),
    outputs: (scenarioOutputs.calculator_outputs ?? []).map(
      (output): CalculatorOutput => ({
        id: output.id,
        hps: clampNormalizedScore(output.hps),
        label: output.label,
        color: output.color,
        totalDemandL: output.total_demand_l,
        totalDemandM3: output.total_demand_m3,
        minDemandL: output.min_demand_l,
        maxDemandL: output.max_demand_l,
        wellCapacityM3: output.well_capacity_m3,
        coverageRatio: output.coverage_ratio,
        depthScore: clampNormalizedScore(output.depth_score),
        tdsScore: clampNormalizedScore(output.tds_score),
        zoneScore: clampNormalizedScore(output.zone_score),
        flowScore: clampNormalizedScore(output.flow_score),
        summary: output.summary,
      }),
    ),
  }
}

function buildScenarios(
  scenarioOutputs: RawScenarioOutputsPayload,
  comparePayload: RawComparePayload,
  normalizedSites: Map<number, NormalizedSiteTruth>,
) {
  const highlightCards: HighlightCard[] = (scenarioOutputs.highlight_cards ?? []).map((card) => ({
    title: card.title,
    value: card.value,
    subtitle: card.subtitle,
    accent: card.accent,
    background: card.background,
  }))

  const scenarioCases: ScenarioCase[] = (scenarioOutputs.scenario_cases ?? []).map((scenario) => ({
    name: scenario.name,
    depth: scenario.depth_m,
    zone: scenario.zone,
    cost: scenario.cost_tenge,
    hps: clampNormalizedScore(scenario.hps),
    result: scenario.result,
    status: scenario.status,
  }))

  const scenarioModes: ScenarioMode[] = (scenarioOutputs.scenario_modes ?? []).map((mode) => ({
    id: mode.id,
    title: mode.title,
    purpose: mode.purpose,
    accent: mode.accent,
    background: mode.background,
    filters: mode.filters ?? [],
    shortlist: (mode.shortlist ?? []).map(
      (pick): ScenarioSitePick => {
        const site = normalizedSites.get(pick.site_id)
        const actionId = normalizeActionId(pick.action_id, pick.action)
        return {
          siteId: pick.site_id,
          title: site?.title || pick.title || `Точка ${pick.site_id}`,
          district: site?.district || pick.district || 'Неизвестный район',
          priorityBand: site ? priorityBandFromScore(site.priorityScore) : 'unknown',
          actionId: actionId === 'UNKNOWN' ? site?.actionId ?? 'UNKNOWN' : actionId,
          reasons: pick.reasons ?? pick.selection_reasons ?? [],
        }
      },
    ),
    excludedCount: mode.excluded_count,
    excludedSummary: mode.excluded_summary,
  }))

  return {
    highlightCards,
    scenarioCases,
    steps: comparePayload.steps ?? comparePayload.implementation_steps ?? [],
    scenarioModes,
  }
}

function pickWinner(left: number, right: number, higherIsBetter: boolean): CompareDifference['winner'] {
  if (left === right) return 'tie'
  if (higherIsBetter) return left > right ? 'left' : 'right'
  return left < right ? 'left' : 'right'
}

function buildCanonicalDifferences(left: NormalizedSiteTruth, right: NormalizedSiteTruth): CompareDifference[] {
  return [
    { label: 'HPS', left: left.hps, right: right.hps, winner: pickWinner(left.hps, right.hps, true) },
    { label: 'PNS', left: left.pns, right: right.pns, winner: pickWinner(left.pns, right.pns, true) },
    { label: 'Risk', left: left.risk, right: right.risk, winner: pickWinner(left.risk, right.risk, false) },
    { label: 'Confidence', left: left.confidence, right: right.confidence, winner: pickWinner(left.confidence, right.confidence, true) },
  ]
}

function buildCompare(comparePayload: RawComparePayload, normalizedSites: Map<number, NormalizedSiteTruth>): CompareData {
  const rawExamples = comparePayload.examples ?? comparePayload.compare_examples ?? []
  const examples = rawExamples.flatMap<CompareExample>((example) => {
      const leftSite = normalizedSites.get(example.left.site_id)
      const rightSite = normalizedSites.get(example.right.site_id)
      if (!leftSite || !rightSite) return []

      const left: CompareSiteSummary = {
        siteId: leftSite.siteId,
        title: leftSite.title,
        district: leftSite.district,
        priorityScore: leftSite.priorityScore,
        priorityBand: priorityBandFromScore(leftSite.priorityScore),
        actionId: leftSite.actionId,
        scores: toScores(leftSite),
        metrics: toMetrics(leftSite),
      }
      const right: CompareSiteSummary = {
        siteId: rightSite.siteId,
        title: rightSite.title,
        district: rightSite.district,
        priorityScore: rightSite.priorityScore,
        priorityBand: priorityBandFromScore(rightSite.priorityScore),
        actionId: rightSite.actionId,
        scores: toScores(rightSite),
        metrics: toMetrics(rightSite),
      }

      return [{
        id: example.id,
        title: example.title || `Сравнение ${leftSite.title} vs ${rightSite.title}`,
        left,
        right,
        winner: canonicalToken(example.winner) === 'RIGHT' ? 'right' : canonicalToken(example.winner) === 'TIE' ? 'tie' : 'left',
        whyWins: example.why_wins ?? [],
        differences: buildCanonicalDifferences(leftSite, rightSite),
        humanReviewNeeded: Boolean(example.human_review_needed) || leftSite.actionId === 'HUMAN_REVIEW_REQUIRED' || rightSite.actionId === 'HUMAN_REVIEW_REQUIRED',
        nextStepDifference: example.next_step_difference,
      }]
    })

  return { examples }
}

function buildValidationIssues(
  scenarioOutputs: RawScenarioOutputsPayload,
  comparePayload: RawComparePayload,
  normalizedSites: Map<number, NormalizedSiteTruth>,
): string[] {
  const issues: string[] = []

  for (const mode of scenarioOutputs.scenario_modes ?? []) {
    for (const pick of mode.shortlist ?? []) {
      if (!normalizedSites.has(pick.site_id)) {
        issues.push(`Scenario ${mode.id} ссылается на неизвестную точку ${pick.site_id}.`)
      }
    }
  }

  for (const example of comparePayload.examples ?? comparePayload.compare_examples ?? []) {
    if (!normalizedSites.has(example.left.site_id)) {
      issues.push(`Compare ${example.id} содержит неизвестную left-точку ${example.left.site_id}.`)
    }
    if (!normalizedSites.has(example.right.site_id)) {
      issues.push(`Compare ${example.id} содержит неизвестную right-точку ${example.right.site_id}.`)
    }
  }

  return issues
}

export async function loadSmartPastureBundle(): Promise<SmartPastureBundle> {
  const [mapPayload, siteCards, scenarioOutputs, comparePayload] = await Promise.all([
    fetchJson<RawMapPayload>('/data/map_points.json'),
    fetchJson<RawSiteCardsPayload>('/data/site_cards.json'),
    fetchJson<RawScenarioOutputsPayload>('/data/scenario_outputs.json'),
    fetchJson<RawComparePayload>('/data/compare_examples.json'),
  ])

  const normalizedSites = buildNormalizedSites(mapPayload, siteCards)
  const siteDetails = [...normalizedSites.values()].sort((left, right) => left.siteId - right.siteId).map(toSiteDetail)

  return {
    dashboard: buildDashboard(mapPayload, normalizedSites),
    knowledge: buildKnowledge(siteCards),
    calculator: buildCalculator(siteCards, scenarioOutputs),
    scenarios: buildScenarios(scenarioOutputs, comparePayload, normalizedSites),
    compare: buildCompare(comparePayload, normalizedSites),
    siteDetails,
    siteById: Object.fromEntries(siteDetails.map((detail) => [detail.siteId, detail])),
    validationIssues: buildValidationIssues(scenarioOutputs, comparePayload, normalizedSites),
  }
}

export function siteActionLabel(site: SiteDetail | CompareSiteSummary | ScenarioSitePick): string {
  return actionLabel(site.actionId)
}
