export const SEMESTER_OPTIONS = [
  { value: '1', label: 'Học kỳ 1' },
  { value: '2', label: 'Học kỳ 2' },
  { value: '3', label: 'Học kỳ 3' },
];

export function normalizeSemester(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === '3' || raw === 'iii' || raw.includes('iii')) return '3';
  if (raw === '2' || raw === 'ii') return '2';
  if (raw === '1' || raw === 'i') return '1';
  return String(value || '').trim();
}

export function getCurrentAcademicTerm() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month >= 8) {
    return { schoolYear: `${year}-${year + 1}`, semester: '1' };
  }

  if (month >= 6) {
    return { schoolYear: `${year - 1}-${year}`, semester: '3' };
  }

  return { schoolYear: `${year - 1}-${year}`, semester: '2' };
}

export const CURRENT_ACADEMIC_TERM = getCurrentAcademicTerm();

export function getAcademicYearOptions(periods = []) {
  const currentYear = new Date().getFullYear();
  const years = new Set([CURRENT_ACADEMIC_TERM.schoolYear]);
  for (let index = 0; index < 6; index += 1) {
    const start = currentYear - index;
    years.add(`${start}-${start + 1}`);
  }
  periods.forEach((period) => {
    if (period?.schoolYear) years.add(period.schoolYear);
  });
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

export function isPeriodInTerm(period, schoolYear, semester) {
  if (!period) return false;
  return period.schoolYear === schoolYear && normalizeSemester(period.semester) === normalizeSemester(semester);
}

export function getRecordPeriod(record, periods = []) {
  const period = record?.periodId;
  if (period && typeof period === 'object') return period;
  const periodId = period?._id || period;
  return periods.find((item) => String(item._id) === String(periodId)) || null;
}

export function filterRecordsByTerm(records = [], periods = [], schoolYear, semester) {
  return records.filter((record) => isPeriodInTerm(getRecordPeriod(record, periods), schoolYear, semester));
}

