import { onCLS, onINP, onLCP, type Metric } from 'web-vitals'
import { env } from '@/lib/env'

function report(metric: Metric) {
  if (!env.analyticsEnabled) return
  console.info('[web-vitals]', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
  })
}

export function reportWebVitals() {
  onCLS(report)
  onINP(report)
  onLCP(report)
}
