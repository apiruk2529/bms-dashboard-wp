// =============================================================================
// BMS Session KPI Dashboard - Visit Trends Page
// Diversified chart types for professional showcase
// =============================================================================

import { useState, useCallback, useMemo } from 'react'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import {
  getDailyVisitTrend,
  getHourlyDistribution,
  getMonthlyVisitSummary,
  getVisitsByDayOfWeek,
  getTopDepartmentsForRange,
  computeTrendSummary,
  getTopDiagnoses,
  getTopMedications,
  getMedicationCostSummary,
  getDeathSummary,
  getDiagnosisSummary,
} from '@/services/kpiService'
import type { VisitTrend, HourlyDistribution, DepartmentWorkload } from '@/types'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { HourlyChart } from '@/components/charts/HourlyChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { getDateRange } from '@/utils/dateUtils'
import {
  TrendingUp,
  BarChart3,
  ArrowUp,
  CalendarCheck,
  Pill,
  Banknote,
  Package,
  Stethoscope,
  HeartPulse,
  FileText,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

function formatDateLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'd MMM', { locale: th })
  } catch {
    return dateStr
  }
}

export default function Trends() {
  const { connectionConfig, session } = useBmsSessionContext()

  const defaultRange = useMemo(() => getDateRange(30), [])
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const isReady = connectionConfig !== null && session !== null

  // --- Existing Queries ---
  const { data: dailyData, isLoading: isDailyLoading, isError: isDailyError, error: dailyError, execute: refetchDaily } =
    useQuery<VisitTrend[]>({
      queryFn: useCallback(() => getDailyVisitTrend(connectionConfig!, session!.databaseType, startDate, endDate), [connectionConfig, session, startDate, endDate]),
      enabled: isReady,
    })

  const { data: hourlyData, isLoading: isHourlyLoading, execute: fetchHourly, reset: resetHourly } =
    useQuery<HourlyDistribution[]>({
      queryFn: useCallback(() => getHourlyDistribution(connectionConfig!, session!.databaseType, selectedDate!), [connectionConfig, session, selectedDate]),
      enabled: isReady && selectedDate !== null,
    })

  const { data: dowData, isLoading: isDowLoading } =
    useQuery<{ dayOfWeek: number; dayName: string; visitCount: number }[]>({
      queryFn: useCallback(() => getVisitsByDayOfWeek(connectionConfig!, session!.databaseType, startDate, endDate), [connectionConfig, session, startDate, endDate]),
      enabled: isReady,
    })

  const { data: topDeptsData, isLoading: isTopDeptsLoading } =
    useQuery<DepartmentWorkload[]>({
      queryFn: useCallback(() => getTopDepartmentsForRange(connectionConfig!, session!.databaseType, startDate, endDate), [connectionConfig, session, startDate, endDate]),
      enabled: isReady,
    })

  const { data: monthlyData, isLoading: isMonthlyLoading } =
    useQuery<{ month: string; visitCount: number }[]>({
      queryFn: useCallback(() => getMonthlyVisitSummary(connectionConfig!, session!.databaseType), [connectionConfig, session]),
      enabled: isReady,
    })

  // --- New Queries: Diagnosis, Medications, Death ---
  const { data: topDiagnosesData, isLoading: isDiagnosesLoading } =
    useQuery<{ icd10: string; diagnosisName: string; visitCount: number }[]>({
      queryFn: useCallback(() => getTopDiagnoses(connectionConfig!, session!.databaseType, startDate, endDate), [connectionConfig, session, startDate, endDate]),
      enabled: isReady,
    })

  const { data: topMedsData, isLoading: isMedsLoading } =
    useQuery<{ drugName: string; totalQty: number; totalCost: number }[]>({
      queryFn: useCallback(() => getTopMedications(connectionConfig!, session!.databaseType, startDate, endDate), [connectionConfig, session, startDate, endDate]),
      enabled: isReady,
    })

  const { data: medCostSummary, isLoading: isMedCostLoading } =
    useQuery<{ totalItems: number; totalCost: number; uniqueDrugs: number }>({
      queryFn: useCallback(() => getMedicationCostSummary(connectionConfig!, session!.databaseType, startDate, endDate), [connectionConfig, session, startDate, endDate]),
      enabled: isReady,
    })

  const { data: deathData, isLoading: isDeathLoading } =
    useQuery<{ totalDeaths: number; thisYearDeaths: number; thisMonthDeaths: number }>({
      queryFn: useCallback(() => getDeathSummary(connectionConfig!, session!.databaseType), [connectionConfig, session]),
      enabled: isReady,
    })

  const { data: diagSummary, isLoading: isDiagSummaryLoading } =
    useQuery<{ totalDiagnoses: number; uniqueCodes: number }>({
      queryFn: useCallback(() => getDiagnosisSummary(connectionConfig!, session!.databaseType, startDate, endDate), [connectionConfig, session, startDate, endDate]),
      enabled: isReady,
    })

  const trendSummary = useMemo(() => computeTrendSummary(dailyData ?? []), [dailyData])

  const handleRangeChange = useCallback((newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    setSelectedDate(null)
    resetHourly()
  }, [resetHourly])

  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(date)
    if (connectionConfig && session) fetchHourly()
  }, [connectionConfig, session, fetchHourly])

  const tooltipStyle = {
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    backgroundColor: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    fontSize: '12px',
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">แนวโน้มการเข้ารับบริการ</h1>
        <p className="text-sm text-muted-foreground">
          วิเคราะห์จำนวนการเข้ารับบริการรายวัน รายสัปดาห์ และรายเดือน พร้อมสรุปแผนกยอดนิยม การวินิจฉัย ค่ายา และสถิติการเสียชีวิต
        </p>
      </div>

      <DateRangePicker startDate={startDate} endDate={endDate} onRangeChange={handleRangeChange} isLoading={isDailyLoading} />

      {isDailyError && dailyError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{dailyError.message || 'ไม่สามารถโหลดข้อมูลแนวโน้มได้'}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={refetchDaily}>ลองอีกครั้ง</Button>
        </div>
      )}

      {/* 2. Summary Cards — expanded from 4 to 6 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'จำนวนการเข้ารับบริการทั้งหมด', value: trendSummary.totalVisits, icon: TrendingUp, color: 'blue', loading: isDailyLoading },
          { label: 'เฉลี่ยต่อวัน', value: trendSummary.avgDailyVisits, icon: BarChart3, color: 'green', loading: isDailyLoading },
          { label: 'วันที่มีผู้เข้ารับบริการมากที่สุด', value: trendSummary.peakDay?.count ?? 0, sub: trendSummary.peakDay?.date, icon: ArrowUp, color: 'amber', loading: isDailyLoading },
          { label: 'จำนวนวันที่มีบริการ', value: `${trendSummary.daysWithVisits} / ${trendSummary.totalDays}`, icon: CalendarCheck, color: 'purple', loading: isDailyLoading },
          { label: 'จำนวนการวินิจฉัย', value: diagSummary?.totalDiagnoses ?? 0, sub: `${diagSummary?.uniqueCodes ?? 0} รหัส ICD10`, icon: Stethoscope, color: 'teal', loading: isDiagSummaryLoading },
          { label: 'ค่ายาทั้งหมด', value: `฿${(medCostSummary?.totalCost ?? 0).toLocaleString()}`, icon: Banknote, color: 'orange', loading: isMedCostLoading },
        ].map((card) => (
          <Card key={card.label} className="card-shadow-hover p-4">
            <CardContent className="p-0 flex items-center gap-3">
              {card.loading ? <Skeleton className="h-16 w-full" /> : (
                <>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-${card.color}-100 text-${card.color}-600 dark:bg-${card.color}-900/30 dark:text-${card.color}-400`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                    <p className="text-xl font-bold">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
                    {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. Daily Trend — AREA CHART (gradient fill) */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-sm font-medium">แนวโน้มการเข้ารับบริการรายวัน</CardTitle>
          <CardDescription>คลิกที่จุดข้อมูลเพื่อดูรายละเอียดรายชั่วโมง</CardDescription>
        </CardHeader>
        <CardContent>
          {isDailyLoading ? <Skeleton className="h-[300px] w-full" /> :
           !dailyData || dailyData.length === 0 ? <EmptyState title="ไม่มีข้อมูลการเข้ารับบริการ" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData} onClick={(state: Record<string, unknown>) => {
                const payload = state?.activePayload as Array<{ payload: { date: string } }> | undefined
                if (payload?.[0]?.payload) handleDateClick(payload[0].payload.date)
              }}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  labelFormatter={((label: unknown) => formatDateLabel(String(label))) as never}
                  formatter={((value: unknown) => [Number(value).toLocaleString(), 'ครั้ง']) as never}
                  contentStyle={tooltipStyle}
                />
                <Area type="monotone" dataKey="visitCount" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#areaGradient)" dot={{ r: 4, fill: 'hsl(var(--chart-1))', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 4. Two-column: Radar (day-of-week) + Horizontal Bar (top depts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of week — RADAR CHART */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-medium">การเข้ารับบริการตามวันในสัปดาห์</CardTitle>
            <CardDescription>รูปแบบการกระจายตัวของผู้เข้ารับบริการแยกตามวัน</CardDescription>
          </CardHeader>
          <CardContent>
            {isDowLoading ? <Skeleton className="h-[280px] w-full" /> :
             !dowData || dowData.length === 0 ? <EmptyState title="ไม่มีข้อมูลแยกตามวัน" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={dowData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid strokeDasharray="3 3" className="stroke-muted" />
                  <PolarAngleAxis dataKey="dayName" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={((value: unknown) => [Number(value).toLocaleString(), 'ครั้ง']) as never}
                    contentStyle={tooltipStyle}
                  />
                  <Radar dataKey="visitCount" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.25} strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--chart-2))' }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top departments — HORIZONTAL BAR */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-sm font-medium">แผนกยอดนิยม</CardTitle>
            <CardDescription>5 แผนกที่มีผู้เข้ารับบริการมากที่สุดในช่วงเวลาที่เลือก</CardDescription>
          </CardHeader>
          <CardContent>
            {isTopDeptsLoading ? <Skeleton className="h-[250px] w-full" /> :
             !topDeptsData || topDeptsData.length === 0 ? <EmptyState title="ไม่มีข้อมูลแผนก" /> : (
              <ResponsiveContainer width="100%" height={Math.max(200, topDeptsData.length * 50)}>
                <BarChart data={topDeptsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="departmentName" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={140} />
                  <Tooltip
                    formatter={((value: unknown) => [Number(value).toLocaleString(), 'ครั้ง']) as never}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="visitCount" fill="hsl(var(--chart-4))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 7. กลุ่มโรคที่พบบ่อย — Top Diagnoses Horizontal Bar */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            กลุ่มโรคที่พบบ่อย
          </CardTitle>
          <CardDescription>10 กลุ่มโรค (ICD10) ที่มีการวินิจฉัยมากที่สุดในช่วงเวลาที่เลือก</CardDescription>
        </CardHeader>
        <CardContent>
          {isDiagnosesLoading ? <Skeleton className="h-[400px] w-full" /> :
           !topDiagnosesData || topDiagnosesData.length === 0 ? <EmptyState title="ไม่มีข้อมูลการวินิจฉัย" /> : (
            <ResponsiveContainer width="100%" height={Math.max(300, topDiagnosesData.length * 45)}>
              <BarChart data={topDiagnosesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  dataKey="diagnosisName"
                  type="category"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={200}
                  tickFormatter={(value: string) => value.length > 30 ? `${value.slice(0, 30)}...` : value}
                />
                <Tooltip
                  formatter={((value: unknown) => [Number(value).toLocaleString(), 'ครั้ง']) as never}
                  labelFormatter={(label: unknown) => String(label)}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="visitCount" fill="hsl(var(--chart-1))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 8. ค่าใช้จ่ายยาและเวชภัณฑ์ — Medication Costs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 3 mini stat cards */}
        <div className="flex flex-col gap-4">
          {[
            {
              label: 'จำนวนรายการยา',
              value: (medCostSummary?.totalItems ?? 0).toLocaleString(),
              icon: Pill,
              color: 'blue',
            },
            {
              label: 'ค่ายาทั้งหมด',
              value: `฿${(medCostSummary?.totalCost ?? 0).toLocaleString()} บาท`,
              icon: Banknote,
              color: 'orange',
            },
            {
              label: 'ชนิดยาที่ใช้',
              value: (medCostSummary?.uniqueDrugs ?? 0).toLocaleString(),
              icon: Package,
              color: 'purple',
            },
          ].map((stat) => (
            <Card key={stat.label} className="card-shadow-hover p-4">
              <CardContent className="p-0 flex items-center gap-3">
                {isMedCostLoading ? <Skeleton className="h-14 w-full" /> : (
                  <>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-${stat.color}-100 text-${stat.color}-600 dark:bg-${stat.color}-900/30 dark:text-${stat.color}-400`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                      <p className="text-lg font-bold">{stat.value}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: Top 10 medications by cost — Horizontal Bar */}
        <Card className="card-shadow lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Pill className="h-4 w-4" />
              ยาที่มีค่าใช้จ่ายสูงสุด
            </CardTitle>
            <CardDescription>10 รายการยาที่มีมูลค่าการใช้สูงสุดในช่วงเวลาที่เลือก</CardDescription>
          </CardHeader>
          <CardContent>
            {isMedsLoading ? <Skeleton className="h-[350px] w-full" /> :
             !topMedsData || topMedsData.length === 0 ? <EmptyState title="ไม่มีข้อมูลค่ายา" /> : (
              <ResponsiveContainer width="100%" height={Math.max(300, topMedsData.length * 40)}>
                <BarChart data={topMedsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(value: number) => value.toLocaleString()}
                  />
                  <YAxis
                    dataKey="drugName"
                    type="category"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={180}
                    tickFormatter={(value: string) => value.length > 25 ? `${value.slice(0, 25)}...` : value}
                  />
                  <Tooltip
                    formatter={((value: unknown, name: unknown) => {
                      if (String(name) === 'totalCost') return [`${Number(value).toLocaleString()} บาท`, 'ค่าใช้จ่าย']
                      return [Number(value).toLocaleString(), String(name)]
                    }) as never}
                    labelFormatter={(label: unknown) => String(label)}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="totalCost" fill="hsl(var(--chart-3))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Hourly drill-down */}
      {selectedDate && (
        <Card className="card-shadow border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">การกระจายรายชั่วโมงสำหรับ {selectedDate}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { setSelectedDate(null); resetHourly() }}>ล้างการเลือก</Button>
            </div>
          </CardHeader>
          <CardContent>
            <HourlyChart data={hourlyData ?? []} isLoading={isHourlyLoading} selectedDate={selectedDate} />
          </CardContent>
        </Card>
      )}

      {/* 6. Monthly summary — LINE CHART */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-sm font-medium">สรุปการเข้ารับบริการรายเดือน</CardTitle>
          <CardDescription>6 เดือนย้อนหลัง</CardDescription>
        </CardHeader>
        <CardContent>
          {isMonthlyLoading ? <Skeleton className="h-[220px] w-full" /> :
           !monthlyData || monthlyData.length === 0 ? <EmptyState title="ไม่มีข้อมูลรายเดือน" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={((value: unknown) => [Number(value).toLocaleString(), 'ครั้ง']) as never}
                  contentStyle={tooltipStyle}
                />
                <Line type="monotone" dataKey="visitCount" stroke="hsl(var(--chart-5))" strokeWidth={2.5} dot={{ r: 5, fill: 'hsl(var(--chart-5))', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 9. สถิติการเสียชีวิต — Death Statistics */}
      <Card className="card-shadow bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
            สถิติการเสียชีวิต
          </CardTitle>
          <CardDescription>ข้อมูลสรุปจำนวนผู้เสียชีวิตจากฐานข้อมูล</CardDescription>
        </CardHeader>
        <CardContent>
          {isDeathLoading ? <Skeleton className="h-20 w-full" /> : (
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: 'จำนวนทั้งหมด', value: deathData?.totalDeaths ?? 0 },
                { label: 'ปีนี้', value: deathData?.thisYearDeaths ?? 0 },
                { label: 'เดือนนี้', value: deathData?.thisMonthDeaths ?? 0 },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-2xl font-bold text-muted-foreground">{item.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
