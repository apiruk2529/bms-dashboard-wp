// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
// =============================================================================
// BMS Session KPI Dashboard - KPI Data Fetching Service
// (T042 + T053 + T062 + T070)
// Centralized service for all KPI queries across Overview, Trends,
// Departments/Doctors, and Demographics user stories.
// =============================================================================

import type {
  ConnectionConfig,
  DatabaseType,
  DepartmentWorkload,
  DoctorWorkload,
  HourlyDistribution,
  KpiSummary,
  OverviewStats,
  PatientTypeDistribution,
  RecentVisit,
  SqlApiResponse,
  VisitTrend,
} from '@/types';

import { queryBuilder } from '@/services/queryBuilder';
import { executeSqlViaApi } from '@/services/bmsSession';

// ---------------------------------------------------------------------------
// Response parsing helper
// ---------------------------------------------------------------------------

/**
 * Map raw {@link SqlApiResponse} rows into a typed array using the supplied
 * mapper function.
 *
 * Returns an empty array when the response contains no data rows.
 */
function parseQueryResponse<T>(
  response: SqlApiResponse,
  mapper: (row: Record<string, unknown>) => T,
): T[] {
  if (!response.data || !Array.isArray(response.data)) {
    return [];
  }
  return response.data.map(mapper);
}

// ---------------------------------------------------------------------------
// US1 - Overview KPIs
// ---------------------------------------------------------------------------

/**
 * Count of OPD visits for today.
 */

export interface TrendSummary {
  totalVisits: number
  avgDailyVisits: number
  peakDay: { date: string; count: number } | null
  lowestDay: { date: string; count: number } | null
  totalDays: number
  daysWithVisits: number
}

export function computeTrendSummary(trends: VisitTrend[]): TrendSummary {
  if (trends.length === 0) {
    return { totalVisits: 0, avgDailyVisits: 0, peakDay: null, lowestDay: null, totalDays: 0, daysWithVisits: 0 }
  }
  const totalVisits = trends.reduce((sum, t) => sum + t.visitCount, 0)
  const daysWithVisits = trends.filter(t => t.visitCount > 0).length
  const sorted = [...trends].sort((a, b) => b.visitCount - a.visitCount)
  return {
    totalVisits,
    avgDailyVisits: Math.round(totalVisits / trends.length),
    peakDay: sorted[0] ? { date: sorted[0].date, count: sorted[0].visitCount } : null,
    lowestDay: sorted[sorted.length - 1] ? { date: sorted[sorted.length - 1].date, count: sorted[sorted.length - 1].visitCount } : null,
    totalDays: trends.length,
    daysWithVisits,
  }
}

/**
 * Monthly visit summary for the last 6 months.
 */
