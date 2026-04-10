// import { queryBuilder } from '@/services/queryBuilder'
import { executeSqlViaApi } from '@/services/bmsSession'
import type { ConnectionConfig } from '@/types'

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

export interface NcdRegistrationSummary {
  dmCount: number
  htCount: number
  comorbidCount: number // Has both DM and HT
}

export interface NcdKpiControl {
  dmTotalTested: number
  dmWellControlled: number
  htTotalTested: number
  htWellControlled: number
}

export interface NcdScreeningRates {
  totalTarget: number // Baseline NCD active count
  eyeScreened: number
  footScreened: number
  kidneyScreened: number
}

export interface GeographicDensity {
  provName: string
  ampName: string
  tmbName: string
  moo: string
  mooName: string
  patientCount: number
}

export interface PatientAddressDistribution {
  address: string
  count: number
}

export interface TreemapNode {
  name: string
  value: number
  color?: string
  children?: TreemapNode[]
}

export interface HierarchicalPatientData {
  name: string
  children: {
    name: string // Province
    children: {
      name: string // Address/Area
      value: number // Patient count
      disease: string // DM or HT
    }[]
  }[]
}

// ---------------------------------------------------------------------------
// Registration Summary
// ---------------------------------------------------------------------------

export async function getNcdRegistrationSummary(
  config: ConnectionConfig,
): Promise<NcdRegistrationSummary> {
  const sql = `
    SELECT 
      SUM(CASE WHEN is_dm = 1 AND is_ht = 0 THEN 1 ELSE 0 END) as dm_only,
      SUM(CASE WHEN is_dm = 0 AND is_ht = 1 THEN 1 ELSE 0 END) as ht_only,
      SUM(CASE WHEN is_dm = 1 AND is_ht = 1 THEN 1 ELSE 0 END) as comorbid
    FROM (
      SELECT 
        cm.hn,
        MAX(CASE WHEN c.name LIKE '%เบาหวาน%' THEN 1 ELSE 0 END) as is_dm,
        MAX(CASE WHEN c.name LIKE '%ความดัน%' THEN 1 ELSE 0 END) as is_ht
      FROM clinicmember cm
      INNER JOIN clinic c ON cm.clinic = c.clinic
      WHERE cm.clinic_member_status_id IN (5) /* 5=ยังรักษาอยู่ */
      GROUP BY cm.hn
    ) as p
  `

  const response = await executeSqlViaApi(sql, config)
  const rows = parseQueryResponse(response, (row) => ({
    dmCount: Number(row['dm_only'] ?? 0) + Number(row['comorbid'] ?? 0),
    htCount: Number(row['ht_only'] ?? 0) + Number(row['comorbid'] ?? 0),
    comorbidCount: Number(row['comorbid'] ?? 0)
  }))

  return rows[0] ?? { dmCount: 0, htCount: 0, comorbidCount: 0 }
}

// ---------------------------------------------------------------------------
// KPI Control (HbA1c & BP)
// ---------------------------------------------------------------------------

