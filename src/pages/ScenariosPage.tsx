import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSmartPasture } from '@/context/useSmartPasture'
import { EmptyState, ErrorPanel, LoadingPanel, MetricCard, PageIntro, Panel, Pill, SectionTitle } from '@/components/ui'
import { loadGisProbeDataset } from '@/lib/gisProbe'
import {
  buildFullMapScenarioCandidates,
  buildWishlistScenarioCandidates,
  findSavedPointForScenarioCandidate,
  runProbeScenario,
  saveScenarioCandidateToWishlist,
  type ProbeEvidenceFilter,
  type ProbeScenarioActionFilter,
  type ProbeScenarioProfileKey,
} from '@/lib/probePlanning'
import { actionLabel, confidenceColor, formatScore, priorityColor, priorityLabel, riskColor } from '@/lib/labels'
import { useI18n } from '@/i18n/useI18n'
import type { ActionId, GisProbeCell, GisProbeDataset, ProbeScenarioCandidate, ScenarioSourceMode } from '@/lib/types'

type ScenarioFormState = {
  sourceMode: ScenarioSourceMode
  scenarioName: string
  query: string
  topN: number
  minPriority: number
  maxRisk: number
  minConfidence: number
  actionId: ProbeScenarioActionFilter
  evidenceLevel: ProbeEvidenceFilter
  sortStrategy: ProbeScenarioProfileKey
}

const defaultForm: ScenarioFormState = {
  sourceMode: 'full_map',
  scenarioName: 'Balanced shortlist',
  query: '',
  topN: 3,
  minPriority: 0.4,
  maxRisk: 0.65,
  minConfidence: 0.45,
  actionId: 'all',
  evidenceLevel: 'all',
  sortStrategy: 'balanced',
}

const actionOptions: ActionId[] = [
  'INSPECT_FIRST',
  'INSPECT_WITH_QUICK_VERIFICATION',
  'HUMAN_REVIEW_REQUIRED',
  'DEFER',
  'NOT_RECOMMENDED_CURRENT_EVIDENCE',
]

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function priorityTone(score: number) {
  if (score >= 0.7) return 'high' as const
  if (score >= 0.4) return 'medium' as const
  return 'low' as const
}

function evidenceTone(level: GisProbeCell['evidenceLevel']) {
  return level === 'full' ? 'confidence' as const : 'warning' as const
}

function evidenceLabel(level: GisProbeCell['evidenceLevel']) {
  return level === 'full' ? 'Full evidence' : 'Partial evidence'
}

function contextLabel(label: GisProbeCell['contextScoreLabel']) {
  if (label === 'favorable') return 'Favorable context'
  if (label === 'mixed') return 'Mixed context'
  return 'Constrained context'
}

function formatDistance(valueKm: number) {
  return valueKm < 10 ? `${valueKm.toFixed(1)} km` : `${Math.round(valueKm)} km`
}

function formatMaybeMetric(value: number | null, suffix: string, empty = 'No DEM') {
  return value == null ? empty : `${value.toFixed(value < 10 ? 2 : 0)}${suffix}`
}

function sourceModeLabel(sourceMode: ScenarioSourceMode) {
  return sourceMode === 'full_map' ? 'Full map' : 'Wishlist'
}

function sourceModeSubtitle(sourceMode: ScenarioSourceMode) {
  return sourceMode === 'full_map'
    ? 'Run the scenario across every non-null AOI cell from the province GIS grid.'
    : 'Run the scenario only across the points that your team saved and named.'
}

function buildPreset(
  current: ScenarioFormState,
  overrides: Partial<Omit<ScenarioFormState, 'sourceMode'>>,
): ScenarioFormState {
  return {
    ...defaultForm,
    sourceMode: current.sourceMode,
    ...overrides,
  }
}

