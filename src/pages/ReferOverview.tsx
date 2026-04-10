// =============================================================================
// BMS Session KPI Dashboard - ภาพรวม refer (Refer Overview) Page
// =============================================================================

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import {
  getHospitalRegionInfo,
  getTopReferDiseasesByRegion,
  getReferSummaryCounts,
  getReferTrend,
} from '@/services/kpiService'
import type {
  ReferRegionDisease,
  HospitalRegionInfo,
  ReferSummaryCounts,
  ReferTrendData
} from '@/services/kpiService'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { getFiscalYearRange } from '@/utils/dateUtils'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Activity, MapPin, Ambulance, ExternalLink } from 'lucide-react'

// ---------------------------------------------------------------------------
// Helper: Rank badge
// ---------------------------------------------------------------------------

function RankBadge({ rank }: { rank: number }) {
  const colors =
    rank === 1
      ? 'bg-yellow-400 text-yellow-900'
      : rank === 2
        ? 'bg-slate-300 text-slate-800'
        : rank === 3
          ? 'bg-amber-600 text-amber-100'
          : 'bg-slate-100 text-slate-600'
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${colors}`}
    >
      {rank}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Helper: Empty / loading state
// ---------------------------------------------------------------------------

function TablePlaceholder({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return (
      <LoadingSpinner size="sm" message="กำลังโหลดข้อมูล..." className="py-6" />
    )
  }
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">
      ไม่พบข้อมูล
    </p>
  )
}

// ---------------------------------------------------------------------------
// Helper: Short date format
// ---------------------------------------------------------------------------

function formatShortDate(dateStr: string) {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), 'd MMM', { locale: th })
  } catch {
    return dateStr
  }
}

// ---------------------------------------------------------------------------
// Refer Table Component
// ---------------------------------------------------------------------------

interface ReferRegionTableProps {
  title: string
  icon: string
  data: ReferRegionDisease[]
  isLoading: boolean
}

function ReferRegionTable({
  title,
  icon,
  data,
  isLoading,
}: ReferRegionTableProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span>{icon}</span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {data.length === 0 ? (
          <TablePlaceholder isLoading={isLoading} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3 w-20">ICD10</th>
                  <th className="px-4 py-3 min-w-[120px]">ชื่อโรค</th>
                  <th className="px-4 py-3 text-right">ส่งต่อรวม</th>
                  <th className="px-4 py-3 text-right">OPD</th>
                  <th className="px-4 py-3 text-right">ER</th>
                  <th className="px-4 py-3 text-right">IPD</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr
                    key={`${row.pdx}-${i}`}
                    className="border-b transition-colors hover:bg-muted/30 last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-muted-foreground">
                      {row.pdx}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{row.icd10name || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-orange-600">
                      {row.ct.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-blue-600 font-medium">
                      {row.referOpd.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">
                      {row.referEr.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">
                      {row.referIpd.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ReferOverview() {
  const { connectionConfig, session } = useBmsSessionContext()

  // Default to current fiscal year
  const defaultRange = useMemo(() => getFiscalYearRange(), [])
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)

  // Tab State
  const [patientType, setPatientType] = useState<'ALL' | 'OPD' | 'IPD'>('ALL')

  // Hospital Info State
  const [hospitalInfo, setHospitalInfo] = useState<HospitalRegionInfo | null>(null)
  const [isHospitalInfoLoading, setIsHospitalInfoLoading] = useState(false)

  const isConnected = connectionConfig !== null && session !== null

  // Fetch Hospital Info Once
  useEffect(() => {
    async function fetchInfo() {
      if (!isConnected || !connectionConfig) return
      setIsHospitalInfoLoading(true)
      try {
        const info = await getHospitalRegionInfo(connectionConfig)
        setHospitalInfo(info)
      } catch (error) {
        console.error("Failed to fetch hospital region info", error)
      } finally {
        setIsHospitalInfoLoading(false)
      }
    }
    fetchInfo()
  }, [isConnected, connectionConfig])

  // Queries
  const canFetchData = isConnected && hospitalInfo !== null

  // 1. In Province
  const inProvinceQueryFn = useCallback(
    () =>
      getTopReferDiseasesByRegion(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        'IN_PROVINCE',
        hospitalInfo!.chwpart,
        hospitalInfo!.zone_code,
        patientType
      ),
    [connectionConfig, session, startDate, endDate, hospitalInfo, patientType]
  )
  const inProvinceQuery = useQuery<ReferRegionDisease[]>({
    queryFn: inProvinceQueryFn,
    enabled: canFetchData,
  })

  // 2. In Zone
  const inZoneQueryFn = useCallback(
    () =>
      getTopReferDiseasesByRegion(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        'IN_ZONE',
        hospitalInfo!.chwpart,
        hospitalInfo!.zone_code,
        patientType
      ),
    [connectionConfig, session, startDate, endDate, hospitalInfo, patientType]
  )
  const inZoneQuery = useQuery<ReferRegionDisease[]>({
    queryFn: inZoneQueryFn,
    enabled: canFetchData,
  })

  // 3. Out Zone
  const outZoneQueryFn = useCallback(
    () =>
      getTopReferDiseasesByRegion(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        'OUT_ZONE',
        hospitalInfo!.chwpart,
        hospitalInfo!.zone_code,
        patientType
      ),
    [connectionConfig, session, startDate, endDate, hospitalInfo, patientType]
  )
  const outZoneQuery = useQuery<ReferRegionDisease[]>({
    queryFn: outZoneQueryFn,
    enabled: canFetchData,
  })

  // 4. Summary Counts
  const summaryQueryFn = useCallback(
    () =>
      getReferSummaryCounts(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        hospitalInfo!.chwpart,
        hospitalInfo!.zone_code,
        patientType
      ),
    [connectionConfig, session, startDate, endDate, hospitalInfo, patientType]
  )
  const summaryQuery = useQuery<ReferSummaryCounts>({
    queryFn: summaryQueryFn,
    enabled: canFetchData,
  })

  // 5. Refer Trend
  const trendQueryFn = useCallback(
    () =>
      getReferTrend(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        patientType
      ),
    [connectionConfig, session, startDate, endDate, patientType]
  )
  const trendQuery = useQuery<ReferTrendData[]>({
    queryFn: trendQueryFn,
    enabled: canFetchData,
  })

  // Date range handler
  const handleRangeChange = useCallback((start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }, [])

  const anyLoading =
    isHospitalInfoLoading ||
    inProvinceQuery.isLoading ||
    inZoneQuery.isLoading ||
    outZoneQuery.isLoading ||
    summaryQuery.isLoading ||
    trendQuery.isLoading

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            ภาพรวม refer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ข้อมูลการส่งต่อผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD) แยกตามพื้นที่ในจังหวัด และเขตสุขภาพ
          </p>
        </div>
        
        {/* Type Selector */}
        <div className="flex bg-muted p-1 rounded-lg">
          {(['ALL', 'OPD', 'IPD'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setPatientType(type)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                patientType === type
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'ALL' ? 'ทั้งหมด' : type === 'OPD' ? 'ผู้ป่วยนอก (OPD)' : 'ผู้ป่วยใน (IPD)'}
            </button>
          ))}
        </div>
      </div>

      {/* Date range picker */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onRangeChange={handleRangeChange}
        isLoading={anyLoading}
      />

      {/* Dashboard Grid */}
      {isHospitalInfoLoading && !hospitalInfo ? (
        <div className="py-20">
          <LoadingSpinner size="lg" message="กำลังเตรียมข้อมูลอ้างอิงของโรงพยาบาล..." />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="ส่งต่อรวม (Refer Out)"
              value={summaryQuery.data?.total ?? null}
              icon={<Activity className="h-5 w-5" />}
              isLoading={summaryQuery.isLoading}
              isError={summaryQuery.isError}
              error={summaryQuery.error?.message}
              onRetry={summaryQuery.execute}
              description="จำนวนส่งต่อทั้งหมด"
              accentColor="text-blue-500"
            />
            <KpiCard
              title="ในจังหวัด"
              value={summaryQuery.data?.inProvince ?? null}
              icon={<MapPin className="h-5 w-5" />}
              isLoading={summaryQuery.isLoading}
              isError={summaryQuery.isError}
              error={summaryQuery.error?.message}
              onRetry={summaryQuery.execute}
              description="จำนวนส่งต่อในจังหวัด"
              accentColor="text-orange-500"
            />
            <KpiCard
              title="นอกจังหวัด (ในเขต)"
              value={summaryQuery.data?.inZone ?? null}
              icon={<Ambulance className="h-5 w-5" />}
              isLoading={summaryQuery.isLoading}
              isError={summaryQuery.isError}
              error={summaryQuery.error?.message}
              onRetry={summaryQuery.execute}
              description="จำนวนส่งต่อนอกจังหวัด (เขตสุขภาพเดียวกัน)"
              accentColor="text-emerald-500"
            />
            <KpiCard
              title="นอกเขตสุขภาพ"
              value={summaryQuery.data?.outZone ?? null}
              icon={<ExternalLink className="h-5 w-5" />}
              isLoading={summaryQuery.isLoading}
              isError={summaryQuery.isError}
              error={summaryQuery.error?.message}
              onRetry={summaryQuery.execute}
              description="จำนวนส่งต่อนอกเขตสุขภาพ"
              accentColor="text-rose-500"
            />
          </div>

          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-5 w-5" />
                แนวโน้มการส่งต่อผู้ป่วย
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendQuery.isLoading ? (
                <div className="flex h-[300px] items-center justify-center">
                  <LoadingSpinner size="md" message="กำลังโหลดข้อมูล..." />
                </div>
              ) : trendQuery.isError ? (
                <div className="flex flex-col h-[300px] items-center justify-center text-sm text-red-500">
                  <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                  <button onClick={trendQuery.execute} className="mt-2 text-blue-500 underline">ลองใหม่</button>
                </div>
              ) : trendQuery.data && trendQuery.data.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={trendQuery.data}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={formatShortDate}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={20}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={(label) => <span className="font-semibold">{formatShortDate(label as string)}</span>}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                        iconType="circle"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="referOpd" 
                        name="OPD" 
                        stroke="#2563eb" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="referEr" 
                        name="ER" 
                        stroke="#dc2626" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="referIpd" 
                        name="IPD" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  ไม่มีข้อมูลสำหรับช่วงเวลาที่เลือก
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 5 Diseases Tables Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          <div className="xl:col-span-1">
            <ReferRegionTable
              title="5 อันดับโรค ในจังหวัด"
              icon="📍"
              data={inProvinceQuery.data ?? []}
              isLoading={inProvinceQuery.isLoading}
            />
          </div>
          
          <div className="xl:col-span-1">
            <ReferRegionTable
              title="5 อันดับโรค นอกจังหวัด (ในเขตสุขภาพ)"
              icon="🗺️"
              data={inZoneQuery.data ?? []}
              isLoading={inZoneQuery.isLoading}
            />
          </div>

          <div className="xl:col-span-1">
            <ReferRegionTable
              title="5 อันดับโรค นอกเขตสุขภาพ"
              icon="🚗"
              data={outZoneQuery.data ?? []}
              isLoading={outZoneQuery.isLoading}
            />
          </div>
        </div>
        </>
      )}
    </div>
  )
}