export async function getNcdKpiControl(
  config: ConnectionConfig,
  fiscalStart: string, // e.g. '2025-10-01'
  fiscalEnd: string,   // e.g. '2026-09-30'
): Promise<NcdKpiControl> {

  // 1. HbA1c ล่าสุดในปีงบประมาณ สำหรับผู้ป่วยเบาหวาน
  const dmSqlClean = `
    SELECT
      COUNT(*) as tested,
      SUM(CASE WHEN hba1c_val < 7 THEN 1 ELSE 0 END) as controlled
    FROM (
      SELECT lh.hn,
             MAX(CAST(lo.lab_order_result AS DECIMAL(10,2))) as hba1c_val
      FROM lab_order lo
      INNER JOIN lab_head lh ON lo.lab_order_number = lh.lab_order_number
      INNER JOIN lab_items li ON lo.lab_items_code = li.lab_items_code
      INNER JOIN clinicmember cm ON lh.hn = cm.hn
      INNER JOIN clinic c ON cm.clinic = c.clinic
      WHERE c.name LIKE '%เบาหวาน%'
        AND li.lab_items_name LIKE '%HbA1c%'
        AND lh.order_date BETWEEN '${fiscalStart}' AND '${fiscalEnd}'
      GROUP BY lh.hn
    ) as stats
  `;

  // 2. BP ล่าสุดในปีงบประมาณ สำหรับผู้ป่วยความดัน
  const htSqlClean = `
    SELECT
      COUNT(*) as tested,
      SUM(CASE WHEN bps < 140 AND bpd < 90 THEN 1 ELSE 0 END) as controlled
    FROM (
      SELECT o.hn,
             MIN(o.bps) as bps,
             MIN(o.bpd) as bpd
      FROM opdscreen o
      INNER JOIN clinicmember cm ON o.hn = cm.hn
      INNER JOIN clinic c ON cm.clinic = c.clinic
      WHERE c.name LIKE '%ความดัน%'
        AND o.vstdate BETWEEN '${fiscalStart}' AND '${fiscalEnd}'
        AND o.bps > 0 AND o.bpd > 0
      GROUP BY o.hn
    ) as stats
  `;

  const [dmRes, htRes] = await Promise.all([
    executeSqlViaApi(dmSqlClean, config).catch(() => ({ data: [] })),
    executeSqlViaApi(htSqlClean, config).catch(() => ({ data: [] }))
  ]);

  const dmData = parseQueryResponse(dmRes, (r) => ({
    tested: Number(r['tested'] ?? 0),
    controlled: Number(r['controlled'] ?? 0)
  }))[0] ?? { tested: 0, controlled: 0 };

  const htData = parseQueryResponse(htRes, (r) => ({
    tested: Number(r['tested'] ?? 0),
    controlled: Number(r['controlled'] ?? 0)
  }))[0] ?? { tested: 0, controlled: 0 };

  return {
    dmTotalTested: dmData.tested,
    dmWellControlled: dmData.controlled,
    htTotalTested: htData.tested,
    htWellControlled: htData.controlled
  }
}

// ---------------------------------------------------------------------------
// Screening Rates
// ---------------------------------------------------------------------------

export async function getNcdScreeningRates(
  config: ConnectionConfig,
  fiscalStart: string, // e.g. '2025-10-01'
  fiscalEnd: string,   // e.g. '2026-09-30'
): Promise<NcdScreeningRates> {
  // Get active targets (Total NCD patients)
  const targetSql = `
    SELECT COUNT(DISTINCT cm.hn) as total
    FROM clinicmember cm
    INNER JOIN clinic c ON cm.clinic = c.clinic
    WHERE (c.name LIKE '%เบาหวาน%' OR c.name LIKE '%ความดัน%')
      AND cm.clinic_member_status_id IN (5)
  `

  // Eye Screening - ในปีงบประมาณ
  const eyeSql = `
    SELECT COUNT(DISTINCT c.hn) as total
    FROM clinicmember_cormobidity_screen c
    INNER JOIN clinicmember_cormobidity_eye_screen d ON c.clinicmember_cormobidity_screen_id = d.clinicmember_cormobidity_screen_id
    WHERE c.screen_date BETWEEN '${fiscalStart}' AND '${fiscalEnd}'
  `

  // Foot Screening - ในปีงบประมาณ
  const footSql = `
    SELECT COUNT(DISTINCT c.hn) as total
    FROM clinicmember_cormobidity_screen c
    INNER JOIN clinicmember_cormobidity_foot_screen f ON c.clinicmember_cormobidity_screen_id = f.clinicmember_cormobidity_screen_id
    WHERE c.screen_date BETWEEN '${fiscalStart}' AND '${fiscalEnd}'
  `

  // Kidney Screening - นับจากผลแล็บ Creatinine ของผู้ป่วยเบาหวาน/ความดัน
  const kidneySql = `
    SELECT COUNT(DISTINCT lh.hn) as total
    FROM lab_order lo
    INNER JOIN lab_head lh ON lo.lab_order_number = lh.lab_order_number
    INNER JOIN lab_items li ON lo.lab_items_code = li.lab_items_code
    INNER JOIN clinicmember cm ON lh.hn = cm.hn
    INNER JOIN clinic c ON cm.clinic = c.clinic
    WHERE (c.name LIKE '%เบาหวาน%' OR c.name LIKE '%ความดัน%')
      AND li.lab_items_name LIKE '%Creatin%'
      AND lh.order_date BETWEEN '${fiscalStart}' AND '${fiscalEnd}'
  `

  const [targetRes, eyeRes, footRes, kidneyRes] = await Promise.all([
    executeSqlViaApi(targetSql, config).catch(() => ({ data: [] })),
    executeSqlViaApi(eyeSql, config).catch(() => ({ data: [] })),
    executeSqlViaApi(footSql, config).catch(() => ({ data: [] })),
    executeSqlViaApi(kidneySql, config).catch(() => ({ data: [] }))
  ]);

  const extractTotal = (res: any) => {
    const raw = parseQueryResponse(res, r => Number(r['total'] ?? 0));
    return raw[0] ?? 0;
  }

  return {
    totalTarget: extractTotal(targetRes),
    eyeScreened: extractTotal(eyeRes),
    footScreened: extractTotal(footRes),
    kidneyScreened: extractTotal(kidneyRes)
  }
}

