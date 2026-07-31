import {
  Calculator,
  GitCompareArrows,
  ListFilter,
  Map,
  MapPinned,
  ShieldCheck,
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

  const heroHeadline = isKk
    ? 'Гидрогеологиялық скрининг платформасы'
    : isEn
      ? 'Hydrogeological screening platform'
      : 'Платформа предварительного гидрогеологического скрининга'
  const heroSub = isKk
    ? 'Қызметтерге іздеу аймағын тез тарылтып, тексеруге лайық нүктелерді таңдауға көмектеседі'
    : isEn
      ? 'Helps services narrow the search area and prioritize points before field inspection'
      : 'Помогает гидрогеологическим службам быстрее сузить территорию поиска и выбрать точки для первичной проверки'

  const valueCards = [
    {
      icon: MapPinned,
      label: isKk ? 'GIS-контекст' : isEn ? 'GIS context' : 'GIS-контекст',
      title: isKk ? 'Аумақты алдын ала талдау' : isEn ? 'Screen the territory' : 'Предварительный анализ территории',
      body: isKk
        ? 'Жолдар, жер бедері, су нысандары және жер пайдалану қабаттарын бір картада қарау'
        : isEn
          ? 'Review roads, terrain, surface water, and land-use layers in one place'
          : 'Просмотр дорог, рельефа, поверхностных вод и землепользования на одной карте',
      color: '#2196A6',
    },
    {
      icon: ListFilter,
      label: isKk ? 'Түсінікті рейтинг' : isEn ? 'Transparent ranking' : 'Понятное ранжирование',
      title: isKk ? 'Тексеру кезегін құру' : isEn ? 'Plan the inspection order' : 'Планирование очередности проверки',
      body: isKk
        ? 'Нүктелерді басымдық, тәуекел және қолжетімді деректер бойынша сұрыптау'
        : isEn
          ? 'Sort candidate points by priority, risk, and available evidence'
          : 'Сортировка кандидатных точек по приоритету, риску и доступным данным',
      color: '#3DA366',
    },
    {
      icon: Calculator,
      label: isKk ? 'Су балансы' : isEn ? 'Water balance' : 'Баланс воды',
      title: isKk ? 'Судың табынға жетуін есептеу' : isEn ? 'Check water sufficiency for a herd' : 'Расчёт достаточности воды для стада',
      body: isKk
        ? 'Мал саны мен болжамды дебитті салыстырып, қордың жеткіліктілігін анықтау'
        : isEn
          ? 'Compare herd demand with an assumed well flow and see the reserve'
          : 'Сравнение потребности стада с предполагаемым дебитом и расчёт запаса',
      color: '#6B8A7A',
    },
  ]

  const quickActions = [
    {
      to: '/map',
      icon: Map,
      title: isKk ? 'Карта' : isEn ? 'Map' : 'Карта',
      desc: isKk ? 'Нүктені GIS қабаттары арқылы тексеру' : isEn ? 'Inspect a point using GIS layers' : 'Проверить точку по GIS-слоям',
    },
    {
      to: '/ranking',
      icon: ListFilter,
      title: isKk ? 'Нүктелер' : isEn ? 'Points' : 'Точки',
      desc: isKk ? 'Кандидаттарды салыстырып, сұрыптау' : isEn ? 'Rank and filter candidate points' : 'Ранжировать и фильтровать кандидатов',
    },
    {
      to: '/calculator',
      icon: Calculator,
      title: isKk ? 'Калькулятор' : isEn ? 'Calculator' : 'Калькулятор',
      desc: isKk ? 'Табынның су қажеттілігін есептеу' : isEn ? 'Calculate herd water demand' : 'Рассчитать потребность стада в воде',
    },
    {
      to: '/compare',
      icon: GitCompareArrows,
      title: isKk ? 'Салыстыру' : isEn ? 'Compare' : 'Сравнить',
      desc: isKk ? 'Сақталған екі нүктені салыстыру' : isEn ? 'Compare two saved points' : 'Сравнить две сохранённые точки',
    },
  ]

  return (
    <div className="page page--home">
      <section className="editorial-hero home-hero" style={{ '--hero-image': `url(${homeHeroImage})` } as CSSProperties}>
        <div className="editorial-hero__overlay" />
        <div className="editorial-hero__content">
          <p className="eyebrow">{isKk ? 'Гидрогеологиялық қызметтер' : isEn ? 'Hydrogeological services' : 'Для гидрогеологических служб'}</p>
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
          {quickActions.map((action) => (
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
          title={isKk ? 'Негізгі мүмкіндіктер' : isEn ? 'Core capabilities' : 'Основные возможности'}
          subtitle={isKk ? 'Далалық тексеруге дейін түсінікті шешімдер' : isEn ? 'Clear decisions before field inspection' : 'Понятные решения до полевого выезда'}
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
          {isKk
            ? 'SmartPasture далалық зерттеулерді алмастырмайды'
            : isEn
              ? 'SmartPasture supports field work; it does not replace it'
              : 'SmartPasture помогает подготовить выезд, но не заменяет гидрогеологическое заключение.'}
        </p>
      </Panel>
    </div>
  )
}
