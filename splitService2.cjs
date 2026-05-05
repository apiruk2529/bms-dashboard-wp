const fs = require('fs');

const content = fs.readFileSync('src/services/kpiService.ts', 'utf8');
const lines = content.split(/\r?\n/);

const headerLines = [];
let i = 0;
while (i < lines.length && !lines[i].includes('export ')) {
  headerLines.push(lines[i]);
  i++;
}
const header = headerLines.join('\n');

const files = {
  'src/services/overviewService.ts': [],
  'src/services/trendsService.ts': [],
  'src/services/departmentAnalyticsService.ts': [],
  'src/services/demographicsService.ts': [],
  'src/services/topDiseaseService.ts': [],
  'src/services/referService.ts': [],
  'src/services/ttmService.ts': [],
};

const mapping = {
  'getOverviewStats': 'src/services/overviewService.ts',
  'getWeeklyMiniTrend': 'src/services/overviewService.ts',
  'getTopDoctorsThisMonth': 'src/services/overviewService.ts',
  'getKpiSummary': 'src/services/overviewService.ts',
  'getDailyVisitTrend': 'src/services/overviewService.ts',
  'getHourlyDistribution': 'src/services/overviewService.ts',
  'getDepartmentBreakdown': 'src/services/overviewService.ts',
  'getOpdVisitCount': 'src/services/overviewService.ts',
  'getIpdPatientCount': 'src/services/overviewService.ts',
  'getErVisitCount': 'src/services/overviewService.ts',
  'getActiveDepartmentCount': 'src/services/overviewService.ts',
  'getRecentVisits': 'src/services/overviewService.ts',
  'getGenderDistribution': 'src/services/demographicsService.ts',
  'getAgeGroupDistribution': 'src/services/demographicsService.ts',
  'getPatientTypeDistribution': 'src/services/demographicsService.ts',
  'getDepartmentWorkload': 'src/services/departmentAnalyticsService.ts',
  'getDepartmentDailyTrend': 'src/services/departmentAnalyticsService.ts',
  'getDoctorWorkload': 'src/services/departmentAnalyticsService.ts',
  'TrendSummary': 'src/services/trendsService.ts',
  'computeTrendSummary': 'src/services/trendsService.ts',
  'getMonthlyVisitSummary': 'src/services/trendsService.ts',
  'getVisitsByDayOfWeek': 'src/services/trendsService.ts',
  'getTopDepartmentsForRange': 'src/services/trendsService.ts',
  'getTopDiagnoses': 'src/services/trendsService.ts',
  'getTopMedications': 'src/services/trendsService.ts',
  'getMedicationCostSummary': 'src/services/trendsService.ts',
  'getDeathSummary': 'src/services/trendsService.ts',
  'getDiagnosisSummary': 'src/services/trendsService.ts',
  'AddressFilter': 'src/services/topDiseaseService.ts',
  'AreaInfo': 'src/services/topDiseaseService.ts',
  'getProvinces': 'src/services/topDiseaseService.ts',
  'getAmphurs': 'src/services/topDiseaseService.ts',
  'getTambons': 'src/services/topDiseaseService.ts',
  'getVillages': 'src/services/topDiseaseService.ts',
  'Top20OpdDisease': 'src/services/topDiseaseService.ts',
  'Top20IpdDisease': 'src/services/topDiseaseService.ts',
  'Top20ReferDisease': 'src/services/topDiseaseService.ts',
  'getTop20OpdDiseases': 'src/services/topDiseaseService.ts',
  'getTop20IpdDiseases': 'src/services/topDiseaseService.ts',
  'getTop20ReferDiseases': 'src/services/topDiseaseService.ts',
  'HospitalRegionInfo': 'src/services/referService.ts',
  'ReferRegionDisease': 'src/services/referService.ts',
  'getHospitalRegionInfo': 'src/services/referService.ts',
  'getTopReferDiseasesByRegion': 'src/services/referService.ts',
  'ReferSummaryCounts': 'src/services/referService.ts',
  'getReferSummaryCounts': 'src/services/referService.ts',
  'ReferTrendData': 'src/services/referService.ts',
  'getReferTrend': 'src/services/referService.ts',
  'ReferOutZoneDetail': 'src/services/referService.ts',
  'getReferOutZoneDetail': 'src/services/referService.ts',
  'TtmFinancialSummary': 'src/services/ttmService.ts',
  'TtmMonthlyTrend': 'src/services/ttmService.ts',
  'TtmServiceTypeSummary': 'src/services/ttmService.ts',
  'TtmDoctorWorkload': 'src/services/ttmService.ts',
  'TtmPatientAgeGroup': 'src/services/ttmService.ts',
  'TtmRevenueByPayerType': 'src/services/ttmService.ts',
  'TtmDiagnosisDistribution': 'src/services/ttmService.ts',
  'TtmMonthlyDoctorTrend': 'src/services/ttmService.ts',
  'getTtmFinancialSummary': 'src/services/ttmService.ts',
  'getTtmMonthlyTrend': 'src/services/ttmService.ts',
  'getTtmServiceTypeSummary': 'src/services/ttmService.ts',
  'getTtmDoctorWorkload': 'src/services/ttmService.ts',
  'getTtmPatientAgeGroups': 'src/services/ttmService.ts',
  'getTtmRevenueByPayerType': 'src/services/ttmService.ts',
  'getTtmDiagnosisDistribution': 'src/services/ttmService.ts',
  'getTtmDailyTrend': 'src/services/ttmService.ts',
  'getTtmTopHerbalDrugs': 'src/services/ttmService.ts',
};

let currentFile = 'src/services/overviewService.ts'; // default
let buffer = [];

for (let j = i; j < lines.length; j++) {
  const line = lines[j];
  buffer.push(line);
  
  let match = line.match(/^export (?:async )?(?:function|interface|const) (\w+)/);
  if (match) {
    const fnName = match[1];
    const targetFile = mapping[fnName];
    if (targetFile) {
      if (currentFile !== targetFile) {
        // Everything before this export line, except the export line itself
        // Wait, comments right before the export should go to targetFile!
        // So we scan backwards to find where comments start.
        let k = buffer.length - 2;
        while (k >= 0 && (buffer[k].trim().startsWith('//') || buffer[k].trim() === '')) {
          k--;
        }
        
        // Everything up to k goes to currentFile
        const prevBlock = buffer.slice(0, k + 1);
        if (prevBlock.length > 0) files[currentFile].push(prevBlock.join('\n'));
        
        // Everything from k+1 to end goes to targetFile
        buffer = buffer.slice(k + 1);
        currentFile = targetFile;
      }
    }
  }
}

if (buffer.length > 0) {
  files[currentFile].push(buffer.join('\n'));
}

for (const [file, blocks] of Object.entries(files)) {
  if (blocks.length > 0) {
    let finalHeader = header;
    finalHeader = `/* eslint-disable @typescript-eslint/no-unused-vars */\n` + finalHeader;
    
    // Add computeTrendSummary missing interface if needed
    if (file === 'src/services/trendsService.ts') {
        finalHeader += `\nimport type { VisitTrend } from '@/types'\n`;
    }

    fs.writeFileSync(file, finalHeader + '\n' + blocks.join('\n'));
    console.log('Created ' + file);
  }
}
