// =============================================================================
// BMS Session KPI Dashboard - Overview Page (Rich Command Center)
// =============================================================================

import { useState, useCallback, useMemo } from 'react'
import {
  RefreshCw,
  Database,
  Clock,
  Shield,
  Server,
  Globe,
  User,
  Building,
  CalendarDays,
  Users,
  CalendarCheck,
  CalendarMinus,
  BarChart3,
  Stethoscope,
  Building2,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCardGrid } from '@/components/dashboard/KpiCardGrid'
import { DepartmentTable } from '@/components/dashboard/DepartmentTable'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import {
  getOverviewStats,
  getWeeklyMiniTrend,
  getTopDoctorsThisMonth,
  getRecentVisits,
} from '@/services/kpiService'
import { formatDate, formatDateTime } from '@/utils/dateUtils'
import { cn } from '@/lib/utils'

function formatExpiryDays(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) {
    return `${days}d ${hours}h`
  }
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function truncateUrl(url: string, maxLength = 40): string {
  if (url.length <= maxLength) return url
  return url.substring(0, maxLength) + '...'
}

/** Format vsttime (e.g. "14:30:00" or "143000") into "HH:MM" */
function formatVisitTime(raw: string): string {
  if (!raw) return '--:--'
  // Handle "HH:MM:SS" format
  if (raw.includes(':')) {
    return raw.substring(0, 5)
  }
  // Handle numeric "HHMMSS" format
  const padded = raw.padStart(6, '0')
  return `${padded.substring(0, 2)}:${padded.substring(2, 4)}`
}

