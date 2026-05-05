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
export async function getOpdVisitCount(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<number> {
  const sql = `SELECT COUNT(*) as total FROM ovst WHERE vstdate = ${queryBuilder.currentDate(dbType)}`;
  const response = await executeSqlViaApi(sql, config);
  const rows = parseQueryResponse(response, (row) => Number(row['total'] ?? 0));
  return rows[0] ?? 0;
}

/**
 * Count of currently admitted IPD patients (not yet discharged).
 *
 * The query is identical for MySQL and PostgreSQL.
 */
export async function getIpdPatientCount(
  config: ConnectionConfig,
): Promise<number> {
  const sql = `SELECT COUNT(*) as total FROM ipt WHERE dchdate IS NULL`;
  const response = await executeSqlViaApi(sql, config);
  const rows = parseQueryResponse(response, (row) => Number(row['total'] ?? 0));
  return rows[0] ?? 0;
}

/**
 * Count of ER visits for today.
 */
export async function getErVisitCount(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<number> {
  const sql = `SELECT COUNT(*) as total FROM er_regist WHERE vstdate = ${queryBuilder.currentDate(dbType)}`;
  const response = await executeSqlViaApi(sql, config);
  const rows = parseQueryResponse(response, (row) => Number(row['total'] ?? 0));
  return rows[0] ?? 0;
}

/**
 * Count of distinct departments with visits today.
 */
export async function getActiveDepartmentCount(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<number> {
  const sql =
    `SELECT COUNT(DISTINCT k.depcode) as total ` +
    `FROM ovst o LEFT JOIN kskdepartment k ON o.main_dep = k.depcode ` +
    `WHERE o.vstdate = ${queryBuilder.currentDate(dbType)}`;
  const response = await executeSqlViaApi(sql, config);
  const rows = parseQueryResponse(response, (row) => Number(row['total'] ?? 0));
  return rows[0] ?? 0;
}

/**
 * Per-department visit counts for today, ordered by volume descending.
 */
export async function getKpiSummary(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<KpiSummary> {
  const [opdVisitCount, ipdPatientCount, erVisitCount, activeDepartmentCount] =
    await Promise.all([
      getOpdVisitCount(config, dbType),
      getIpdPatientCount(config),
      getErVisitCount(config, dbType),
      getActiveDepartmentCount(config, dbType),
    ]);

  return {
    opdVisitCount,
    ipdPatientCount,
    erVisitCount,
    activeDepartmentCount,
    timestamp: new Date(),
  };
}

// ---------------------------------------------------------------------------
// US2 - Trend KPIs
// ---------------------------------------------------------------------------

/**
 * Daily visit counts grouped by date within the given range.
 */
export async function getDailyVisitTrend(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<VisitTrend[]> {
  const dateExpr = queryBuilder.dateFormat(dbType, 'vstdate', '%Y-%m-%d');
  const sql =
    `SELECT ${dateExpr} as visit_date, COUNT(*) as visit_count ` +
    `FROM ovst ` +
    `WHERE vstdate >= '${startDate}' AND vstdate <= '${endDate}' ` +
    `GROUP BY ${dateExpr} ` +
    `ORDER BY visit_date ASC`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    date: String(row['visit_date'] ?? ''),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

/**
 * Hourly visit distribution for a single date.
 */
export async function getHourlyDistribution(
  config: ConnectionConfig,
  dbType: DatabaseType,
  date: string,
): Promise<HourlyDistribution[]> {
  const hourExpr = queryBuilder.hourExtract(dbType, 'vsttime');
  const sql =
    `SELECT ${hourExpr} as visit_hour, COUNT(*) as visit_count ` +
    `FROM ovst ` +
    `WHERE vstdate = '${date}' ` +
    `GROUP BY ${hourExpr} ` +
    `ORDER BY visit_hour ASC`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    hour: Number(row['visit_hour'] ?? 0),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// US3 - Department / Doctor KPIs
// ---------------------------------------------------------------------------

/**
 * Department-level visit breakdown for a date range.
 */
export async function getDepartmentBreakdown(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<DepartmentWorkload[]> {
  const sql =
    `SELECT k.depcode as department_code, k.department as department_name, COUNT(*) as visit_count ` +
    `FROM ovst o LEFT JOIN kskdepartment k ON o.main_dep = k.depcode ` +
    `WHERE o.vstdate >= '${startDate}' AND o.vstdate <= '${endDate}' ` +
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
 * Doctor workload (patient counts) for a date range, optionally filtered by
 * department. Results are capped at 50 rows.
 */
export async function getRecentVisits(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<RecentVisit[]> {
  const sql =
    `SELECT o.vn, o.hn, ` +
    `${queryBuilder.dateFormat(dbType, 'o.vstdate', '%Y-%m-%d')} as vstdate, ` +
    `${queryBuilder.castToText(dbType, 'o.vsttime')} as vsttime, ` +
    `COALESCE(k.department, 'Unknown') as department_name, ` +
    `COALESCE(d.name, 'Unknown') as doctor_name ` +
    `FROM ovst o ` +
    `LEFT JOIN kskdepartment k ON o.main_dep = k.depcode ` +
    `LEFT JOIN doctor d ON o.doctor = d.code ` +
    `ORDER BY o.vstdate DESC, o.vsttime DESC ` +
    `LIMIT 10`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    vn: String(row['vn'] ?? ''),
    hn: String(row['hn'] ?? ''),
    vstdate: String(row['vstdate'] ?? ''),
    vsttime: String(row['vsttime'] ?? ''),
    departmentName: String(row['department_name'] ?? 'Unknown'),
    doctorName: String(row['doctor_name'] ?? 'Unknown'),
  }));
}

/**
 * Get overview statistics for the dashboard.
 */
export async function getOverviewStats(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<OverviewStats> {
  // Use simpler approach - run individual queries
  const queries = [
    // Total registered patients (from ovst_patient_record distinct hn)
    `SELECT COUNT(DISTINCT hn) as total FROM ovst_patient_record`,
    // Total visits this month
    `SELECT COUNT(*) as total FROM ovst WHERE ${queryBuilder.dateFormat(dbType, 'vstdate', '%Y-%m')} = ${queryBuilder.dateFormat(dbType, queryBuilder.currentDate(dbType), '%Y-%m')}`,
    // Total visits last month - use a date range approach
    `SELECT COUNT(*) as total FROM ovst WHERE vstdate >= ${queryBuilder.dateSubtract(dbType, 60)} AND vstdate < ${queryBuilder.dateSubtract(dbType, 30)}`,
    // Total active doctors
    `SELECT COUNT(*) as total FROM doctor WHERE active = 'Y' OR active IS NULL`,
    // Total departments
    `SELECT COUNT(*) as total FROM kskdepartment`,
  ];

  const results = await Promise.all(
    queries.map(sql => executeSqlViaApi(sql, config).then(r => {
      const rows = parseQueryResponse(r, (row) => Number(row['total'] ?? 0));
      return rows[0] ?? 0;
    }).catch(() => 0))
  );

  const totalVisitsThisMonth = results[1];
  const daysInMonth = new Date().getDate();

  return {
    totalRegisteredPatients: results[0],
    totalVisitsThisMonth: results[1],
    totalVisitsLastMonth: results[2],
    avgDailyVisitsThisMonth: daysInMonth > 0 ? Math.round(totalVisitsThisMonth / daysInMonth) : 0,
    totalDoctors: results[3],
    totalDepartments: results[4],
  };
}

/**
 * Get visit counts for the last 7 days as a mini trend.
 */
export async function getWeeklyMiniTrend(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<VisitTrend[]> {
  const sql =
    `SELECT ${queryBuilder.dateFormat(dbType, 'vstdate', '%Y-%m-%d')} as visit_date, COUNT(*) as visit_count ` +
    `FROM ovst ` +
    `WHERE vstdate >= ${queryBuilder.dateSubtract(dbType, 7)} ` +
    `GROUP BY ${queryBuilder.dateFormat(dbType, 'vstdate', '%Y-%m-%d')} ` +
    `ORDER BY visit_date`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    date: String(row['visit_date'] ?? ''),
    visitCount: Number(row['visit_count'] ?? 0),
  }));
}

/**
 * Get top 5 doctors by patient count for the current month.
 */
export async function getTopDoctorsThisMonth(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<DoctorWorkload[]> {
  const sql =
    `SELECT o.doctor as doctor_code, d.name as doctor_name, COUNT(*) as patient_count ` +
    `FROM ovst o ` +
    `LEFT JOIN doctor d ON o.doctor = d.code ` +
    `WHERE ${queryBuilder.dateFormat(dbType, 'o.vstdate', '%Y-%m')} = ${queryBuilder.dateFormat(dbType, queryBuilder.currentDate(dbType), '%Y-%m')} ` +
    `GROUP BY o.doctor, d.name ` +
    `ORDER BY patient_count DESC ` +
    `LIMIT 5`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    doctorCode: String(row['doctor_code'] ?? ''),
    doctorName: String(row['doctor_name'] ?? 'Unknown'),
    patientCount: Number(row['patient_count'] ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Trend Summary & Extended Trend KPIs
// ---------------------------------------------------------------------------

/**
 * Trend summary statistics for a date range.
 */