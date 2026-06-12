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