export function ScenariosPage() {
  const { status, error, savedProbePoints, saveProbePoint } = useSmartPasture()
  const { language } = useI18n()
  const [form, setForm] = useState<ScenarioFormState>(defaultForm)
  const [dataset, setDataset] = useState<GisProbeDataset | null>(null)
  const [datasetError, setDatasetError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadGisProbeDataset()
      .then((payload) => {
        if (cancelled) return
        setDataset(payload)
        setDatasetError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setDatasetError(loadError instanceof Error ? loadError.message : 'Failed to load province GIS data')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const fullMapCandidates = useMemo(
    () => (dataset ? buildFullMapScenarioCandidates(dataset) : []),
    [dataset],
  )
  const wishlistCandidates = useMemo(
    () => buildWishlistScenarioCandidates(savedProbePoints),
    [savedProbePoints],
  )

  const activeCandidates = form.sourceMode === 'full_map' ? fullMapCandidates : wishlistCandidates
  const maxTopN = Math.max(1, activeCandidates.length || 1)
  const resolvedTopN = clampNumber(form.topN, 1, maxTopN)

  const result = useMemo(() => runProbeScenario(activeCandidates, {
    sourceMode: form.sourceMode,
    query: form.query,
    topN: resolvedTopN,
    minPriority: form.minPriority,
    maxRisk: form.maxRisk,
    minConfidence: form.minConfidence,
    actionId: form.actionId,
    evidenceLevel: form.evidenceLevel,
    profile: form.sortStrategy,
  }), [activeCandidates, form, resolvedTopN])

  const unsavedShortlist = useMemo(
    () => result.shortlist.filter((candidate) => !findSavedPointForScenarioCandidate(savedProbePoints, candidate)),
    [result.shortlist, savedProbePoints],
  )

  if (status === 'loading') {
    return <LoadingPanel title="Scenario" message="Loading SmartPasture data." />
  }

  if (status === 'error') {
    return <ErrorPanel title="Scenario" message={error ?? 'Failed to load SmartPasture data'} />
  }

  if (datasetError) {
    return <ErrorPanel title="Scenario" message={datasetError} />
  }

  if (!dataset) {
    return <LoadingPanel title="Scenario" message="Loading province-wide GIS grid." />
  }

  const sourceIsEmpty = activeCandidates.length === 0

  function updateForm<K extends keyof ScenarioFormState>(key: K, value: ScenarioFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function applyPreset(overrides: Partial<Omit<ScenarioFormState, 'sourceMode'>>) {
    setForm((current) => buildPreset(current, overrides))
  }

  function saveCandidate(candidate: ProbeScenarioCandidate) {
    saveScenarioCandidateToWishlist(candidate, savedProbePoints, saveProbePoint)
  }

  function saveAllShortlist() {
    for (const candidate of unsavedShortlist) {
      saveScenarioCandidateToWishlist(candidate, savedProbePoints, saveProbePoint)
    }
  }

  return (
    <div className="page page--scenario">
      <PageIntro
        eyebrow="Scenario"
        title="Find the best candidates from the full map"
        subtitle="Full map is now the default scenario source. Save the strongest candidates to your wishlist, then compare them manually."
        actions={<Link className="button button--secondary" to="/map">Open map</Link>}
      />

      <Panel className="scenario-overview-panel" level="secondary">
        <SectionTitle
          title="Source mode"
          subtitle={sourceModeSubtitle(form.sourceMode)}
        />
        <div className="button-row">
          <button
            type="button"
            className={`button ${form.sourceMode === 'full_map' ? 'button--selected' : 'button--secondary'}`}
            onClick={() => updateForm('sourceMode', 'full_map')}
          >
            Full map
          </button>
          <button
            type="button"
            className={`button ${form.sourceMode === 'wishlist' ? 'button--selected' : 'button--secondary'}`}
            onClick={() => updateForm('sourceMode', 'wishlist')}
          >
            Wishlist
          </button>
        </div>

        <div className="metric-grid scenario-overview-grid">
          <MetricCard
            label={form.sourceMode === 'full_map' ? 'AOI cells' : 'Wishlist points'}
            value={String(activeCandidates.length)}
            color="#0d6f83"
          />
          <MetricCard label="Matching candidates" value={String(result.preDedupMatches)} color="#14532d" />
          <MetricCard
            label={form.sourceMode === 'full_map' ? 'Shortlisted clusters' : 'Shortlisted points'}
            value={String(result.shortlist.length)}
            color="#14532d"
          />
          <MetricCard
            label={form.sourceMode === 'full_map' ? 'Near duplicates skipped' : 'Saved wishlist points'}
            value={String(form.sourceMode === 'full_map' ? result.dedupExcludedCount : savedProbePoints.length)}
            color="#a96d2f"
          />
        </div>
      </Panel>

      <div className="scenario-control-grid">
        <Panel className="preset-panel scenario-preset-panel" level="secondary">
          <SectionTitle
            title="Quick presets"
            subtitle="These presets keep the current source mode and only adjust the scenario filters."
          />
          <div className="scenario-preset-grid">
            <button type="button" className="scenario-preset-button" onClick={() => applyPreset({})}>
              <strong>Balanced</strong>
              <span>General shortlist across priority, context, confidence, and risk.</span>
            </button>
            <button
              type="button"
              className="scenario-preset-button"
              onClick={() => applyPreset({
                scenarioName: 'Safest shortlist',
                maxRisk: 0.35,
                minConfidence: 0.55,
                sortStrategy: 'safest',
              })}
            >
              <strong>Safest</strong>
              <span>Bias the shortlist toward lower risk and steadier evidence.</span>
            </button>
            <button
              type="button"
              className="scenario-preset-button"
              onClick={() => applyPreset({
                scenarioName: 'Full evidence first',
                evidenceLevel: 'full',
                minConfidence: 0.55,
                sortStrategy: 'confidence',
              })}
            >
              <strong>Full evidence</strong>
              <span>Prioritize DEM-backed cells before partial-evidence cells.</span>
            </button>
          </div>
        </Panel>

        <Panel className="scenario-builder-panel scenario-constructor-panel" level="secondary">
          <SectionTitle
            title="Scenario filters"
            subtitle={`Running on ${sourceModeLabel(form.sourceMode).toLowerCase()} candidates only.`}
          />
          <div className="form-grid form-grid--scenario">
            <label className="field">
              <span>Scenario name</span>
              <input value={form.scenarioName} onChange={(event) => updateForm('scenarioName', event.target.value)} />
            </label>
            <label className="field">
              <span>Query</span>
              <input
                value={form.query}
                onChange={(event) => updateForm('query', event.target.value)}
                placeholder="Candidate name or coordinates"
              />
            </label>
            <label className="field">
              <span>Top N</span>
              <input
                type="number"
                min={1}
                max={maxTopN}
                value={resolvedTopN}
                onChange={(event) => updateForm('topN', clampNumber(Number(event.target.value) || 1, 1, maxTopN))}
              />
            </label>
            <label className="field">
              <span>Action</span>
              <select value={form.actionId} onChange={(event) => updateForm('actionId', event.target.value as ProbeScenarioActionFilter)}>
                <option value="all">All actions</option>
                {actionOptions.map((actionId) => (
                  <option key={actionId} value={actionId}>
                    {actionLabel(actionId, language)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Evidence</span>
              <select value={form.evidenceLevel} onChange={(event) => updateForm('evidenceLevel', event.target.value as ProbeEvidenceFilter)}>
                <option value="all">All evidence levels</option>
                <option value="full">Full evidence</option>
                <option value="partial">Partial evidence</option>
              </select>
            </label>
            <label className="field">
              <span>Sort strategy</span>
              <select value={form.sortStrategy} onChange={(event) => updateForm('sortStrategy', event.target.value as ProbeScenarioProfileKey)}>
                <option value="balanced">Balanced</option>
                <option value="safest">Safest</option>
                <option value="confidence">Confidence</option>
              </select>
            </label>
          </div>

          <div className="form-grid form-grid--sliders scenario-constructor-panel__sliders">
            <label className="field">
              <span>Min priority <small>{formatScore(form.minPriority)}</small></span>
              <input type="range" min="0" max="1" step="0.05" value={form.minPriority} onChange={(event) => updateForm('minPriority', Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Max risk <small>{formatScore(form.maxRisk)}</small></span>
              <input type="range" min="0" max="1" step="0.05" value={form.maxRisk} onChange={(event) => updateForm('maxRisk', Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Min confidence <small>{formatScore(form.minConfidence)}</small></span>
              <input type="range" min="0" max="1" step="0.05" value={form.minConfidence} onChange={(event) => updateForm('minConfidence', Number(event.target.value))} />
            </label>
          </div>
        </Panel>
      </div>

      <Panel className="scenario-constraint-panel" level="minimal">
        <SectionTitle
          title="Active filters"
          subtitle={`${result.preDedupMatches} ${form.sourceMode === 'full_map' ? 'matching cells' : 'matching wishlist points'}`}
        />
        <div className="button-row scenario-constraint-panel__chips">
          <Pill tone="selected">{form.scenarioName}</Pill>
          <Pill tone="confidence" color="#0f766e">{sourceModeLabel(form.sourceMode)}</Pill>
          <Pill tone="confidence" color="#0f766e">Priority ≥ {formatScore(form.minPriority)}</Pill>
          <Pill tone="confidence" color="#0f766e">Risk ≤ {formatScore(form.maxRisk)}</Pill>
          <Pill tone="confidence" color="#0f766e">Confidence ≥ {formatScore(form.minConfidence)}</Pill>
          <Pill tone="confidence" color="#0f766e">{form.evidenceLevel === 'all' ? 'All evidence' : evidenceLabel(form.evidenceLevel)}</Pill>
        </div>
      </Panel>

      {sourceIsEmpty ? (
        <Panel className="state-panel" level="minimal">
          <EmptyState
            title={form.sourceMode === 'wishlist' ? 'Wishlist is empty' : 'No scenario source available'}
            description={form.sourceMode === 'wishlist'
              ? 'Save a few points from the map first, then return here to run a manual shortlist on them.'
              : 'The province-wide GIS grid did not load correctly.'}
          />
          <div className="button-row state-panel__actions">
            <Link className="button button--primary" to="/map">Open map</Link>
          </div>
        </Panel>
      ) : result.shortlist.length ? (
        <section className="scenario-results-section">
          <Panel className="scenario-results-summary" level="secondary">
            <SectionTitle
              title="Shortlist"
              subtitle={form.sourceMode === 'full_map'
                ? `${result.preDedupMatches} matching cells • ${result.shortlist.length} shortlisted clusters • ${result.dedupExcludedCount} near-duplicates skipped while building the shortlist`
                : `${result.preDedupMatches} matching wishlist points • ${result.shortlist.length} shortlisted`}
            />
            <div className="button-row scenario-results-summary__actions">
              {unsavedShortlist.length ? (
                <button type="button" className="button button--primary" onClick={saveAllShortlist}>
                  Save all shortlist
                </button>
              ) : null}
              <Link className="button button--secondary" to="/map">Back to map</Link>
              {savedProbePoints.length >= 2 ? <Link className="button button--secondary" to="/compare">Open compare</Link> : null}
            </div>
          </Panel>

          <div className="card-stack scenario-results-list">
            {result.shortlist.map((candidate, index) => {
              const savedPoint = findSavedPointForScenarioCandidate(savedProbePoints, candidate)
              const priorityBand = priorityTone(candidate.cell.scores.priority)

              return (
                <Panel
                  key={candidate.id}
                  className={`scenario-result-card ${index === 0 ? 'scenario-result-card--lead' : ''}`}
                  level={index === 0 ? 'secondary' : 'minimal'}
                >
                  <div className="site-tile__head scenario-result-card__head">
                    <span className="site-rank">#{index + 1}</span>
                    <div className="button-row scenario-result-card__badges">
                      <Pill tone={priorityBand} color={priorityColor(candidate.cell.scores.priority)}>
                        {priorityLabel(priorityBand, language)}
                      </Pill>
                      <Pill tone={evidenceTone(candidate.cell.evidenceLevel)}>
                        {evidenceLabel(candidate.cell.evidenceLevel)}
                      </Pill>
                      <Pill tone={savedPoint ? 'selected' : 'neutral'}>
                        {savedPoint ? 'Saved' : sourceModeLabel(candidate.source)}
                      </Pill>
                    </div>
                  </div>

                  <h3>{candidate.displayName}</h3>
                  <p className="muted">{candidate.subtitle}</p>

                  <div className="metric-grid scenario-result-card__metrics">
                    <MetricCard label="Priority" value={formatScore(candidate.cell.scores.priority)} color={priorityColor(candidate.cell.scores.priority)} />
                    <MetricCard label="GIS Context" value={formatScore(candidate.cell.scores.contextScore)} color={priorityColor(candidate.cell.scores.contextScore)} helper={contextLabel(candidate.cell.contextScoreLabel)} />
                    <MetricCard label="Risk" value={formatScore(candidate.cell.scores.risk)} color={riskColor(candidate.cell.scores.risk)} />
                    <MetricCard label="Confidence" value={formatScore(candidate.cell.scores.confidence)} color={confidenceColor(candidate.cell.scores.confidence)} />
                  </div>

                  <div className="table-like">
                    <div className="table-like__row">
                      <span>Recommended action</span>
                      <strong>{actionLabel(candidate.cell.actionId, language)}</strong>
                    </div>
                    <div className="table-like__row">
                      <span>Evidence</span>
                      <strong>{evidenceLabel(candidate.cell.evidenceLevel)}</strong>
                    </div>
                    <div className="table-like__row">
                      <span>Road access</span>
                      <strong>{formatDistance(candidate.cell.roadKm)}</strong>
                    </div>
                    <div className="table-like__row">
                      <span>Surface water</span>
                      <strong>{formatDistance(candidate.cell.waterKm)}</strong>
                    </div>
                    <div className="table-like__row">
                      <span>Landuse</span>
                      <strong>{candidate.cell.landuseClass}</strong>
                    </div>
                    <div className="table-like__row">
                      <span>Slope</span>
                      <strong>{formatMaybeMetric(candidate.cell.slopePct, '%')}</strong>
                    </div>
                  </div>

                  <div className="button-row scenario-result-card__actions">
                    {savedPoint ? (
                      <Pill tone="selected">Already in wishlist</Pill>
                    ) : (
                      <button type="button" className="button button--secondary" onClick={() => saveCandidate(candidate)}>
                        Save to wishlist
                      </button>
                    )}
                    {savedPoint && savedProbePoints.length >= 2 ? (
                      <Link className="button button--ghost" to={`/compare?left=${savedPoint.id}`}>
                        Open compare
                      </Link>
                    ) : null}
                  </div>
                </Panel>
              )
            })}
          </div>
        </section>
      ) : (
        <Panel className="state-panel" level="minimal">
          <EmptyState
            title="No candidates matched this scenario"
            description="Relax the filters or switch the source mode to scan a broader set of points."
          />
          <div className="button-row state-panel__actions">
            <button type="button" className="button button--secondary" onClick={() => setForm(defaultForm)}>
              Reset
            </button>
          </div>
        </Panel>
      )}
    </div>
  )
}
