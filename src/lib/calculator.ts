import { clampNormalizedScore, priorityColor } from '@/lib/labels'
import type { AnimalGroup, CalculatorOutput, LivestockDemandSummary, LivestockPnsOutput, ZoneOption } from '@/lib/types'
import type { Language } from '@/i18n/translations'

function collectAnimalDemandSummary(
  animalGroups: AnimalGroup[],
  animalCounts: Record<string, string>,
): LivestockDemandSummary {
  let totalAnimals = 0
  let totalAvg = 0
  let totalMin = 0
  let totalMax = 0

  for (const group of animalGroups) {
    for (const animal of group.animals) {
      const count = Math.max(0, Number(animalCounts[animal.key]) || 0)
      totalAnimals += count
      totalAvg += count * animal.avg
      totalMin += count * animal.min
      totalMax += count * animal.max
    }
  }

  return {
    totalAnimals,
    qNeedL: totalAvg,
    qNeedM3: totalAvg / 1000,
    minNeedL: totalMin,
    maxNeedL: totalMax,
  }
}

function coverageRatioToPns(coverageRatio: number) {
  if (!Number.isFinite(coverageRatio) || coverageRatio <= 0) return 0
  if (coverageRatio < 0.5) return clampNormalizedScore(coverageRatio * 0.5)
  if (coverageRatio < 1) return clampNormalizedScore(0.25 + ((coverageRatio - 0.5) / 0.5) * 0.45)
  if (coverageRatio < 1.5) return clampNormalizedScore(0.7 + ((coverageRatio - 1) / 0.5) * 0.15)
  if (coverageRatio < 3) return clampNormalizedScore(0.85 + ((coverageRatio - 1.5) / 1.5) * 0.15)
  return 1
}

export function computeLivestockPnsOutput(params: {
  flowText: string
  animalGroups: AnimalGroup[]
  animalCounts: Record<string, string>
  language?: Language
}): LivestockPnsOutput {
  const flowLps = Math.max(0, Number(params.flowText) || 0)
  const demand = collectAnimalDemandSummary(params.animalGroups, params.animalCounts)
  const qStockM3 = flowLps * 86.4
  const qStockL = qStockM3 * 1000
  const coverageRatio = demand.qNeedM3 > 0 ? qStockM3 / demand.qNeedM3 : 0
  const pns = demand.totalAnimals > 0 ? coverageRatioToPns(coverageRatio) : 0
  const language = params.language ?? 'kk'
  const copy = {
    kk: {
      needsInput: 'Алдымен мал санын енгізіңіз, сонда PNS есептеледі.',
      enough: 'Болжамды су қоры осы мал санына жетеді және резерв қалдырады.',
      borderline: 'Болжамды су қоры мал сұранысына шамалас, сондықтан дебитті далада нақтылау керек.',
      insufficient: 'Болжамды су қоры бұл мал санына әзірге жетпейді.',
    },
    ru: {
      needsInput: 'Сначала введите количество скота, чтобы посчитать PNS.',
      enough: 'Предполагаемого запаса воды хватает на это стадо с запасом.',
      borderline: 'Предполагаемый запас воды примерно равен спросу стада, поэтому дебит нужно быстро проверить в поле.',
      insufficient: 'Предполагаемого запаса воды для такого стада пока недостаточно.',
    },
    en: {
      needsInput: 'Enter herd counts first to calculate livestock PNS.',
      enough: 'The assumed water supply covers this herd with reserve.',
      borderline: 'The assumed water supply is close to herd demand, so field verification of flow is needed.',
      insufficient: 'The assumed water supply is not enough for this herd yet.',
    },
  }[language]

  const verdict =
    demand.totalAnimals <= 0
      ? 'needs_input'
      : coverageRatio >= 1.2
        ? 'enough'
        : coverageRatio >= 1
          ? 'borderline'
          : 'insufficient'

  const summary =
    verdict === 'needs_input'
      ? copy.needsInput
      : verdict === 'enough'
        ? copy.enough
        : verdict === 'borderline'
          ? copy.borderline
          : copy.insufficient

  return {
    ...demand,
    flowLps,
    qStockL,
    qStockM3,
    coverageRatio,
    pns,
    verdict,
    summary,
  }
}

