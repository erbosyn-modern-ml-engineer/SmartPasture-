export type WaterVerdict = 'needs_input' | 'enough' | 'borderline' | 'insufficient'

export type LivestockNorm = {
  key: string
  label: string
  min: number
  max: number
  defaultValue: number
  note?: string
}

export type LivestockGroup = {
  id: string
  label: string
  emoji: string
  animals: LivestockNorm[]
}

export type WaterPlan = {
  flowLps: number
  counts: Record<string, number>
  norms: Record<string, number>
  selectedSiteId?: number
  updatedAt: string
}

export type WaterPlanResult = {
  qNeedL: number
  qNeedM3: number
  qNeedMinL: number
  qNeedMaxL: number
  qStockL: number
  qStockM3: number
  k: number
  pns: number
  totalAnimals: number
  verdict: WaterVerdict
  label: string
  summary: string
}

export const WATER_PLAN_STORAGE_KEY = 'smartpasture-water-plan-v2'
export const WATER_PLAN_EVENT = 'smartpasture:water-plan-updated'

export const LIVESTOCK_GROUPS: LivestockGroup[] = [
  {
    id: 'cattle',
    label: 'КРС',
    emoji: '🐄',
    animals: [
      { key: 'dairy_cow_dry', label: 'Молочная корова (сухостойная)', min: 34, max: 49, defaultValue: 41 },
      { key: 'dairy_cow_lactating', label: 'Дойная корова', min: 68, max: 155, defaultValue: 100 },
      { key: 'calf_1_4_months', label: 'Телёнок 1–4 мес.', min: 4.9, max: 13.2, defaultValue: 9 },
      { key: 'beef_cow_with_calf', label: 'Мясная корова с телёнком', min: 43, max: 67, defaultValue: 55 },
      { key: 'dry_cow_heifer_bull', label: 'Сухая корова / тёлка / бык', min: 22, max: 54, defaultValue: 38 },
      { key: 'pasture_calf_heat', label: 'Телёнок на пастбище в жару', min: 19, max: 30, defaultValue: 24 },
    ],
  },
  {
    id: 'equine',
    label: 'Лошадиные',
    emoji: '🐴',
    animals: [
      { key: 'horse_adult', label: 'Лошадь взрослая', min: 26, max: 39, defaultValue: 32 },
      { key: 'horse_cool_rest', label: 'Лошадь в покое, прохладный климат', min: 23, max: 38, defaultValue: 30 },
      { key: 'foal_one_month', label: 'Жеребёнок (1 месяц)', min: 4, max: 4, defaultValue: 4, note: 'Дополнительно к молоку кобылы' },
    ],
  },
  {
    id: 'sheep',
    label: 'Овцеводство',
    emoji: '🐑',
    animals: [
      { key: 'ewe_pregnant', label: 'Овца суягная', min: 4, max: 6.5, defaultValue: 5.2 },
      { key: 'ewe_lactating', label: 'Овца лактирующая', min: 9, max: 11.4, defaultValue: 10.2 },
      { key: 'lamb_growing', label: 'Ягнёнок подрастающий', min: 3.6, max: 5.2, defaultValue: 4.4 },
      { key: 'lamb_finishing', label: 'Ягнёнок на откорме', min: 1.9, max: 1.9, defaultValue: 1.9 },
    ],
  },
  {
    id: 'goats',
    label: 'Козоводство',
    emoji: '🐐',
    animals: [
      { key: 'goat_adult', label: 'Коза взрослая', min: 1.9, max: 5.7, defaultValue: 3.8 },
      { key: 'kid_maintenance', label: 'Козлёнок', min: 1.5, max: 3.3, defaultValue: 2.4 },
    ],
  },
  {
    id: 'swine',
    label: 'Свиноводство',
    emoji: '🐷',
    animals: [
      { key: 'sow_boar_pregnant', label: 'Свиноматка / хряк', min: 13.6, max: 17.2, defaultValue: 15.4 },
      { key: 'sow_lactating', label: 'Подсосная свиноматка с поросятами', min: 18.1, max: 22.7, defaultValue: 20.4 },
      { key: 'piglet_weaned', label: 'Поросёнок после отъёма', min: 1, max: 3.2, defaultValue: 2.1 },
      { key: 'pig_growing', label: 'Поросёнок растущий', min: 3.2, max: 10, defaultValue: 6.6 },
    ],
  },
  {
    id: 'poultry',
    label: 'Птицеводство',
    emoji: '🐔',
    animals: [
      { key: 'layer_hen', label: 'Курица-несушка', min: 0.18, max: 0.32, defaultValue: 0.25 },
      { key: 'pullet', label: 'Молодка', min: 0.03, max: 0.18, defaultValue: 0.1 },
      { key: 'broiler_normal', label: 'Бройлер 1–4 недели (21°C)', min: 0.05, max: 0.26, defaultValue: 0.15 },
      { key: 'broiler_heat', label: 'Бройлер в жару', min: 0.35, max: 0.415, defaultValue: 0.35 },
    ],
  },
  {
    id: 'rabbits',
    label: 'Кролиководство',
    emoji: '🐇',
    animals: [
      { key: 'rabbit_pregnant', label: 'Крольчиха сукрольная', min: 0.35, max: 0.35, defaultValue: 0.35 },
      { key: 'rabbit_litter', label: 'Крольчиха с помётом', min: 1.02, max: 1.02, defaultValue: 1.02 },
      { key: 'rabbit_6_weeks', label: 'Крольчонок на откорме (6 нед.)', min: 0.3, max: 0.3, defaultValue: 0.3 },
      { key: 'rabbit_12_weeks', label: 'Крольчонок на откорме (12 нед.)', min: 0.64, max: 0.64, defaultValue: 0.64 },
    ],
  },
]

