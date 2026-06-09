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
      subtitle={`Năm học: ${period.schoolYear} | Học kỳ: ${period.semester}`}
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
          {(period.status === 'enrollment' || period.status === 'registration_open') && (
            <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'start')}>
              Bắt đầu thực hiện
            </Button>
          )}
          {period.status === 'defense' && (
            <Button variant="primary" size="sm" onClick={() => handleTransition(period._id, 'lock-results')}>
              Khóa điểm số & kết quả
            </Button>
          )}
          {period.status === 'completed' && (
            <Button variant="secondary" size="sm" onClick={() => handleTransition(period._id, 'archive')}>
              Lưu trữ đợt đồ án
            </Button>
          )}
        </div>
      }
    >
      <div className={css.s10}>
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
          <span className={css.s17}>Hạn nộp báo cáo trước bảo vệ: </span>
          <strong className={css.s18}>{formatDate(period.preDefenseSubmissionDeadline)}</strong>
        </div>
        <div>
          <span className={css.s19}>Thời gian bảo vệ: </span>
          <strong className={css.s20}>
            {formatDate(period.defenseStart)} - {formatDate(period.defenseEnd)}
          </strong>
        </div>
        <div>
          <span className={css.s21}>Công thức tính điểm: </span>
          <strong>
            HD: {period.scoringFormula?.supervisor} | PB: {period.scoringFormula?.reviewer} | HĐ:{' '}
            {period.scoringFormula?.committee}
          </strong>
        </div>
      </div>
    </Card>
  );
}
