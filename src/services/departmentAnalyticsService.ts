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
  StaffVisitDetail,
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
export async function getDepartmentWorkload(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<DepartmentWorkload[]> {
  const sql =
    `SELECT k.depcode as department_code, k.department as department_name, COUNT(*) as visit_count ` +
    `FROM ovst o LEFT JOIN kskdepartment k ON o.main_dep = k.depcode ` +
    `WHERE o.vstdate = ${queryBuilder.currentDate(dbType)} ` +
    `GROUP BY k.depcode, k.department ` +
    `ORDER BY visit_count DESC`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    departmentCode: String(row['department_code'] ?? ''),
    departmentName: String(row['department_name'] ?? ''),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

/**
 * Daily workload summary by staff/kiosk.
 */
export async function getWorkloadDaily(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<WorkloadDailyItem[]> {
  const sql =
    `SELECT COALESCE(d.staff, 'Kiosk') AS staff, o.vstdate as vstdate, COUNT(*) AS total, ` +
    `SUM(CASE WHEN o.vsttime BETWEEN '08:00:00' AND '16:00:00' THEN 1 ELSE 0 END) AS shift1, ` +
    `SUM(CASE WHEN o.vsttime BETWEEN '16:00:01' AND '23:59:59' THEN 1 ELSE 0 END) AS shift2, ` +
    `SUM(CASE WHEN o.vsttime BETWEEN '00:00:00' AND '07:59:59' THEN 1 ELSE 0 END) AS shift3 ` +
    `FROM ovst o ` +
    `LEFT JOIN ptdepart d ON o.vn = d.vn AND d.depcode = '013' ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}' ` +
    `GROUP BY d.staff, o.vstdate ` +
    `ORDER BY o.vstdate ASC`;

  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => {
    const rawStaff = String(row['staff'] ?? '');
    // Convert to lowercase to group case-insensitive logins, but keep Kiosk capitalized if it's kiosk
    const staff = rawStaff.toLowerCase() === 'kiosk' ? 'Kiosk' : rawStaff.toLowerCase();
    
    return {
      staff,
      vstdate: String(row['vstdate'] ?? ''),
      total: Number(row['total'] ?? 0),
      shift1: Number(row['shift1'] ?? 0),
      shift2: Number(row['shift2'] ?? 0),
      shift3: Number(row['shift3'] ?? 0),
    };
  });
}

/**
 * Aggregate overview KPI summary (all four counts fetched in parallel).
 */
export async function getDoctorWorkload(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
  depcode?: string,
): Promise<DoctorWorkload[]> {
  const depFilter = depcode
    ? ` AND o.main_dep = '${depcode}'`
    : '';
  const sql =
    `SELECT o.doctor as doctor_code, COALESCE(d.name, o.doctor) as doctor_name, COUNT(*) as patient_count ` +
    `FROM ovst o LEFT JOIN doctor d ON o.doctor = d.code ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}'${depFilter} ` +
    `GROUP BY o.doctor, d.name ` +
    `ORDER BY patient_count DESC ` +
    `LIMIT 50`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    doctorCode: String(row['doctor_code'] ?? ''),
    doctorName: String(row['doctor_name'] ?? ''),
    patientCount: Number(row['patient_count'] ?? 0),
  }));
}



/**
 * Daily visit trend for a specific department within a date range.
 */
export async function getDepartmentDailyTrend(
  config: ConnectionConfig,
  dbType: DatabaseType,
  depcode: string,
  startDate: string,
  endDate: string,
): Promise<VisitTrend[]> {
  const dateExpr = queryBuilder.dateFormat(dbType, 'o.vstdate', '%Y-%m-%d');
  const sql =
    `SELECT ${dateExpr} as visit_date, COUNT(*) as visit_count ` +
    `FROM ovst o ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}' ` +
    `AND o.main_dep = '${depcode}' ` +
    `GROUP BY ${dateExpr} ` +
    `ORDER BY visit_date ASC`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    date: String(row['visit_date'] ?? ''),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// US4 - Demographics KPIs
// ---------------------------------------------------------------------------

/**
 * Gender distribution for visits within a date range.
 *
 * Attempts the `patient` table first. If the result set is empty (e.g. the
 * table is not populated), falls back to `ovst_patient_record`.
 */