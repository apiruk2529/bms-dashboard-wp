// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
// =============================================================================
// BMS Session KPI Dashboard - Refer Service (Restored with Address Filters)
// =============================================================================

import type {
  ConnectionConfig,
  DatabaseType,
  SqlApiResponse,
} from '@/types';

import { queryBuilder } from '@/services/queryBuilder';
import { executeSqlViaApi } from '@/services/bmsSession';

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Types & Rankings
// ---------------------------------------------------------------------------

function parseQueryResponse<T>(
  response: SqlApiResponse,
  mapper: (row: Record<string, any>) => T,
): T[] {
  if (!response.data || response.data.length === 0) {
    return [];
  }
  return response.data.map(mapper);
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
): Promise<Top20OpdDisease[]> {
  const sql =
    `SELECT o.icd10, i.name, COUNT(DISTINCT o.hn) as HN, COUNT(o.vn) as VN ` +
    `FROM ovstdiag o ` +
    `LEFT JOIN icd101 i ON o.icd10 = i.code ` +
    `WHERE o.vstdate BETWEEN '${startDate}' AND '${endDate}' ` +
    `AND i.code IS NOT NULL AND o.icd10 NOT LIKE 'Z%' ` +
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
): Promise<Top20IpdDisease[]> {
  const sql =
    `SELECT v.pdx, COUNT(v.pdx) as pdx_count, i.name as icdname ` +
    `FROM an_stat v ` +
    `LEFT JOIN icd101 i ON i.code = v.pdx ` +
    `WHERE v.dchdate BETWEEN '${startDate}' AND '${endDate}' ` +
    `AND v.pdx IS NOT NULL AND v.pdx <> '' ` +
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
): Promise<Top20ReferDisease[]> {
  const sql =
    `SELECT ro.pdx, i10.name AS ICD10, ` +
    `COUNT(ro.vn) AS ct, COUNT(DISTINCT(ro.hn)) AS ct_hn, ` +
    `SUM(IF(ro.refer_point='OPD',1,0)) AS refer_opd, ` +
    `SUM(IF(ro.refer_point='ER',1,0)) AS refer_ER, ` +
    `SUM(IF(ro.refer_point='IPD',1,0)) AS refer_IPD ` +
    `FROM referout ro ` +
    `LEFT JOIN icd101 i10 ON ro.pdx = i10.code ` +
    `WHERE ro.refer_date BETWEEN '${startDate}' AND '${endDate}' ` +
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
 * Attempts to identify the hospital's own region from opdconfig or hospcode.
 */
export async function getHospitalRegionInfo(
  config: ConnectionConfig,
): Promise<HospitalRegionInfo | null> {
  // 1. Try fetching directly from opdconfig (some setups have these fields there)
  try {
    const sqlDirect = `SELECT chwpart, region_id FROM opdconfig LIMIT 1`;
    const respDirect = await executeSqlViaApi(sqlDirect, config);
    if (respDirect.data && respDirect.data.length > 0) {
      const row = respDirect.data[0];
      const chw = String(row['chwpart'] ?? '').trim();
      const zone = String(row['region_id'] ?? '').trim();
      if (chw && chw !== '00' && chw !== '') {
        return {
          chwpart: chw.padStart(2, '0'),
          zone_code: zone.padStart(2, '0'),
        };
      }
    }
  } catch (err) {
    // Field might not exist in opdconfig, ignore and proceed to join
  }

  try {
    // 2. Primary attempt: Join opdconfig with hospcode
    const sql =
      `SELECT h.chwpart, h.region_id ` +
      `FROM opdconfig o ` +
      `LEFT JOIN hospcode h ON h.hospcode = o.hospitalcode ` +
      `LIMIT 1`;
    const response = await executeSqlViaApi(sql, config);
    const rows = parseQueryResponse(response, (row) => {
      const chw = String(row['chwpart'] ?? '').trim();
      const zone = String(row['region_id'] ?? '').trim();
      return {
        chwpart: chw.padStart(2, '0'),
        zone_code: zone.padStart(2, '0'),
      };
    });
    
    if (rows.length > 0 && rows[0].chwpart && rows[0].chwpart !== '00') {
      return rows[0];
    }
  } catch (err) {
    console.error('Error fetching hospital region info via join', err);
  }

  // 3. Fallback: Fetch hospitalcode first
  try {
    const sqlCode = `SELECT hospitalcode FROM opdconfig LIMIT 1`;
    const respCode = await executeSqlViaApi(sqlCode, config);
    if (respCode.data && respCode.data.length > 0) {
      const hCode = respCode.data[0].hospitalcode;
      if (hCode) {
        const sqlH = `SELECT chwpart, region_id FROM hospcode WHERE hospcode = '${hCode}'`;
        const respH = await executeSqlViaApi(sqlH, config);
        const rowsH = parseQueryResponse(respH, (row) => {
          const chw = String(row['chwpart'] ?? '').trim();
          const zone = String(row['region_id'] ?? '').trim();
          return {
            chwpart: chw.padStart(2, '0'),
            zone_code: zone.padStart(2, '0'),
          };
        });
        if (rowsH.length > 0 && rowsH[0].chwpart !== '00') return rowsH[0];
      }
    }
  } catch (err) {
    console.error('Fallback hospital region fetch failed', err);
  }

  // 4. Guaranteed fallback for Province 70 (Ratchaburi), Zone 05
  return {
    chwpart: '70',
    zone_code: '05',
  };
}

/**
 * Top 5 Refer-out diseases by region type for a date range.
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
  // Normalize codes for comparison using LPAD in SQL
  const normZone = hospitalZoneCode.padStart(2, '0');
  const normChw = hospitalChwpart.padStart(2, '0');

  if (regionType === 'IN_PROVINCE') {
    regionCondition = `LPAD(h.chwpart, 2, '0') = '${normChw}'`;
  } else if (regionType === 'IN_ZONE') {
    regionCondition = `LPAD(h.chwpart, 2, '0') <> '${normChw}' AND LPAD(h.region_id, 2, '0') = '${normZone}'`;
  } else if (regionType === 'OUT_ZONE') {
    regionCondition = `(LPAD(h.region_id, 2, '0') <> '${normZone}' OR h.region_id IS NULL OR h.region_id = '')`;
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
    `WHERE DATE(ro.refer_date) BETWEEN '${startDate}' AND '${endDate}' ` +
    (regionCondition ? `AND ${regionCondition} ` : '') +
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

  const normZone = hospitalZoneCode.padStart(2, '0');
  const normChw = hospitalChwpart.padStart(2, '0');

  const sql =
    `SELECT ` +
    `SUM(IF(LPAD(h.chwpart, 2, '0') = '${normChw}', 1, 0)) as in_province, ` +
    `SUM(IF(LPAD(h.chwpart, 2, '0') <> '${normChw}' AND LPAD(h.region_id, 2, '0') = '${normZone}', 1, 0)) as in_zone, ` +
    `SUM(IF(LPAD(h.region_id, 2, '0') <> '${normZone}' OR h.region_id IS NULL OR h.region_id = '', 1, 0)) as out_zone ` +
    `FROM referout ro ` +
    `LEFT JOIN hospcode h ON ro.hospcode = h.hospcode ` +
    `WHERE DATE(ro.refer_date) BETWEEN '${startDate}' AND '${endDate}' ` +
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
    `WHERE DATE(ro.refer_date) BETWEEN '${startDate}' AND '${endDate}' ` +
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

  const normZone = hospitalZoneCode.padStart(2, '0');

  const sql =
    `SELECT ro.hospcode, h.name as hospname, ro.pdx, i10.name as icd10name, COUNT(ro.vn) as ct ` +
    `FROM referout ro ` +
    `LEFT JOIN hospcode h ON ro.hospcode = h.hospcode ` +
    `LEFT JOIN icd101 i10 ON ro.pdx = i10.code ` +
    `WHERE DATE(ro.refer_date) BETWEEN '${startDate}' AND '${endDate}' ` +
    `AND (LPAD(h.region_id, 2, '0') <> '${normZone}' OR h.region_id IS NULL OR h.region_id = '') ` +
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

// ---------------------------------------------------------------------------
// Address Lookups (Restore for compatibility if needed elsewhere)
// ---------------------------------------------------------------------------

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
