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