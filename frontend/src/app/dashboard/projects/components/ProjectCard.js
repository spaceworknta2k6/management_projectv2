'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { UserCheck, CheckSquare, ChatsCircle } from '@phosphor-icons/react';
import { getOwnerDisplay, getOwnerTypeLabel } from '@/lib/projectOwner';
import { getTechnicalLabel } from '@/lib/utils';
import css from '../page.module.css';

export default function ProjectCard({
  project: p,
  user,
  isStaff,
  isLecturer,
  isStudent,
  onStartProject,
  onOpenAssignReviewer,
  onFinalizeProject,
  onRequestDirectChat,
}) {
  const getProjectStatusBadge = (status) => {
    switch (status) {
      case 'assigned':
        return <Badge variant="info">Mới phân công</Badge>;
      case 'in_progress':
        return <Badge variant="warning">Đang thực hiện</Badge>;
      case 'final_report_submitted':
        return <Badge variant="info">Đã nộp báo cáo cuối</Badge>;
      case 'supervisor_reviewed':
        return <Badge variant="success">GVHD đã đánh giá</Badge>;
      case 'reviewer_reviewed':
        return <Badge variant="success">GV chấm 2 đã đánh giá</Badge>;
      case 'ready_for_grading':
        return <Badge variant="success">Sẵn sàng chấm</Badge>;
      case 'finalized':
        return <Badge variant="success">Đã hoàn thành</Badge>;
      case 'cancelled':
        return <Badge variant="error">Đã hủy</Badge>;
      default:
        return <Badge variant="secondary">{getTechnicalLabel(status)}</Badge>;
    }
  };

  return (
    <Card
      key={p._id}
      title={p.title}
      subtitle={`${getOwnerTypeLabel(p)}: ${getOwnerDisplay(p)} | Mã đợt: ${p.periodId?.name || '—'}`}
      actions={
        <div className={css.s8}>
          {getProjectStatusBadge(p.status)}

          {/* Student Start Project Action */}
          {!isStaff && !isLecturer && p.status === 'assigned' && (
            <Button variant="primary" size="sm" onClick={() => onStartProject(p._id)}>
              Bắt đầu thực hiện
            </Button>
          )}

          {/* Staff actions */}
          {isStaff && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenAssignReviewer(p._id, p.reviewerId?._id || '')}
              >
                <UserCheck size={14} /> Phân công GV chấm 2
              </Button>

              {p.status === 'ready_for_grading' && (
                <Button variant="success" size="sm" onClick={() => onFinalizeProject(p._id)}>
                  <CheckSquare size={14} /> Chốt hoàn tất
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className={css.s9}>
        <div>
          <p className={css.s10}>Giảng viên hướng dẫn:</p>
          <div className={css.lecturerLine}>
            <p className={css.s11}>
              {p.supervisorId?.userId?.fullName || 'Chưa phân công'} ({p.supervisorId?.userId?.email || '—'})
            </p>
            {isStudent && p.supervisorId?.userId?._id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRequestDirectChat(p.supervisorId.userId._id)}
                icon={<ChatsCircle size={14} />}
              >
                Nhắn tin
              </Button>
            )}
          </div>
        </div>
        <div>
          <p className={css.s12}>Giảng viên chấm 2:</p>
          <div className={css.lecturerLine}>
            <p className={css.s13}>
              {p.reviewerId?.userId?.fullName ? (
                <span>{p.reviewerId.userId.fullName} ({p.reviewerId.userId.email})</span>
              ) : (
                <span className={css.s14}>Chưa phân công giảng viên chấm 2</span>
              )}
            </p>
            {isStudent && p.reviewerId?.userId?._id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRequestDirectChat(p.reviewerId.userId._id)}
                icon={<ChatsCircle size={14} />}
              >
                Nhắn tin
              </Button>
            )}
          </div>
        </div>
        <div className={css.s15}>
          <p className={css.s16}>Tóm tắt đề tài:</p>
          <p className={css.s17}>{p.topicId?.summary || 'Không có tóm tắt chi tiết.'}</p>
        </div>
      </div>
    </Card>
  );
}
