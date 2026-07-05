import type { ActionId, SiteDetail } from '@/lib/types'

export type ScenarioProfileKey = 'balanced' | 'safest' | 'confidence'
export type ScenarioActionFilter = ActionId | 'all'

export type ScenarioInput = {
  query: string
  topN: number
  minPriority: number
  maxRisk: number
  minConfidence: number
  actionId: ScenarioActionFilter
  profile: ScenarioProfileKey
}

export type ScenarioRun = {
  matches: SiteDetail[]
  shortlist: SiteDetail[]
  excludedCount: number
  baseRanking: number[]
  scenarioRanking: number[]
}

export const scenarioVersion = 'preset-v1'

export function scenarioScore(site: SiteDetail, profile: ScenarioProfileKey): number {
  const { hps, pns, risk, confidence } = site.scores
  if (profile === 'safest') return site.priorityScore * 0.34 + hps * 0.12 + pns * 0.1 + confidence * 0.18 - risk * 0.42
  if (profile === 'confidence') return site.priorityScore * 0.28 + hps * 0.12 + pns * 0.12 + confidence * 0.42 - risk * 0.16
  return site.priorityScore * 0.42 + hps * 0.22 + pns * 0.18 + confidence * 0.16 - risk * 0.18
}

export function scenarioAssumptionKeys(profile: ScenarioProfileKey): string[] {
  if (profile === 'safest') return ['scenario.assumption.safestRisk', 'scenario.assumption.safestConfidence', 'scenario.assumption.safestControl']
  if (profile === 'confidence') return ['scenario.assumption.confidenceWeight', 'scenario.assumption.confidenceProxy', 'scenario.assumption.confidenceDemo']
  return ['scenario.assumption.balancedUtility', 'scenario.assumption.balancedRisk', 'scenario.assumption.balancedTop']
}

export function scenarioAssumptions(profile: ScenarioProfileKey): string[] {
  if (profile === 'safest') return ['Risk penalty increased', 'Low-confidence sites deprioritized', 'Only controlled-risk inspections first']
  if (profile === 'confidence') return ['Confidence weighting increased', 'Unstable proxy signals pushed down', 'Best for judge/demo explanation']
  return ['Overall utility prioritized', 'Risk still penalized', 'Only top inspections selected']
}

export function runScenario(sites: SiteDetail[], input: ScenarioInput): ScenarioRun {
  const query = input.query.trim().toLowerCase()
  const matches = sites.filter((site) => {
    const matchesQuery =
      !query ||
      site.title.toLowerCase().includes(query) ||
      site.district.toLowerCase().includes(query) ||
      String(site.siteId) === query

    return (
      matchesQuery &&
      site.priorityScore >= input.minPriority &&
      site.scores.risk <= input.maxRisk &&
      site.scores.confidence >= input.minConfidence &&
      (input.actionId === 'all' || site.actionId === input.actionId)
    )
  })

  const sorted = [...matches].sort((left, right) => scenarioScore(right, input.profile) - scenarioScore(left, input.profile))
  const shortlist = sorted.slice(0, input.topN)
  return {
    matches,
    shortlist,
    excludedCount: Math.max(0, matches.length - shortlist.length),
    baseRanking: [...sites].sort((left, right) => right.priorityScore - left.priorityScore).map((site) => site.siteId),
    scenarioRanking: sorted.map((site) => site.siteId),
  }
}
