import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { usePrefersReducedMotion } from '@/lib/useUiMotion'

const NUMERIC_VALUE_PATTERN = /^-?\d+(\.\d+)?$/

type ParsedMetricValue = {
  numeric: number
  decimals: number
}

type PanelProps = {
  children: ReactNode
  className?: string
  tone?: 'default' | 'hero' | 'soft'
  level?: 'primary' | 'secondary' | 'minimal'
  style?: CSSProperties
} & Omit<ComponentPropsWithoutRef<'section'>, 'children' | 'className' | 'style'>

function parseMetricValue(value: string): ParsedMetricValue | null {
  const normalized = value.trim()
  if (!NUMERIC_VALUE_PATTERN.test(normalized)) {
    return null
  }

  const decimals = normalized.includes('.') ? normalized.split('.')[1]?.length ?? 0 : 0
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) {
    return null
  }

  return { numeric, decimals }
}

function formatAnimatedMetricValue(value: number, decimals: number) {
  if (decimals <= 0) {
    return String(Math.round(value))
  }
  return value.toFixed(decimals)
}

function AnimatedMetricValue({ value, color }: { value: string; color?: string }) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const parsedValue = useMemo(() => parseMetricValue(value), [value])
  const previousValueRef = useRef(parsedValue?.numeric ?? 0)
  const [animatedValue, setAnimatedValue] = useState<number | null>(parsedValue?.numeric ?? null)

  useEffect(() => {
    if (!parsedValue) {
      previousValueRef.current = 0
      return
    }

    if (prefersReducedMotion) {
      previousValueRef.current = parsedValue.numeric
      return
    }

    const fromValue = previousValueRef.current
    const toValue = parsedValue.numeric

    if (Math.abs(fromValue - toValue) < 0.0001) {
      previousValueRef.current = toValue
      return
    }

    let frameId = 0
    const duration = 260 + Math.min(220, Math.abs(toValue - fromValue) * 140)
    const startTime = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration)
      const easedProgress = 1 - (1 - progress) ** 3
      const currentValue = fromValue + (toValue - fromValue) * easedProgress
      setAnimatedValue(currentValue)

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
        return
      }

      previousValueRef.current = toValue
      setAnimatedValue(toValue)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [parsedValue, prefersReducedMotion])

  const renderedValue = !parsedValue || prefersReducedMotion
    ? value
    : formatAnimatedMetricValue(animatedValue ?? parsedValue.numeric, parsedValue.decimals)

  return <strong style={color ? { color } : undefined}>{renderedValue}</strong>
}

export function Panel({
  children,
  className,
  tone = 'default',
  level = 'primary',
  style,
  ...rest
}: PanelProps) {
  return (
    <section
      {...rest}
      className={cx('panel', `panel--${level}`, tone !== 'default' && `panel--${tone}`, className)}
      style={style}
    >
      {children}
    </section>
  )
}

export function PageIntro({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className="page-intro">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p className="page-intro__subtitle">{subtitle}</p>
      </div>
      {actions ? <div className="page-intro__actions">{actions}</div> : null}
    </div>
  )
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="section-title">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  )
}

export function Pill({
  children,
  color,
  tone = 'neutral',
  size = 'md',
}: {
  children: ReactNode
  color?: string
  tone?: 'neutral' | 'high' | 'medium' | 'low' | 'confidence' | 'warning' | 'danger' | 'pinned' | 'selected'
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cx('pill', tone !== 'neutral' && `pill--${tone}`, size === 'sm' && 'pill--sm')}
      style={color ? ({ '--pill-color': color } as CSSProperties) : undefined}
    >
      {children}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  color,
  helper,
}: {
  label: string
  value: string
  color?: string
  helper?: string
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <AnimatedMetricValue value={value} color={color} />
      {helper ? <small>{helper}</small> : null}
    </div>
  )
}

export function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="scorebar">
      <div className="scorebar__head">
        <span>{label}</span>
        <strong>{value.toFixed(2)}</strong>
      </div>
      <div className="scorebar__track">
        <div className="scorebar__fill" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} />
      </div>
    </div>
  )
}

export function BulletList({ items, emptyText = 'Нет данных' }: { items: string[]; emptyText?: string }) {
  if (items.length === 0) {
    return <p className="empty-hint" role="status">{emptyText}</p>
  }

  return (
    <ul className="bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function EmptyState({
  title,
  description,
  compact = false,
}: {
  title: string
  description?: string
  compact?: boolean
}) {
  return (
    <div className={cx('empty-state', compact && 'empty-state--compact')} role="status" aria-live="polite">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  )
}

export function SkeletonCard({
  className,
  lines = 3,
  withHeader = true,
  children,
}: {
  className?: string
  lines?: number
  withHeader?: boolean
  children?: ReactNode
}) {
  return (
    <div className={cx('skeleton-card', className)} aria-hidden="true">
      {children ?? (
        <>
          {withHeader ? <span className="skeleton-block skeleton-block--title" /> : null}
          <div className="skeleton-card__lines">
            {Array.from({ length: lines }).map((_, index) => (
              <span key={`${className ?? 'skeleton'}-${index}`} className={cx('skeleton-block', index === lines - 1 && 'skeleton-block--short')} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function LoadingPanel({
  title = 'Загрузка',
  message = 'Подготавливаем web-версию SmartPasture.',
  compact = false,
}: {
  title?: string
  message?: string
  compact?: boolean
}) {
  return (
    <Panel className={cx('state-panel state-panel--loading', compact && 'state-panel--compact')}>
      <LoaderCircle className="state-panel__icon spin" />
      <div role="status" aria-live="polite">
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {compact ? null : (
        <div className="state-panel__skeleton" aria-hidden="true">
          <span />
          <span />
        </div>
      )}
    </Panel>
  )
}

export function ErrorPanel({ title = 'Что-то пошло не так', message }: { title?: string; message: string }) {
  return (
    <Panel className="state-panel state-panel--error">
      <AlertTriangle className="state-panel__icon" />
      <div role="alert">
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </Panel>
  )
}
