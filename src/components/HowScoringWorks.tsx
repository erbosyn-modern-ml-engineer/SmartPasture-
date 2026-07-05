import { Link } from 'react-router-dom'
import { Panel } from '@/components/ui'
import { useI18n } from '@/i18n/useI18n'

type HowScoringWorksProps = {
  className?: string
}

export function HowScoringWorks({ className }: HowScoringWorksProps) {
  const { t } = useI18n()

  return (
    <Panel className={className} level="minimal">
      <details className="scoring-help">
        <summary className="scoring-help__summary">
          <span>{t('help.howScoringTitle')}</span>
          <small>{t('help.howScoringSub')}</small>
        </summary>

        <div className="scoring-help__content">
          <ul className="scoring-help__list">
            <li><strong>HPS</strong> {t('help.hps')}</li>
            <li><strong>PNS</strong> {t('help.pns')}</li>
            <li><strong>{t('common.risk')} + {t('common.confidence')}</strong> {t('help.riskConfidence')}</li>
          </ul>
          <p className="scoring-help__note">{t('help.compactNote')}</p>
          <Link className="scoring-help__appendix" to="/appendix/methodology">
            {t('help.openAppendix')}
          </Link>
        </div>
      </details>
    </Panel>
  )
}
