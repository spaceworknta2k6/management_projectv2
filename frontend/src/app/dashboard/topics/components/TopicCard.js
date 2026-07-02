'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { getStatus } from '@/lib/utils';
import { getAcademicUnitLabel, getTopicDomainLabel } from '@/lib/academicUnits';
import { Pencil, X, Check, Prohibit } from '@phosphor-icons/react';
import css from '../page.module.css';

export default function TopicCard({
  topic,
  user,
  isStaff,
  isLecturer,
  isStudent,
  handleRequestRevision,
  handleReject,
  handleApprove,
  handleAssignSupervisorClick,
  handleCancelClick,
  handleEditClick,
  onRegisterTopic,
  onPublishTopic,
  onUnpublishTopic,
}) {
  const mappedStatus = topic.status === 'submitted' ? 'pending_review' : topic.status;
  const statusInfo = getStatus(mappedStatus);
  const canCancelTopic = isStaff && !['cancelled', 'completed'].includes(topic.status);
  const isAwaitingSupervisorAssignment = topic.status === 'approved';
  const lecturerId = user?.lecturerId?.toString();
  const proposedSupervisorId = (topic.proposedSupervisorId?._id || topic.proposedSupervisorId)?.toString();
  const proposedByLecturerId = (topic.proposedByLecturerId?._id || topic.proposedByLecturerId)?.toString();
  const canReviewTopic = (isStaff || (
    isLecturer &&
    lecturerId &&
    (proposedSupervisorId === lecturerId || proposedByLecturerId === lecturerId)
  )) && ['pending_review', 'submitted'].includes(topic.status);

  const proposerText = topic.createdByRole === 'lecturer'
    ? `Giang vien: ${topic.proposedByLecturerId?.userId?.fullName || 'Giang vien'}`
    : `Sinh vien de xuat: ${topic.proposedByStudentId?.userId?.fullName || 'Sinh vien'}`;

  return (
    <Card
      title={topic.title}
      subtitle={`${proposerText} | Hoc ky: ${topic.periodId?.semester || '-'}`}
      actions={
        <div className={css.s9}>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          {isAwaitingSupervisorAssignment && (
            <Badge variant="warning">Cho phan cong GVHD</Badge>
          )}

          {canReviewTopic && (
            <>
              <Button variant="secondary" size="sm" onClick={() => handleRequestRevision(topic._id)}>
                <Pencil size={14} /> Yeu cau sua
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleReject(topic._id)}>
                <X size={14} /> Tu choi
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleApprove(topic._id)}>
                <Check size={14} /> Duyet de tai
              </Button>
            </>
          )}

          {isStaff && topic.status === 'approved' && (
            <>
              {onPublishTopic && (
                <Button variant="primary" size="sm" onClick={() => onPublishTopic(topic._id)}>
                  Cong khai de tai
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => handleAssignSupervisorClick(topic)}>
                <Check size={14} /> Phan cong GVHD
              </Button>
            </>
          )}

          {isStaff && topic.status === 'published' && onUnpublishTopic && (
            <Button variant="secondary" size="sm" onClick={() => onUnpublishTopic(topic._id)}>
              Huy cong khai
            </Button>
          )}

          {isStudent && topic.status === 'published' && topic.createdByRole === 'lecturer' && onRegisterTopic && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {topic.allowIndividual && (
                <Button variant="primary" size="sm" onClick={() => onRegisterTopic(topic._id, 'student')}>
                  Dang ky ca nhan
                </Button>
              )}
              {topic.allowGroup && (
                <Button variant="primary" size="sm" onClick={() => onRegisterTopic(topic._id, 'group')}>
                  Dang ky nhom
                </Button>
              )}
            </div>
          )}

          {isStudent && topic.status === 'needs_revision' && topic.proposedByStudentId?._id?.toString() === user?.studentId?.toString() && (
            <Button variant="secondary" size="sm" onClick={() => handleEditClick(topic)}>
              <Pencil size={14} /> Chinh sua
            </Button>
          )}

          {canCancelTopic && (
            <Button variant="danger" size="sm" onClick={() => handleCancelClick(topic)}>
              <Prohibit size={14} /> Huy de tai
            </Button>
          )}
        </div>
      }
    >
      <div className={css.s10}>
        <p className={css.s11}>Tom tat de tai:</p>
        <p className={css.s12}>{topic.summary || 'Khong co tom tat chi tiet.'}</p>
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Badge variant="info">{getAcademicUnitLabel(topic.academicUnit || topic.periodId?.academicUnit)}</Badge>
          <Badge variant="neutral">{getTopicDomainLabel(topic.topicDomain)}</Badge>
        </div>

        {topic.createdByRole === 'lecturer' && (
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--bg-card-nested, #f8fafc)', borderRadius: '6px', fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '16px', border: '1px solid var(--border)' }}>
            {topic.allowIndividual && (
              <span>Ca nhan: <strong>{topic.currentStudentCount || 0} / {topic.capacityMaxStudents || 0} SV</strong></span>
            )}
            {topic.allowGroup && (
              <span>Nhom: <strong>{topic.currentGroupCount || 0} / {topic.capacityMaxGroups || 0} nhom</strong> {topic.minGroupSize && `(${topic.minGroupSize}-${topic.maxGroupSize} SV/nhom)`}</span>
            )}
          </div>
        )}

        {isAwaitingSupervisorAssignment && (
          <div className={css.assignmentNotice}>
            <div className={css.assignmentNoticeTitle}>Trang thai tao du an</div>
            <div className={css.assignmentNoticeItems}>
              <span>Da duyet</span>
              <span>Chua tao du an</span>
              <span>Can phan cong GVHD</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
