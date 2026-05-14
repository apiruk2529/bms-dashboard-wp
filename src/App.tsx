import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BmsSessionProvider } from '@/contexts/BmsSessionContext'
import { SessionValidator } from '@/components/session/SessionValidator'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { AppLayout } from '@/components/layout/AppLayout'

const Overview = lazy(() => import('@/pages/Overview'))
const Trends = lazy(() => import('@/pages/Trends'))
const DepartmentAnalytics = lazy(() => import('@/pages/DepartmentAnalytics'))
const Workload = lazy(() => import('@/pages/Workload'))
const Demographics = lazy(() => import('@/pages/Demographics'))
const TopDisease = lazy(() => import('@/pages/TopDisease'))
const ReferOverview = lazy(() => import('@/pages/ReferOverview'))
const NcdDashboard = lazy(() => import('@/pages/NcdDashboard'))
const ThaiTraditionalMedicine = lazy(() => import('@/pages/ThaiTraditionalMedicine'))

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" message="กำลังโหลดหน้า..." className="min-h-[50vh]" />}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/departments" element={<DepartmentAnalytics />} />
        <Route path="/workload" element={<Workload />} />
        <Route path="/demographics" element={<Demographics />} />
        <Route path="/top-diseases" element={<TopDisease />} />
        <Route path="/refer-overview" element={<ReferOverview />} />
        <Route path="/ncd-dashboard" element={<NcdDashboard />} />
        <Route path="/ttm-dashboard" element={<ThaiTraditionalMedicine />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <BmsSessionProvider>
        <SessionValidator>
          <AppLayout>
            <AppRoutes />
          </AppLayout>
        </SessionValidator>
      </BmsSessionProvider>
    </BrowserRouter>
  )
}
