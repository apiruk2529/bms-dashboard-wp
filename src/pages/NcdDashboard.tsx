import { useCallback, useMemo } from 'react'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import {
  getNcdRegistrationSummary,
  getNcdKpiControl,
  getNcdScreeningRates,
  getNcdPatientsByDiseaseHierarchy,
} from '@/services/ncdService'
import { NcdTreemap } from '@/components/charts/NcdTreemap'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar
} from 'recharts'
import { Users, Activity, Shield, Database } from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

function calculatePercent(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

// ---------------------------------------------------------------------------
// Dashboard Component
// ---------------------------------------------------------------------------
export default function NcdDashboard() {
  const { connectionConfig, session } = useBmsSessionContext()
  const isConnected = connectionConfig !== null && session !== null

  // คำนวณปีงบประมาณไทย (ต.ค. - ก.ย.) จากวันปัจจุบัน
  const fiscalYear = useMemo(() => {
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    const year = now.getFullYear()
    // ถ้าเดือน ≥ 10 (ต..ค.) ปีงบ = ปีปัจจุบัน+1
    const fy = month >= 10 ? year + 1 : year
    return {
      start: `${fy - 1}-10-01`,
      end: `${fy}-09-30`,
      labelBE: `${fy + 543}`, // ปี พ.ศ.
    }
  }, [])

  // Queries
  const registrationQuery = useQuery({
    queryFn: useCallback(
      () => getNcdRegistrationSummary(connectionConfig!),
      [connectionConfig]
    ),
    enabled: isConnected,
  });

  const kpiQuery = useQuery({
    queryFn: useCallback(
      () => getNcdKpiControl(connectionConfig!, fiscalYear.start, fiscalYear.end),
      [connectionConfig, fiscalYear]
    ),
    enabled: isConnected,
  });

  const screenQuery = useQuery({
    queryFn: useCallback(
      () => getNcdScreeningRates(connectionConfig!, fiscalYear.start, fiscalYear.end),
      [connectionConfig, fiscalYear]
    ),
    enabled: isConnected,
  });

  const treemapQuery = useQuery({
    queryFn: useCallback(
      () => getNcdPatientsByDiseaseHierarchy(connectionConfig!),
      [connectionConfig]
    ),
    enabled: isConnected,
  });

  // Prepare UI data
  const regData = registrationQuery.data;
  const kpiData = kpiQuery.data;
  const screenData = screenQuery.data;
  const treemapData = treemapQuery.data;

  // Donut chart logic
  const dmDonut = [
    { name: 'ควบคุมได้', value: kpiData?.dmWellControlled || 0 },
    { name: 'ควบคุมไม่ได้', value: (kpiData?.dmTotalTested || 0) - (kpiData?.dmWellControlled || 0) }
  ];

  const htDonut = [
    { name: 'ควบคุมได้', value: kpiData?.htWellControlled || 0 },
    { name: 'ควบคุมไม่ได้', value: (kpiData?.htTotalTested || 0) - (kpiData?.htWellControlled || 0) }
  ];

  const screenBarData = [
    { name: 'ตรวจตา', count: screenData?.eyeScreened || 0, total: screenData?.totalTarget || 0 },
    { name: 'ตรวจไต', count: screenData?.kidneyScreened || 0, total: screenData?.totalTarget || 0 },
    { name: 'ตรวจเท้า', count: screenData?.footScreened || 0, total: screenData?.totalTarget || 0 },
  ];

  const anyLoading = registrationQuery.isLoading || kpiQuery.isLoading || screenQuery.isLoading || treemapQuery.isLoading;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          NCDs Executive Summary
        </h1>
        <p className="text-sm text-muted-foreground">
          ระบบติดตามเป้าหมาย KPI ผู้ป่วยโรคเรื้อรังระดับผู้บริหาร (เบาหวานและความดันโลหิตสูง)
        </p>
      </div>

      {!isConnected && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-md border border-amber-200">
          กรุณาเชื่อมต่อฐานข้อมูลก่อนดูข้อมูล NCD
        </div>
      )}

      {anyLoading && (
        <div className="py-12">
          <LoadingSpinner message="กำลังวิเคราะห์ข้อมูลภาพรวมโรคเรื้อรัง..." size="lg" />
        </div>
      )}

      {!anyLoading && isConnected && (
        <>
          {/* Row 1: Registration Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-800 flex items-center justify-between">
                  <span>ผู้ป่วยเบาหวาน (DM)</span>
                  <Database className="h-4 w-4 opacity-50" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">
                  {regData?.dmCount?.toLocaleString() || 0} <span className="text-sm font-normal text-slate-500">ราย</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-indigo-800 flex items-center justify-between">
                  <span>ผู้ป่วยความดัน (HT)</span>
                  <Database className="h-4 w-4 opacity-50" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-900">
                  {regData?.htCount?.toLocaleString() || 0} <span className="text-sm font-normal text-slate-500">ราย</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-800 flex items-center justify-between">
                  <span>โรคร่วม (DM + HT)</span>
                  <Users className="h-4 w-4 opacity-50" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900">
                  {regData?.comorbidCount?.toLocaleString() || 0} <span className="text-sm font-normal text-slate-500">ราย</span>
                </div>
                <p className="text-xs text-purple-600 mt-1">ผู้ป่วยที่มีทั้งสองโรค</p>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: KPI & Screening */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* KPI Donut Charts */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  KPI ควบคุมโรคเรื้อรัง ปีงบ {fiscalYear.labelBE}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({fiscalYear.start} – {fiscalYear.end})
                  </span>
                </CardTitle>
                <CardDescription>
                  สัดส่วนผู้ป่วยที่ควบคุมระดับน้ำตาลและความดันได้ตามเกณฑ์
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col sm:flex-row justify-around items-center gap-4 min-h-[300px]">
                {/* DM Donut */}
                <div className="flex flex-col items-center">
                  <h3 className="text-sm font-semibold mb-2">HbA1c &lt; 7%</h3>
                  <div className="h-48 w-48 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dmDonut}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          <Cell fill={COLORS[0]} />
                          <Cell fill={COLORS[1]} />
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-green-600">
                        {calculatePercent(kpiData?.dmWellControlled || 0, kpiData?.dmTotalTested || 0)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    ({kpiData?.dmWellControlled?.toLocaleString()} / {kpiData?.dmTotalTested?.toLocaleString()} ราย)
                  </p>
                </div>

                {/* HT Donut */}
                <div className="flex flex-col items-center">
                  <h3 className="text-sm font-semibold mb-2">BP &lt; 140/90</h3>
                  <div className="h-48 w-48 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={htDonut}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          <Cell fill={COLORS[0]} />
                          <Cell fill={COLORS[1]} />
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-green-600">
                        {calculatePercent(kpiData?.htWellControlled || 0, kpiData?.htTotalTested || 0)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    ({kpiData?.htWellControlled?.toLocaleString()} / {kpiData?.htTotalTested?.toLocaleString()} ราย)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Screening Bar Chart */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  อัตราการคัดกรองภาวะแทรกซ้อน
                </CardTitle>
                <CardDescription>
                  จํานวนผู้ป่วยที่ได้รับการคัดกรอง เทียบกับเป้าหมายรวม {screenData?.totalTarget?.toLocaleString()} ราย
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <BarChart data={screenBarData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={70} />
                    <RechartsTooltip
                      formatter={(val: any) => `${Number(val).toLocaleString()} ราย`}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32}>
                      {
                        screenBarData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Treemap Distribution */}
          <div className="mt-8">
            <NcdTreemap 
              data={
                treemapData?.children && treemapData.children.length > 0
                  ? { name: '', value: 0, children: treemapData.children }
                  : { name: 'ไม่มีข้อมูล', value: 0 }
              }
              isLoading={treemapQuery.isLoading}
            />
          </div>

        </>
      )}
    </div>
  )
}