export function defaultWaterPlan(): WaterPlan {
  const counts: Record<string, number> = {}
  const norms: Record<string, number> = {}

  for (const group of LIVESTOCK_GROUPS) {
    for (const animal of group.animals) {
      counts[animal.key] = 0
      norms[animal.key] = animal.defaultValue
    }
  }

  return {
    flowLps: 10,
    counts,
    norms,
    updatedAt: new Date(0).toISOString(),
  }
}

function safeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export function calculateWaterPlan(plan: WaterPlan): WaterPlanResult {
  let qNeedL = 0
  let qNeedMinL = 0
  let qNeedMaxL = 0
  let totalAnimals = 0

  for (const group of LIVESTOCK_GROUPS) {
    for (const animal of group.animals) {
      const count = safeNumber(plan.counts[animal.key])
      const norm = safeNumber(plan.norms[animal.key]) || animal.defaultValue
      totalAnimals += count
      qNeedL += count * norm
      qNeedMinL += count * animal.min
      qNeedMaxL += count * animal.max
    }
  }

  const flowLps = safeNumber(plan.flowLps)
  const qStockL = flowLps * 86_400
  const qStockM3 = qStockL / 1000
  const qNeedM3 = qNeedL / 1000
  const k = qNeedM3 > 0 ? qStockM3 / qNeedM3 : 0
  const pns = qNeedM3 > 0 ? Math.min(1, Math.max(0, k / 1.5)) : 0

  if (totalAnimals <= 0) {
    return {
      qNeedL,
      qNeedM3,
      qNeedMinL,
      qNeedMaxL,
      qStockL,
      qStockM3,
      k,
      pns,
      totalAnimals,
      verdict: 'needs_input',
      label: 'ВВЕДИТЕ ПОГОЛОВЬЕ',
      summary: 'Добавьте количество животных, чтобы система рассчитала потребность стада и достаточность источника.',
    }
  }

  if (k >= 1.5) {
    return {
      qNeedL, qNeedM3, qNeedMinL, qNeedMaxL, qStockL, qStockM3, k, pns, totalAnimals,
      verdict: 'enough',
      label: 'ВОДЫ ХВАТАЕТ',
      summary: 'Расчётный дебит покрывает суточную потребность стада с резервом не менее 50%.',
    }
  }

  if (k >= 1) {
    return {
      qNeedL, qNeedM3, qNeedMinL, qNeedMaxL, qStockL, qStockM3, k, pns, totalAnimals,
      verdict: 'borderline',
      label: 'НА ГРАНИ',
      summary: 'Расчётный дебит покрывает среднюю потребность, но запаса мало. Нужна полевая проверка дебита и сезонности.',
    }
  }

  return {
    qNeedL, qNeedM3, qNeedMinL, qNeedMaxL, qStockL, qStockM3, k, pns, totalAnimals,
    verdict: 'insufficient',
    label: 'ВОДЫ НЕ ХВАТАЕТ',
    summary: 'Расчётный дебит ниже средней суточной потребности стада. Уменьшите нагрузку или ищите более производительный источник.',
  }
}

export function saveWaterPlan(plan: WaterPlan) {
  if (typeof window === 'undefined') return
  const next = { ...plan, updatedAt: new Date().toISOString() }
  window.localStorage.setItem(WATER_PLAN_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(WATER_PLAN_EVENT, { detail: next }))
}

export function loadWaterPlan(): WaterPlan {
  const fallback = defaultWaterPlan()
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(WATER_PLAN_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<WaterPlan>
    return {
      ...fallback,
      ...parsed,
      flowLps: safeNumber(parsed.flowLps) || fallback.flowLps,
      counts: { ...fallback.counts, ...(parsed.counts ?? {}) },
      norms: { ...fallback.norms, ...(parsed.norms ?? {}) },
    }
  } catch {
    return fallback
  }
}
