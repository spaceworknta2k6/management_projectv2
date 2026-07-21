'use client';

import { useMemo, useState } from 'react';
import { usePeriods } from './hooks/usePeriods';
import PeriodCard from './components/PeriodCard';
import PeriodModal from './components/PeriodModal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { CalendarBlank, Plus, ArrowsClockwise, MagnifyingGlass } from '@phosphor-icons/react';
import css from './page.module.css';

const BASE_SCHOOL_YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => {
  const startYear = new Date().getFullYear() - index;
  return `${startYear}-${startYear + 1}`;
});

export default function PeriodsPage() {
  const {
    periods,
    rubrics,
    lecturers,
    loading,
    showModal,
    setShowModal,
    editingPeriod,
    setEditingPeriod,
    periodToDelete,
    setPeriodToDelete,
    submitting,
    deleting,
    form,
    formErrors,
    currentAcademicTerm,
    openCreateModal,
    openEditModal,
    fetchPeriods,
    handleChange,
    handleSubmit,
    handleTransition,
    handleTransitionBatch,
    handleDeletePeriod,
    handleDeleteBatch,
  } = usePeriods();

  const [selectedSchoolYear, setSelectedSchoolYear] = useState(currentAcademicTerm.schoolYear);
  const [selectedSemester, setSelectedSemester] = useState(currentAcademicTerm.semester);
  const [searchTerm, setSearchTerm] = useState('');

  const schoolYearOptions = useMemo(() => {
    const years = new Set([currentAcademicTerm.schoolYear, ...BASE_SCHOOL_YEAR_OPTIONS]);
    periods.forEach((period) => {
      if (period.schoolYear) years.add(period.schoolYear);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [currentAcademicTerm.schoolYear, periods]);

  const filteredPeriods = useMemo(() => (
    periods.filter((period) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const courseName = (period.courseName || period.name || '').toLowerCase();
      const classCode = (period.classCode || '').toLowerCase();
      const cohort = (period.cohort || '').toLowerCase();

      return (
        period.schoolYear === selectedSchoolYear &&
        String(period.semester) === selectedSemester &&
        (!normalizedSearch || courseName.includes(normalizedSearch) || classCode.includes(normalizedSearch) || cohort.includes(normalizedSearch))
      );
    })
  ), [periods, searchTerm, selectedSchoolYear, selectedSemester]);

  const periodDisplayItems = useMemo(() => {
    const groups = new Map();
    const items = [];

    filteredPeriods.forEach((period) => {
      const batchKey = period.batchId;
      if (!batchKey) {
        items.push(period);
        return;
      }

      if (!groups.has(batchKey)) {
        groups.set(batchKey, {
          ...period,
          _id: `batch-${batchKey}`,
          batchKey,
          isBatchGroup: true,
          childPeriods: [],
        });
        items.push(groups.get(batchKey));
      }

      groups.get(batchKey).childPeriods.push(period);
    });

    return items.map((item) => {
      if (!item.isBatchGroup) return item;
      const childPeriods = [...item.childPeriods].sort((a, b) => (a.classSection || '').localeCompare(b.classSection || ''));
      return {
        ...item,
        childPeriods,
        classCount: childPeriods.length,
      };
    });
  }, [filteredPeriods]);

  return (
    <div>
      {/* Header section */}
      <div className={css.s1}>
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <CalendarBlank size={28} className={css.s3} />
            Quản lý đợt học phần
          </h1>
          <p className={css.s4}>
            Quản lý các đợt mở đăng ký, thời gian thực hiện, quy định nhóm/cá nhân và công thức tính điểm
          </p>
        </div>
      </div>

      <div className={css.s42}>
        <div className={css.s43}>
          <div className={`${css.s39} ${css.s44}`}>
            <label className={css.s40} htmlFor="period-search">Tên học phần</label>
            <div className={css.s45}>
              <MagnifyingGlass size={16} className={css.s46} />
              <input
                id="period-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên học phần"
                className={css.s47}
              />
            </div>
          </div>
          <div className={css.s39}>
            <label className={css.s40} htmlFor="period-school-year">Năm học</label>
            <select
              id="period-school-year"
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className={css.s41}
            >
              {schoolYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className={css.s39}>
            <label className={css.s40} htmlFor="period-semester">Học kỳ</label>
            <select
              id="period-semester"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className={css.s41}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
        </div>
        <div className={css.s5}>
          <Button variant="secondary" size="sm" onClick={fetchPeriods}>
            <ArrowsClockwise size={16} />
            Làm mới
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedSchoolYear(currentAcademicTerm.schoolYear);
              setSelectedSemester(currentAcademicTerm.semester);
              openCreateModal();
            }}
          >
            <Plus size={16} />
            Tạo đợt học phần
          </Button>
        </div>
      </div>

      {/* List items */}
      {loading ? (
        <div className={css.s6}>
          <Spinner size="lg" />
        </div>
      ) : periods.length === 0 ? (
        <Card>
          <div className={css.s7}>
            Chưa có đợt học phần nào được định cấu hình trên hệ thống. Hãy nhấp &quot;Tạo đợt học phần&quot; để bắt đầu.
          </div>
        </Card>
      ) : periodDisplayItems.length === 0 ? (
        <Card>
          <div className={css.s7}>
            Không tìm thấy đợt học phần phù hợp với bộ lọc hiện tại.
          </div>
        </Card>
      ) : (
        <div className={css.s8}>
          {periodDisplayItems.map((p) => (
            <PeriodCard
              key={p._id}
              period={p}
              openEditModal={openEditModal}
              setPeriodToDelete={setPeriodToDelete}
              handleTransition={handleTransition}
              handleTransitionBatch={handleTransitionBatch}
            />
          ))}
        </div>
      )}

      {/* Modal create new */}
      {showModal && (
        <PeriodModal
          editingPeriod={editingPeriod}
          form={form}
          formErrors={formErrors}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          onClose={() => {
            setShowModal(false);
            setEditingPeriod(null);
          }}
          submitting={submitting}
          schoolYearOptions={schoolYearOptions}
          rubrics={rubrics}
          lecturers={lecturers}
        />
      )}

      <ConfirmDialog
        open={Boolean(periodToDelete)}
        title="Xóa đợt học phần"
        message={periodToDelete ? `Bạn có chắc chắn muốn xóa đợt học phần "${periodToDelete.courseName || periodToDelete.name}"?` : ''}
        confirmLabel="Xóa"
        loading={deleting}
        onCancel={() => setPeriodToDelete(null)}
        onConfirm={() => {
          if (periodToDelete?.isBatchGroup) {
            handleDeleteBatch(periodToDelete.childPeriods);
            return;
          }
          handleDeletePeriod(periodToDelete);
        }}
      />
    </div>
  );
}
