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
    `FROM ovst o LEFT JOIN kskdepartment k ON o.cur_dep = k.depcode ` +
    `WHERE o.vstdate = ${queryBuilder.currentDate(dbType)}`;
  const response = await executeSqlViaApi(sql, config);
  const rows = parseQueryResponse(response, (row) => Number(row['total'] ?? 0));
  return rows[0] ?? 0;
}

/**
 * Per-department visit counts for today, ordered by volume descending.
 */
export async function getDepartmentWorkload(
  config: ConnectionConfig,
  dbType: DatabaseType,
): Promise<DepartmentWorkload[]> {
  const sql =
    `SELECT k.depcode as department_code, k.department as department_name, COUNT(*) as visit_count ` +
    `FROM ovst o LEFT JOIN kskdepartment k ON o.cur_dep = k.depcode ` +
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
 * Aggregate overview KPI summary (all four counts fetched in parallel).
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
    `FROM ovst o LEFT JOIN kskdepartment k ON o.cur_dep = k.depcode ` +
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
export async function getDoctorWorkload(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
  depcode?: string,
): Promise<DoctorWorkload[]> {
  const depFilter = depcode
    ? ` AND o.cur_dep = '${depcode}'`
    : '';
  const sql =
    `SELECT o.doctor as doctor_code, d.name as doctor_name, COUNT(*) as patient_count ` +
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
    `AND o.cur_dep = '${depcode}' ` +
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
    `LEFT JOIN kskdepartment k ON o.cur_dep = k.depcode ` +
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
    `SELECT k.depcode as department_code, k.department as department_name, COUNT(*) as visit_count ` +
    `FROM ovst o LEFT JOIN kskdepartment k ON o.cur_dep = k.depcode ` +
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
    `SELECT od.icd10, COALESCE(i.tname, i.name, od.icd10) as diagnosis_name, COUNT(*) as visit_count ` +
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
    `SELECT COALESCE(d.name, 'ไม่ระบุ') as drug_name, ` +
    `SUM(op.qty) as total_qty, ` +
    `SUM(op.qty * op.unitprice) as total_cost ` +
    `FROM opitemrece op ` +
    `LEFT JOIN drugitems d ON op.icode = d.icode ` +
    `WHERE op.vstdate >= '${startDate}' AND op.vstdate <= '${endDate}' ` +
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

// ---------------------------------------------------------------------------
// Geographic Setup (Address Filters)
// ---------------------------------------------------------------------------

export interface AddressFilter {
  chwpart?: string
  amppart?: string
  tmbpart?: string
  moopart?: string[]
}

function buildAddressCondition(ptAlias: string, filter?: AddressFilter): string {
  if (!filter) return '';
  let cond = '';
  if (filter.chwpart) cond += ` AND ${ptAlias}.chwpart = '${filter.chwpart}'`;
  if (filter.amppart) cond += ` AND ${ptAlias}.amppart = '${filter.amppart}'`;
  if (filter.tmbpart) cond += ` AND ${ptAlias}.tmbpart = '${filter.tmbpart}'`;
  if (filter.moopart && filter.moopart.length > 0) {
    const mooList = filter.moopart.map(m => `'${m}'`).join(',');
    cond += ` AND ${ptAlias}.moopart IN (${mooList})`;
  }
  return cond;
}

export interface AreaInfo {
  code: string
  name: string
}

export async function getProvinces(config: ConnectionConfig): Promise<AreaInfo[]> {
  const sql = `SELECT chwpart as code, name FROM thaiaddress WHERE amppart='00' AND tmbpart='00' ORDER BY name`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({ code: String(row['code'] ?? ''), name: String(row['name'] ?? '') }));
}

export async function getAmphurs(config: ConnectionConfig, chwpart: string): Promise<AreaInfo[]> {
  const sql = `SELECT amppart as code, name FROM thaiaddress WHERE chwpart='${chwpart}' AND amppart<>'00' AND tmbpart='00' ORDER BY name`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({ code: String(row['code'] ?? ''), name: String(row['name'] ?? '') }));
}

