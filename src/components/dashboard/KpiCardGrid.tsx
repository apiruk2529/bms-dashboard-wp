// =============================================================================
// BMS Session KPI Dashboard - KPI Card Grid Component (Redesigned)
// =============================================================================

import { useCallback } from 'react'
import { Activity, BedDouble, Siren, Building2 } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import { getKpiSummary } from '@/services/overviewService'

export function KpiCardGrid() {
  const { connectionConfig, session } = useBmsSessionContext()

  const queryFn = useCallback(
    () => getKpiSummary(connectionConfig!, session!.databaseType),
    [connectionConfig, session],
  )

  const {
    data: kpiSummary,
    isLoading,
    isError,
    error,
    execute,
  } = useQuery<Awaited<ReturnType<typeof getKpiSummary>>>({
    queryFn,
    enabled: connectionConfig !== null && session !== null,
  })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="ผู้ป่วยนอก (OPD)"
        value={kpiSummary?.opdVisitCount ?? null}
        icon={<Activity className="h-5 w-5" />}
        isLoading={isLoading}
        isError={isError}
        error={error?.message}
        onRetry={execute}
        description="จำนวนผู้ป่วยนอกวันนี้"
        accentColor="text-blue-500"
        trend={{ value: 12, isPositive: true }}
      />
      <KpiCard
        title="ผู้ป่วยใน (IPD)"
        value={kpiSummary?.ipdPatientCount ?? null}
        icon={<BedDouble className="h-5 w-5" />}
        isLoading={isLoading}
        isError={isError}
        error={error?.message}
        onRetry={execute}
        description="จำนวนผู้ป่วยในปัจจุบัน"
        accentColor="text-purple-500"
        trend={{ value: 3, isPositive: true }}
      />
      <KpiCard
        title="ห้องฉุกเฉิน (ER)"
        value={kpiSummary?.erVisitCount ?? null}
        icon={<Siren className="h-5 w-5" />}
        isLoading={isLoading}
        isError={isError}
        error={error?.message}
        onRetry={execute}
        description="จำนวนเข้ารับบริการฉุกเฉินวันนี้"
        accentColor="text-red-500"
        trend={{ value: 5, isPositive: false }}
      />
      <KpiCard
        title="แผนกที่มีบริการ"
        value={kpiSummary?.activeDepartmentCount ?? null}
        icon={<Building2 className="h-5 w-5" />}
        isLoading={isLoading}
        isError={isError}
        error={error?.message}
        onRetry={execute}
        description="จำนวนแผนกที่มีผู้ป่วยวันนี้"
        accentColor="text-green-500"
        trend={{ value: 8, isPositive: true }}
      />
    </div>
  )
}
