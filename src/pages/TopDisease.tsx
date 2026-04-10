// =============================================================================
// BMS Session KPI Dashboard - 20 อันดับโรค (Top 20 Diseases) Page
// =============================================================================

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useBmsSessionContext } from '@/contexts/BmsSessionContext'
import { useQuery } from '@/hooks/useQuery'
import {
  getTop20OpdDiseases,
  getTop20IpdDiseases,
  getTop20ReferDiseases,
  getProvinces,
  getAmphurs,
  getTambons,
  getVillages,
} from '@/services/kpiService'
import type {
  Top20OpdDisease,
  Top20IpdDisease,
  Top20ReferDisease,
  AreaInfo,
} from '@/services/kpiService'
import { getFiscalYearRange } from '@/utils/dateUtils'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { AddressFilter } from '@/components/dashboard/AddressFilter'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'

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
// OPD Table
// ---------------------------------------------------------------------------

function OpdTable({
  data,
  isLoading,
}: {
  data: Top20OpdDisease[]
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          🏥 20 อันดับโรคผู้ป่วยนอก (OPD)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <TablePlaceholder isLoading={isLoading} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 w-12">#</th>
                  <th className="px-4 py-2.5 w-24">ICD10</th>
                  <th className="px-4 py-2.5">ชื่อโรค</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">HN (ราย)</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">VN (ครั้ง)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr
                    key={row.icd10}
                    className="border-b transition-colors hover:bg-muted/30 last:border-0"
                  >
                    <td className="px-4 py-2">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.icd10}
                    </td>
                    <td className="px-4 py-2">{row.name || '-'}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {row.hn.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-600">
                      {row.vn.toLocaleString()}
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
// IPD Table
// ---------------------------------------------------------------------------

function IpdTable({
  data,
  isLoading,
}: {
  data: Top20IpdDisease[]
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          🛏️ 20 อันดับโรคผู้ป่วยใน (IPD)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <TablePlaceholder isLoading={isLoading} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 w-12">#</th>
                  <th className="px-4 py-2.5 w-24">ICD10</th>
                  <th className="px-4 py-2.5">ชื่อโรค</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">จำนวน (ราย)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr
                    key={`${row.pdx}-${i}`}
                    className="border-b transition-colors hover:bg-muted/30 last:border-0"
                  >
                    <td className="px-4 py-2">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.pdx}
                    </td>
                    <td className="px-4 py-2">{row.icdname || '-'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-600">
                      {row.pdxCount.toLocaleString()}
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
// Refer Table
// ---------------------------------------------------------------------------

function ReferTable({
  data,
  isLoading,
}: {
  data: Top20ReferDisease[]
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          🚑 20 อันดับโรค Refer ออก
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <TablePlaceholder isLoading={isLoading} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 w-12">#</th>
                  <th className="px-4 py-2.5 w-24">ICD10</th>
                  <th className="px-4 py-2.5">ชื่อโรค</th>
                  <th className="px-4 py-2.5 text-right">ครั้ง</th>
                  <th className="px-4 py-2.5 text-right">ราย</th>
                  <th className="px-4 py-2.5 text-right">OPD</th>
                  <th className="px-4 py-2.5 text-right">ER</th>
                  <th className="px-4 py-2.5 text-right">IPD</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr
                    key={`${row.pdx}-${i}`}
                    className="border-b transition-colors hover:bg-muted/30 last:border-0"
                  >
                    <td className="px-4 py-2">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {row.pdx}
                    </td>
                    <td className="px-4 py-2">{row.icd10name || '-'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-orange-600">
                      {row.ct.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {row.ctHn.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-blue-500">
                      {row.referOpd.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-red-500">
                      {row.referEr.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-green-500">
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
// Main page component
// ---------------------------------------------------------------------------

export default function TopDisease() {
  const { connectionConfig, session } = useBmsSessionContext()

  // Default to current fiscal year
  const defaultRange = useMemo(() => getFiscalYearRange(), [])
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)

  const isConnected = connectionConfig !== null && session !== null

  // Address AddressFilter State
  const [selectedChwpart, setSelectedChwpart] = useState('')
  const [selectedAmppart, setSelectedAmppart] = useState('')
  const [selectedTmbpart, setSelectedTmbpart] = useState('')
  const [selectedMoopart, setSelectedMoopart] = useState<string[]>([])

  // Lists state
  const [provinces, setProvinces] = useState<AreaInfo[]>([])
  const [amphurs, setAmphurs] = useState<AreaInfo[]>([])
  const [tambons, setTambons] = useState<AreaInfo[]>([])
  const [villages, setVillages] = useState<AreaInfo[]>([])

  // Load Provinces
  useEffect(() => {
    if (isConnected && connectionConfig) {
      getProvinces(connectionConfig).then(setProvinces)
    }
  }, [isConnected, connectionConfig])

  useEffect(() => {
    setSelectedAmppart('')
    setSelectedTmbpart('')
    setSelectedMoopart([])
    setAmphurs([])
    setTambons([])
    setVillages([])
    if (selectedChwpart && connectionConfig) {
      getAmphurs(connectionConfig, selectedChwpart).then(setAmphurs)
    }
  }, [selectedChwpart, connectionConfig])

  useEffect(() => {
    setSelectedTmbpart('')
    setSelectedMoopart([])
    setTambons([])
    setVillages([])
    if (selectedChwpart && selectedAmppart && connectionConfig) {
      getTambons(connectionConfig, selectedChwpart, selectedAmppart).then(setTambons)
    }
  }, [selectedAmppart, selectedChwpart, connectionConfig])

  useEffect(() => {
    setSelectedMoopart([])
    setVillages([])
    if (selectedChwpart && selectedAmppart && selectedTmbpart && connectionConfig) {
      getVillages(connectionConfig, selectedChwpart, selectedAmppart, selectedTmbpart).then(setVillages)
    }
  }, [selectedTmbpart, selectedAmppart, selectedChwpart, connectionConfig])

  const currentAddressFilter = useMemo(() => ({
    chwpart: selectedChwpart || undefined,
    amppart: selectedAmppart || undefined,
    tmbpart: selectedTmbpart || undefined,
    moopart: selectedMoopart.length > 0 ? selectedMoopart : undefined,
  }), [selectedChwpart, selectedAmppart, selectedTmbpart, selectedMoopart])

  // ----- OPD query -----
  const opdQueryFn = useCallback(
    () =>
      getTop20OpdDiseases(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        currentAddressFilter
      ),
    [connectionConfig, session, startDate, endDate, currentAddressFilter],
  )
  const opdQuery = useQuery<Top20OpdDisease[]>({
    queryFn: opdQueryFn,
    enabled: isConnected,
  })

  // ----- IPD query -----
  const ipdQueryFn = useCallback(
    () =>
      getTop20IpdDiseases(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        currentAddressFilter
      ),
    [connectionConfig, session, startDate, endDate, currentAddressFilter],
  )
  const ipdQuery = useQuery<Top20IpdDisease[]>({
    queryFn: ipdQueryFn,
    enabled: isConnected,
  })

  // ----- Refer query -----
  const referQueryFn = useCallback(
    () =>
      getTop20ReferDiseases(
        connectionConfig!,
        session!.databaseType,
        startDate,
        endDate,
        currentAddressFilter
      ),
    [connectionConfig, session, startDate, endDate, currentAddressFilter],
  )
  const referQuery = useQuery<Top20ReferDisease[]>({
    queryFn: referQueryFn,
    enabled: isConnected,
  })

  // ----- Date range handler -----
  const handleRangeChange = useCallback((start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }, [])

  const anyLoading =
    opdQuery.isLoading || ipdQuery.isLoading || referQuery.isLoading

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          20 อันดับโรคผู้ป่วย
        </h1>
        <p className="text-sm text-muted-foreground">
          ข้อมูลการวินิจฉัยโรค 20 อันดับแรก แยกตามผู้ป่วยนอก ผู้ป่วยใน และการ Refer ออก
        </p>
      </div>

      {/* Date range and Address filter */}
      <div className="flex flex-col gap-4">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onRangeChange={handleRangeChange}
          isLoading={anyLoading}
        />
        <AddressFilter
          provinces={provinces}
          amphurs={amphurs}
          tambons={tambons}
          villages={villages}
          selectedChwpart={selectedChwpart}
          selectedAmppart={selectedAmppart}
          selectedTmbpart={selectedTmbpart}
          selectedMoopart={selectedMoopart}
          onProvinceChange={setSelectedChwpart}
          onAmphurChange={setSelectedAmppart}
          onTambonChange={setSelectedTmbpart}
          onVillageChange={setSelectedMoopart}
          isLoading={anyLoading}
        />
      </div>

      {/* OPD Table */}
      <OpdTable data={opdQuery.data ?? []} isLoading={opdQuery.isLoading} />

      {/* IPD + Refer side by side on wide screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <IpdTable data={ipdQuery.data ?? []} isLoading={ipdQuery.isLoading} />
        <ReferTable
          data={referQuery.data ?? []}
          isLoading={referQuery.isLoading}
        />
      </div>
    </div>
  )
}
