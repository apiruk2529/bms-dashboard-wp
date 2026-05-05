// @ts-nocheck
import { queryBuilder } from '@/services/queryBuilder'
import { executeSqlViaApi } from '@/services/bmsSession'
import type { ConnectionConfig, DatabaseType } from '@/types'

// Helper for parsing
function parseQueryResponse<T>(
  response: any,
  mapper: (row: Record<string, unknown>) => T,
): T[] {
  if (!response.data || !Array.isArray(response.data)) {
    return []
  }
  return response.data.map(mapper)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TtmFinancialSummary {
  totalServiceValue: number;
  totalHerbalValue: number;
  totalRevenue: number;
  totalSessions: number;
  uniquePatients: number;
  avgRevenuePerSession: number;
}

export interface TtmMonthlyTrend {
  month: string;
  totalServiceRevenue: number;
  totalDrugRevenue: number;
}

export interface TtmServiceTypeSummary {
  serviceCode: string;
  serviceName: string;
  sessionCount: number;
  totalValue: number;
  uniquePatients: number;
}

export interface TtmDoctorWorkload {
  doctorCode: string;
  doctorName: string;
  sessionCount: number;
  uniquePatients: number;
  totalValue: number;
}

export interface TtmPatientAgeGroup {
  ageGroup: string;
  count: number;
}

export interface TtmRevenueByPayerType {
  pttype: string;
  pttypeName: string;
  sessionCount: number;
  totalValue: number;
}

export interface TtmDiagnosisDistribution {
  icd10: string;
  diagnosisName: string;
  count: number;
}

export interface TtmMonthlyDoctorTrend {
  date: string;
  sessionCount: number;
  uniquePatients: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function getTtmFinancialSummary(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<TtmFinancialSummary> {
  // Service Revenue
  const sqlSvc = `
    SELECT 
      COUNT(h1.health_med_service_id) AS session_count,
      COUNT(DISTINCT h2.hn) AS unique_patients,
      COALESCE(SUM(h1.service_price), 0) AS total_service_value
    FROM health_med_service_operation h1
    JOIN health_med_service h2 ON h2.health_med_service_id = h1.health_med_service_id
    WHERE h2.service_date BETWEEN '${startDate}' AND '${endDate}'
  `;
  
  // Herbal Drug Revenue
  const sqlDrug = `
    SELECT COALESCE(SUM(op.qty * op.unitprice), 0) AS total_drug_value
    FROM opitemrece op
    JOIN drugitems d ON d.icode = op.icode
    WHERE d.drugcategory LIKE '%สมุนไพร%'
      AND op.vstdate BETWEEN '${startDate}' AND '${endDate}'
  `;

  const [svcRes, drugRes] = await Promise.all([
    executeSqlViaApi(sqlSvc, config).catch(() => ({ data: [] })),
    executeSqlViaApi(sqlDrug, config).catch(() => ({ data: [] }))
  ]);

  const svcData = parseQueryResponse(svcRes, (r) => ({
    sessionCount: Number(r['session_count'] ?? 0),
    uniquePatients: Number(r['unique_patients'] ?? 0),
    totalServiceValue: Number(r['total_service_value'] ?? 0),
  }))[0] ?? { sessionCount: 0, uniquePatients: 0, totalServiceValue: 0 };

  const drugData = parseQueryResponse(drugRes, (r) => ({
    totalDrugValue: Number(r['total_drug_value'] ?? 0)
  }))[0] ?? { totalDrugValue: 0 };

  return {
    totalServiceValue: svcData.totalServiceValue,
    totalHerbalValue: drugData.totalDrugValue,
    totalRevenue: svcData.totalServiceValue + drugData.totalDrugValue,
    totalSessions: svcData.sessionCount,
    uniquePatients: svcData.uniquePatients,
    avgRevenuePerSession: svcData.sessionCount > 0 ? (svcData.totalServiceValue + drugData.totalDrugValue) / svcData.sessionCount : 0
  };
}

export async function getTtmMonthlyTrend(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<TtmMonthlyTrend[]> {
  const monthExprSvc = queryBuilder.dateFormat(dbType, 'h2.service_date', '%Y-%m');
  const sqlSvc = `
    SELECT ${monthExprSvc} as month_val, COALESCE(SUM(h1.service_price), 0) as total_service
    FROM health_med_service_operation h1
    JOIN health_med_service h2 ON h2.health_med_service_id = h1.health_med_service_id
    WHERE h2.service_date BETWEEN '${startDate}' AND '${endDate}'
    GROUP BY ${monthExprSvc}
  `;

  const monthExprDrug = queryBuilder.dateFormat(dbType, 'op.vstdate', '%Y-%m');
  const sqlDrug = `
    SELECT ${monthExprDrug} as month_val, COALESCE(SUM(op.qty * op.unitprice), 0) as total_drug
    FROM opitemrece op
    JOIN drugitems d ON d.icode = op.icode
    WHERE d.drugcategory LIKE '%สมุนไพร%' AND op.vstdate BETWEEN '${startDate}' AND '${endDate}'
    GROUP BY ${monthExprDrug}
  `;

  const [svcRes, drugRes] = await Promise.all([
    executeSqlViaApi(sqlSvc, config).catch(() => ({ data: [] })),
    executeSqlViaApi(sqlDrug, config).catch(() => ({ data: [] }))
  ]);

  const svcData = parseQueryResponse(svcRes, r => ({
    month: String(r['month_val']),
    val: Number(r['total_service'])
  }));

  const drugData = parseQueryResponse(drugRes, r => ({
    month: String(r['month_val']),
    val: Number(r['total_drug'])
  }));

  const map = new Map<string, TtmMonthlyTrend>();
  
  svcData.forEach(d => {
    map.set(d.month, { month: d.month, totalServiceRevenue: d.val, totalDrugRevenue: 0 });
  });
  
  drugData.forEach(d => {
    if (!map.has(d.month)) {
      map.set(d.month, { month: d.month, totalServiceRevenue: 0, totalDrugRevenue: 0 });
    }
    map.get(d.month)!.totalDrugRevenue = d.val;
  });

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export async function getTtmServiceTypeSummary(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<TtmServiceTypeSummary[]> {
  const sql = `
    SELECT 
      h1.health_med_operation_item_id AS service_code, 
      COALESCE(h3.health_med_operation_item_name, 'ไม่ระบุ') AS service_name, 
      COUNT(h1.health_med_service_id) AS session_count, 
      COALESCE(SUM(h1.service_price), 0) AS total_value, 
      COUNT(DISTINCT h2.hn) AS unique_patients 
    FROM health_med_service_operation h1 
    JOIN health_med_service h2 ON h2.health_med_service_id = h1.health_med_service_id 
    LEFT JOIN health_med_operation_item h3 ON h3.health_med_operation_item_id = h1.health_med_operation_item_id 
    WHERE h2.service_date BETWEEN '${startDate}' AND '${endDate}' 
    GROUP BY h1.health_med_operation_item_id, h3.health_med_operation_item_name 
    ORDER BY session_count DESC 
    LIMIT 10
  `;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    serviceCode: String(row['service_code'] ?? ''),
    serviceName: String(row['service_name'] ?? 'ไม่ระบุ'),
    sessionCount: Number(row['session_count'] ?? 0),
    totalValue: Number(row['total_value'] ?? 0),
    uniquePatients: Number(row['unique_patients'] ?? 0),
  }));
}

export async function getTtmDoctorWorkload(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<TtmDoctorWorkload[]> {
  const sql = `
    SELECT 
      h1.health_med_provider_id AS doctor_code, 
      COALESCE(h4.health_med_provider_full_name, h1.health_med_provider_id, 'ไม่ระบุ') AS doctor_name, 
      COUNT(h1.health_med_provider_id) AS session_count, 
      COUNT(DISTINCT h2.hn) AS unique_patients, 
      COALESCE(SUM(h1.service_price), 0) AS total_value 
    FROM health_med_service_operation h1 
    JOIN health_med_service h2 ON h2.health_med_service_id = h1.health_med_service_id 
    JOIN health_med_provider h4 ON h4.health_med_provider_id = h1.health_med_provider_id 
    WHERE h2.service_date BETWEEN '${startDate}' AND '${endDate}' 
    GROUP BY h1.health_med_provider_id, h4.health_med_provider_full_name 
    ORDER BY session_count DESC 
    LIMIT 15
  `;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    doctorCode: String(row['doctor_code'] ?? ''),
    doctorName: String(row['doctor_name'] ?? 'ไม่ระบุ'),
    sessionCount: Number(row['session_count'] ?? 0),
    uniquePatients: Number(row['unique_patients'] ?? 0),
    totalValue: Number(row['total_value'] ?? 0),
  }));
}

export async function getTtmPatientAgeGroups(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<TtmPatientAgeGroup[]> {
  const age = queryBuilder.ageCalc(dbType, 'p.birthday');
  const sql = `
    SELECT 
      CASE 
        WHEN ${age} < 15 THEN 'เด็ก (<15)' 
        WHEN ${age} < 25 THEN 'วัยรุ่น (15-24)' 
        WHEN ${age} < 40 THEN 'วัยทำงานตอนต้น (25-39)' 
        WHEN ${age} < 60 THEN 'วัยกลางคน (40-59)' 
        ELSE 'ผู้สูงอายุ (>=60)' 
      END AS age_group, 
      COUNT(DISTINCT s.hn) AS cnt 
    FROM health_med_service s 
    INNER JOIN patient p ON s.hn = p.hn 
    WHERE s.service_date BETWEEN '${startDate}' AND '${endDate}' 
      AND p.birthday IS NOT NULL 
    GROUP BY age_group 
    ORDER BY cnt DESC
  `;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    ageGroup: String(row['age_group'] ?? ''),
    count: Number(row['cnt'] ?? 0),
  }));
}

