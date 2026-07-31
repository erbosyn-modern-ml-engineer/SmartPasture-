import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { ScrollToTop } from '@/components/ScrollToTop'
import { featureFlags } from '@/lib/featureFlags'

const CalculatorPage = lazy(() => import('@/pages/CalculatorPage').then((module) => ({ default: module.CalculatorPage })))
const ComparePage = lazy(() => import('@/pages/ComparePage').then((module) => ({ default: module.ComparePage })))
const GisProbePage = lazy(() => import('@/pages/GisProbePage').then((module) => ({ default: module.GisProbePage })))
const HomePage = lazy(() => import('@/pages/HomePage').then((module) => ({ default: module.HomePage })))
const KnowledgePage = lazy(() => import('@/pages/KnowledgePage').then((module) => ({ default: module.KnowledgePage })))
const MapPage = lazy(() => import('@/pages/MapPage').then((module) => ({ default: module.MapPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const RankingPage = lazy(() => import('@/pages/RankingPage').then((module) => ({ default: module.RankingPage })))
const SiteDetailPage = lazy(() => import('@/pages/SiteDetailPage').then((module) => ({ default: module.SiteDetailPage })))
const ValidationPage = lazy(() => import('@/pages/ValidationExperiencePage').then((module) => ({ default: module.ValidationExperiencePage })))

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/site/:siteId" element={<SiteDetailPage />} />
          <Route path="/report" element={<KnowledgePage />} />

          {/* Experimental ML screens stay in the repository but are closed for public users. */}
          <Route
            path="/validation"
            element={featureFlags.experimentalMlUi ? <ValidationPage /> : <Navigate to="/ranking" replace />}
          />
          <Route
            path="/gis-probe"
            element={featureFlags.experimentalMlUi ? <GisProbePage /> : <Navigate to="/ranking" replace />}
          />

          <Route path="/knowledge" element={<Navigate to="/report" replace />} />
          <Route path="/methodology" element={<Navigate to="/report" replace />} />
          <Route path="/appendix/methodology" element={<Navigate to="/report" replace />} />
          <Route path="/risk-confidence" element={<Navigate to="/ranking" replace />} />
          <Route path="/scenarios" element={<Navigate to="/ranking" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
