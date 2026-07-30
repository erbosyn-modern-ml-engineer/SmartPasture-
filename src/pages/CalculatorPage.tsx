import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Droplets, Save, SlidersHorizontal } from 'lucide-react'
import { ErrorPanel, LoadingPanel, MetricCard, PageIntro, Panel, SectionTitle } from '@/components/ui'
import { useSmartPasture } from '@/context/useSmartPasture'
import {
  LIVESTOCK_GROUPS,
  calculateWaterPlan,
  loadWaterPlan,
  saveWaterPlan,
  type WaterPlan,
} from '@/lib/waterPlan'

function format(value: number, digits = 1) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value)
}

function updateRecord(record: Record<string, number>, key: string, value: string) {
  const number = Number(value)
  return { ...record, [key]: Number.isFinite(number) && number >= 0 ? number : 0 }
}

export function CalculatorPage() {
  const { status, data, error } = useSmartPasture()
  const [plan, setPlan] = useState<WaterPlan>(() => loadWaterPlan())
  const [savedMessage, setSavedMessage] = useState('')
  const result = useMemo(() => calculateWaterPlan(plan), [plan])

  if (status === 'loading' || !data) {
    return <LoadingPanel title="Калькулятор воды" message="Загружаем точки SmartPasture." />
  }

  if (status === 'error') {
    return <ErrorPanel title="Калькулятор воды" message={error ?? 'Не удалось загрузить SmartPasture.'} />
  }

  function persist(message: string) {
    saveWaterPlan(plan)
    setSavedMessage(message)
  }

  return (
    <div className="page page--water-calculator">
      <PageIntro
        eyebrow="Потребность стада × дебит источника"
        title="Хватит ли воды моему стаду?"
        subtitle="Введите предполагаемый дебит и поголовье. SmartPasture посчитает Qneed, Qstock, коэффициент достаточности K и индекс PNS. Нормы можно менять под жару, лактацию и реальные условия хозяйства."
      />

      <section className="water-calculator-layout" data-reveal data-reveal-delay="20">
        <Panel level="secondary" className="water-input-panel">
          <SectionTitle title="Исходные данные" subtitle="Дебит — сценарное значение до фактического замера скважины." />
          <label className="field water-flow-field">
            <span>Предполагаемый дебит скважины <small>л/с</small></span>
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              value={plan.flowLps}
              onChange={(event) => setPlan((current) => ({ ...current, flowLps: Math.max(0, Number(event.target.value) || 0) }))}
            />
          </label>

          <div className="water-formula-note">
            <Droplets size={20} />
            <span>Qstock = дебит × 86 400 / 1000 = <strong>{format(result.qStockM3)} м³/сутки</strong></span>
          </div>

          <label className="field">
            <span>Применить к точке на карте</span>
            <select
              value={plan.selectedSiteId ?? ''}
              onChange={(event) => setPlan((current) => ({
                ...current,
                selectedSiteId: event.target.value ? Number(event.target.value) : undefined,
              }))}
            >
              <option value="">Без привязки к точке</option>
              {data.siteDetails.map((site) => (
                <option key={site.siteId} value={site.siteId}>{site.title} — {site.district}</option>
              ))}
            </select>
          </label>

          <div className="button-row water-actions">
            <button type="button" className="button button--secondary" onClick={() => persist('Расчёт сохранён.')}>
              <Save size={17} /> Сохранить расчёт
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={!plan.selectedSiteId}
              onClick={() => persist('Расчёт применён к выбранной точке.')}
            >
              Применить к точке
            </button>
          </div>
          {savedMessage ? <p className="water-save-message" role="status">{savedMessage}</p> : null}
        </Panel>

        <Panel tone="hero" className={`water-result-panel water-result-panel--${result.verdict}`}>
          <SectionTitle title="Результат" subtitle="Однозначный вывод по средним нормам, выбранным пользователем." />
          <div className={`water-verdict water-verdict--${result.verdict}`}>{result.label}</div>
          <p className="water-result-summary">{result.summary}</p>

          <div className="metric-grid water-metric-grid">
            <MetricCard label="Qneed" value={format(result.qNeedM3, 2)} helper="м³/сут" color="#22c55e" />
            <MetricCard label="Qstock" value={format(result.qStockM3, 2)} helper="м³/сут" color="#38bdf8" />
            <MetricCard label="K = Qstock / Qneed" value={result.totalAnimals ? format(result.k, 2) : '—'} color="#f59e0b" />
            <MetricCard label="PNS" value={format(result.pns, 2)} helper="0–1" color="#a78bfa" />
          </div>

          <div className="water-range-card">
            <strong>Диапазон потребности</strong>
            <span>{format(result.qNeedMinL, 0)}–{format(result.qNeedMaxL, 0)} л/сутки</span>
            <small>Минимум и максимум по справочным диапазонам для введённого поголовья.</small>
          </div>

          {plan.selectedSiteId ? (
            <Link className="button button--ghost" to={`/site/${plan.selectedSiteId}`}>Открыть выбранную точку</Link>
          ) : null}
        </Panel>
      </section>

      <Panel level="minimal" className="water-livestock-panel" data-reveal data-reveal-delay="60">
        <SectionTitle
          title="Поголовье и нормы потребления"
          subtitle="Количество голов и норма редактируются отдельно. Все значения подписаны в л/сутки на голову."
        />
        <div className="water-group-list">
          {LIVESTOCK_GROUPS.map((group) => (
            <details key={group.id} className="water-animal-group">
              <summary>
                <span>{group.emoji} {group.label}</span>
                <SlidersHorizontal size={18} />
              </summary>
              <div className="water-animal-table">
                <div className="water-animal-table__head" aria-hidden="true">
                  <span>Категория</span><span>Голов</span><span>Норма</span>
                </div>
                {group.animals.map((animal) => (
                  <div key={animal.key} className="water-animal-row">
                    <div className="water-animal-copy">
                      <strong>{animal.label}</strong>
                      <small>{animal.defaultValue} л/сутки на голову ({animal.min}–{animal.max}){animal.note ? ` · ${animal.note}` : ''}</small>
                    </div>
                    <label>
                      <span className="sr-only">Количество: {animal.label}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={plan.counts[animal.key] ?? 0}
                        onChange={(event) => setPlan((current) => ({
                          ...current,
                          counts: updateRecord(current.counts, animal.key, event.target.value),
                        }))}
                      />
                      <small>голов</small>
                    </label>
                    <label>
                      <span className="sr-only">Норма: {animal.label}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={plan.norms[animal.key] ?? animal.defaultValue}
                        onChange={(event) => setPlan((current) => ({
                          ...current,
                          norms: updateRecord(current.norms, animal.key, event.target.value),
                        }))}
                      />
                      <small>л/сут на голову</small>
                    </label>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Panel>

      <p className="water-source-note">
        Справочные диапазоны взяты из технического задания заказчика. Они предназначены для предварительного планирования и не заменяют ветеринарные, климатические и полевые нормы конкретного хозяйства.
      </p>
    </div>
  )
}