export async function getTtmRevenueByPayerType(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<TtmRevenueByPayerType[]> {
  const sql = `
    SELECT 
      v.pttype, 
      COALESCE(pt.name, v.pttype, 'ไม่ระบุ') AS pttype_name, 
      COUNT(DISTINCT h2.health_med_service_id) AS session_count, 
      COALESCE(SUM(h1.service_price), 0) AS total_value 
    FROM health_med_service_operation h1 
    JOIN health_med_service h2 ON h2.health_med_service_id = h1.health_med_service_id 
    LEFT JOIN vn_stat v ON h2.vn = v.vn 
    LEFT JOIN pttype pt ON v.pttype = pt.pttype 
    WHERE h2.service_date BETWEEN '${startDate}' AND '${endDate}' 
    GROUP BY v.pttype, pt.name 
    ORDER BY total_value DESC 
    LIMIT 10
  `;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    pttype: String(row['pttype'] ?? ''),
    pttypeName: String(row['pttype_name'] ?? 'ไม่ระบุ'),
    sessionCount: Number(row['session_count'] ?? 0),
    totalValue: Number(row['total_value'] ?? 0),
  }));
}

export async function getTtmDiagnosisDistribution(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<TtmDiagnosisDistribution[]> {
  const sql = `
    SELECT 
      o.icd10, 
      COALESCE(i.tname, i.name, o.icd10, 'ไม่ระบุ') AS diagnosis_name, 
      COUNT(s.health_med_service_id) AS cnt 
    FROM health_med_service s 
    LEFT JOIN ovstdiag o ON s.vn = o.vn 
    LEFT JOIN icd101 i ON o.icd10 = i.code 
    WHERE s.service_date BETWEEN '${startDate}' AND '${endDate}' 
      AND o.icd10 IS NOT NULL AND o.icd10 <> '' 
    GROUP BY o.icd10, i.tname, i.name 
    ORDER BY cnt DESC 
    LIMIT 15
  `;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    icd10: String(row['icd10'] ?? ''),
    diagnosisName: String(row['diagnosis_name'] ?? 'ไม่ระบุ'),
    count: Number(row['cnt'] ?? 0),
  }));
}