export async function getTambons(config: ConnectionConfig, chwpart: string, amppart: string): Promise<AreaInfo[]> {
  const sql = `SELECT tmbpart as code, name FROM thaiaddress WHERE chwpart='${chwpart}' AND amppart='${amppart}' AND tmbpart<>'00' ORDER BY name`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({ code: String(row['code'] ?? ''), name: String(row['name'] ?? '') }));
}

export async function getVillages(config: ConnectionConfig, chwpart: string, amppart: string, tmbpart: string): Promise<AreaInfo[]> {
  const addressId = `${chwpart}${amppart}${tmbpart}`;
  const sql = `SELECT village_moo as code, village_name as name FROM village WHERE address_id='${addressId}' ORDER BY ABS(village_moo)`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({ code: String(row['code'] ?? ''), name: String(row['name'] ?? '') }));
}

// ---------------------------------------------------------------------------
// Top 20 Disease Rankings (OPD, IPD, Refer)
// ---------------------------------------------------------------------------

export interface Top20OpdDisease {
  icd10: string
  name: string
  hn: number
  vn: number
}

export interface Top20IpdDisease {
  pdx: string
  icdname: string
  pdxCount: number
}

export interface Top20ReferDisease {
  pdx: string
  icd10name: string
  ct: number
  ctHn: number
  referOpd: number
  referEr: number
  referIpd: number
}

/**
 * Top 20 OPD diagnoses by visit count (VN) for a date range.
 * Excludes Z-codes and null ICD codes.
 */
export async function getTop20OpdDiseases(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
  addressFilter?: AddressFilter,
): Promise<Top20OpdDisease[]> {
  const addressCond = buildAddressCondition('pt', addressFilter);
  const sql =
    `SELECT o.icd10, i.name, COUNT(DISTINCT o.hn) as HN, COUNT(o.vn) as VN ` +
    `FROM ovstdiag o ` +
    `INNER JOIN patient pt ON o.hn = pt.hn ` +
    `LEFT JOIN icd101 i ON o.icd10 = i.code ` +
    `WHERE o.vstdate BETWEEN '${startDate}' AND '${endDate}' ` +
    `AND i.code IS NOT NULL AND o.icd10 NOT LIKE 'Z%' ` +
    `${addressCond} ` +
    `GROUP BY i.code ` +
    `ORDER BY VN DESC ` +
    `LIMIT 20`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    icd10: String(row['icd10'] ?? ''),
    name: String(row['name'] ?? ''),
    hn: Number(row['HN'] ?? 0),
    vn: Number(row['VN'] ?? 0),
  }));
}

/**
 * Top 20 IPD diagnoses by discharge count for a date range.
 */
export async function getTop20IpdDiseases(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
  addressFilter?: AddressFilter,
): Promise<Top20IpdDisease[]> {
  const addressCond = buildAddressCondition('pt', addressFilter);
  const joinPatient = addressCond ? `INNER JOIN patient pt ON v.hn = pt.hn ` : '';
  const sql =
    `SELECT v.pdx, COUNT(v.pdx) as pdx_count, i.name as icdname ` +
    `FROM an_stat v ` +
    `${joinPatient}` +
    `LEFT JOIN icd101 i ON i.code = v.pdx ` +
    `WHERE v.dchdate BETWEEN '${startDate}' AND '${endDate}' ` +
    `AND v.pdx IS NOT NULL AND v.pdx <> '' ` +
    `${addressCond} ` +
    `GROUP BY v.pdx, i.name ` +
    `ORDER BY pdx_count DESC ` +
    `LIMIT 20`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    pdx: String(row['pdx'] ?? ''),
    icdname: String(row['icdname'] ?? ''),
    pdxCount: Number(row['pdx_count'] ?? 0),
  }));
}

/**
 * Top 20 Refer-out diagnoses by case count for a date range.
 */
