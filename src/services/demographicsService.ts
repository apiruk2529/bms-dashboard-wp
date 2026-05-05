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
export async function getGenderDistribution(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<{ gender: string; count: number; dataSource: 'patient' | 'ovst_patient_record' }[]> {
  // Try patient table first
  const patientCountSql =
    `SELECT COUNT(*) as total ` +
    `FROM ovst o INNER JOIN patient p ON o.hn = p.hn ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}'`;
  const countResponse = await executeSqlViaApi(patientCountSql, config);
  const totalRows = parseQueryResponse(countResponse, (row) => Number(row['total'] ?? 0));
  const patientCount = totalRows[0] ?? 0;

  if (patientCount > 0) {
    const sql =
      `SELECT p.sex as gender, COUNT(*) as count ` +
      `FROM ovst o INNER JOIN patient p ON o.hn = p.hn ` +
      `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}' ` +
      `GROUP BY p.sex ` +
      `ORDER BY count DESC`;
    const response = await executeSqlViaApi(sql, config);
    return parseQueryResponse(response, (row) => ({
      gender: String(row['gender'] ?? ''),
      count: Number(row['count'] ?? 0),
      dataSource: 'patient' as const,
    }));
  }

  // Fallback to ovst_patient_record
  const fallbackSql =
    `SELECT opr.sex as gender, COUNT(*) as count ` +
    `FROM ovst o INNER JOIN ovst_patient_record opr ON o.vn = opr.vn ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}' ` +
    `GROUP BY opr.sex ` +
    `ORDER BY count DESC`;
  const fallbackResponse = await executeSqlViaApi(fallbackSql, config);
  return parseQueryResponse(fallbackResponse, (row) => ({
    gender: String(row['gender'] ?? ''),
    count: Number(row['count'] ?? 0),
    dataSource: 'ovst_patient_record' as const,
  }));
}

/**
 * Age group distribution for visits within a date range.
 *
 * Groups: Infant (<1), Child (<13), Teenager (<20), Young Adult (<40),
 * Middle Age (<60), Senior (>=60).
 *
 * Uses {@link queryBuilder.ageCalc} to handle MySQL vs PostgreSQL age
 * calculation differences.
 */
export async function getAgeGroupDistribution(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<{ group: string; count: number }[]> {
  const age = queryBuilder.ageCalc(dbType, 'p.birthday');
  const sql =
    `SELECT ` +
    `CASE ` +
    `  WHEN ${age} < 1 THEN 'Infant' ` +
    `  WHEN ${age} < 13 THEN 'Child' ` +
    `  WHEN ${age} < 20 THEN 'Teenager' ` +
    `  WHEN ${age} < 40 THEN 'Young Adult' ` +
    `  WHEN ${age} < 60 THEN 'Middle Age' ` +
    `  ELSE 'Senior' ` +
    `END as age_group, ` +
    `COUNT(*) as count ` +
    `FROM ovst o INNER JOIN patient p ON o.hn = p.hn ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}' ` +
    `AND p.birthday IS NOT NULL ` +
    `GROUP BY age_group ` +
    `ORDER BY count DESC`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    group: String(row['age_group'] ?? ''),
    count: Number(row['count'] ?? 0),
  }));
}

/**
 * Patient type (pttype) distribution for visits within a date range.
 */
export async function getPatientTypeDistribution(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<PatientTypeDistribution[]> {
  const sql =
    `SELECT o.pttype as pttype_code, pt.name as pttype_name, COUNT(*) as visit_count ` +
    `FROM ovst o LEFT JOIN pttype pt ON o.pttype = pt.pttype ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}' ` +
    `GROUP BY o.pttype, pt.name ` +
    `ORDER BY visit_count DESC`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    pttypeCode: String(row['pttype_code'] ?? ''),
    pttypeName: String(row['pttype_name'] ?? ''),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Overview - Extended Stats & Recent Activity
// ---------------------------------------------------------------------------

/**
 * Get recent visits (last 10) with department and doctor names.
 */