import type { ActionId, ConfidenceBand, PriorityBand, RiskBand } from '@/lib/types'
import type { Language } from '@/i18n/translations'

const HIGH_PRIORITY_THRESHOLD = 0.7
const MEDIUM_PRIORITY_THRESHOLD = 0.4
const HIGH_CONFIDENCE_THRESHOLD = 0.7
const MEDIUM_CONFIDENCE_THRESHOLD = 0.45
const HIGH_RISK_THRESHOLD = 0.65
const MEDIUM_RISK_THRESHOLD = 0.4

function clampScore(value?: number | null): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

export function canonicalToken(value?: string): string {
  if (!value) return ''
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-ZА-Я0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

export function normalizeActionId(...values: Array<string | undefined>): ActionId {
  for (const raw of values) {
    switch (canonicalToken(raw)) {
      case 'INSPECT_FIRST':
      case 'ИНСПЕКЦИЯ_В_ПЕРВУЮ_ОЧЕРЕДЬ':
        return 'INSPECT_FIRST'
      case 'INSPECT_WITH_QUICK_VERIFICATION':
      case 'QUICK_CHECK':
      case 'БЫСТРАЯ_ВЕРИФИКАЦИЯ':
        return 'INSPECT_WITH_QUICK_VERIFICATION'
      case 'HUMAN_REVIEW_REQUIRED':
      case 'HUMAN_REVIEW':
      case 'ТРЕБУЕТСЯ_HUMAN_REVIEW':
      case 'ТРЕБУЕТСЯ_ЭКСПЕРТНАЯ_ПРОВЕРКА':
        return 'HUMAN_REVIEW_REQUIRED'
      case 'DEFER':
      case 'ОТЛОЖИТЬ_РЕЗЕРВ':
      case 'РЕЗЕРВ':
        return 'DEFER'
      case 'NOT_RECOMMENDED_CURRENT_EVIDENCE':
      case 'НЕ_РЕКОМЕНДУЕТСЯ_ПО_ТЕКУЩИМ_ДАННЫМ':
        return 'NOT_RECOMMENDED_CURRENT_EVIDENCE'
    }
  }
  return 'UNKNOWN'
}

export function deriveActionId(priorityScore: number, risk: number, confidence: number): ActionId {
  if (priorityScore >= 0.75 && risk <= 0.35 && confidence >= 0.7) return 'INSPECT_FIRST'
  if (priorityScore < 0.3) return 'NOT_RECOMMENDED_CURRENT_EVIDENCE'
  if (risk >= 0.7) return 'DEFER'
  if (risk >= 0.55 || confidence < 0.45) return 'HUMAN_REVIEW_REQUIRED'
  return 'INSPECT_WITH_QUICK_VERIFICATION'
}

export function priorityBandFromScore(score?: number | null): PriorityBand {
  const normalized = clampScore(score)
  if (normalized >= HIGH_PRIORITY_THRESHOLD) return 'high'
  if (normalized >= MEDIUM_PRIORITY_THRESHOLD) return 'medium'
  return 'low'
}

export function confidenceBandFromScore(score?: number | null): ConfidenceBand {
  const normalized = clampScore(score)
  if (normalized >= HIGH_CONFIDENCE_THRESHOLD) return 'high'
  if (normalized >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium'
  return 'low'
}

export function riskBandFromScore(score?: number | null): RiskBand {
  const normalized = clampScore(score)
  if (normalized >= HIGH_RISK_THRESHOLD) return 'high'
  if (normalized >= MEDIUM_RISK_THRESHOLD) return 'medium'
  return 'low'
}

export function actionLabel(actionId: ActionId, language: Language = 'kk'): string {
  const labels: Record<ActionId, Record<Language, string>> = {
    INSPECT_FIRST: {
      kk: 'Алдымен тексеру',
      ru: 'Проверить в первую очередь',
      en: 'Inspect first',
    },
    INSPECT_WITH_QUICK_VERIFICATION: {
      kk: 'Жылдам тексеру',
      ru: 'Быстрая проверка',
      en: 'Quick check',
    },
    HUMAN_REVIEW_REQUIRED: {
      kk: 'Сарапшы тексеруі қажет',
      ru: 'Нужна экспертная проверка',
      en: 'Human review required',
    },
    DEFER: {
      kk: 'Кейінге қалдыру',
      ru: 'Отложить',
      en: 'Defer',
    },
    NOT_RECOMMENDED_CURRENT_EVIDENCE: {
      kk: 'Қазіргі дерекпен ұсынылмайды',
      ru: 'Не рекомендовано по текущим данным',
      en: 'Not recommended on current evidence',
    },
    UNKNOWN: {
      kk: 'Әрекет белгісіз',
      ru: 'Действие не определено',
      en: 'Action undefined',
    },
  }
  return labels[actionId][language]
}

export function priorityLabel(band: PriorityBand, language: Language = 'kk'): string {
  const labels: Record<PriorityBand, Record<Language, string>> = {
    high: { kk: 'Жоғары басымдық', ru: 'Высокий приоритет', en: 'High priority' },
    medium: { kk: 'Орташа басымдық', ru: 'Средний приоритет', en: 'Medium priority' },
    low: { kk: 'Төмен басымдық', ru: 'Низкий приоритет', en: 'Low priority' },
    unknown: { kk: 'Басымдық белгісіз', ru: 'Приоритет не определен', en: 'Priority unknown' },
  }
  return labels[band][language]
}

export function confidenceLabel(band: ConfidenceBand, language: Language = 'kk'): string {
  const labels: Record<ConfidenceBand, Record<Language, string>> = {
    high: { kk: 'Жоғары сенімділік', ru: 'Высокая уверенность', en: 'High confidence' },
    medium: { kk: 'Орташа сенімділік', ru: 'Средняя уверенность', en: 'Medium confidence' },
    low: { kk: 'Төмен сенімділік', ru: 'Низкая уверенность', en: 'Low confidence' },
    unknown: { kk: 'Сенімділік белгісіз', ru: 'Уверенность не определена', en: 'Confidence unknown' },
  }
  return labels[band][language]
}

export function riskLabel(band: RiskBand, language: Language = 'kk'): string {
  const labels: Record<RiskBand, Record<Language, string>> = {
    low: { kk: 'Төмен тәуекел', ru: 'Низкий риск', en: 'Low risk' },
    medium: { kk: 'Орташа тәуекел', ru: 'Средний риск', en: 'Medium risk' },
    high: { kk: 'Жоғары тәуекел', ru: 'Высокий риск', en: 'High risk' },
    unknown: { kk: 'Тәуекел белгісіз', ru: 'Риск не определен', en: 'Risk unknown' },
  }
  return labels[band][language]
}

export function metricLabel(label: string, language: Language = 'kk'): string {
  const labels: Record<string, Record<Language, string>> = {
    HPS: { kk: 'HPS (Су әлеуеті)', ru: 'HPS (Гидропотенциал)', en: 'HPS (Hydro Potential)' },
    PNS: { kk: 'PNS (Жайылым сұранысы)', ru: 'PNS (Пастбищная потребность)', en: 'PNS (Pasture Need)' },
    RISK: { kk: 'Тәуекел', ru: 'Риск', en: 'Risk' },
    CONFIDENCE: { kk: 'Сенімділік', ru: 'Уверенность', en: 'Confidence' },
    DEPTH: { kk: 'Тереңдік', ru: 'Глубина', en: 'Depth' },
    TDS: { kk: 'Минералдану', ru: 'Минерализация', en: 'Salinity' },
    ZONE: { kk: 'Зона', ru: 'Зона', en: 'Zone' },
    FLOW: { kk: 'Дебит', ru: 'Дебит', en: 'Flow' },
  }
  switch (label.toUpperCase()) {
    case 'HPS':
    case 'PNS':
    case 'RISK':
    case 'CONFIDENCE':
    case 'DEPTH':
    case 'TDS':
    case 'ZONE':
    case 'FLOW':
      return labels[label.toUpperCase()][language]
    default:
      return label
  }
}

export function priorityColor(score: number): string {
  if (score >= HIGH_PRIORITY_THRESHOLD) return '#1f9d63'
  if (score >= MEDIUM_PRIORITY_THRESHOLD) return '#d59b17'
  return '#cd4b4e'
}

export function riskColor(score: number): string {
  if (score >= HIGH_RISK_THRESHOLD) return '#cd4b4e'
  if (score >= MEDIUM_RISK_THRESHOLD) return '#d59b17'
  return '#1f9d63'
}

export function confidenceColor(score: number): string {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return '#1e8fa8'
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return '#5e7080'
  return '#c2410c'
}

export function metricColor(label: string, value: number): string {
  switch (label.toUpperCase()) {
    case 'HPS':
      return priorityColor(value)
    case 'RISK':
      return riskColor(value)
    case 'CONFIDENCE':
      return confidenceColor(value)
    default:
      return '#14532d'
  }
}

export function formatScore(value: number): string {
  return value.toFixed(2)
}

export function formatCurrency(value: number, language: Language = 'kk'): string {
  const locale: Record<Language, string> = {
    kk: 'kk-KZ',
    ru: 'ru-RU',
    en: 'en-US',
  }
  return new Intl.NumberFormat(locale[language], {
    maximumFractionDigits: 0,
  }).format(value)
}

export function clampNormalizedScore(value?: number | null): number {
  return clampScore(value)
}
