import { useCallback, useMemo, useState } from 'react'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import {
  getTelemedicineSummary,
  getTelemedicineMonthlyTrend,
  getTelemedicineByPayerType,
  getTelemedicineByVisitType,
} from '@/services/telemedicineService'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts'
import { getFiscalYearRange } from '@/utils/dateUtils'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import {
  Activity, MonitorSmartphone, Target, AlertCircle, Users, TrendingUp, List
} from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('th-TH') }

const PIE_COLORS = ['#0ea5e9', '#3b82f6', '#4f46e5', '#4338ca', '#312e81', '#1e3a8a', '#172554']

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function TelemedicineDashboard() {
  const { connectionConfig, session } = useBmsSessionContext()
  const isConnected = connectionConfig !== null && session !== null
  const dbType = session?.databaseType ?? 'mysql'

  const defaultRange = useMemo(() => getFiscalYearRange(), [])
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)

  // Calculate Thai year label based on endDate year for visual badge
  const labelBE = useMemo(() => {
    if (!endDate) return ''
    const y = parseInt(endDate.split('-')[0])
    return `${y + 543}`
  }, [endDate])

  const handleRangeChange = useCallback((start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }, [])

  // Queries
  const summaryQ = useQuery({
    queryFn: useCallback(() => getTelemedicineSummary(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })
  const monthlyQ = useQuery({
    queryFn: useCallback(() => getTelemedicineMonthlyTrend(connectionConfig!, dbType, startDate, endDate), [connectionConfig, dbType, startDate, endDate]),
    enabled: isConnected,
  })
  const payerTypeQ = useQuery({
    queryFn: useCallback(() => getTelemedicineByPayerType(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })
  const visitTypeQ = useQuery({
    queryFn: useCallback(() => getTelemedicineByVisitType(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })

  const summary = summaryQ.data
  const isLoading = summaryQ.isLoading || monthlyQ.isLoading || payerTypeQ.isLoading || visitTypeQ.isLoading
  const isTargetMet = summary ? summary.telemedicineRate >= 30 : false;
  
  // คำนวณจำนวนที่ขาดเพื่อให้ถึงเป้าหมาย 30%
  const targetVisits = summary ? Math.ceil(summary.totalOpVisits * 0.3) : 0;
  const missingVisits = summary ? Math.max(0, targetVisits - summary.telemedicineVisits) : 0;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-indigo-950">
            <MonitorSmartphone className="h-7 w-7 text-indigo-700" />
            แดชบอร์ดแพทย์ทางไกล (Telemedicine)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            วิเคราะห์ข้อมูลอัตราการให้บริการแพทย์ทางไกล ปีงบประมาณ {labelBE}
            <span className="ml-2 text-xs opacity-60">({startDate} – {endDate})</span>
          </p>
        </div>
        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">
          <Activity className="mr-1 h-3 w-3" />
          ปีงบ {labelBE}
        </Badge>
      </div>

      {/* ── Date Range Picker ── */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onRangeChange={handleRangeChange}
        isLoading={isLoading}
      />

      {/* ── Not Connected ── */}
      {!isConnected && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">กรุณาเชื่อมต่อฐานข้อมูลก่อนดูข้อมูลแพทย์ทางไกล</span>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="py-12">
          <LoadingSpinner message="กำลังโหลดข้อมูล..." size="lg" />
        </div>
      )}

      {!isLoading && isConnected && (
        <>
          {/* ── KPI Summary Row ── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">แพทย์ทางไกล (A)</p>
                    <p className="mt-1 text-3xl font-bold text-sky-600">
                      {fmt(summary?.telemedicineVisits ?? 0)} <span className="text-sm font-normal text-muted-foreground">ครั้ง</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">export_code="5"</p>
                  </div>
                  <div className="rounded-full bg-sky-50 p-2">
                    <MonitorSmartphone className="h-5 w-5 text-sky-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">ผู้ป่วยนอกที่เกี่ยวข้อง (B)</p>
                    <p className="mt-1 text-3xl font-bold text-indigo-900">
                      {fmt(summary?.totalOpVisits ?? 0)} <span className="text-sm font-normal text-muted-foreground">ครั้ง</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">export_code in (2, 3, 5)</p>
                  </div>
                  <div className="rounded-full bg-indigo-100 p-2">
                    <Users className="h-5 w-5 text-indigo-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`relative overflow-hidden ${isTargetMet ? 'border-green-200 bg-green-50/50' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">อัตราการให้บริการ (A/B) × 100</p>
                    <p className={`mt-1 text-3xl font-bold ${isTargetMet ? 'text-green-600' : 'text-sky-600'}`}>
                      {(summary?.telemedicineRate ?? 0).toFixed(2)}%
                    </p>
                  </div>
                  <div className={`rounded-full p-2 ${isTargetMet ? 'bg-green-100' : 'bg-sky-50'}`}>
                    <Activity className={`h-5 w-5 ${isTargetMet ? 'text-green-600' : 'text-sky-600'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">เป้าหมาย (Goal)</p>
                    <p className="mt-1 text-3xl font-bold text-blue-800">30%</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-medium">
                      <span className={isTargetMet ? 'text-green-600' : 'text-amber-600'}>
                        {isTargetMet ? 'ผ่านเกณฑ์เป้าหมาย 🎉' : `ต่ำกว่าเป้าหมาย (ขาดอีก ${fmt(missingVisits)} ครั้ง)`}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-full bg-blue-50 p-2">
                    <Target className="h-5 w-5 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            {/* ── Monthly Trend ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-indigo-900">
                  <TrendingUp className="h-5 w-5 text-indigo-700" />
                  แนวโน้มการรับบริการแพทย์ทางไกลรายเดือน
                </CardTitle>
                <CardDescription>เปรียบเทียบจำนวนการให้บริการและผู้ป่วยนอกที่เกี่ยวข้อง</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyQ.data ?? []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        fmt(value as number),
                        name === 'telemedicineVisits' ? 'แพทย์ทางไกล (A)' : 'ผู้ป่วยนอกที่เกี่ยวข้อง (B)'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="telemedicineVisits" name="แพทย์ทางไกล (A)" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="totalOpVisits" name="ผู้ป่วยนอกที่เกี่ยวข้อง (B)" fill="#312e81" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* ── Payer Type Distribution ── */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-indigo-900">
                    <Users className="h-5 w-5 text-indigo-700" />
                    แยกผู้รับบริการตามสิทธิ์การรักษา (Top 10)
                  </CardTitle>
                  <CardDescription>สัดส่วนผู้รับบริการ Telemedicine แยกตามสิทธิ์</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                  <div className="h-64 w-64 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={(payerTypeQ.data ?? []).slice(0, 10)} dataKey="count" nameKey="pttypeName"
                          innerRadius={60} outerRadius={90} paddingAngle={2}>
                          {((payerTypeQ.data ?? []).slice(0, 10)).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: unknown) => `${fmt(v as number)} ครั้ง`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 overflow-auto max-h-64 pr-2">
                    {((payerTypeQ.data ?? []).slice(0, 10)).map((p, i) => (
                      <div key={p.pttypeName} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{p.pttypeName}</span>
                        </div>
                        <span className="font-semibold text-indigo-900 shrink-0">{fmt(p.count)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* ── Visit Type Distribution ── */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-indigo-900">
                    <List className="h-5 w-5 text-indigo-700" />
                    แยกตามประเภทการมา (Visit Type)
                  </CardTitle>
                  <CardDescription>สัดส่วนผู้รับบริการผู้ป่วยนอกทั้งหมดที่เกี่ยวข้อง</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                  <div className="h-64 w-64 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={(visitTypeQ.data ?? []).slice(0, 10)} dataKey="count" nameKey="visitTypeName"
                          innerRadius={60} outerRadius={90} paddingAngle={2}>
                          {((visitTypeQ.data ?? []).slice(0, 10)).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: unknown) => `${fmt(v as number)} ครั้ง`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 overflow-auto max-h-64 pr-2">
                    {((visitTypeQ.data ?? []).slice(0, 10)).map((v, i) => (
                      <div key={v.visitTypeName} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{v.visitTypeName}</span>
                        </div>
                        <span className="font-semibold text-indigo-900 shrink-0">{fmt(v.count)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