export async function getMonthlyVisitSummary(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<{ month: string; visitCount: number }[]> {
  const monthExpr = queryBuilder.dateFormat(dbType, 'vstdate', '%Y-%m');
  const sql =
    `SELECT ${monthExpr} as visit_month, COUNT(*) as visit_count ` +
    `FROM ovst ` +
    `WHERE vstdate >= ${queryBuilder.dateSubtract(dbType, 180)} ` +
    `GROUP BY ${monthExpr} ` +
    `ORDER BY visit_month ASC`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    month: String(row['visit_month'] ?? ''),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

/**
 * Visit counts by day of week for a date range.
 */
export async function getVisitsByDayOfWeek(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<{ dayOfWeek: number; dayName: string; visitCount: number }[]> {
  // Use day of week extraction - MySQL DAYOFWEEK (1=Sun..7=Sat), PostgreSQL EXTRACT(DOW) (0=Sun..6=Sat)
  const dowExpr = dbType === 'mysql'
    ? 'DAYOFWEEK(vstdate)'
    : "EXTRACT(DOW FROM vstdate)::int";
  const sql =
    `SELECT ${dowExpr} as day_of_week, COUNT(*) as visit_count ` +
    `FROM ovst ` +
    `WHERE vstdate >= '${startDate}' AND vstdate <= '${endDate}' ` +
    `GROUP BY ${dowExpr} ` +
    `ORDER BY day_of_week ASC`;
  const response = await executeSqlViaApi(sql, config);

  const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  return parseQueryResponse(response, (row) => {
    let dow = Number(row['day_of_week'] ?? 0);
    // MySQL: 1=Sun..7=Sat -> normalize to 0=Sun..6=Sat
    if (dbType === 'mysql') dow = dow - 1;
    return {
      dayOfWeek: dow,
      dayName: dayNames[dow] ?? `วัน ${dow}`,
      visitCount: Number(row['visit_count'] ?? 0),
    };
  });
}

/**
 * Top 5 departments by visit count for a date range.
 */
export async function getTopDepartmentsForRange(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<DepartmentWorkload[]> {
  const sql =
    `SELECT k.depcode as department_code, CONVERT(k.department USING utf8) as department_name, COUNT(*) as visit_count ` +
    `FROM ovst o LEFT JOIN kskdepartment k ON o.main_dep = k.depcode ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}' ` +
    `GROUP BY k.depcode, k.department ` +
    `ORDER BY visit_count DESC ` +
    `LIMIT 5`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    departmentCode: String(row['department_code'] ?? ''),
    departmentName: String(row['department_name'] ?? ''),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Diagnosis, Medication Cost & Death Statistics (Trends page)
// ---------------------------------------------------------------------------

/**
 * Top 10 diagnoses by visit count for a date range.
 * Joins ovstdiag with icd101 for Thai diagnosis names.
 */
export async function getTopDiagnoses(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<{ icd10: string; diagnosisName: string; visitCount: number }[]> {
  const sql =
    `SELECT od.icd10, COALESCE(CONVERT(i.tname USING utf8), CONVERT(i.name USING utf8), od.icd10) as diagnosis_name, COUNT(*) as visit_count ` +
    `FROM ovstdiag od ` +
    `LEFT JOIN icd101 i ON od.icd10 = i.code ` +
    `WHERE od.vstdate >= '${startDate}' AND od.vstdate <= '${endDate}' ` +
    `GROUP BY od.icd10, i.tname, i.name ` +
    `ORDER BY visit_count DESC ` +
    `LIMIT 10`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    icd10: String(row['icd10'] ?? ''),
    diagnosisName: String(row['diagnosis_name'] ?? ''),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

/**
 * Top 10 medications by total cost for a date range.
 * Joins opitemrece with drugitems for drug names.
 */
export async function getTopMedications(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<{ drugName: string; totalQty: number; totalCost: number }[]> {
  const sql =
    `SELECT COALESCE(CONVERT(d.name USING utf8), 'ไม่ระบุ') as drug_name, ` +
    `SUM(op.qty) as total_qty, ` +
    `SUM(op.qty * op.unitprice) as total_cost ` +
    `FROM opitemrece op ` +
    `LEFT JOIN drugitems d ON op.icode = d.icode ` +
    `WHERE op.vstdate >= '${startDate}' AND op.vstdate <= '${endDate}'   ` +
    `GROUP BY d.name ` +
    `ORDER BY total_cost DESC ` +
    `LIMIT 10`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    drugName: String(row['drug_name'] ?? 'ไม่ระบุ'),
    totalQty: Number(row['total_qty'] ?? 0),
    totalCost: Number(row['total_cost'] ?? 0),
  }));
}

/**
 * Medication cost summary for a date range.
 */
export async function getMedicationCostSummary(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<{ totalItems: number; totalCost: number; uniqueDrugs: number }> {
  const sql =
    `SELECT COUNT(*) as total_items, ` +
    `COALESCE(SUM(qty * unitprice), 0) as total_cost, ` +
    `COUNT(DISTINCT icode) as unique_drugs ` +
    `FROM opitemrece ` +
    `WHERE vstdate >= '${startDate}' AND vstdate <= '${endDate}'`;
  const response = await executeSqlViaApi(sql, config);
  const rows = parseQueryResponse(response, (row) => ({
    totalItems: Number(row['total_items'] ?? 0),
    totalCost: Number(row['total_cost'] ?? 0),
    uniqueDrugs: Number(row['unique_drugs'] ?? 0),
  }));
  return rows[0] ?? { totalItems: 0, totalCost: 0, uniqueDrugs: 0 };
}

/**
 * Death statistics summary.
 */
export async function getDeathSummary(
  config: ConnectionConfig,
  _dbType: DatabaseType,
): Promise<{ totalDeaths: number; thisYearDeaths: number; thisMonthDeaths: number }> {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const yearStart = `${currentYear}-01-01`;
  const monthStart = `${currentYear}-${currentMonth}-01`;

  const sql =
    `SELECT ` +
    `COUNT(*) as total_deaths, ` +
    `SUM(CASE WHEN death_date >= '${yearStart}' THEN 1 ELSE 0 END) as this_year, ` +
    `SUM(CASE WHEN death_date >= '${monthStart}' THEN 1 ELSE 0 END) as this_month ` +
    `FROM death`;
  const response = await executeSqlViaApi(sql, config);
  const rows = parseQueryResponse(response, (row) => ({
    totalDeaths: Number(row['total_deaths'] ?? 0),
    thisYearDeaths: Number(row['this_year'] ?? 0),
    thisMonthDeaths: Number(row['this_month'] ?? 0),
  }));
  return rows[0] ?? { totalDeaths: 0, thisYearDeaths: 0, thisMonthDeaths: 0 };
}

/**
 * Total diagnosis count and unique ICD10 codes for a date range.
 */
export async function getDiagnosisSummary(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<{ totalDiagnoses: number; uniqueCodes: number }> {
  const sql =
    `SELECT COUNT(*) as total_diagnoses, COUNT(DISTINCT icd10) as unique_codes ` +
    `FROM ovstdiag ` +
    `WHERE vstdate >= '${startDate}' AND vstdate <= '${endDate}'`;
  const response = await executeSqlViaApi(sql, config);
  const rows = parseQueryResponse(response, (row) => ({
    totalDiagnoses: Number(row['total_diagnoses'] ?? 0),
    uniqueCodes: Number(row['unique_codes'] ?? 0),
  }));
  return rows[0] ?? { totalDiagnoses: 0, uniqueCodes: 0 };
}