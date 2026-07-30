import { BarChart3, TriangleAlert } from 'lucide-react'
import { Panel, SectionTitle } from '@/components/ui'
import { ValidationPage } from '@/pages/ValidationPage'

export function ValidationExperiencePage() {
  return (
    <div className="validation-experience">
      <div className="validation-user-warning" role="note">
        <TriangleAlert size={22} />
        <div>
          <strong>Модель пока работает лишь немного лучше случайного угадывания.</strong>
          <span>Не полагайтесь только на ML-прогноз. Используйте его вместе с ГИС-ранжированием, архивными материалами и полевой проверкой.</span>
        </div>
      </div>

      <Panel level="minimal" className="validation-glossary">
        <SectionTitle
          title="Как читать метрики модели"
          subtitle="Технические сокращения расшифрованы простыми словами."
        />
        <div className="validation-glossary__grid">
          <div><BarChart3 size={18} /><span><strong>Точность (Accuracy)</strong><small>Доля всех примеров, которые модель определила правильно.</small></span></div>
          <div><BarChart3 size={18} /><span><strong>Точность положительного прогноза (Precision)</strong><small>Как часто прогноз «скважина удачная» действительно оказывается верным.</small></span></div>
          <div><BarChart3 size={18} /><span><strong>Полнота (Recall)</strong><small>Какую долю реально удачных скважин модель смогла найти.</small></span></div>
          <div><BarChart3 size={18} /><span><strong>AUC</strong><small>Насколько хорошо модель отделяет удачные случаи от рискованных при разных порогах.</small></span></div>
        </div>
      </Panel>

      <ValidationPage />
    </div>
  )
}
