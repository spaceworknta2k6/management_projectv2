'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, getStatus } from '@/lib/utils';
import { getAcademicUnitLabel } from '@/lib/academicUnits';
import { PencilSimple, Trash } from '@phosphor-icons/react';
import css from '../page.module.css';

export default function PeriodCard({
  period,
  openEditModal,
  setPeriodToDelete,
  handleTransition,
  handleTransitionBatch,
}) {
  const childPeriods = period.isBatchGroup ? period.childPeriods || [] : [];
  const batchStatuses = period.isBatchGroup ? new Set(childPeriods.map((child) => child.status)) : null;
  const hasMixedStatus = batchStatuses?.size > 1;
  const actionPeriod = period.isBatchGroup ? childPeriods[0] : period;
  const periodStatus = hasMixedStatus ? null : actionPeriod?.status || period.status;
  const statusInfo = hasMixedStatus ? { label: 'Nhiều trạng thái', variant: 'warning' } : getStatus(periodStatus);
  const isDemo = period.isDemo === true;
  const secondMarkerWeight = period.scoringFormula?.secondMarker ?? period.scoringFormula?.reviewer;
  const subtitleParts = [
    `Mã HP: ${period.courseCode || 'N/A'}`,
    period.cohort ? `Khóa: ${period.cohort}` : null,
    `Năm học: ${period.schoolYear}`,
    `Học kỳ: ${period.semester}`,
  ].filter(Boolean);

  const runTransition = (action) => {
    if (period.isBatchGroup) {
      handleTransitionBatch(childPeriods.map((child) => child._id), action);
      return;
    }
    handleTransition(period._id, action);
  };

  return (
    <Card
      title={period.courseName || period.name}
      subtitle={subtitleParts.join(' | ')}
      actions={
        <div className={css.s9}>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          {period.isBatchGroup && <Badge variant="info">{childPeriods.length} lớp</Badge>}
          {isDemo ? (
            <Badge variant="info">Demo</Badge>
          ) : (
            <>
              {!period.isBatchGroup && (
                <Button variant="secondary" size="sm" onClick={() => openEditModal(period)}>
                  <PencilSimple size={14} />
                  Sửa
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => setPeriodToDelete(period)}>
                <Trash size={14} />
                Xóa
              </Button>
            </>
          )}

          {!isDemo && periodStatus === 'draft' && (
            <Button variant="primary" size="sm" onClick={() => runTransition('open-registration')}>
              Mở đăng ký đề tài
            </Button>
          )}
          {!isDemo && periodStatus === 'registration_open' && (
            <Button variant="primary" size="sm" onClick={() => runTransition('start')}>
              Bắt đầu thực hiện
            </Button>
          )}
          {!isDemo && periodStatus === 'in_progress' && (
            <Button variant="primary" size="sm" onClick={() => runTransition('start-grading')}>
              Bắt đầu chấm điểm
            </Button>
          )}
          {!isDemo && periodStatus === 'grading' && (
            <Button variant="primary" size="sm" onClick={() => runTransition('publish-results')}>
              Công bố kết quả
            </Button>
          )}
          {!isDemo && periodStatus === 'results_published' && (
            <>
              <Button variant="primary" size="sm" onClick={() => runTransition('open-appeal')}>
                Mở phúc khảo
              </Button>
              <Button variant="primary" size="sm" onClick={() => runTransition('lock-results')}>
                Khóa kết quả
              </Button>
            </>
          )}
          {!isDemo && periodStatus === 'appeal_open' && (
            <Button variant="primary" size="sm" onClick={() => runTransition('lock-results')}>
              Khóa kết quả
            </Button>
          )}
          {!isDemo && periodStatus === 'result_locked' && (
            <Button variant="secondary" size="sm" onClick={() => runTransition('archive')}>
              Lưu trữ học phần
            </Button>
          )}
        </div>
      }
    >
      <div className={css.s10}>
        <div>
          <span className={css.s11}>Khoa phụ trách: </span>
          <strong className={css.s12}>{getAcademicUnitLabel(period.academicUnit)}</strong>
        </div>
        <div>
          <span className={css.s11}>Hình thức: </span>
          <strong className={css.s12}>
            {period.allowIndividual ? 'Cá nhân' : ''}
            {period.allowIndividual && period.allowGroup ? ' & ' : ''}
            {period.allowGroup ? `Nhóm (tối thiểu ${period.groupMinSize ?? 2} - tối đa ${period.groupMaxSize ?? 5} SV)` : ''}
          </strong>
        </div>
        <div>
          <span className={css.s11}>Thời hạn đăng ký: </span>
          <strong className={css.s12}>
            {formatDate(period.registrationStart)} - {formatDate(period.registrationEnd)}
          </strong>
        </div>
        <div>
          <span className={css.s13}>Hạn đổi đề tài: </span>
          <strong className={css.s14}>{formatDate(period.topicChangeDeadline)}</strong>
        </div>
        <div>
          <span className={css.s15}>Thời gian thực hiện: </span>
          <strong className={css.s16}>
            {formatDate(period.projectStart)} - {formatDate(period.projectEnd)}
          </strong>
        </div>
        <div>
          <span className={css.s21}>Công thức tính điểm: </span>
          <strong>
            {`GVHD: ${period.scoringFormula?.supervisor !== undefined ? `${period.scoringFormula.supervisor * 100}%` : '50%'} | GV Chấm 2: ${secondMarkerWeight !== undefined ? `${secondMarkerWeight * 100}%` : '50%'}`}
          </strong>
        </div>
      </div>

      {period.isBatchGroup && (
        <div className={css.s48}>
          {childPeriods.map((child) => {
            const childStatus = getStatus(child.status);
            const lecturer = child.coordinatorLecturerId?.userId?.fullName || child.coordinatorLecturerId?.name || 'Chưa phân công';
            return (
              <div key={child._id} className={css.s49}>
                <div className={css.s50}>
                  <strong>{child.classCode || child.classSection}</strong>
                  <span>{lecturer}</span>
                </div>
                <Badge variant={childStatus.variant}>{childStatus.label}</Badge>
                {!isDemo && (
                  <Button variant="secondary" size="sm" onClick={() => openEditModal(child)}>
                    <PencilSimple size={14} />
                    Sửa lớp
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
