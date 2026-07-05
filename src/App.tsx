import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { ScrollToTop } from '@/components/ScrollToTop'

const CalculatorPage = lazy(() => import('@/pages/CalculatorPage').then((module) => ({ default: module.CalculatorPage })))
const ComparePage = lazy(() => import('@/pages/ComparePage').then((module) => ({ default: module.ComparePage })))
const GisProbePage = lazy(() => import('@/pages/GisProbePage').then((module) => ({ default: module.GisProbePage })))
const HomePage = lazy(() => import('@/pages/HomePage').then((module) => ({ default: module.HomePage })))
const KnowledgePage = lazy(() => import('@/pages/KnowledgePage').then((module) => ({ default: module.KnowledgePage })))
const MapPage = lazy(() => import('@/pages/MapPage').then((module) => ({ default: module.MapPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const RankingPage = lazy(() => import('@/pages/RankingPage').then((module) => ({ default: module.RankingPage })))
const RiskConfidencePage = lazy(() => import('@/pages/RiskConfidencePage').then((module) => ({ default: module.RiskConfidencePage })))
const ScenariosPage = lazy(() => import('@/pages/ScenariosPage').then((module) => ({ default: module.ScenariosPage })))
const SiteDetailPage = lazy(() => import('@/pages/SiteDetailPage').then((module) => ({ default: module.SiteDetailPage })))
const ValidationPage = lazy(() => import('@/pages/ValidationPage').then((module) => ({ default: module.ValidationPage })))

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/risk-confidence" element={<RiskConfidencePage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/knowledge" element={<Navigate to="/appendix/methodology" replace />} />
          <Route path="/methodology" element={<Navigate to="/appendix/methodology" replace />} />
          <Route path="/appendix/methodology" element={<KnowledgePage />} />
          <Route path="/scenarios" element={<ScenariosPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/gis-probe" element={<GisProbePage />} />
          <Route path="/validation" element={<ValidationPage />} />
          <Route path="/site/:siteId" element={<SiteDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
