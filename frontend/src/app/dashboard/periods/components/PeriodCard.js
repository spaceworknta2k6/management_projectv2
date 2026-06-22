'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, getStatus } from '@/lib/utils';
import { PencilSimple, Trash } from '@phosphor-icons/react';
import css from '../page.module.css';

export default function PeriodCard({
  period,
  openEditModal,
  setPeriodToDelete,
  handleTransition,
}) {
  const statusInfo = getStatus(period.status);

  return (
    <Card
      title={period.name}
      subtitle={`Mã HP: ${period.courseCode || 'N/A'} - ${period.courseName || 'N/A'} | Năm học: ${period.schoolYear} | Học kỳ: ${period.semester}`}
      actions={
        <div className={css.s9}>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          <Button variant="secondary" size="sm" onClick={() => openEditModal(period)}>
            <PencilSimple size={14} />
            Sửa
          </Button>
          <Button variant="danger" size="sm" onClick={() => setPeriodToDelete(period)}>
            <Trash size={14} />
            Xóa
          </Button>
          
          {period.status === 'draft' && (
            <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'open-registration')}>
              Mở đăng ký đề tài
            </Button>
          )}
          {period.status === 'registration_open' && (
            <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'start')}>
              Bắt đầu thực hiện
            </Button>
          )}
          {period.status === 'in_progress' && (
            <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'start-grading')}>
              Bắt đầu chấm điểm
            </Button>
          )}
          {period.status === 'grading' && (
            <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'publish-results')}>
              Công bố kết quả
            </Button>
          )}
          {period.status === 'results_published' && (
            <>
              <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'open-appeal')}>
                Mở phúc khảo
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'lock-results')}>
                Khóa kết quả
              </Button>
            </>
          )}
          {period.status === 'appeal_open' && (
            <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'lock-results')}>
              Khóa kết quả
            </Button>
          )}
          {period.status === 'result_locked' && (
            <Button variant="secondary" size="sm" onClick={() => handleTransition(period._id, 'archive')}>
              Lưu trữ học phần
            </Button>
          )}
        </div>
      }
    >
      <div className={css.s10}>
        <div>
          <span className={css.s11}>Hình thức: </span>
          <strong className={css.s12}>
            {period.allowIndividual ? 'Cá nhân' : ''}
            {period.allowIndividual && period.allowGroup ? ' & ' : ''}
            {period.allowGroup ? `Nhóm (tối thiểu ${period.groupMinSize ?? 2} - tối đa ${period.groupMaxSize ?? 5} SV)` : ''}
          </strong>
        </div>
        <div>
          <span className={css.s11}>Thời hạn Đăng ký: </span>
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
            {period.scoringFormula?.committee > 0 ? (
              `HD: ${period.scoringFormula?.supervisor} | PB: ${period.scoringFormula?.reviewer} | HĐ: ${period.scoringFormula?.committee}`
            ) : (
              `GVHD: ${period.scoringFormula?.supervisor !== undefined ? `${period.scoringFormula.supervisor * 100}%` : '50%'} | GV Chấm 2: ${period.scoringFormula?.reviewer !== undefined ? `${period.scoringFormula.reviewer * 100}%` : '50%'}`
            )}
          </strong>
        </div>
      </div>
    </Card>
  );
}
