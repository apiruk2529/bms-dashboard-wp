import { useCallback, useMemo, useState } from 'react'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import {
  getTtmFinancialSummary,
  getTtmMonthlyTrend,
  getTtmServiceTypeSummary,
  getTtmDoctorWorkload,
  getTtmPatientAgeGroups,
  getTtmRevenueByPayerType,
  getTtmDiagnosisDistribution,
  getTtmDailyTrend,
  getTtmTopHerbalDrugs,
} from '@/services/ttmService'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LineChart, Line, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts'
import { getFiscalYearRange } from '@/utils/dateUtils'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import {
  TrendingUp, Users, Activity, DollarSign, Stethoscope,
  FlaskConical, BarChart3, Calendar, AlertCircle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
const TTM_COLORS = {
  primary: '#059669',
  secondary: '#10b981',
  accent: '#34d399',
  warm: '#d97706',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  red: '#ef4444',
  orange: '#f97316',
}
const PIE_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#d97706', '#f59e0b', '#fbbf24']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n: number) { return n.toLocaleString('th-TH') }
function fmtB(n: number) { return `฿${n.toLocaleString('th-TH')}` }

type TabId = 'financial' | 'clinical' | 'operations'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  title, value, unit, icon: Icon, color, sub,
}: {
  title: string; value: string; unit?: string; icon: React.ElementType; color: string; sub?: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color }}>
              {value} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
            </p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-full p-2" style={{ background: `${color}20` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ThaiTraditionalMedicine() {
  const { connectionConfig, session } = useBmsSessionContext()
  const isConnected = connectionConfig !== null && session !== null
  const dbType = session?.databaseType ?? 'mysql'
  const [activeTab, setActiveTab] = useState<TabId>('financial')

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
  const financialQ = useQuery({
    queryFn: useCallback(() => getTtmFinancialSummary(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })
  const monthlyQ = useQuery({
    queryFn: useCallback(() => getTtmMonthlyTrend(connectionConfig!, dbType, startDate, endDate), [connectionConfig, dbType, startDate, endDate]),
    enabled: isConnected,
  })
  const serviceQ = useQuery({
    queryFn: useCallback(() => getTtmServiceTypeSummary(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })
  const doctorQ = useQuery({
    queryFn: useCallback(() => getTtmDoctorWorkload(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })
  const ageQ = useQuery({
    queryFn: useCallback(() => getTtmPatientAgeGroups(connectionConfig!, dbType, startDate, endDate), [connectionConfig, dbType, startDate, endDate]),
    enabled: isConnected,
  })
  const payerQ = useQuery({
    queryFn: useCallback(() => getTtmRevenueByPayerType(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })
  const diagQ = useQuery({
    queryFn: useCallback(() => getTtmDiagnosisDistribution(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })
  const herbalQ = useQuery({
    queryFn: useCallback(() => getTtmTopHerbalDrugs(connectionConfig!, startDate, endDate), [connectionConfig, startDate, endDate]),
    enabled: isConnected,
  })
  const dailyQ = useQuery({
    queryFn: useCallback(() => getTtmDailyTrend(connectionConfig!, dbType, startDate, endDate), [connectionConfig, dbType, startDate, endDate]),
    enabled: isConnected,
  })

  const fin = financialQ.data
  const isLoading = financialQ.isLoading || monthlyQ.isLoading

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'financial', label: 'การเงินและมูลค่า', icon: DollarSign },
    { id: 'clinical', label: 'คลินิกและการรักษา', icon: Stethoscope },
    { id: 'operations', label: 'ติดตามและเชิงรุก', icon: BarChart3 },
  ]

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FlaskConical className="h-7 w-7 text-emerald-600" />
            แดชบอร์ดแพทย์แผนไทย
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            วิเคราะห์ข้อมูลบริการแพทย์แผนไทย ปีงบประมาณ {labelBE}
            <span className="ml-2 text-xs opacity-60">({startDate} – {endDate})</span>
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
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
          <span className="text-sm">กรุณาเชื่อมต่อฐานข้อมูลก่อนดูข้อมูลแพทย์แผนไทย</span>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="py-12">
          <LoadingSpinner message="กำลังโหลดข้อมูลแพทย์แผนไทย..." size="lg" />
        </div>
      )}

      {!isLoading && isConnected && (
        <>
          {/* ── KPI Summary Row ── */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard title="รายได้รวม" value={fmtB(fin?.totalRevenue ?? 0)} icon={DollarSign} color={TTM_COLORS.primary} sub={`บริการ ${fmtB(fin?.totalServiceValue ?? 0)} | ยา ${fmtB(fin?.totalHerbalValue ?? 0)}`} />
            <KpiCard title="ครั้งบริการ" value={fmt(fin?.totalSessions ?? 0)} unit="ครั้ง" icon={Activity} color={TTM_COLORS.blue} />
            <KpiCard title="ผู้รับบริการ" value={fmt(fin?.uniquePatients ?? 0)} unit="ราย" icon={Users} color={TTM_COLORS.purple} />
            <KpiCard title="รายได้เฉลี่ย/ครั้ง" value={fmtB(fin?.avgRevenuePerSession ?? 0)} icon={TrendingUp} color={TTM_COLORS.warm} />
            <KpiCard title="มูลค่าบริการ" value={fmtB(fin?.totalServiceValue ?? 0)} icon={Stethoscope} color={TTM_COLORS.secondary} />
            <KpiCard title="แพทย์ที่ให้บริการ" value={fmt(doctorQ.data?.length ?? 0)} unit="คน" icon={Calendar} color={TTM_COLORS.red} />
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
            {tabs.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={
                    'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ' +
                    (activeTab === t.id
                      ? 'bg-white shadow text-emerald-700 border border-emerald-100'
                      : 'text-muted-foreground hover:text-foreground')
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* ================================================================ */}
          {/* TAB 1: Financial & Value Analysis                                */}
          {/* ================================================================ */}
          {activeTab === 'financial' && (
            <div className="flex flex-col gap-6">
              {/* Monthly Revenue + Sessions Trend */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                      แนวโน้มรายได้รายเดือน
                    </CardTitle>
                    <CardDescription>รายได้และจำนวนครั้งบริการรายเดือน</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={monthlyQ.data ?? []} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="svcGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={TTM_COLORS.primary} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={TTM_COLORS.primary} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="herbGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={TTM_COLORS.warm} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={TTM_COLORS.warm} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `฿${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v: unknown) => [`฿${(v as number).toLocaleString()}`]} />
                        <Legend />
                        <Area stackId="rev" type="monotone" dataKey="totalServiceRevenue" stroke={TTM_COLORS.primary} strokeWidth={2} fill="url(#svcGrad)" name="ค่าบริการ" />
                        <Area stackId="rev" type="monotone" dataKey="totalHerbalRevenue" stroke={TTM_COLORS.warm} strokeWidth={2} fill="url(#herbGrad)" name="ค่ายาสมุนไพร" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Payer type donut */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                      รายได้แยกตามสิทธิ์การรักษา
                    </CardTitle>
                    <CardDescription>สัดส่วนมูลค่าบริการแต่ละสิทธิ์</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4">
                    <div className="h-56 w-56 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={payerQ.data ?? []} dataKey="totalValue" nameKey="pttypeName"
                            innerRadius={55} outerRadius={80} paddingAngle={3}>
                            {(payerQ.data ?? []).map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: unknown) => `฿${(v as number).toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2 overflow-auto max-h-56">
                      {(payerQ.data ?? []).map((p, i) => (
                        <div key={p.pttype} className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="truncate">{p.pttypeName}</span>
                          </div>
                          <span className="font-medium shrink-0">{fmtB(p.totalValue)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Service Type Bar */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FlaskConical className="h-5 w-5 text-emerald-600" />
                    ประเภทบริการแพทย์แผนไทย (Top 10)
                  </CardTitle>
                  <CardDescription>จำนวนครั้งบริการและมูลค่าแยกตามประเภท</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={serviceQ.data ?? []} layout="vertical" margin={{ top: 5, right: 80, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="serviceName" type="category" width={300} tick={{ fontSize: 11 }} />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-white p-2 border rounded shadow-sm text-xs">
                                <p className="font-semibold mb-1">{data.serviceName}</p>
                                <p className="text-emerald-700">จำนวน: {fmt(data.sessionCount)} ครั้ง</p>
                                <p className="text-amber-600">มูลค่า: {fmtB(data.totalValue)}</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Legend />
                      <Bar dataKey="sessionCount" fill={TTM_COLORS.primary} name="จำนวนครั้ง" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Herbal Drug Top 10 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FlaskConical className="h-5 w-5 text-amber-600" />
                    ยาแพทย์แผนไทย Top 10 (ตาม opitemrece)
                  </CardTitle>
                  <CardDescription>ยาสมุนไพรที่ใช้มากที่สุดในผู้ป่วยแพทย์แผนไทย (มูลค่ารวม)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/60">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">#</th>
                          <th className="px-3 py-2 text-left font-semibold">ชื่อยา</th>
                          <th className="px-3 py-2 text-left font-semibold">รหัส</th>
                          <th className="px-3 py-2 text-right font-semibold">จำนวน</th>
                          <th className="px-3 py-2 text-right font-semibold">มูลค่า</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(herbalQ.data ?? []).map((d, i) => (
                          <tr key={d.icode} className="border-t hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2 font-medium">{d.drugName}</td>
                            <td className="px-3 py-2 text-muted-foreground">{d.icode}</td>
                            <td className="px-3 py-2 text-right">{fmt(d.totalQty)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-amber-700">{fmtB(d.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: Clinical Monitoring                                       */}
          {/* ================================================================ */}
          {activeTab === 'clinical' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Doctor Workload */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Stethoscope className="h-5 w-5 text-emerald-600" />
                      ภาระงานแพทย์แผนไทย (Top 10)
                    </CardTitle>
                    <CardDescription>จำนวนครั้งบริการของแต่ละแพทย์</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-72 overflow-auto">
                      {(doctorQ.data ?? []).slice(0, 10).map((doc, i) => {
                        const max = doctorQ.data?.[0]?.sessionCount ?? 1
                        const pct = Math.round((doc.sessionCount / max) * 100)
                        return (
                          <div key={doc.doctorCode} className="flex items-center gap-3">
                            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="truncate font-medium">{doc.doctorName}</span>
                                <span className="shrink-0 ml-2 text-muted-foreground">{fmt(doc.sessionCount)} ครั้ง</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: TTM_COLORS.primary }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Age Group Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-5 w-5 text-emerald-600" />
                      การกระจายกลุ่มอายุผู้รับบริการ
                    </CardTitle>
                    <CardDescription>จำนวนผู้รับบริการแยกตามช่วงอายุ</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={ageQ.data ?? []} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="ageGroup" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: unknown) => [fmt(v as number), 'ราย']} />
                        <Bar dataKey="count" name="จำนวน" radius={[4, 4, 0, 0]} barSize={36}>
                          {(ageQ.data ?? []).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Diagnosis Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    การกระจายการวินิจฉัยโรค (Top 15)
                  </CardTitle>
                  <CardDescription>กลุ่มโรคที่ผู้ป่วยแพทย์แผนไทยมารับบริการมากที่สุด</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {(diagQ.data ?? []).map((d, i) => {
                      const max = diagQ.data?.[0]?.count ?? 1
                      const pct = Math.round((d.count / max) * 100)
                      return (
                        <div key={d.icd10} className="flex items-center gap-2 rounded-lg border p-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-medium">{d.diagnosisName}</p>
                            <p className="text-xs text-muted-foreground">{d.icd10}</p>
                            <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold">{fmt(d.count)}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: Operations & Follow-up                                    */}
          {/* ================================================================ */}
          {activeTab === 'operations' && (
            <div className="flex flex-col gap-6">
              {/* Daily Session Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-5 w-5 text-emerald-600" />
                    แนวโน้มการให้บริการรายวัน
                  </CardTitle>
                  <CardDescription>จำนวนครั้งบริการและผู้รับบริการรายวัน</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={dailyQ.data ?? []} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: unknown, n: unknown) => [fmt(v as number), n === 'sessionCount' ? 'ครั้งบริการ' : 'ผู้รับบริการ']} />
                      <Legend />
                      <Line type="monotone" dataKey="sessionCount" stroke={TTM_COLORS.primary} strokeWidth={2} dot={false} name="ครั้งบริการ" />
                      <Line type="monotone" dataKey="uniquePatients" stroke={TTM_COLORS.blue} strokeWidth={2} dot={false} name="ผู้รับบริการ" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Monthly Sessions Bar */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-5 w-5 text-emerald-600" />
                      ปริมาณการให้บริการรายเดือน
                    </CardTitle>
                    <CardDescription>จำนวนครั้งบริการและผู้รับบริการแต่ละเดือน</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={monthlyQ.data ?? []} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="totalSessions" name="ครั้งบริการ" fill={TTM_COLORS.primary} radius={[3, 3, 0, 0]} barSize={18} />
                        <Bar dataKey="uniquePatients" name="ผู้รับบริการ" fill={TTM_COLORS.blue} radius={[3, 3, 0, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Doctor Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Stethoscope className="h-5 w-5 text-emerald-600" />
                      รายชื่อแพทย์แผนไทย
                    </CardTitle>
                    <CardDescription>ภาพรวมภาระงานของแพทย์แต่ละท่าน</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-64 rounded-lg border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/60">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">#</th>
                            <th className="px-3 py-2 text-left font-semibold">แพทย์</th>
                            <th className="px-3 py-2 text-right font-semibold">ครั้ง</th>
                            <th className="px-3 py-2 text-right font-semibold">ผู้ป่วย</th>
                            <th className="px-3 py-2 text-right font-semibold">มูลค่า</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(doctorQ.data ?? []).map((d, i) => (
                            <tr key={d.doctorCode} className="border-t hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-2 font-medium">{d.doctorName}</td>
                              <td className="px-3 py-2 text-right">{fmt(d.sessionCount)}</td>
                              <td className="px-3 py-2 text-right">{fmt(d.uniquePatients)}</td>
                              <td className="px-3 py-2 text-right text-emerald-700">{fmtB(d.totalValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