export async function getTtmDailyTrend(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<TtmMonthlyDoctorTrend[]> {
  const dateExpr = queryBuilder.dateFormat(dbType, 'h2.service_date', '%Y-%m-%d');
  const sql = `
    SELECT ${dateExpr} AS visit_date, 
      COUNT(DISTINCT h2.health_med_service_id) AS session_count, 
      COUNT(DISTINCT h2.hn) AS unique_patients 
    FROM health_med_service_operation h1 
    JOIN health_med_service h2 ON h2.health_med_service_id = h1.health_med_service_id 
    WHERE h2.service_date BETWEEN '${startDate}' AND '${endDate}' 
    GROUP BY ${dateExpr} 
    ORDER BY visit_date ASC
  `;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    date: String(row['visit_date'] ?? ''),
    sessionCount: Number(row['session_count'] ?? 0),
    uniquePatients: Number(row['unique_patients'] ?? 0),
  }));
}

export async function getTtmTopHerbalDrugs(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<{ icode: string; drugName: string; totalQty: number; totalCost: number }[]> {
  const sql = `
    SELECT op.icode, 
      COALESCE(d.name, op.icode, 'ไม่ระบุ') AS drug_name, 
      SUM(op.qty) AS total_qty, 
      SUM(op.qty * op.unitprice) AS total_cost 
    FROM opitemrece op 
    JOIN drugitems d ON d.icode = op.icode 
    WHERE d.drugcategory LIKE '%สมุนไพร%' 
      AND op.vstdate BETWEEN '${startDate}' AND '${endDate}' 
    GROUP BY op.icode, d.name 
    ORDER BY total_cost DESC 
    LIMIT 10
  `;
  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (row) => ({
    icode: String(row['icode'] ?? ''),
    drugName: String(row['drug_name'] ?? 'ไม่ระบุ'),
    totalQty: Number(row['total_qty'] ?? 0),
    totalCost: Number(row['total_cost'] ?? 0),
  }));
}