// ---------------------------------------------------------------------------
// Geographic Mapping Density
// ---------------------------------------------------------------------------

// Helper to extract field value by name using field_name array
function getFieldValue(row: any, fieldIndex: number, response: any): unknown {
  // If row is an array, use index directly
  if (Array.isArray(row)) {
    return row[fieldIndex];
  }
  // If row is object, try to get by field name
  if (typeof row === 'object' && response.field_name?.[fieldIndex]) {
    return row[response.field_name[fieldIndex]];
  }
  // Fallback: try common properties
  return row[fieldIndex];
}

export async function getNcdGeographicDensity(
  config: ConnectionConfig,
): Promise<GeographicDensity[]> {
  const sql = `
    SELECT
      IFNULL(TRIM(p.moopart), '??') as moopart,
      t.name as tmb_name,
      COUNT(DISTINCT p.hn) as count,
      tAmp.name as amp_name,
      tProv.name as province_name
    FROM clinicmember cm
    INNER JOIN clinic c ON cm.clinic = c.clinic
    INNER JOIN patient p ON cm.hn = p.hn
    LEFT JOIN thaiaddress t ON p.chwpart = t.chwpart AND p.amppart = t.amppart AND p.tmbpart = t.tmbpart
    LEFT JOIN thaiaddress tAmp ON p.chwpart = tAmp.chwpart AND p.amppart = tAmp.amppart AND tAmp.tmbpart = '00'
    LEFT JOIN thaiaddress tProv ON p.chwpart = tProv.chwpart AND tProv.amppart = '00' AND tProv.tmbpart = '00'
    WHERE (c.name LIKE '%เบาหวาน%' OR c.name LIKE '%ความดัน%')
      AND cm.clinic_member_status_id IN (5)
      AND p.chwpart IS NOT NULL AND p.chwpart <> ''
      AND p.amppart IS NOT NULL
    GROUP BY t.chwpart, tProv.name, t.amppart, tAmp.name, t.tmbpart, t.name, p.moopart
    ORDER BY count DESC
    LIMIT 100
  `

  const response = await executeSqlViaApi(sql, config)
  
  // Debug: Log complete response structure to diagnose field mapping
  if (response.data && response.data.length > 0) {
    const firstRow = response.data[0];
    const secondRow = response.data[1];
    
    console.debug('[getNcdGeographicDensity] Complete API Response Debug:', {
      totalRecords: response.data.length,
      fieldNames: response.field_name,
      fieldNamesCount: response.field_name?.length,
      firstRowKeys: firstRow ? Object.keys(firstRow) : 'NO_DATA',
      firstRowValues: firstRow,
      secondRowValues: secondRow,
      firstRowEntries: firstRow ? Object.entries(firstRow) : 'NO_DATA',
      firstRowAsJson: firstRow ? JSON.stringify(firstRow) : 'NO_DATA'
    });
    
    // Print field-to-column mapping
    const fieldNames = response.field_name || [];
    console.debug('[getNcdGeographicDensity] Field Position Mapping:', {
      0: fieldNames[0],
      1: fieldNames[1],
      2: fieldNames[2],
      3: fieldNames[3],
      4: fieldNames[4]
    });
  }

  // Find column indices from field_name array
  const fieldNames = response.field_name || [];
  const fieldMap: Record<string, number> = {};
  const expectedFields = ['moopart', 'tmb_name', 'count', 'amp_name', 'province_name'];
  
  expectedFields.forEach(fname => {
    fieldMap[fname] = fieldNames.indexOf(fname);
  });

  console.debug('[getNcdGeographicDensity] Field mapping indices:', fieldMap);
  console.debug('[getNcdGeographicDensity] Expected order: 0:moopart, 1:tmb_name, 2:count, 3:amp_name, 4:province_name');

  if (!response.data || !Array.isArray(response.data)) {
    return [];
  }

  const results = response.data.map((r: any, rowIdx: number) => {
    // Extract values using field mapping
    const mooIdx = fieldMap['moopart'];
    const tmbIdx = fieldMap['tmb_name'];
    const countIdx = fieldMap['count'];
    const ampIdx = fieldMap['amp_name'];
    const provIdx = fieldMap['province_name'];

    // Get values with multiple fallback strategies
    let mooVal = mooIdx >= 0 ? getFieldValue(r, mooIdx, response) : null;
    let tmbVal = tmbIdx >= 0 ? getFieldValue(r, tmbIdx, response) : null;
    let countVal = countIdx >= 0 ? getFieldValue(r, countIdx, response) : null;
    let ampVal = ampIdx >= 0 ? getFieldValue(r, ampIdx, response) : null;
    let provVal = provIdx >= 0 ? getFieldValue(r, provIdx, response) : null;

    // If field mapping failed, try direct object property access by name
    if (!mooVal && mooIdx < 0) mooVal = r['moopart'];
    if (!tmbVal && tmbIdx < 0) tmbVal = r['tmb_name'];
    if (!countVal && countIdx < 0) countVal = r['count'];
    if (!ampVal && ampIdx < 0) ampVal = r['amp_name'];
    if (!provVal && provIdx < 0) provVal = r['province_name'];

    // Final fallback: try positional array access if object properties didn't work
    if (!mooVal) mooVal = Array.isArray(r) ? r[0] : r['0'];
    if (!tmbVal) tmbVal = Array.isArray(r) ? r[1] : r['1'];
    if (!countVal) countVal = Array.isArray(r) ? r[2] : r['2'];
    if (!ampVal) ampVal = Array.isArray(r) ? r[3] : r['3'];
    if (!provVal) provVal = Array.isArray(r) ? r[4] : r['4'];

    // Log first 3 rows for debugging
    if (rowIdx < 3) {
      console.debug(`[getNcdGeographicDensity] Row ${rowIdx} extraction:`, {
        rawRow: r,
        fieldIndices: { mooIdx, tmbIdx, countIdx, ampIdx, provIdx },
        extractedValues: {
          mooVal: String(mooVal),
          tmbVal: String(tmbVal),
          countVal: Number(countVal),
          ampVal: String(ampVal),
          provVal: String(provVal)
        }
      });
    }

    return {
      provName: String(provVal ?? 'ไม่ระบุ').trim(),
      ampName: String(ampVal ?? 'ไม่ระบุ').trim(),
      tmbName: String(tmbVal ?? 'ไม่ระบุ').trim(),
      moo: String(mooVal ?? '??').trim(),
      mooName: `หมู่ ${String(mooVal ?? '??').trim()}`,
      patientCount: Number(countVal ?? 0)
    }
  });

  // Log final results
  console.debug('[getNcdGeographicDensity] Final results (first 3):', results.slice(0, 3));
  console.debug('[getNcdGeographicDensity] Total records processed:', results.length);

  return results;
}

