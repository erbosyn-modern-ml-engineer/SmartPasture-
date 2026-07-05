import {
  BarChart3,
  BrainCircuit,
  ListFilter,
  MapPinned,
  ShieldAlert,
  ShieldCheck,
  Map,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { homeHeroImage } from '@/assets/smartpasture'
import { useSmartPasture } from '@/context/useSmartPasture'
import { ErrorPanel, Panel, SectionTitle, SkeletonCard } from '@/components/ui'
import { useI18n } from '@/i18n/useI18n'

export function HomePage() {
  const { status, error } = useSmartPasture()
  const { language, t } = useI18n()

  if (status === 'loading') {
    return (
      <div className="page page--home page--home-loading" aria-busy="true">
        <section className="home-loading-skeleton" aria-hidden="true">
          <SkeletonCard className="home-loading-skeleton__hero" lines={5} />
          <SkeletonCard className="home-loading-skeleton__workflow" lines={3} />
          <SkeletonCard className="home-loading-skeleton__shortlist" lines={2} />
        </section>
      </div>
    )
  }

  if (status === 'error') {
    return <ErrorPanel title={t('common.errorTitle')} message={error ?? t('home.error')} />
  }

  const isKk = language === 'kk'
  const isEn = language === 'en'

  const heroHeadline = isKk ? "Гидрогеологиялық скрининг платформасы" : isEn ? "Hydrogeological screening platform" : "Платформа предварительного гидрогеологического скрининга";
  const heroSub = isKk
    ? "Қызметтерге іздеу аймағын тез тарылтып, тексеруге лайық нүктелерді таңдауға көмектеседі"
    : isEn
      ? "Helps services narrow the search area and prioritize points before field inspection"
      : "Помогает гидрогеологическим службам быстрее сузить территорию поиска и выбрать точки для первичной проверки";
  
  const valueCards = [
    { 
      icon: ListFilter, 
      label: isKk ? 'Алдын ала іріктеу' : (isEn ? 'Pre-field shortlist' : 'Предполевой shortlist'), 
      title: isKk ? 'Тексерілетін нүктелерді таңдау' : (isEn ? 'Prioritize inspection points' : 'Отбор точек для проверки'), 
      body: isKk ? 'Үлкен аумақты нақты кандидаттарға қысқарту' : (isEn ? 'Reduce a broad area to concrete candidate points' : 'Сокращение широкой территории до конкретных кандидатных точек'), 
      color: '#2196A6' 
    },
    { 
      icon: BrainCircuit, 
      label: isKk ? 'Classic ML' : (isEn ? 'Classic ML' : 'Classic ML'), 
      title: isKk ? 'Су табу ықтималдығы' : (isEn ? 'Water-success probability' : 'Вероятность успешной водной точки'), 
      body: isKk ? 'Бұрғылауға дейінгі GIS белгілер бойынша baseline болжам' : (isEn ? 'Baseline prediction from pre-drilling GIS features' : 'Baseline-прогноз по GIS-признакам, доступным до бурения'), 
      color: '#3DA366' 
    },
    { 
      icon: ShieldAlert, 
      label: isKk ? 'Тәуекел' : (isEn ? 'Risk control' : 'Контроль риска'), 
      title: isKk ? 'Дерек сапасын түсіндіру' : (isEn ? 'Explain data confidence' : 'Объяснение качества данных'), 
      body: isKk ? 'Жетіспейтін қабаттар мен далаға дейінгі шектеулерді көрсету' : (isEn ? 'Show missing layers and pre-field limitations' : 'Показ недостающих слоев и ограничений перед выездом'), 
      color: '#6B8A7A' 
    },
  ]

  const quickActions = [
    { to: '/map', icon: Map, title: isKk ? 'Карта' : (isEn ? 'Map' : 'Карта'), desc: isKk ? 'Нүктені GIS және ML арқылы тексеру' : (isEn ? 'Inspect a point with GIS and ML' : 'Проверить точку через GIS и ML') },
    { to: '/ranking', icon: ListFilter, title: isKk ? 'Рейтинг' : (isEn ? 'Ranking' : 'Рейтинг'), desc: isKk ? 'Ең күшті кандидаттарды табу' : (isEn ? 'Find strongest candidates' : 'Найти сильные кандидатные точки') },
    { to: '/risk-confidence', icon: ShieldAlert, title: isKk ? 'Тәуекел' : (isEn ? 'Risks' : 'Риски'), desc: isKk ? 'Дерек сапасын тексеру' : (isEn ? 'Check data confidence' : 'Проверить качество данных') },
    { to: '/validation', icon: BarChart3, title: isKk ? 'Валидация' : (isEn ? 'Validation' : 'Проверка'), desc: isKk ? 'Белгілі ұңғымалармен салыстыру' : (isEn ? 'Compare against known wells' : 'Сравнить с известными скважинами') },
  ];

  return (
    <div className="page page--home">
      <section className="editorial-hero home-hero" style={{ '--hero-image': `url(${homeHeroImage})` } as CSSProperties}>
        <div className="editorial-hero__overlay"></div>
        <div className="editorial-hero__content">
          <p className="eyebrow">{isKk ? "Гидрогеологиялық қызметтер" : isEn ? "Hydrogeological services" : "Для гидрогеологических служб"}</p>
          <h1>{heroHeadline}</h1>
          <p className="hero-subtitle">{heroSub}</p>
          <Link className="button button--primary button--large" to="/map">
            <MapPinned size={20} />
            {isKk ? 'Жұмыс картасын ашу' : isEn ? 'Open work map' : 'Открыть рабочую карту'}
          </Link>
        </div>
      </section>

      <section className="section-block quick-actions" data-reveal>
        <div className="home-value-grid">
          {quickActions.map(action => (
            <Link key={action.to} to={action.to} style={{ textDecoration: 'none' }}>
              <Panel className="capability-card" level="secondary">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#1A2E25' }}>
                  <action.icon size={26} color="#3DA366" />
                  <div>
                    <strong style={{ fontSize: '1.2rem', display: 'block' }}>{action.title}</strong>
                    <span style={{ color: '#6B8A7A', fontSize: '0.9rem' }}>{action.desc}</span>
                  </div>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block" data-reveal data-reveal-delay="70">
        <SectionTitle 
          title={isKk ? 'Негізгі көрсеткіштер' : (isEn ? 'Key indicators' : 'Основные показатели')} 
          subtitle={isKk ? 'Алдын ала шешім қабылдауға арналған қабаттар' : (isEn ? 'Layers for pre-field decisions' : 'Слои для предполевого решения')} 
        />
        <div className="home-value-grid">
          {valueCards.map((item) => (
            <Panel key={item.title} className="capability-card capability-card--colored" level="minimal">
              <div className="capability-card__icon capability-card__icon--large" style={{ color: item.color }}>
                <item.icon size={28} />
              </div>
              <span className="capability-card__label">{item.label}</span>
              <strong className="capability-card__title">{item.title}</strong>
              <p className="capability-card__body">{item.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <Panel className="home-disclaimer home-disclaimer--info" level="minimal" data-reveal data-reveal-delay="100">
        <p style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={18} />
          {isKk ? 'SmartPasture далалық зерттеулерді алмастырмайды' : (isEn ? 'SmartPasture supports field work, it does not replace it' : 'SmartPasture помогает подготовить выезд, но не заменяет гидрогеологическое заключение.')}
        </p>
      </Panel>

    </div>
  )
}
