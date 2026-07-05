import type { ActionId, ActionSummary } from '@/lib/types'

type ExplanationInput = {
  depth?: number
  tds?: number
  hps: number
  pns: number
  risk: number
  confidence: number
  actionId: ActionId
}

export type SiteExplanation = {
  positiveReasons: string[]
  cautionReasons: string[]
  nextSteps: string[]
  confidenceNote: string
}

export function buildSiteExplanation(input: ExplanationInput): SiteExplanation {
  const positiveReasons: string[] = []
  const cautionReasons: string[] = []
  const nextSteps = ['Check nearby well archives and depth records before the pilot trip.']

  if ((input.depth ?? Number.POSITIVE_INFINITY) <= 40) {
    positiveReasons.push('Depth remains inside a practical pilot-check range.')
  }
  if ((input.tds ?? Number.POSITIVE_INFINITY) <= 1) {
    positiveReasons.push('Salinity proxy looks usable for livestock water planning.')
  }
  if (input.hps >= 0.7) {
    positiveReasons.push('Hydro Potential Score gives a strong preliminary water-suitability signal.')
  }
  if (input.pns >= 0.6) {
    positiveReasons.push('Pasture Need Score increases the practical value of this inspection point.')
  }

  if ((input.depth ?? 0) >= 60) {
    cautionReasons.push('Depth may increase drilling cost and field uncertainty.')
  }
  if ((input.tds ?? 0) >= 2) {
    cautionReasons.push('Salinity proxy raises a water-quality caution before any final decision.')
  }
  if (input.risk >= 0.5) {
    cautionReasons.push('Risk score is sensitive enough to require an extra field check.')
  }
  if (input.confidence < 0.55) {
    cautionReasons.push('Confidence is limited because part of the signal depends on proxy data.')
  }

  if (input.risk >= 0.5 || input.confidence < 0.55) {
    nextSteps.push('Run a quick verification pass before committing the full inspection team.')
  }
  if ((input.tds ?? 0) >= 2) {
    nextSteps.push('Plan a lab water-quality check after any sample collection.')
  }
  nextSteps.push('Compare this point in scenario mode before locking the shortlist.')

  return {
    positiveReasons: positiveReasons.length ? positiveReasons.slice(0, 3) : ['At least one workable proxy signal is present, but no single factor dominates.'],
    cautionReasons: cautionReasons.length ? cautionReasons.slice(0, 3) : ['A quick engineering check is still required before field work.'],
    nextSteps: nextSteps.slice(0, 3),
    confidenceNote: buildConfidenceNote(input.confidence),
  }
}

export function buildConfidenceNote(confidence: number): string {
  if (confidence >= 0.72) {
    return 'Confidence is above average: signals agree, but field control is still required.'
  }
  if (confidence >= 0.5) {
    return 'Confidence is moderate: the point can enter a shortlist, but needs a quick on-site check.'
  }
  return 'Confidence is low: use this point only as a cautious reserve or human-review case.'
}

export function buildActionSummary(actionId: ActionId, nextSteps: string[], cautionNote?: string): ActionSummary {
  const summaries: Record<ActionId, string> = {
    INSPECT_FIRST: 'Best candidate for the first field trip.',
    INSPECT_WITH_QUICK_VERIFICATION: 'Good candidate, but needs a quick field check.',
    HUMAN_REVIEW_REQUIRED: 'Expert review is needed before a decision.',
    DEFER: 'Defer until stronger evidence appears.',
    NOT_RECOMMENDED_CURRENT_EVIDENCE: 'Current evidence does not make this site a priority.',
    UNKNOWN: 'The site needs additional verification.',
  }

  return {
    actionId,
    summary: summaries[actionId],
    nextSteps: nextSteps.slice(0, 3),
    cautionNote,
  }
}