// ---------------------------------------------------------------------------
// Patient Distribution by Address (Geomap Data)
// ---------------------------------------------------------------------------

export async function getNcdPatientsByAddress(
  config: ConnectionConfig,
): Promise<PatientAddressDistribution[]> {
  const sql = `
    SELECT
      COUNT(DISTINCT p.hn) as count,
      CONCAT("หมู่", " ", p.moopart, " ", IFNULL(TRIM(t.full_name), 'ไม่ระบุ')) as address
    FROM clinicmember cm
    INNER JOIN clinic c ON cm.clinic = c.clinic
    INNER JOIN patient p ON cm.hn = p.hn
    LEFT JOIN thaiaddress t ON p.chwpart = t.chwpart AND p.amppart = t.amppart AND p.tmbpart = t.tmbpart
    WHERE (c.name LIKE '%เบาหวาน%' OR c.name LIKE '%ความดัน%')
      AND cm.clinic_member_status_id IN (5)
    GROUP BY address
    ORDER BY count DESC
    LIMIT 100
  `

  const response = await executeSqlViaApi(sql, config)
  
  if (!response.data || !Array.isArray(response.data)) {
    return []
  }

  // Parse response - data can be array of arrays or array of objects
  const results: PatientAddressDistribution[] = response.data.map((row: any) => {
    let count = 0
    let address = ''

    // If field_name is available, use it for mapping
    if (response.field_name && Array.isArray(row)) {
      const countIdx = response.field_name.indexOf('count')
      const addressIdx = response.field_name.indexOf('address')
      
      if (countIdx >= 0 && addressIdx >= 0) {
        count = Number(row[countIdx] ?? 0)
        address = String(row[addressIdx] ?? 'ไม่ระบุ')
      }
    } else if (typeof row === 'object') {
      // Try object property access
      count = Number(row['count'] ?? row[0] ?? 0)
      address = String(row['address'] ?? row[1] ?? 'ไม่ระบุ')
    }

    return {
      address: address.trim() || 'ไม่ระบุ',
      count: Math.max(0, count)
    }
  })

  // Sort by count descending
  return results.sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Treemap Data by Area Only (No disease/province grouping)
// ---------------------------------------------------------------------------

export async function getNcdPatientsByDiseaseHierarchy(
  config: ConnectionConfig,
): Promise<TreemapNode> {
  // Get patients grouped by area - fetch separate fields and concatenate on client-side (UTF-8)
  // This avoids TIS620 encoding issues with CONCAT in database
  const sql = `
     SELECT
      CAST(p.moopart AS INT) as moopart,
      IFNULL(TRIM(t.full_name), 'ไม่ระบุ') as address_name,
      COUNT(DISTINCT p.hn) as patient_count
    FROM clinicmember cm
    INNER JOIN clinic c ON cm.clinic = c.clinic
    INNER JOIN patient p ON cm.hn = p.hn
    LEFT JOIN thaiaddress t ON p.chwpart = t.chwpart AND p.amppart = t.amppart AND p.tmbpart = t.tmbpart
    WHERE (c.name LIKE '%เบาหวาน%' OR c.name LIKE '%ความดัน%')
      AND cm.clinic_member_status_id IN (5)
    GROUP BY p.moopart,t.chwpart,t.amppart,t.tmbpart
    ORDER BY patient_count DESC
    LIMIT 50
  `;

  const response = await executeSqlViaApi(sql, config);
  
  if (!response.data || !Array.isArray(response.data)) {
    return { name: 'ไม่มีข้อมูล', value: 0 };
  }

  // Build flat structure: only Area levels
  const children: TreemapNode[] = [];
  let totalCount = 0;
  
  for (const row of response.data) {
    let moopart = '';
    let addressName = '';
    let count = 0;

    // Parse row data (could be array or object)
    if (response.field_name && Array.isArray(row)) {
      const mooIdx = response.field_name.indexOf('moopart');
      const nameIdx = response.field_name.indexOf('address_name');
      const countIdx = response.field_name.indexOf('patient_count');

      if (mooIdx >= 0) moopart = String(row[mooIdx] ?? '');
      if (nameIdx >= 0) addressName = String(row[nameIdx] ?? 'ไม่ระบุ');
      if (countIdx >= 0) count = Number(row[countIdx] ?? 0);
    } else if (typeof row === 'object') {
      moopart = String(row['moopart'] ?? '');
      addressName = String(row['address_name'] ?? 'ไม่ระบุ');
      count = Number(row['patient_count'] ?? 0);
    }

    // Concatenate at client-side using UTF-8 (JavaScript native string handling)
    const address = `หมู่ ${moopart.trim()} ${addressName.trim()}`.trim();
    
    children.push({
      name: address,
      value: count,
    });

    totalCount += count;
  }

  return {
    name: 'ผู้ป่วยโรคเรื้อรัง',
    value: totalCount,
    children,
  };
}
