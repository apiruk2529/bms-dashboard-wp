import { useCallback, useMemo, useState } from 'react'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import { getWorkloadDaily } from '@/services/departmentAnalyticsService'
import { getFiscalYearRange } from '@/utils/dateUtils'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { WorkloadDailyItem } from '@/types'

// Generate a highly distinct color palette for different staff
const COLORS = [
  '#2563eb', // blue-600
  '#dc2626', // red-600
  '#16a34a', // green-600
  '#d97706', // amber-600
  '#9333ea', // purple-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#4f46e5', // indigo-600
  '#ea580c', // orange-600
  '#059669', // emerald-600
  '#65a30d', // lime-600
  '#0284c7', // sky-600
  '#7c3aed', // violet-600
  '#b91c1c', // red-700
  '#0d9488', // teal-600
]

export default function Workload() {
  const { connectionConfig, session } = useBmsSessionContext()
  const defaultRange = getFiscalYearRange()
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('all')

  const queryFn = useCallback(
    () =>
      getWorkloadDaily(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
      ),
    [connectionConfig, session, startDate, endDate],
  )

  const {
    data: rawData,
    error,
    isError,
    isLoading,
  } = useQuery<WorkloadDailyItem[]>({
    queryFn,
    enabled: connectionConfig !== null && session !== null,
  })

  // Filter raw data by day of week if selected
  const filteredData = useMemo(() => {
    if (!rawData) return []
    if (selectedDayOfWeek === 'all') return rawData

    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
    const targetDayIndex = days.indexOf(selectedDayOfWeek)

    return rawData.filter((r) => {
      const date = new Date(r.vstdate)
      return date.getDay() === targetDayIndex
    })
  }, [rawData, selectedDayOfWeek])

  // Transform raw data (staff, date, total) into wide format for Recharts
  // e.g. [ { date: '2026-03-01', Kiosk: 10, Admin: 5 }, ... ]
  const chartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { data: [], staffs: [] }

    const dateMap = new Map<string, Record<string, any>>()
    const staffSet = new Set<string>()

    filteredData.forEach(({ staff, vstdate, total }) => {
      staffSet.add(staff)
      if (!dateMap.has(vstdate)) {
        dateMap.set(vstdate, { vstdate })
      }
      const record = dateMap.get(vstdate)!
      record[staff] = (record[staff] ?? 0) + total
    })

    const sortedData = Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.vstdate).getTime() - new Date(b.vstdate).getTime()
    )

    return {
      data: sortedData,
      staffs: Array.from(staffSet),
    }
  }, [filteredData])

  // Compute summary table
  const summaryData = useMemo(() => {
    if (!filteredData) return []
    const summary = new Map<string, any>()
    filteredData.forEach(({ staff, total, shift1, shift2, shift3, vstdate }) => {
      if (!summary.has(staff)) {
        summary.set(staff, { staff, total: 0, shift1: 0, shift2: 0, shift3: 0, daysSet: new Set<string>() })
      }
      const item = summary.get(staff)!
      item.total += total
      item.shift1 += shift1
      item.shift2 += shift2
      item.shift3 += shift3
      item.daysSet.add(vstdate)
    })
    return Array.from(summary.values())
      .map(item => ({ ...item, workingDays: item.daysSet.size }))
      .sort((a, b) => b.total - a.total)
  }, [filteredData])

  // Compute shift chart data (grouped by user if all, or by date if specific user)
  const shiftChartData = useMemo(() => {
    if (!filteredData) return []

    if (selectedStaff === 'all') {
      const map = new Map<string, any>()
      filteredData.forEach(r => {
        if (!map.has(r.staff)) {
          map.set(r.staff, { name: r.staff, shift1: 0, shift2: 0, shift3: 0 })
        }
        const item = map.get(r.staff)!
        item.shift1 += r.shift1
        item.shift2 += r.shift2
        item.shift3 += r.shift3
      })
      return Array.from(map.values()).sort((a, b) => (b.shift1 + b.shift2 + b.shift3) - (a.shift1 + a.shift2 + a.shift3))
    } else {
      const map = new Map<string, any>()
      filteredData.filter(r => r.staff === selectedStaff).forEach(r => {
        if (!map.has(r.vstdate)) {
          map.set(r.vstdate, { name: r.vstdate, shift1: 0, shift2: 0, shift3: 0 })
        }
        const item = map.get(r.vstdate)!
        item.shift1 += r.shift1
        item.shift2 += r.shift2
        item.shift3 += r.shift3
      })
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [filteredData, selectedStaff])

  const monthlyChartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return { data: [], staffs: [] }

    const monthMap = new Map<string, Record<string, any>>()
    const staffSet = new Set<string>()

    filteredData.forEach(({ staff, vstdate, total }) => {
      // Extract YYYY-MM from YYYY-MM-DD
      const monthStr = vstdate.substring(0, 7)

      staffSet.add(staff)
      if (!monthMap.has(monthStr)) {
        monthMap.set(monthStr, { month: monthStr })
      }

      const record = monthMap.get(monthStr)!
      record[staff] = (record[staff] ?? 0) + total
    })

    const sortedData = Array.from(monthMap.values()).sort(
      (a, b) => a.month.localeCompare(b.month)
    )

    // Format displayMonth (e.g., "มี.ค. 69")
    const formatter = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' })
    sortedData.forEach(d => {
      try {
        const [yyyy, mm] = d.month.split('-')
        const date = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1)
        d.displayMonth = formatter.format(date)
      } catch (e) {
        d.displayMonth = d.month
      }
    })

    return {
      data: sortedData,
      staffs: Array.from(staffSet),
    }
  }, [filteredData])

  // Compute weekday chart data (Radar) - Always uses rawData so the radar doesn't collapse
  const weekdayChartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return []

    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
    const map = new Map<number, any>()
    for (let i = 0; i < 7; i++) {
      map.set(i, { dayIndex: i, day: days[i] })
    }

    // Filter by selectedStaff if not 'all', otherwise aggregate all
    const dataToProcess = selectedStaff === 'all'
      ? rawData
      : rawData.filter(r => r.staff === selectedStaff)

    dataToProcess.forEach(r => {
      const date = new Date(r.vstdate)
      const dayOfWeek = date.getDay() // 0-6

      const record = map.get(dayOfWeek)!
      record[r.staff] = (record[r.staff] ?? 0) + r.total
    })

    return Array.from(map.values()).sort((a, b) => a.dayIndex - b.dayIndex)
  }, [rawData, selectedStaff])

  const staffsToRender = useMemo(() => {
    if (selectedStaff === 'all') return chartData.staffs
    return chartData.staffs.filter((s) => s === selectedStaff)
  }, [chartData.staffs, selectedStaff])

  const summaryDataToRender = useMemo(() => {
    if (selectedStaff === 'all') return summaryData
    return summaryData.filter((r) => r.staff === selectedStaff)
  }, [summaryData, selectedStaff])

  const handleRangeChange = useCallback(
    (start: string, end: string) => {
      setStartDate(start)
      setEndDate(end)
    },
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ปริมาณงานเวชระเบียน</h1>
        <p className="text-sm text-muted-foreground">
          แสดงสถิติการส่งตรวจเวชระเบียนตามช่วงวันที่ แยกตามผู้ใช้งาน
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onRangeChange={handleRangeChange}
          isLoading={isLoading}
        />

        <div className="flex flex-col gap-1.5 w-full sm:w-64">
          <label className="text-xs font-medium text-muted-foreground px-1">กรองตามพนักงาน</label>
          <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            disabled={isLoading || chartData.staffs.length === 0}
          >
            <option value="all">ดูทั้งหมดทุกคน</option>
            {chartData.staffs.map((staff) => (
              <option key={staff} value={staff}>
                {staff}
              </option>
            ))}
          </select>
        </div>

        {selectedDayOfWeek !== 'all' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground px-1">วันในสัปดาห์</label>
            <button
              onClick={() => setSelectedDayOfWeek('all')}
              className="flex h-10 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            >
              กรอง: {selectedDayOfWeek} ✕
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              แนวโน้มการส่งตรวจรายเดือน (แยกตาม User)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : isError ? (
              <div className="flex h-[350px] items-center justify-center">
                <EmptyState
                  title="ไม่สามารถโหลดข้อมูลได้"
                  description={error?.message ?? 'กรุณาลองใหม่อีกครั้ง'}
                />
              </div>
            ) : monthlyChartData.data.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center">
                <EmptyState
                  title="ไม่พบข้อมูลปริมาณงาน"
                  description="ลองเลือกช่วงวันที่อื่นหรือรีเฟรชหน้าอีกครั้ง"
                />
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyChartData.data}
                    margin={{ top: 15, right: 24, left: 16, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="displayMonth"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: '10px', cursor: 'pointer' }}
                      onClick={(e) => {
                        if (e && e.dataKey) {
                          const clickedStaff = String(e.dataKey)
                          setSelectedStaff(clickedStaff === selectedStaff ? 'all' : clickedStaff)
                        }
                      }}
                    />
                    {staffsToRender.map((staff) => (
                      <Line
                        key={staff}
                        type="monotone"
                        dataKey={staff}
                        name={staff}
                        stroke={COLORS[chartData.staffs.indexOf(staff) % COLORS.length]}
                        strokeWidth={2}
                        activeDot={{
                          r: 6,
                          onClick: () => setSelectedStaff(staff === selectedStaff ? 'all' : staff),
                          className: 'cursor-pointer'
                        }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              แนวโน้มการส่งตรวจรายวัน (แยกตาม User)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[420px] w-full" />
            ) : isError ? (
              <div className="flex h-[420px] items-center justify-center">
                <EmptyState
                  title="ไม่สามารถโหลดข้อมูลได้"
                  description={error?.message ?? 'กรุณาลองใหม่อีกครั้ง'}
                />
              </div>
            ) : chartData.data.length === 0 ? (
              <div className="flex h-[420px] items-center justify-center">
                <EmptyState
                  title="ไม่พบข้อมูลปริมาณงาน"
                  description="ลองเลือกช่วงวันที่อื่นหรือรีเฟรชหน้าอีกครั้ง"
                />
              </div>
            ) : (
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.data}
                    margin={{ top: 15, right: 24, left: 16, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="vstdate"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: '10px', cursor: 'pointer' }}
                      onClick={(e) => {
                        if (e && e.dataKey) {
                          const clickedStaff = String(e.dataKey)
                          setSelectedStaff(clickedStaff === selectedStaff ? 'all' : clickedStaff)
                        }
                      }}
                    />
                    {staffsToRender.map((staff, index) => (
                      <Bar
                        key={staff}
                        dataKey={staff}
                        name={staff}
                        stackId="a"
                        fill={COLORS[chartData.staffs.indexOf(staff) % COLORS.length]}
                        radius={
                          index === staffsToRender.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                        }
                        onClick={() => setSelectedStaff(staff === selectedStaff ? 'all' : staff)}
                        cursor="pointer"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Radar Chart for Day of Week */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                การส่งตรวจแยกตามวันในสัปดาห์ (Radar)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[420px] w-full" />
              ) : isError ? (
                <div className="flex h-[420px] items-center justify-center">
                  <EmptyState
                    title="ไม่สามารถโหลดข้อมูลได้"
                    description={error?.message ?? 'กรุณาลองใหม่อีกครั้ง'}
                  />
                </div>
              ) : weekdayChartData.length === 0 ? (
                <div className="flex h-[420px] items-center justify-center">
                  <EmptyState
                    title="ไม่พบข้อมูลวันในสัปดาห์"
                    description="ลองเลือกช่วงวันที่อื่นหรือรีเฟรชหน้าอีกครั้ง"
                  />
                </div>
              ) : (
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="65%"
                      data={weekdayChartData}
                      onClick={(e) => {
                        if (e && e.activeLabel) {
                          const clickedDay = String(e.activeLabel)
                          setSelectedDayOfWeek(clickedDay === selectedDayOfWeek ? 'all' : clickedDay)
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <PolarGrid stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                      <PolarAngleAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))', cursor: 'pointer' }} />
                      <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12, paddingTop: '10px', cursor: 'pointer' }}
                        onClick={(e) => {
                          if (e && e.dataKey) {
                            const clickedStaff = String(e.dataKey)
                            setSelectedStaff(clickedStaff === selectedStaff ? 'all' : clickedStaff)
                          }
                        }}
                      />
                      {staffsToRender.map((staff) => (
                        <Radar
                          key={staff}
                          name={staff}
                          dataKey={staff}
                          stroke={COLORS[chartData.staffs.indexOf(staff) % COLORS.length]}
                          strokeWidth={2}
                          fill={COLORS[chartData.staffs.indexOf(staff) % COLORS.length]}
                          fillOpacity={staffsToRender.length > 3 ? 0.05 : 0.4}
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* New Shift Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                สัดส่วนการส่งตรวจแยกตามช่วงเวลา (Shift)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[420px] w-full" />
              ) : isError ? (
                <div className="flex h-[420px] items-center justify-center">
                  <EmptyState
                    title="ไม่สามารถโหลดข้อมูลได้"
                    description={error?.message ?? 'กรุณาลองใหม่อีกครั้ง'}
                  />
                </div>
              ) : shiftChartData.length === 0 ? (
                <div className="flex h-[420px] items-center justify-center">
                  <EmptyState
                    title="ไม่พบข้อมูลสัดส่วนเวลา"
                    description="ลองเลือกช่วงวันที่อื่นหรือรีเฟรชหน้าอีกครั้ง"
                  />
                </div>
              ) : (
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={shiftChartData}
                      margin={{ top: 15, right: 24, left: 16, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
                      <Bar
                        dataKey="shift1"
                        name="08:00 - 16:00"
                        stackId="time"
                        fill="#3b82f6"
                      />
                      <Bar
                        dataKey="shift2"
                        name="16:00 - 23:59"
                        stackId="time"
                        fill="#f59e0b"
                      />
                      <Bar
                        dataKey="shift3"
                        name="00:00 - 07:59"
                        stackId="time"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">ตารางสรุปจำนวนการส่งตรวจ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-16 text-xs uppercase tracking-wider text-muted-foreground">
                      ลำดับ
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                      User / พนักงาน
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                      จำนวนวัน
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                      08:00 - 16:00
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                      16:00 - 23:59
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                      00:00 - 07:59
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                      รวม (ครั้ง)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryDataToRender.length > 0 ? (
                    summaryDataToRender.map((row, index) => (
                      <TableRow
                        key={row.staff}
                        className="transition-colors hover:bg-muted/60 cursor-pointer"
                        onClick={() => setSelectedStaff(row.staff === selectedStaff ? 'all' : row.staff)}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{row.staff}</TableCell>
                        <TableCell className="text-right font-medium text-blue-600 dark:text-blue-400">{row.workingDays.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.shift1.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.shift2.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.shift3.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold">{row.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        ไม่มีข้อมูลสำหรับช่วงวันที่นี้
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
