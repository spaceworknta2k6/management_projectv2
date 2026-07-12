'use client';

import usePeriodStore from '@/store/period.store';
import { getAcademicYearOptions, SEMESTER_OPTIONS } from '@/lib/academicTerm';
import css from './AcademicTermFilter.module.css';

export default function AcademicTermFilter({ periods = [], hidden = false }) {
  const {
    selectedSchoolYear,
    selectedSemester,
    setSelectedTerm,
  } = usePeriodStore();

  if (hidden) return null;

  return (
    <div className={css.termFilter}>
      <div className={css.field}>
        <label className={css.label} htmlFor="academic-school-year">Năm học</label>
        <select
          id="academic-school-year"
          className={css.select}
          value={selectedSchoolYear}
          onChange={(event) => setSelectedTerm(event.target.value, selectedSemester)}
        >
          {getAcademicYearOptions(periods).map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      <div className={css.field}>
        <label className={css.label} htmlFor="academic-semester">Học kỳ</label>
        <select
          id="academic-semester"
          className={css.select}
          value={selectedSemester}
          onChange={(event) => setSelectedTerm(selectedSchoolYear, event.target.value)}
        >
          {SEMESTER_OPTIONS.map((semester) => (
            <option key={semester.value} value={semester.value}>{semester.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
