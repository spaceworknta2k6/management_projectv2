'use client';

import { useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, getTechnicalLabel } from '@/lib/utils';
import { Calendar, Upload, PencilSimple, Trash, Shield, Clock, Download, Sparkle } from '@phosphor-icons/react';
import css from '../page.module.css';

const cleanAiError = (errStr) => {
  if (!errStr) return 'AI phân tích thất bại.';
  if (errStr.includes('The document has no pages')) {
    return 'Tài liệu PDF tải lên không chứa trang hoặc nội dung bị lỗi định dạng. Vui lòng kiểm tra và tải lên tệp PDF thực tế.';
  }
  if (errStr.includes('quota') || errStr.includes('rate limit')) {
    return 'Giới hạn/Hạn ngạch dịch vụ AI hiện tại đã hết. Vui lòng thử lại sau.';
  }
  return errStr;
};

const formatMarkdown = (text) => {
  if (!text) return '';
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+(.*)$/gm, '• $1')
    .replace(/^(\d+\.\s+.*)$/gm, '<strong style="color: #a78bfa; display: block; margin-top: 8px;">$1</strong>');

  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
};

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

  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [showAiFileId, setShowAiFileId] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const toggleAiReport = async (fileId) => {
    if (showAiFileId === fileId) {
      setShowAiFileId(null);
      setAiReport(null);
      return;
    }

    setShowAiFileId(fileId);
    setLoadingAi(true);
    setAiReport(null);

    try {
      const res = await api.post(`/ai/milestones/${milestone._id}/files/${fileId}/analyze`, {}, token);
      const job = res.data?.data || res.data;
      if (job.status === 'succeeded') {
        setAiReport(job.result);
      } else if (job.status === 'failed') {
        toast.error(cleanAiError(job.error));
        setShowAiFileId(null);
      } else {
        toast.info('Tác vụ AI đang được xử lý...');
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi kết nối với dịch vụ phân tích AI.');
      setShowAiFileId(null);
    } finally {
      setLoadingAi(false);
    }
  };

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
              <div key={idx} style={{ marginBottom: '12px' }}>
                <div className={css.s18}>
                  <div>
                    <p className={css.s19}>Ghi chú sinh viên: &quot;{sub.note || 'Không có ghi chú.'}&quot;</p>
                    <p className={css.s20}>
                      Người nộp: {sub.submittedBy?.fullName || 'Sinh viên'} | Thời gian: {formatDate(sub.submittedAt)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {sub.fileIds?.map((fId) => (
                      <div key={fId} style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownloadFile(fId)}
                          className={css.s65}
                        >
                          <Download size={14} /> Tải báo cáo
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleAiReport(fId)}
                          className={css.s65}
                        >
                          <Sparkle size={14} /> Nhận xét AI
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Review Result for this submission's file */}
                {sub.fileIds?.map((fId) => (
                  showAiFileId === fId && (
                    <div key={`ai-panel-${fId}`} className={css.aiAnalysisSection} style={{ marginBottom: '12px' }}>
                      <div className={css.aiHeader}>
                        <span className={css.aiTitle}>
                          <Sparkle size={18} />
                          Trợ lý AI nhận xét báo cáo
                        </span>
                        {loadingAi ? (
                          <span className={css.aiStatusBadge} style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                            Đang phân tích...
                          </span>
                        ) : (
                          aiReport && (
                            <span
                              className={`${css.aiStatusBadge} ${
                                aiReport.structureOk ? css.aiStatusOk : css.aiStatusError
                              }`}
                            >
                              {aiReport.structureOk
                                ? 'Cấu trúc & Định dạng: ĐẠT'
                                : 'Cấu trúc & Định dạng: CHƯA ĐẠT'}
                            </span>
                          )
                        )}
                      </div>

                      {loadingAi ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                          <span className="text-muted" style={{ fontSize: '13px' }}>Đang nạp nhận xét từ Trợ lý AI học thuật...</span>
                        </div>
                      ) : aiReport ? (
                        <div className={css.aiContent}>
                          {aiReport.missingSections && aiReport.missingSections.length > 0 && (
                            <div>
                              <div className={css.aiSectionTitle}>Phần/Yêu cầu thiếu hoặc lỗi:</div>
                              <ul className={css.aiMissingList}>
                                {aiReport.missingSections.map((sec, i) => (
                                  <li key={i} className={css.aiMissingItem}>
                                    {sec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {aiReport.weaknesses && (
                            <div>
                              <div className={css.aiSectionTitle}>Điểm yếu cần khắc phục:</div>
                              <div className={css.aiText}>{formatMarkdown(aiReport.weaknesses)}</div>
                            </div>
                          )}

                          {aiReport.suggestions && (
                            <div>
                              <div className={css.aiSectionTitle}>Gợi ý chỉnh sửa chi tiết:</div>
                              <div className={css.aiText}>{formatMarkdown(aiReport.suggestions)}</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                          <span className="text-muted" style={{ fontSize: '13px' }}>Không tìm thấy nhận xét. Thử lại sau.</span>
                        </div>
                      )}
                    </div>
                  )
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
