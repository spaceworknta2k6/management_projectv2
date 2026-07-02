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
      return <Badge variant="info">Cho nop bai</Badge>;
    case 'submitted':
      return <Badge variant="warning">Da nop</Badge>;
    case 'accepted':
      return <Badge variant="success">Dat yeu cau</Badge>;
    case 'needs_revision':
      return <Badge variant="warning">Can chinh sua</Badge>;
    case 'rejected':
      return <Badge variant="error">Tu choi</Badge>;
    case 'late':
      return <Badge variant="error">Nop tre</Badge>;
    case 'locked':
      return <Badge variant="secondary">Da khoa</Badge>;
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
      subtitle={`Mo ta: ${milestone.description || 'Khong co mo ta chi tiet.'}`}
      actions={
        <div className={css.s12}>
          {getMilestoneStatusBadge(milestone.status)}

          {isStudent && milestone.status !== 'locked' && milestone.status !== 'accepted' && (
            <Button variant="primary" size="sm" onClick={() => setShowSubmitModal(milestone._id)}>
              <Upload size={14} /> Nop bai
            </Button>
          )}

          {(isLecturer || isStaff) && (
            <>
              {isSupervisor && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => openEditMilestone(milestone)}>
                    <PencilSimple size={14} /> Sua
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={hasSubmissions}
                    title={hasSubmissions ? 'Moc da co bai nop nen khong the xoa' : 'Xoa moc nop bai'}
                    onClick={() => setMilestoneToDelete(milestone)}
                  >
                    <Trash size={14} /> Xoa
                  </Button>
                </>
              )}
              {hasSubmissions && milestone.status !== 'locked' && (
                <Button variant="primary" size="sm" onClick={() => setShowFeedbackModal(milestone._id)}>
                  <Shield size={14} /> Danh gia ban nop
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => handleToggleLockMilestone(milestone._id, milestone.status)}>
                <Clock size={14} /> {milestone.status === 'locked' ? 'Mo khoa' : 'Khoa moc'}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className={css.s13}>
        <span className={css.s14}>
          <Calendar size={16} />
          Han chot:
        </span>
        <strong className={css.s15}>{formatDate(milestone.deadline)}</strong>
      </div>

      <div className={css.s16}>
        {hasSubmissions ? (
          <div>
            <p className={css.s17}>Tai lieu sinh vien da nop:</p>
            {milestone.submissions.map((sub, idx) => (
              <div key={idx} style={{ marginBottom: '12px' }}>
                <div className={css.s18}>
                  <div>
                    <p className={css.s19}>Ghi chu sinh vien: &quot;{sub.note || 'Khong co ghi chu.'}&quot;</p>
                    <p className={css.s20}>
                      Nguoi nop: {sub.submittedBy?.fullName || 'Sinh vien'} | Thoi gian: {formatDate(sub.submittedAt)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {sub.fileIds?.map((fileId) => (
                      <Button
                        key={fileId}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownloadFile(fileId)}
                        className={css.s65}
                      >
                        <Download size={14} /> Tai bao cao
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={css.s21}>Nhom sinh vien chua nop tai lieu bao cao cho moc nay.</p>
        )}

        {hasFeedbacks && (
          <div className={css.s22}>
            <p className={css.s23}>Y kien nhan xet danh gia tu giang vien:</p>
            {milestone.feedback.map((feed, idx) => (
              <div
                key={idx}
                className={[
                  css.feedbackCard,
                  feed.status === 'accepted' ? css.feedbackAccepted : css.feedbackRejected,
                ].filter(Boolean).join(' ')}
              >
                <div className={css.s24}>
                  <strong className={feed.status === 'accepted' ? css.feedbackStatusAccepted : css.feedbackStatusWarning}>
                    [
                    {feed.status === 'accepted'
                      ? 'DAT YEU CAU'
                      : feed.status === 'needs_revision'
                      ? 'CAN CHINH SUA'
                      : 'TU CHOI'}
                    ]
                  </strong>
                  <span className={css.s25}>{formatDate(feed.createdAt)}</span>
                </div>
                <p className={css.s26}>Loi phe: &quot;{feed.comment}&quot;</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
