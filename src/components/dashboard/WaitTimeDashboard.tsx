import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, ClipboardList, Stethoscope, UserCheck, UserPlus, Activity, FileText, Pill } from 'lucide-react'
import type { WaitTimeStats } from '@/types'

interface WaitTimeDashboardProps {
  data: WaitTimeStats | null | undefined
  isLoading: boolean
}

export function WaitTimeDashboard({ data, isLoading }: WaitTimeDashboardProps) {
  const stats = [
    {
      label: 'ห้องบัตร-รับยา',
      value: data?.opdCardToDispense,
      icon: <ClipboardList className="h-4 w-4" />,
      color: 'text-blue-500',
      description: 'Registration to Dispense',
    },
    {
      label: 'บัตร-ตรวจเสร็จ',
      value: data?.opdCardToDoctor,
      icon: <Stethoscope className="h-4 w-4" />,
      color: 'text-indigo-500',
      description: 'Registration to Doctor Finished',
    },
    {
      label: 'รอคอยพยาบาล',
      value: data?.waitingNurse,
      icon: <UserCheck className="h-4 w-4" />,
      color: 'text-emerald-500',
      description: 'Waiting for Nursing Staff',
    },
    {
      label: 'รอคอยแพทย์',
      value: data?.waitingDoctor,
      icon: <UserPlus className="h-4 w-4" />,
      color: 'text-amber-500',
      description: 'Waiting for Doctor',
    },
    {
      label: 'แพทย์ตรวจ',
      value: data?.doctorTime,
      icon: <Activity className="h-4 w-4" />,
      color: 'text-rose-500',
      description: 'Doctor Examination Time',
    },
    {
      label: 'เวลาซักประวัติ',
      value: data?.waitingScreen,
      icon: <FileText className="h-4 w-4" />,
      color: 'text-cyan-500',
      description: 'Screening/History Taking',
    },
    {
      label: 'รอคอยจ่ายยา',
      value: data?.waitingDispense,
      icon: <Pill className="h-4 w-4" />,
      color: 'text-purple-500',
      description: 'Waiting for Medication',
    },
  ]

  return (
    <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">ระยะเวลารอคอยเฉลี่ย (นาที)</CardTitle>
            <CardDescription>ข้อมูลประจำวันแยกตามจุดบริการต่างๆ</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="group relative flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all duration-300"
            >
              <div className={`mb-3 p-2.5 rounded-full bg-muted/50 ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                {stat.icon}
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 text-center line-clamp-1">
                {stat.label}
              </span>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black tracking-tighter">
                    {stat.value ? stat.value.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">min</span>
                </div>
              )}
              {/* Subtle background glow on hover */}
              <div className={`absolute inset-0 -z-10 bg-gradient-to-br from-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