export function computeCalculatorOutput(params: {
  depthText: string
  tdsText: string
  flowText: string
  zoneValue: string
  zoneOptions: ZoneOption[]
  animalGroups: AnimalGroup[]
  animalCounts: Record<string, string>
  language?: Language
}): CalculatorOutput {
  const depth = Number(params.depthText) || 0
  const tds = Number(params.tdsText) || 0
  const flowLps = Number(params.flowText) || 0
  const zoneScore = params.zoneOptions.find((option) => option.value === params.zoneValue)?.score ?? 0.45
  const demand = collectAnimalDemandSummary(params.animalGroups, params.animalCounts)

  const depthScore =
    depth <= 20 ? 0.95 : depth <= 40 ? 0.75 : depth <= 60 ? 0.55 : depth <= 80 ? 0.35 : 0.15
  const tdsScore = tds <= 0.5 ? 1 : tds <= 1 ? 0.8 : tds <= 2 ? 0.55 : tds <= 3 ? 0.3 : 0.05
  const flowScore = flowLps >= 8 ? 0.95 : flowLps >= 4 ? 0.65 : flowLps > 0 ? 0.3 : 0
  const hps = clampNormalizedScore(0.35 * depthScore + 0.25 * tdsScore + 0.2 * zoneScore + 0.2 * flowScore)
  const capacityM3 = flowLps * 86.4
  const coverageRatio = demand.qNeedM3 > 0 ? capacityM3 / demand.qNeedM3 : 0
  const language = params.language ?? 'kk'
  const copy = {
    kk: {
      high: 'Жоғары жарамдылық',
      medium: 'Орташа жарамдылық',
      low: 'Әлсіз жарамдылық',
      strong: 'Сценарий күшті: су қоры жақсы және кіріс параметрлері shortlist үшін қолайлы.',
      workable: 'Сценарий жұмыс істейді, бірақ шешім алдында жылдам далалық тексеріс керек.',
      weak: 'Сценарий әлсіз: су сапасы, дебит немесе тереңдік әзірге жеткіліксіз.',
    },
    ru: {
      high: 'Высокая пригодность',
      medium: 'Средняя пригодность',
      low: 'Слабая пригодность',
      strong: 'Сценарий выглядит сильным: запас по воде хороший, а входные параметры подходят для shortlist.',
      workable: 'Сценарий рабочий, но перед решением нужен быстрый полевой чек.',
      weak: 'Сценарий слабый: либо качества воды, либо дебита, либо глубины пока не хватает.',
    },
    en: {
      high: 'High suitability',
      medium: 'Medium suitability',
      low: 'Weak suitability',
      strong: 'This scenario looks strong: water reserve is good and input parameters fit the shortlist.',
      workable: 'This scenario is workable, but it needs a quick field check before a decision.',
      weak: 'This scenario is weak: water quality, flow, or depth is not enough yet.',
    },
  }[language]

  return {
    id: 'local',
    hps,
    label: hps >= 0.75 ? copy.high : hps >= 0.45 ? copy.medium : copy.low,
    color: priorityColor(hps),
    totalDemandL: demand.qNeedL,
    totalDemandM3: demand.qNeedM3,
    minDemandL: demand.minNeedL,
    maxDemandL: demand.maxNeedL,
    wellCapacityM3: capacityM3,
    coverageRatio,
    depthScore,
    tdsScore,
    zoneScore,
    flowScore,
    summary:
      coverageRatio >= 1.2 && hps >= 0.75
        ? copy.strong
        : coverageRatio >= 1 && hps >= 0.45
          ? copy.workable
          : copy.weak,
  }
}
