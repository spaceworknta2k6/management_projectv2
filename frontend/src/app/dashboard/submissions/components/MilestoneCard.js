'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, getTechnicalLabel } from '@/lib/utils';
import { Calendar, Upload, PencilSimple, Trash, Shield, Clock, Download } from '@phosphor-icons/react';
import css from '../page.module.css';

const getMilestoneStatusBadge = (status) => {
  switch (status) {
    case 'open':
      return <Badge variant="info">Chờ nộp bài</Badge>;
    case 'submitted':
      return <Badge variant="warning">Đã nộp</Badge>;
    case 'accepted':
      return <Badge variant="success">Đạt yêu cầu</Badge>;
    case 'needs_revision':
      return <Badge variant="warning">Cần chỉnh sửa</Badge>;
    case 'rejected':
      return <Badge variant="error">Từ chối</Badge>;
    case 'late':
      return <Badge variant="error">Nộp trễ</Badge>;
    case 'locked':
      return <Badge variant="secondary">Đã khóa</Badge>;
    default:
      return <Badge variant="secondary">{getTechnicalLabel(status)}</Badge>;
  }
};

export default function MilestoneCard({
  milestone,
  isStudent,
  isLecturer,
  isStaff,
  isSupervisor,
  setShowSubmitModal,
  openEditMilestone,
  setMilestoneToDelete,
  setShowFeedbackModal,
  handleToggleLockMilestone,
  handleDownloadFile,
}) {
  const hasSubmissions = milestone.submissions && milestone.submissions.length > 0;
  const hasFeedbacks = milestone.feedback && milestone.feedback.length > 0;

  return (
    <Card
      title={milestone.title}
      subtitle={`Mô tả: ${milestone.description || 'Không có mô tả chi tiết.'}`}
      actions={
        <div className={css.s12}>
          {getMilestoneStatusBadge(milestone.status)}

          {/* Student Upload Button */}
          {isStudent && milestone.status !== 'locked' && milestone.status !== 'accepted' && (
            <Button variant="primary" size="sm" onClick={() => setShowSubmitModal(milestone._id)}>
              <Upload size={14} /> Nộp bài
            </Button>
          )}

          {/* Lecturer / Staff Actions */}
          {(isLecturer || isStaff) && (
            <>
              {isSupervisor && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => openEditMilestone(milestone)}>
                    <PencilSimple size={14} /> Sửa
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={hasSubmissions}
                    title={hasSubmissions ? 'Mốc đã có bài nộp nên không thể xóa' : 'Xóa mốc nộp bài'}
                    onClick={() => setMilestoneToDelete(milestone)}
                  >
                    <Trash size={14} /> Xóa
                  </Button>
                </>
              )}
              {hasSubmissions && milestone.status !== 'locked' && (
                <Button variant="primary" size="sm" onClick={() => setShowFeedbackModal(milestone._id)}>
                  <Shield size={14} /> Đánh giá bản nộp
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => handleToggleLockMilestone(milestone._id, milestone.status)}>
                <Clock size={14} /> {milestone.status === 'locked' ? 'Mở khóa' : 'Khóa mốc'}
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* Milestone details (Deadline) */}
      <div className={css.s13}>
        <span className={css.s14}>
          <Calendar size={16} />
          Hạn chót:
        </span>
        <strong className={css.s15}>{formatDate(milestone.deadline)}</strong>
      </div>

      {/* Submissions section details */}
      <div className={css.s16}>
        {hasSubmissions ? (
          <div>
            <p className={css.s17}>Tài liệu sinh viên đã nộp:</p>
            {milestone.submissions.map((sub, idx) => (
              <div key={idx} className={css.s18}>
                <div>
                  <p className={css.s19}>Ghi chú sinh viên: &quot;{sub.note || 'Không có ghi chú.'}&quot;</p>
                  <p className={css.s20}>
                    Người nộp: {sub.submittedBy?.fullName || 'Sinh viên'} | Thời gian: {formatDate(sub.submittedAt)}
                  </p>
                </div>
                {sub.fileIds?.map((fId) => (
                  <Button
                    key={fId}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownloadFile(fId)}
                    className={css.s65}
                  >
                    <Download size={14} /> Tải báo cáo
                  </Button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className={css.s21}>Nhóm sinh viên chưa nộp tài liệu báo cáo cho mốc này.</p>
        )}

        {/* Feedback section details */}
        {hasFeedbacks && (
          <div className={css.s22}>
            <p className={css.s23}>Ý kiến nhận xét đánh giá từ Giảng viên:</p>
            {milestone.feedback.map((feed, idx) => (
              <div
                key={idx}
                className={[
                  css.feedbackCard,
                  feed.status === 'accepted' ? css.feedbackAccepted : css.feedbackRejected,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={css.s24}>
                  <strong className={feed.status === 'accepted' ? css.feedbackStatusAccepted : css.feedbackStatusWarning}>
                    [
                    {feed.status === 'accepted'
                      ? 'ĐẠT YÊU CẦU'
                      : feed.status === 'needs_revision'
                      ? 'CẦN CHỈNH SỬA'
                      : 'TỪ CHỐI'}
                    ]
                  </strong>
                  <span className={css.s25}>{formatDate(feed.createdAt)}</span>
                </div>
                <p className={css.s26}>Lời phê: &quot;{feed.comment}&quot;</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
