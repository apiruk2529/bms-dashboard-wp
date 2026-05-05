// =============================================================================
// BMS Session KPI Dashboard - Department Workload Table Component (T045)
// Professional showcase redesign with progress bars, rank badges, totals
// =============================================================================

import { useCallback, useMemo } from 'react'
import { Building2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import { getDepartmentWorkload } from '@/services/departmentAnalyticsService'

export function DepartmentTable() {
  const { connectionConfig, session } = useBmsSessionContext()

  const queryFn = useCallback(
    () => getDepartmentWorkload(connectionConfig!, session!.databaseType),
    [connectionConfig, session],
  )

  const {
    data: departments,
    isLoading,
    isError,
    error,
    execute,
  } = useQuery<Awaited<ReturnType<typeof getDepartmentWorkload>>>({
    queryFn,
    enabled: connectionConfig !== null && session !== null,
  })

  const maxVisitCount = useMemo(
    () =>
      departments && departments.length > 0
        ? Math.max(...departments.map((d) => d.visitCount))
        : 0,
    [departments],
  )

  const totalVisits = useMemo(
    () =>
      departments
        ? departments.reduce((sum, d) => sum + d.visitCount, 0)
        : 0,
    [departments],
  )

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-12 uppercase text-xs tracking-wider text-muted-foreground">
              #
            </TableHead>
            <TableHead className="uppercase text-xs tracking-wider text-muted-foreground">
              แผนก
            </TableHead>
            <TableHead className="text-right uppercase text-xs tracking-wider text-muted-foreground">
              จำนวนครั้ง
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i} className={i % 2 === 0 ? 'bg-muted/50' : ''}>
              <TableCell>
                <Skeleton className="h-6 w-6 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-16" />
                <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (isError) {
    return (
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="ไม่สามารถโหลดข้อมูลแผนกได้"
        description={error?.message ?? 'An unexpected error occurred.'}
        action={
          <button
            className="text-sm text-primary underline hover:no-underline"
            onClick={execute}
          >
            ลองอีกครั้ง
          </button>
        }
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (!departments || departments.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="ไม่มีข้อมูลการเข้ารับบริการวันนี้"
        description="ข้อมูลจะปรากฏเมื่อมีผู้ป่วยเข้ารับบริการ"
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Data table
  // ---------------------------------------------------------------------------
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30">
          <TableHead className="w-12 uppercase text-xs tracking-wider text-muted-foreground">
            #
          </TableHead>
          <TableHead className="uppercase text-xs tracking-wider text-muted-foreground">
            แผนก
          </TableHead>
          <TableHead className="text-right uppercase text-xs tracking-wider text-muted-foreground">
            จำนวนครั้ง
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {departments.map((dept, index) => {
          const percentage =
            maxVisitCount > 0
              ? Math.round((dept.visitCount / maxVisitCount) * 100)
              : 0

          return (
            <TableRow
              key={dept.departmentCode}
              className={`hover:bg-muted transition-colors ${
                index % 2 === 0 ? 'bg-muted/50' : ''
              }`}
            >
              {/* Rank badge */}
              <TableCell>
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                  {index + 1}
                </div>
              </TableCell>

              {/* Department name */}
              <TableCell className="font-medium">
                {dept.departmentName}
              </TableCell>

              {/* Visit count + progress bar */}
              <TableCell className="text-right">
                <span className="font-semibold">
                  {dept.visitCount.toLocaleString()}
                </span>
                <div className="relative mt-1.5 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary/60 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </TableCell>
            </TableRow>
          )
        })}

        {/* Total row */}
        <TableRow className="border-t-2">
          <TableCell />
          <TableCell className="font-bold">รวม</TableCell>
          <TableCell className="text-right font-bold">
            {totalVisits.toLocaleString()}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
