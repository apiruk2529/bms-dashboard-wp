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
  getReferOutZoneDetail,
} from '@/services/kpiService'
import type {
  ReferRegionDisease,
  HospitalRegionInfo,
  ReferSummaryCounts,
  ReferTrendData,
  ReferOutZoneDetail,
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
import { Activity, MapPin, Ambulance, ExternalLink, X } from 'lucide-react'

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
// Refer Out-of-zone Rank Table Component
// ---------------------------------------------------------------------------

function ReferOutZoneRankTable({
  data,
  isLoading,
  onSelectHosp,
}: {
  data: any[]
  isLoading: boolean
  onSelectHosp: (hosp: any) => void
}) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          <span>Refer นอกเขตสุขภาพ แยกหน่วยบริการและกลุ่มโรค (เรียงตามจำนวนครั้งส่งต่อ)</span>
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
                  <th className="px-4 py-3 min-w-[180px]">หน่วยสถานบริการ</th>
                  <th className="px-4 py-3 text-center">จำนวนกลุ่มโรค</th>
                  <th className="px-4 py-3 text-right">จำนวนครั้งรวม</th>
                  <th className="px-4 py-3">รายละเอียดกลุ่มโรค (5 อันดับแรก)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((hosp, i) => (
                  <tr
                    key={`${hosp.hospcode}-${i}`}
                    className="border-b transition-colors hover:bg-muted/30 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onSelectHosp(hosp)}
                        className="text-left font-semibold text-blue-700 hover:text-blue-900 hover:underline transition-all flex items-center gap-1 group"
                      >
                        <span>{hosp.hospname}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-orange-200">
                        {hosp.diseaseCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">
                      {hosp.totalCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {hosp.diseases.slice(0, 5).map((d: any, idx: number) => (
                          <span
                            key={idx}
                            title={d.icd10name}
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] border border-slate-200"
                          >
                            <span className="font-mono font-bold text-slate-500">{d.pdx}</span>
                            <span className="bg-white/50 px-1 rounded font-medium">{d.count}</span>
                          </span>
                        ))}
                        {hosp.diseases.length > 5 && (
                          <span className="text-[10px] text-muted-foreground self-center italic">
                            ... อีก {hosp.diseases.length - 5} รายการ
                          </span>
                        )}
                      </div>
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
// Drill-down Modal Component
// ---------------------------------------------------------------------------

function DrillDownModal({
  hospname,
  diseases,
  onClose,
}: {
  hospname: string
  diseases: any[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border-none">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 py-4">
          <div>
            <CardTitle className="text-xl font-bold text-blue-700">
              {hospname}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">รายละเอียดกลุ่มโรคที่ส่งต่อ (รวมทั้งหมด)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
            title="ปิด"
          >
            <X className="h-6 w-6 text-muted-foreground" />
          </button>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background/95 backdrop-blur-sm shadow-sm z-10">
              <tr className="text-left text-xs font-semibold uppercase text-muted-foreground border-b">
                <th className="px-6 py-4 w-24">ICD10</th>
                <th className="px-6 py-4">ชื่อโรค</th>
                <th className="px-6 py-4 text-right">จำนวนครั้ง</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {diseases.map((d, i) => (
                <tr key={`${d.pdx}-${i}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3.5 font-mono font-bold text-slate-500">{d.pdx}</td>
                  <td className="px-6 py-3.5 font-medium">{d.icd10name || '-'}</td>
                  <td className="px-6 py-3.5 text-right font-bold text-orange-600">
                    {d.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
        <div className="p-4 border-t bg-muted/5 flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <span className="text-sm font-semibold text-slate-600">
              รวมทั้งหมด: {diseases.reduce((acc, d) => acc + d.count, 0).toLocaleString()} ครั้ง
            </span>
            <span className="text-xs text-muted-foreground">
              ({diseases.length} กลุ่มโรค)
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </Card>
    </div>
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

  // Drill-down State
  const [selectedHosp, setSelectedHosp] = useState<{
    hospname: string
    diseases: ReferOutZoneDetail[]
  } | null>(null)

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

  // 6. Refer Out Zone Detail
  const outZoneDetailQueryFn = useCallback(
    () =>
      getReferOutZoneDetail(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        hospitalInfo!.zone_code,
        patientType
      ),
    [connectionConfig, session, startDate, endDate, hospitalInfo, patientType]
  )
  const outZoneDetailQuery = useQuery<ReferOutZoneDetail[]>({
    queryFn: outZoneDetailQueryFn,
    enabled: canFetchData,
  })

  // Transform Out Zone Detail for Ranking
  const rankedOutZoneData = useMemo(() => {
    if (!outZoneDetailQuery.data) return []
    
    // Group by hospital
    const hospGroups: Record<string, { hospcode: string, hospname: string, diseases: ReferOutZoneDetail[], totalCount: number }> = {}
    
    outZoneDetailQuery.data.forEach(item => {
      if (!hospGroups[item.hospcode]) {
        hospGroups[item.hospcode] = { 
          hospcode: item.hospcode,
          hospname: item.hospname, 
          diseases: [], 
          totalCount: 0 
        }
      }
      hospGroups[item.hospcode].diseases.push(item)
      hospGroups[item.hospcode].totalCount += item.count
    })
    
    // Convert to array and calculate unique diseaseCount
    const result = Object.values(hospGroups).map(group => ({
      ...group,
      diseaseCount: group.diseases.length
    }))
    
    // Sort by totalCount DESC, then by diseaseCount DESC
    return result.sort((a, b) => b.totalCount - a.totalCount || b.diseaseCount - a.diseaseCount)
  }, [outZoneDetailQuery.data])

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
    trendQuery.isLoading ||
    outZoneDetailQuery.isLoading

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

        {/* Refer Out-of-zone Rankings (Detailed) */}
        <div className="grid grid-cols-1 gap-6">
          <ReferOutZoneRankTable 
            data={rankedOutZoneData}
            isLoading={outZoneDetailQuery.isLoading}
            onSelectHosp={setSelectedHosp}
          />
        </div>

        {/* Drill-down Modal */}
        {selectedHosp && (
          <DrillDownModal
            hospname={selectedHosp.hospname}
            diseases={selectedHosp.diseases}
            onClose={() => setSelectedHosp(null)}
          />
        )}
        </>
      )}
    </div>
  )
}
