import { useMemo, useState } from 'react'
import { useSmartPasture } from '@/context/useSmartPasture'
import { computeCalculatorOutput } from '@/lib/calculator'
import { formatScore, metricLabel } from '@/lib/labels'
import { ErrorPanel, LoadingPanel, MetricCard, PageIntro, Panel, ScoreBar, SectionTitle } from '@/components/ui'
import type { AnimalGroup, ZoneOption } from '@/lib/types'
import { useI18n } from '@/i18n/useI18n'
import { localizeAnimalGroup, localizeZoneOption } from '@/i18n/translations'

const initialAnimalCounts: Record<string, string> = {
  cows: '50',
  sheep: '80',
  goats: '20',
  horses: '8',
}
const EMPTY_ZONE_OPTIONS: ZoneOption[] = []
const EMPTY_ANIMAL_GROUPS: AnimalGroup[] = []

export function CalculatorPage() {
  const { status, data, error } = useSmartPasture()
  const { language, t } = useI18n()
  const [locationDepth, setLocationDepth] = useState('30')
  const [waterTds, setWaterTds] = useState('0.8')
  const [wellFlowLps, setWellFlowLps] = useState('10')
  const [animalCounts, setAnimalCounts] = useState<Record<string, string>>(initialAnimalCounts)
  const [zone, setZone] = useState('')
  const zoneOptions = useMemo(
    () => (data?.calculator.zoneOptions ?? EMPTY_ZONE_OPTIONS).map((option) => localizeZoneOption(option, language)),
    [data?.calculator.zoneOptions, language],
  )
  const animalGroups = useMemo(
    () => (data?.calculator.animalGroups ?? EMPTY_ANIMAL_GROUPS).map((group) => localizeAnimalGroup(group, language)),
    [data?.calculator.animalGroups, language],
  )
  const activeZone = zone || zoneOptions[0]?.value || ''
  const output = useMemo(
    () =>
      computeCalculatorOutput({
        depthText: locationDepth,
        tdsText: waterTds,
        flowText: wellFlowLps,
        zoneValue: activeZone,
        zoneOptions,
        animalGroups,
        animalCounts,
        language,
      }),
    [activeZone, animalCounts, animalGroups, language, locationDepth, waterTds, wellFlowLps, zoneOptions],
  )

  if (status === 'loading' || !data) {
    return <LoadingPanel title={t('calculator.loading')} message={t('calculator.loadingMessage')} />
  }

  if (status === 'error') {
    return <ErrorPanel title={t('common.errorTitle')} message={error ?? t('calculator.error')} />
  }

  function updateAnimalCount(key: string, value: string) {
    setAnimalCounts((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="page">
      <PageIntro eyebrow={t('calculator.eyebrow')} title={t('calculator.title')} subtitle={t('calculator.subtitle')} />

      <div className="page-grid page-grid--split" data-reveal data-reveal-delay="20">
        <Panel level="secondary">
          <SectionTitle title={t('calculator.params')} subtitle={t('calculator.paramsSub')} />
          <div className="form-grid">
            <label className="field">
              <span>{t('calculator.depth')}</span>
              <input value={locationDepth} onChange={(event) => setLocationDepth(event.target.value)} />
            </label>
            <label className="field">
              <span>{t('calculator.tds')}</span>
              <input value={waterTds} onChange={(event) => setWaterTds(event.target.value)} />
            </label>
            <label className="field">
              <span>{t('calculator.flow')}</span>
              <input value={wellFlowLps} onChange={(event) => setWellFlowLps(event.target.value)} />
            </label>
          </div>

          <SectionTitle title={t('calculator.zone')} subtitle={t('calculator.zoneSub')} />
          <div className="choice-grid">
            {zoneOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`choice-card ${activeZone === option.value ? 'choice-card--active' : ''}`}
                onClick={() => setZone(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{t('common.score')} {formatScore(option.score)}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle title={t('calculator.result')} subtitle={t('calculator.resultSub')} />
          <div className="metric-grid">
            <MetricCard label={t('common.hps')} value={formatScore(output.hps)} color={output.color} />
            <MetricCard label={t('calculator.coverage')} value={formatScore(output.coverageRatio)} />
            <MetricCard label={t('calculator.demand')} value={formatScore(output.totalDemandM3)} />
            <MetricCard label={t('calculator.capacity')} value={formatScore(output.wellCapacityM3)} />
          </div>

          <p className="hero-copy">{output.summary}</p>

          <div className="info-rows">
            <div>
              <strong>{t('calculator.daily')}</strong>
              <p>{Math.round(output.totalDemandL)} {t('calculator.lpd')}</p>
            </div>
            <div>
              <strong>{t('calculator.range')}</strong>
              <p>
                {Math.round(output.minDemandL)} - {Math.round(output.maxDemandL)} {t('calculator.lpd')}
              </p>
            </div>
          </div>

          <div className="card-stack">
            <ScoreBar label={metricLabel('Depth', language)} value={output.depthScore} color="#14532d" />
            <ScoreBar label={metricLabel('TDS', language)} value={output.tdsScore} color="#0f766e" />
            <ScoreBar label={metricLabel('Zone', language)} value={output.zoneScore} color="#1f9d63" />
            <ScoreBar label={metricLabel('Flow', language)} value={output.flowScore} color="#2563eb" />
          </div>
        </Panel>
      </div>

      <div className="card-stack" data-reveal data-reveal-delay="70">
        {animalGroups.map((group) => (
          <Panel key={group.id} level="minimal">
            <SectionTitle title={`${group.emoji} ${group.label}`} subtitle={group.description} />
            <div className="form-grid">
              {group.animals.map((animal) => (
                <label key={animal.key} className="field">
                  <span>
                    {animal.label}
                    <small>{animal.hint}</small>
                  </span>
                  <input
                    value={animalCounts[animal.key] ?? '0'}
                    onChange={(event) => updateAnimalCount(animal.key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}
