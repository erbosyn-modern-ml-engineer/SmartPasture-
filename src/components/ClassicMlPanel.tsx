import { AlertTriangle } from 'lucide-react'
import { EmptyState, MetricCard, Panel, Pill, SectionTitle } from '@/components/ui'
import {
  mlPredictionColor,
  mlPredictionLabel,
  mlPredictionTone,
  type ClassicMlModel,
  type MlWaterPrediction,
} from '@/lib/classicMl'

function percent(value: number) {
  return String(Math.round(value * 100))
}

function FactorList({
  title,
  factors,
  emptyText,
}: {
  title: string
  factors: MlWaterPrediction['topPositiveFactors']
  emptyText: string
}) {
  return (
    <div className="classic-ml-factor-group">
      <strong>{title}</strong>
      {factors.length ? (
        <ul className="classic-ml-factor-list">
          {factors.map((factor) => (
            <li key={factor.feature}>
              <span>{factor.label}</span>
              <small>{factor.value}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-hint">{emptyText}</p>
      )}
    </div>
  )
}

function GroupContributionList({ prediction }: { prediction: MlWaterPrediction }) {
  const visibleGroups = prediction.groupContributions.slice(0, 6)

  if (visibleGroups.length === 0) return null

  return (
    <div className="classic-ml-groups">
      <strong>Группы факторов</strong>
      <div className="classic-ml-group-list">
        {visibleGroups.map((item) => (
          <span key={item.group} className={item.contribution >= 0 ? 'classic-ml-group--positive' : 'classic-ml-group--risk'}>
            {item.group}
            <b>{item.contribution >= 0 ? '+' : ''}{item.contribution.toFixed(2)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

export function ClassicMlPanel({
  prediction,
  model,
  loading = false,
  error,
  compact = false,
  title = 'ML-прогноз по выбранной точке',
}: {
  prediction: MlWaterPrediction | null
  model: ClassicMlModel | null
  loading?: boolean
  error?: string | null
  compact?: boolean
  title?: string
}) {
  if (loading) {
    return (
      <Panel level="minimal" className="classic-ml-panel classic-ml-panel--loading">
        <EmptyState title="ML-прогноз загружается" description="Подготавливаем модель оценки водной точки." compact />
      </Panel>
    )
  }

  if (error) {
    return (
      <Panel level="minimal" className="classic-ml-panel classic-ml-panel--error">
        <EmptyState title="ML прогноз недоступен" description={error} compact />
      </Panel>
    )
  }

  if (!prediction || !model) {
    return (
      <Panel level="minimal" className="classic-ml-panel">
        <EmptyState title="ML-прогноз не выбран" description="Выберите точку на карте." compact />
      </Panel>
    )
  }

  return (
    <Panel level={compact ? 'minimal' : 'secondary'} className="classic-ml-panel">
      <div className="classic-ml-panel__head">
        <SectionTitle
          title={title}
          subtitle="Модель оценивает вероятность успешной водной точки по признакам, доступным до полевых работ."
        />
        <Pill tone={mlPredictionTone(prediction.prediction)} color={mlPredictionColor(prediction.prediction)}>
          {mlPredictionLabel(prediction.prediction)}
        </Pill>
      </div>

      <div className="metric-grid classic-ml-metrics">
        <MetricCard
          label="Вероятность"
          value={percent(prediction.probability)}
          color={mlPredictionColor(prediction.prediction)}
          helper="/100"
        />
        <MetricCard
          label="Уверенность ML"
          value={percent(prediction.confidence)}
          color="#177a8a"
          helper="/100"
        />
        <MetricCard
          label="Полнота данных"
          value={percent(prediction.inputCoverage)}
          color="#1f9d63"
          helper="/100"
        />
      </div>

      <div className="classic-ml-probability" aria-hidden="true">
        <span style={{ width: `${percent(prediction.probability)}%`, background: mlPredictionColor(prediction.prediction) }} />
      </div>

      <div className="classic-ml-factor-grid">
        <FactorList
          title="Что повысило прогноз"
          factors={prediction.topPositiveFactors}
          emptyText="Нет сильных положительных факторов."
        />
        <FactorList
          title="Что снизило прогноз"
          factors={prediction.topRiskFactors}
          emptyText="Нет сильных негативных факторов."
        />
      </div>

      <GroupContributionList prediction={prediction} />

      {prediction.missingFeatures.length ? (
        <div className="classic-ml-missing">
          <AlertTriangle size={16} />
          <span>Каких данных не хватает: {prediction.missingFeatures.slice(0, 8).join(', ')}{prediction.missingFeatures.length > 8 ? '...' : ''}.</span>
        </div>
      ) : null}

      <p className="classic-ml-note">
        ML — один слой поддержки решения. Он не заменяет гидрогеологическое заключение, геофизику, архивные материалы и лабораторную проверку воды. {prediction.calibrationNote}
      </p>
    </Panel>
  )
}
