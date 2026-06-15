'use client';

import { usePeriods } from './hooks/usePeriods';
import PeriodCard from './components/PeriodCard';
import PeriodModal from './components/PeriodModal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { CalendarBlank, Plus, ArrowsClockwise } from '@phosphor-icons/react';
import css from './page.module.css';

export default function PeriodsPage() {
  const {
    periods,
    rubrics,
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
    openCreateModal,
    openEditModal,
    fetchPeriods,
    handleChange,
    handleSubmit,
    handleTransition,
    handleDeletePeriod,
  } = usePeriods();

  return (
    <div>
      {/* Header section */}
      <div className={css.s1}>
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <CalendarBlank size={28} className={css.s3} />
            Quản lý Đợt đồ án
          </h1>
          <p className={css.s4}>
            Cấu hình thời gian, mốc bảo vệ và công thức tính điểm của đợt đồ án
          </p>
        </div>
        <div className={css.s5}>
          <Button variant="secondary" size="sm" onClick={fetchPeriods}>
            <ArrowsClockwise size={16} />
            Làm mới
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus size={16} />
            Khởi tạo đợt mới
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
            Chưa có đợt đồ án nào được định cấu hình trên hệ thống. Hãy nhấp &quot;Khởi tạo đợt mới&quot; để bắt đầu.
          </div>
        </Card>
      ) : (
        <div className={css.s8}>
          {periods.map((p) => (
            <PeriodCard
              key={p._id}
              period={p}
              openEditModal={openEditModal}
              setPeriodToDelete={setPeriodToDelete}
              handleTransition={handleTransition}
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
          rubrics={rubrics}
        />
      )}

      <ConfirmDialog
        open={Boolean(periodToDelete)}
        title="Xóa đợt đồ án"
        message={periodToDelete ? `Bạn có chắc chắn muốn xóa đợt đồ án "${periodToDelete.name}"?` : ''}
        confirmLabel="Xóa"
        loading={deleting}
        onCancel={() => setPeriodToDelete(null)}
        onConfirm={() => handleDeletePeriod(periodToDelete)}
      />
    </div>
  );
}
