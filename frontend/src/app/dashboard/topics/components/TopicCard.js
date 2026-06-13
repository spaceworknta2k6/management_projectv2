'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { getStatus } from '@/lib/utils';
import { Pencil, X, Check, Cpu, Sparkle, Shield, Prohibit } from '@phosphor-icons/react';
import css from '../page.module.css';

export default function TopicCard({
  topic,
  user,
  isStaff,
  isStudent,
  handleRequestRevision,
  handleReject,
  handleApprove,
  handleCancelClick,
  handleEditClick,
  handleCheckDuplicate,
  aiCheckingId,
  aiResults,
  setShowOverrideModal,
}) {
  const mappedStatus = (topic.status === 'submitted' || topic.status === 'ai_checked') ? 'pending_review' : topic.status;
  const statusInfo = getStatus(mappedStatus);
  const aiJob = aiResults[topic._id];
  const canCancelTopic = isStaff && !['cancelled', 'completed'].includes(topic.status);

  return (
    <Card
      title={topic.title}
      subtitle={`Sinh viên đề xuất: ${topic.proposedByStudentId?.userId?.fullName || 'Giáo vụ'} | Học kỳ: ${topic.periodId?.semester || '—'}`}
      actions={
        <div className={css.s9}>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>

          {isStaff && (topic.status === 'pending_review' || topic.status === 'submitted' || topic.status === 'ai_checked') && (
            <>
              <Button variant="secondary" size="sm" onClick={() => handleRequestRevision(topic._id)}>
                <Pencil size={14} /> Yêu cầu sửa
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleReject(topic._id)}>
                <X size={14} /> Từ chối
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleApprove(topic._id)}>
                <Check size={14} /> Duyệt đề tài
              </Button>
            </>
          )}

          {isStudent && topic.status === 'needs_revision' && topic.proposedByStudentId?._id?.toString() === user?.studentId?.toString() && (
            <Button variant="secondary" size="sm" onClick={() => handleEditClick(topic)}>
              <Pencil size={14} /> Chỉnh sửa
            </Button>
          )}

          {canCancelTopic && (
            <Button variant="danger" size="sm" onClick={() => handleCancelClick(topic)}>
              <Prohibit size={14} /> Hủy đề tài
            </Button>
          )}
        </div>
      }
    >
      <div className={css.s10}>
        <p className={css.s11}>Tóm tắt đề tài:</p>
        <p className={css.s12}>{topic.summary || 'Không có tóm tắt chi tiết.'}</p>

        {/* AI Duplicate Checker section */}
        {isStaff && (
          <div className={css.s13}>
            <div className={css.s14}>
              <div className={css.s15}>
                <Cpu size={18} className={css.s16} />
                <span className={css.s17}>Kiểm tra trùng lặp đề tài</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={aiCheckingId === topic._id}
                onClick={() => handleCheckDuplicate(topic._id)}
              >
                <Sparkle size={14} /> Kiểm tra trùng lặp
              </Button>
            </div>

            {/* Display AI outcome */}
            {aiJob && (
              <div className={css.s18}>
                {aiJob.status === 'running' ? (
                  <p className={css.s19}>AI đang phân tích độ tương đồng ngữ nghĩa...</p>
                ) : aiJob.status === 'succeeded' ? (
                  <div>
                    <div className={css.s20}>
                      <Badge variant={aiJob.result?.hasRisk ? 'error' : 'success'}>
                        {aiJob.result?.hasRisk ? 'Có rủi ro trùng lặp cao' : 'An toàn'}
                      </Badge>
                      <span>
                        Tỉ lệ trùng lặp:{' '}
                        <strong className={aiJob.result?.hasRisk ? css.riskHigh : css.riskLow}>
                          {aiJob.result?.riskScore}%
                        </strong>
                      </span>
                    </div>

                    {aiJob.result?.hasRisk && (
                      <div className={css.s21}>
                        <p className={css.s22}>Lý giải của AI: {aiJob.result?.reasoning}</p>
                        {aiJob.manualOverride?.isOverridden ? (
                          <div className={css.s23}>
                            <strong className={css.s24}>[ĐÃ GHI ĐÈ BỞI GIÁO VỤ]</strong> Lời phê:{' '}
                            {aiJob.manualOverride?.comment}
                          </div>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            className={css.s25}
                            onClick={() => setShowOverrideModal(aiJob._id)}
                          >
                            <Shield size={14} /> Phê duyệt ghi đè thủ công
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className={css.s26}>AI kiểm tra thất bại: {aiJob.error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
