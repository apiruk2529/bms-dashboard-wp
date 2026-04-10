import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { PatientAddressDistribution } from '@/services/ncdService'

interface GeographicMapChartProps {
  data: PatientAddressDistribution[]
  isLoading?: boolean
}

export function GeographicMapChart({ data, isLoading }: GeographicMapChartProps) {
  // Get top 20 for better readability
  const topData = data.slice(0, 20)
  
  // Color gradient based on count values
  const getColor = (count: number, maxCount: number) => {
    const ratio = count / maxCount
    if (ratio > 0.7) return '#dc2626' // red
    if (ratio > 0.5) return '#f97316' // orange
    if (ratio > 0.3) return '#eab308' // yellow
    return '#22c55e' // green
  }

  if (isLoading) {
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">กำลังโหลดข้อมูล...</CardTitle>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center text-muted-foreground">
          กำลังดึงข้อมูลการกระจายตัวของผู้ป่วยตามพื้นที่...
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">ไม่พบข้อมูล</CardTitle>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center text-muted-foreground">
          ไม่มีข้อมูลการกระจายตัวของผู้ป่วยตามพื้นที่
        </CardContent>
      </Card>
    )
  }

  const maxCount = Math.max(...topData.map(d => d.count))
  const totalPatients = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">
              จำนวนพื้นที่
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">
              {data.length}
            </div>
            <p className="text-xs text-blue-600 mt-1">พื้นที่ที่มีผู้ป่วย</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800">
              ผู้ป่วยทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              {totalPatients.toLocaleString()}
            </div>
            <p className="text-xs text-green-600 mt-1">ราย</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">
              ความหนาแน่นเฉลี่ย
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">
              {Math.round(totalPatients / data.length)}
            </div>
            <p className="text-xs text-purple-600 mt-1">ราย/พื้นที่</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart - Distribution by Address */}
      <Card className="flex flex-col mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            การกระจายตัวของผู้ป่วยตามพื้นที่ (ต้น 20)
          </CardTitle>
          <CardDescription>
            จำนวนผู้ป่วยเบาหวาน/ความดันสูงแยกตามพื้นที่ | สีแดง = มากที่สุด, เขียว = น้อย
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={500} minWidth={0}>
            <BarChart
              data={topData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 300, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis 
                dataKey="address" 
                type="category" 
                width={290}
                tick={{ fontSize: 11 }}
              />
              <Tooltip 
                formatter={(val: any) => `${Number(val).toLocaleString()} ราย`}
                contentStyle={{ 
                  backgroundColor: '#f8f9fa', 
                  border: '1px solid #dee2e6',
                  borderRadius: '4px'
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {topData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getColor(entry.count, maxCount)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table - Detailed View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            รายละเอียดทั้งหมด ({data.length} พื้นที่)
          </CardTitle>
          <CardDescription>
            ข้อมูลการกระจายตัวของผู้ป่วยตามพื้นที่ทั้งหมด เรียงลำดับจากมากไปน้อย
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 px-3 font-semibold">ลำดับที่</th>
                  <th className="text-left py-2 px-3 font-semibold">พื้นที่</th>
                  <th className="text-right py-2 px-3 font-semibold">จำนวนผู้ป่วย</th>
                  <th className="text-right py-2 px-3 font-semibold">สัดส่วน (%)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => {
                  const percentage = ((item.count / totalPatients) * 100).toFixed(1)
                  return (
                    <tr 
                      key={idx} 
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium">{item.address}</td>
                      <td className="text-right py-2 px-3">
                        <span className="font-semibold text-foreground">
                          {item.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="text-right py-2 px-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-red-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-muted-foreground">
                            {percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