export default function Overview() {
  const { session, connectionConfig, refreshSession } = useBmsSessionContext()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshSession()
      setLastUpdated(new Date())
    } finally {
      // Small delay so the user sees the spinner
      setTimeout(() => setIsRefreshing(false), 600)
    }
  }, [refreshSession])

  const today = formatDate(new Date())
  const isConnected = connectionConfig !== null && session !== null

  // ---------------------------------------------------------------------------
  // Data queries
  // ---------------------------------------------------------------------------

  const overviewStatsFn = useCallback(
    () => getOverviewStats(connectionConfig!, session!.databaseType),
    [connectionConfig, session],
  )
  const {
    data: overviewStats,
    isLoading: isStatsLoading,
  } = useQuery<Awaited<ReturnType<typeof getOverviewStats>>>({
    queryFn: overviewStatsFn,
    enabled: isConnected,
  })

  const weeklyTrendFn = useCallback(
    () => getWeeklyMiniTrend(connectionConfig!, session!.databaseType),
    [connectionConfig, session],
  )
  const {
    data: weeklyTrend,
    isLoading: isTrendLoading,
  } = useQuery<Awaited<ReturnType<typeof getWeeklyMiniTrend>>>({
    queryFn: weeklyTrendFn,
    enabled: isConnected,
  })

  const topDoctorsFn = useCallback(
    () => getTopDoctorsThisMonth(connectionConfig!, session!.databaseType),
    [connectionConfig, session],
  )
  const {
    data: topDoctors,
    isLoading: isDoctorsLoading,
  } = useQuery<Awaited<ReturnType<typeof getTopDoctorsThisMonth>>>({
    queryFn: topDoctorsFn,
    enabled: isConnected,
  })

  const recentVisitsFn = useCallback(
    () => getRecentVisits(connectionConfig!, session!.databaseType),
    [connectionConfig, session],
  )
  const {
    data: recentVisits,
    isLoading: isVisitsLoading,
  } = useQuery<Awaited<ReturnType<typeof getRecentVisits>>>({
    queryFn: recentVisitsFn,
    enabled: isConnected,
  })

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const weeklyTotal = useMemo(
    () => weeklyTrend?.reduce((sum, d) => sum + d.visitCount, 0) ?? 0,
    [weeklyTrend],
  )

  // ---------------------------------------------------------------------------
  // Mini stat card definitions
  // ---------------------------------------------------------------------------
  const miniStats = useMemo(
    () => [
      {
        label: 'Total Patients',
        value: overviewStats?.totalRegisteredPatients,
        icon: <Users className="h-4 w-4" />,
      },
      {
        label: 'Visits This Month',
        value: overviewStats?.totalVisitsThisMonth,
        icon: <CalendarCheck className="h-4 w-4" />,
      },
      {
        label: 'Visits Last Month',
        value: overviewStats?.totalVisitsLastMonth,
        icon: <CalendarMinus className="h-4 w-4" />,
      },
      {
        label: 'Avg Daily Visits',
        value: overviewStats?.avgDailyVisitsThisMonth,
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        label: 'Active Doctors',
        value: overviewStats?.totalDoctors,
        icon: <Stethoscope className="h-4 w-4" />,
      },
      {
        label: 'Total Departments',
        value: overviewStats?.totalDepartments,
        icon: <Building2 className="h-4 w-4" />,
      },
    ],
    [overviewStats],
  )

  // ---------------------------------------------------------------------------
  // Session info rows helper
  // ---------------------------------------------------------------------------
  const sessionInfoRows: Array<{
    icon: React.ReactNode
    label: string
    value: string | React.ReactNode
  }> = session
    ? [
        {
          icon: <Database className="h-4 w-4" />,
          label: 'Database Type',
          value: (
            <Badge variant="secondary" className="font-mono text-xs">
              {session.databaseType.toUpperCase()}
            </Badge>
          ),
        },
        {
          icon: <Server className="h-4 w-4" />,
          label: 'Database Name',
          value: session.databaseName || 'N/A',
        },
        {
          icon: <Clock className="h-4 w-4" />,
          label: 'Session Expiry',
          value: `Expires in ${formatExpiryDays(session.expirySeconds)}`,
        },
        {
          icon: <User className="h-4 w-4" />,
          label: 'User / Role',
          value: `${session.userInfo.name} (${session.userInfo.position})`,
        },
        {
          icon: <Building className="h-4 w-4" />,
          label: 'Hospital Code',
          value: (
            <span className="font-mono text-sm">
              {session.userInfo.hospitalCode || 'N/A'}
            </span>
          ),
        },
        {
          icon: <Shield className="h-4 w-4" />,
          label: 'System Version',
          value: session.systemInfo.version || 'N/A',
        },
        {
          icon: <Globe className="h-4 w-4" />,
          label: 'Environment',
          value: (
            <Badge
              variant={
                session.systemInfo.environment?.toLowerCase() === 'production'
                  ? 'default'
                  : 'secondary'
              }
              className="text-xs"
            >
              {session.systemInfo.environment || 'Unknown'}
            </Badge>
          ),
        },
      ]
    : []

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------------------- */}
      {/* 1. Welcome Banner                                                    */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard Overview
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {today}
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Last updated {formatDateTime(lastUpdated)}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 gap-1.5 sm:mt-0"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
          />
          Refresh
        </Button>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. KPI Card Grid                                                     */}
      {/* ------------------------------------------------------------------- */}
      <KpiCardGrid />

      {/* ------------------------------------------------------------------- */}
      {/* 3. Stats Row - 6 mini stat cards                                     */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {miniStats.map((stat) => (
          <Card key={stat.label} className="p-3">
            <CardContent className="flex flex-col items-start gap-1.5 p-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {stat.icon}
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {isStatsLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-lg font-bold">
                  {stat.value?.toLocaleString() ?? '0'}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4. Weekly Trend + Top Doctors                                        */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Weekly Visit Trend (3/5 width) */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">This Week's Visits</CardTitle>
            <CardDescription>
              {isTrendLoading
                ? 'Loading trend data...'
                : `${weeklyTotal.toLocaleString()} total visits in the last 7 days`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isTrendLoading ? (
              <div className="flex h-[200px] items-center justify-center">
                <Skeleton className="h-[180px] w-full" />
              </div>
            ) : weeklyTrend && weeklyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyTrend}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val: string) => {
                      // Show just day part (e.g. "Mar 15")
                      const parts = val.split('-')
                      if (parts.length === 3) {
                        const d = new Date(val)
                        return d.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      return val
                    }}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={((value: unknown) => [Number(value).toLocaleString(), 'Visits']) as never}
                    labelFormatter={((label: unknown) => `Date: ${String(label)}`) as never}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="visitCount"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No visit data for the last 7 days
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Top Doctors This Month (2/5 width) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Top Doctors This Month</CardTitle>
            <CardDescription>Ranked by patient count</CardDescription>
          </CardHeader>
          <CardContent>
            {isDoctorsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="ml-auto h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : topDoctors && topDoctors.length > 0 ? (
              <div className="space-y-3">
                {topDoctors.map((doc, index) => (
                  <div
                    key={doc.doctorCode}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {index + 1}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {doc.doctorName}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                      {doc.patientCount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No doctor activity this month
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 5. Department Workload + Recent Visits                               */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Department Workload (2/3 width) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Department Workload</CardTitle>
            <CardDescription>
              Today's visit distribution by department
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentTable />
          </CardContent>
        </Card>

        {/* Right: Recent Visits (1/3 width) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Visits</CardTitle>
            <CardDescription>Last 10 recorded visits</CardDescription>
          </CardHeader>
          <CardContent>
            {isVisitsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-12 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentVisits && recentVisits.length > 0 ? (
              <div className="space-y-0 divide-y">
                {recentVisits.map((visit, index) => (
                  <div
                    key={`${visit.vn}-${index}`}
                    className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <Badge
                      variant="secondary"
                      className="shrink-0 font-mono text-[10px] tabular-nums"
                    >
                      {formatVisitTime(visit.vsttime)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {visit.departmentName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {visit.doctorName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent visits recorded
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 6. Session Info + Connection Footer                                  */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Session Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Session Info</CardTitle>
            <CardDescription>Active connection details</CardDescription>
          </CardHeader>
          <CardContent>
            {session ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {sessionInfoRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      {row.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {row.label}
                      </p>
                      <div className="mt-0.5 truncate text-sm font-medium">
                        {row.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active session. Connect with a session ID to view details.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connection details footer bar */}
      {session && (
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              API: {truncateUrl(session.apiUrl)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Connected: {formatDateTime(session.connectedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              {session.databaseType.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
