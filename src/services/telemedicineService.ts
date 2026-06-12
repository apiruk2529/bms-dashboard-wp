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

export interface TelemedicineSummary {
  telemedicineVisits: number;
  totalOpVisits: number;
  telemedicineRate: number;
}

export interface TelemedicineMonthlyTrend {
  month: string;
  telemedicineVisits: number;
  totalOpVisits: number;
}

export interface TelemedicinePayerType {
  pttypeName: string;
  count: number;
}

export interface TelemedicineVisitType {
  visitTypeName: string;
  count: number;
}

export async function getTelemedicineSummary(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<TelemedicineSummary> {
  const sql = `
    SELECT 
      COUNT(CASE WHEN o1.export_code = '5' THEN 1 END) as telemedicine_visits,
      COUNT(CASE WHEN o1.export_code IN ('2', '3', '5') THEN 1 END) as total_op_visits
    FROM ovst o
    INNER JOIN ovstist o1 ON o.ovstist = o1.ovstist
    WHERE o.vstdate BETWEEN '${startDate}' AND '${endDate}'
      AND o1.export_code IN ('2', '3', '5')
  `;

  const response = await executeSqlViaApi(sql, config);
  const data = parseQueryResponse(response, (r) => ({
    telemedicineVisits: Number(r['telemedicine_visits'] ?? 0),
    totalOpVisits: Number(r['total_op_visits'] ?? 0),
  }))[0] ?? { telemedicineVisits: 0, totalOpVisits: 0 };

  return {
    telemedicineVisits: data.telemedicineVisits,
    totalOpVisits: data.totalOpVisits,
    telemedicineRate: data.totalOpVisits > 0 ? (data.telemedicineVisits / data.totalOpVisits) * 100 : 0,
  };
}

export async function getTelemedicineMonthlyTrend(
  config: ConnectionConfig,
  dbType: DatabaseType,
  startDate: string,
  endDate: string,
): Promise<TelemedicineMonthlyTrend[]> {
  const monthExpr = queryBuilder.dateFormat(dbType, 'o.vstdate', '%Y-%m');
  
  const sql = `
    SELECT 
      ${monthExpr} as month_val,
      COUNT(CASE WHEN o1.export_code = '5' THEN 1 END) as telemedicine_visits,
      COUNT(CASE WHEN o1.export_code IN ('2', '3', '5') THEN 1 END) as total_op_visits
    FROM ovst o
    INNER JOIN ovstist o1 ON o.ovstist = o1.ovstist
    WHERE o.vstdate BETWEEN '${startDate}' AND '${endDate}'
      AND o1.export_code IN ('2', '3', '5')
    GROUP BY ${monthExpr}
    ORDER BY month_val ASC
  `;

  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (r) => ({
    month: String(r['month_val'] ?? ''),
    telemedicineVisits: Number(r['telemedicine_visits'] ?? 0),
    totalOpVisits: Number(r['total_op_visits'] ?? 0),
  }));
}

export async function getTelemedicineByPayerType(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<TelemedicinePayerType[]> {
  const sql = `
    SELECT 
      COALESCE(pt.name, 'ไม่ระบุสิทธิ์') as pttype_name,
      COUNT(*) as visit_count
    FROM ovst o
    INNER JOIN ovstist o1 ON o.ovstist = o1.ovstist
    LEFT OUTER JOIN kskdepartment ON o.main_dep = kskdepartment.depcode
    LEFT OUTER JOIN pttype pt ON o.pttype = pt.pttype
    WHERE o.vstdate BETWEEN '${startDate}' AND '${endDate}' 
      AND o1.export_code = '5'
    GROUP BY o.pttype, pt.name
    ORDER BY visit_count DESC
  `;

  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (r) => ({
    pttypeName: String(r['pttype_name'] ?? 'ไม่ระบุสิทธิ์'),
    count: Number(r['visit_count'] ?? 0),
  }));
}

export async function getTelemedicineByVisitType(
  config: ConnectionConfig,
  startDate: string,
  endDate: string,
): Promise<TelemedicineVisitType[]> {
  const sql = `
    SELECT 
      CONCAT(COALESCE(o1.name, 'ไม่ระบุ'), ' (', o1.export_code, ')') as visit_type_name,
      COUNT(*) as visit_count
    FROM ovst o
    INNER JOIN ovstist o1 ON o.ovstist = o1.ovstist
    LEFT OUTER JOIN kskdepartment ON o.main_dep = kskdepartment.depcode
    LEFT OUTER JOIN pttype pt ON o.pttype = pt.pttype
    WHERE o.vstdate BETWEEN '${startDate}' AND '${endDate}' 
      AND o1.export_code IN ('2', '3', '5')
    GROUP BY o1.ovstist, o1.name, o1.export_code
    ORDER BY visit_count DESC
  `;

  const response = await executeSqlViaApi(sql, config);
  return parseQueryResponse(response, (r) => ({
    visitTypeName: String(r['visit_type_name'] ?? 'ไม่ระบุ'),
    count: Number(r['visit_count'] ?? 0),
  }));
}