export async function getTop20ReferDiseases(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
  addressFilter?: AddressFilter,
): Promise<Top20ReferDisease[]> {
  const addressCond = buildAddressCondition('pt', addressFilter);
  const joinPatient = addressCond ? `INNER JOIN patient pt ON ro.hn = pt.hn ` : '';
  const sql =
    `SELECT ro.pdx, i10.name AS ICD10, ` +
    `COUNT(ro.vn) AS ct, COUNT(DISTINCT(ro.hn)) AS ct_hn, ` +
    `SUM(IF(ro.refer_point='OPD',1,0)) AS refer_opd, ` +
    `SUM(IF(ro.refer_point='ER',1,0)) AS refer_ER, ` +
    `SUM(IF(ro.refer_point='IPD',1,0)) AS refer_IPD ` +
    `FROM referout ro ` +
    `INNER JOIN vn_stat v ON ro.vn = v.vn ` +
    `${joinPatient}` +
    `LEFT JOIN icd101 i10 ON ro.pdx = i10.code ` +
    `LEFT JOIN kskdepartment k ON ro.depcode = k.depcode ` +
    `WHERE ro.refer_date BETWEEN '${startDate}' AND '${endDate}' ` +
    `${addressCond} ` +
    `GROUP BY ro.pdx ` +
    `ORDER BY ct DESC ` +
    `LIMIT 20`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    pdx: String(row['pdx'] ?? ''),
    icd10name: String(row['ICD10'] ?? ''),
    ct: Number(row['ct'] ?? 0),
    ctHn: Number(row['ct_hn'] ?? 0),
    referOpd: Number(row['refer_opd'] ?? 0),
    referEr: Number(row['refer_ER'] ?? 0),
    referIpd: Number(row['refer_IPD'] ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Region-based Refer Overview
// ---------------------------------------------------------------------------

export interface HospitalRegionInfo {
  chwpart: string
  zone_code: string
}

export interface ReferRegionDisease {
  pdx: string
  icd10name: string
  ct: number
  referOpd: number
  referEr: number
  referIpd: number
}

/**
 * Get the hospital's province (chwpart) and health zone (zone_code).
 * Joins opdconfig with hospcode and changwat.
 */
export async function getHospitalRegionInfo(
  config: ConnectionConfig,
): Promise<HospitalRegionInfo | null> {
  try {
    const sql =
      `SELECT h.chwpart, h.region_id ` +
      `FROM opdconfig o ` +
      `LEFT JOIN hospcode h ON h.hospcode = o.hospitalcode ` +
      `LEFT JOIN thaiaddress t ON t.chwpart = h.chwpart ` +
      `LIMIT 1`;
    const response = await executeSqlViaApi(sql, config);
    const rows = parseQueryResponse(response, (row) => ({
      chwpart: String(row['chwpart'] ?? ''),
      zone_code: String(row['region_id'] ?? ''),
    }));
    
    if (rows.length > 0 && rows[0].chwpart) {
      return rows[0];
    }
  } catch (err) {
    console.error('Error fetching full hospital region info via thaiaddress', err);
  }

  // Fallback in case changwat doesn't exist or query failed
  try {
    const sql =
      `SELECT h.chwpart ` +
      `FROM opdconfig o ` +
      `LEFT JOIN hospcode h ON h.hospcode = o.hospitalcode ` +
      `LIMIT 1`;
    const response = await executeSqlViaApi(sql, config);
    const rows = parseQueryResponse(response, (row) => ({
      chwpart: String(row['chwpart'] ?? ''),
      zone_code: '', // Cannot determine zone code
    }));
    return rows[0] ?? null;
  } catch (err) {
    console.error('Error fetching minimal hospital region info', err);
    return null;
  }
}

/**
 * Top 5 Refer-out diseases by region type for a date range.
 * regionType:
 *  - 'IN_PROVINCE': h.chwpart = hospitalChwpart
 *  - 'IN_ZONE': h.chwpart <> hospitalChwpart AND c.zone_code = hospitalZoneCode
 *  - 'OUT_ZONE': c.zone_code <> hospitalZoneCode OR c.zone_code IS NULL
 */
export async function getTopReferDiseasesByRegion(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
  regionType: 'IN_PROVINCE' | 'IN_ZONE' | 'OUT_ZONE',
  hospitalChwpart: string,
  hospitalZoneCode: string,
  patientType: 'ALL' | 'OPD' | 'IPD' = 'ALL',
): Promise<ReferRegionDisease[]> {
  let regionCondition = '';
  if (regionType === 'IN_PROVINCE') {
    regionCondition = `h.chwpart = '${hospitalChwpart}'`;
  } else if (regionType === 'IN_ZONE') {
    regionCondition = `h.chwpart <> '${hospitalChwpart}' AND h.region_id = '${hospitalZoneCode}'`;
  } else if (regionType === 'OUT_ZONE') {
    regionCondition = `(h.region_id <> '${hospitalZoneCode}' OR h.region_id IS NULL)`;
  }

  const sql =
    `SELECT ro.pdx, i10.name AS ICD10, ` +
    `COUNT(ro.vn) AS ct, ` +
    `SUM(IF(ro.refer_point='OPD',1,0)) AS refer_opd, ` +
    `SUM(IF(ro.refer_point='ER',1,0)) AS refer_ER, ` +
    `SUM(IF(ro.refer_point='IPD',1,0)) AS refer_IPD ` +
    `FROM referout ro ` +
    `LEFT JOIN hospcode h ON ro.hospcode = h.hospcode ` +
    `LEFT JOIN icd101 i10 ON ro.pdx = i10.code ` +
    `WHERE ro.refer_date BETWEEN '${startDate}' AND '${endDate}' ` +
    `AND ${regionCondition} ` +
    (patientType === 'OPD' ? `AND ro.refer_point IN ('OPD', 'ER') ` : '') +
    (patientType === 'IPD' ? `AND ro.refer_point = 'IPD' ` : '') +
    `GROUP BY ro.pdx, i10.name ` +
    `ORDER BY ct DESC ` +
    `LIMIT 5`;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    pdx: String(row['pdx'] ?? ''),
    icd10name: String(row['ICD10'] ?? ''),
    ct: Number(row['ct'] ?? 0),
    referOpd: Number(row['refer_opd'] ?? 0),
    referEr: Number(row['refer_ER'] ?? 0),
    referIpd: Number(row['refer_IPD'] ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Refer Summary Counts
// ---------------------------------------------------------------------------

export interface ReferSummaryCounts {
  inProvince: number
  inZone: number
  outZone: number
  total: number
}

export async function getReferSummaryCounts(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
  hospitalChwpart: string,
  hospitalZoneCode: string,
  patientType: 'ALL' | 'OPD' | 'IPD' = 'ALL',
): Promise<ReferSummaryCounts> {
  const patientCondition = 
    patientType === 'OPD' ? `AND ro.refer_point IN ('OPD', 'ER') ` :
    patientType === 'IPD' ? `AND ro.refer_point = 'IPD' ` : '';

  const sql =
    `SELECT ` +
    `SUM(IF(h.chwpart = '${hospitalChwpart}', 1, 0)) as in_province, ` +
    `SUM(IF(h.chwpart <> '${hospitalChwpart}' AND h.region_id = '${hospitalZoneCode}', 1, 0)) as in_zone, ` +
    `SUM(IF(h.region_id <> '${hospitalZoneCode}' OR h.region_id IS NULL, 1, 0)) as out_zone ` +
    `FROM referout ro ` +
    `LEFT JOIN hospcode h ON ro.hospcode = h.hospcode ` +
    `WHERE ro.refer_date BETWEEN '${startDate}' AND '${endDate}' ` +
    `${patientCondition}`;
    
  const response = await executeSqlViaApi(sql, config);
  let inProv = 0, inZn = 0, outZn = 0;
  if (response.data && response.data.length > 0) {
    const row = response.data[0];
    inProv = Number(row['in_province'] ?? 0);
    inZn = Number(row['in_zone'] ?? 0);
    outZn = Number(row['out_zone'] ?? 0);
  }
  return {
    inProvince: inProv,
    inZone: inZn,
    outZone: outZn,
    total: inProv + inZn + outZn
  };
}

// ---------------------------------------------------------------------------
// Refer Trend
// ---------------------------------------------------------------------------

export interface ReferTrendData {
  date: string
  referOpd: number
  referEr: number
  referIpd: number
  total: number
}

export async function getReferTrend(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
  patientType: 'ALL' | 'OPD' | 'IPD' = 'ALL',
): Promise<ReferTrendData[]> {
  const dateExpr = queryBuilder.dateFormat(dbType, 'ro.refer_date', '%Y-%m-%d');
  
  const patientCondition = 
    patientType === 'OPD' ? `AND ro.refer_point IN ('OPD', 'ER') ` :
    patientType === 'IPD' ? `AND ro.refer_point = 'IPD' ` : '';

  const sql =
    `SELECT ${dateExpr} as refer_date, ` +
    `SUM(IF(ro.refer_point='OPD', 1, 0)) as refer_opd, ` +
    `SUM(IF(ro.refer_point='ER', 1, 0)) as refer_er, ` +
    `SUM(IF(ro.refer_point='IPD', 1, 0)) as refer_ipd ` +
    `FROM referout ro ` +
    `WHERE ro.refer_date BETWEEN '${startDate}' AND '${endDate}' ` +
    `${patientCondition}` +
    `GROUP BY ${dateExpr} ` +
    `ORDER BY refer_date ASC`;

  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => {
    const referOpd = Number(row['refer_opd'] ?? 0);
    const referEr = Number(row['refer_er'] ?? 0);
    const referIpd = Number(row['refer_ipd'] ?? 0);
    return {
      date: String(row['refer_date'] ?? ''),
      referOpd,
      referEr,
      referIpd,
      total: referOpd + referEr + referIpd,
    };
  });
}

// ---------------------------------------------------------------------------
// Refer Out-of-zone Details
// ---------------------------------------------------------------------------

export interface ReferOutZoneDetail {
  hospcode: string
  hospname: string
  pdx: string
  icd10name: string
  count: number
}

/**
 * Get detailed Refer-out data for hospitals outside the health zone, 
 * grouped by hospital and disease group.
 */
export async function getReferOutZoneDetail(
  config: ConnectionConfig,
  _dbType: DatabaseType,
  startDate: string,
  endDate: string,
  hospitalZoneCode: string,
  patientType: 'ALL' | 'OPD' | 'IPD' = 'ALL',
): Promise<ReferOutZoneDetail[]> {
  const patientCondition = 
    patientType === 'OPD' ? `AND ro.refer_point IN ('OPD', 'ER') ` :
    patientType === 'IPD' ? `AND ro.refer_point = 'IPD' ` : '';

  const sql =
    `SELECT ro.hospcode, h.name as hospname, ro.pdx, i10.name as icd10name, COUNT(ro.vn) as ct ` +
    `FROM referout ro ` +
    `LEFT JOIN hospcode h ON ro.hospcode = h.hospcode ` +
    `LEFT JOIN icd101 i10 ON ro.pdx = i10.code ` +
    `WHERE ro.refer_date BETWEEN '${startDate}' AND '${endDate}' ` +
    `AND (h.region_id <> '${hospitalZoneCode}' OR h.region_id IS NULL) ` +
    `${patientCondition} ` +
    `GROUP BY ro.hospcode, h.name, ro.pdx, i10.name ` +
    `ORDER BY ct DESC`;

  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    hospcode: String(row['hospcode'] ?? ''),
    hospname: String(row['hospname'] ?? 'ไม่ระบุ'),
    pdx: String(row['pdx'] ?? ''),
    icd10name: String(row['icd10name'] ?? ''),
    count: Number(row['ct'] ?? 0),
  }));
}
