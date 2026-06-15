'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Check, Upload, Sparkle } from '@phosphor-icons/react';
import css from '../page.module.css';

const formatMarkdown = (text) => {
  if (!text) return '';
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*]\s+(.*)$/gm, '• $1')
    .replace(/^(\d+\.\s+.*)$/gm, '<strong style="color: #a78bfa; display: block; margin-top: 8px;">$1</strong>');

  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
};

export default function SubmitReportModal({
  onClose,
  handleSubmissionSubmit,
  handleFileUpload,
  uploadingFile,
  uploadedFileId,
  fileName,
  submissionNote,
  setSubmissionNote,
  submittingWork,
  aiAnalysisResult,
  analyzingFile,
  runAiAnalysis,
  milestoneId,
}) {
  const isPdf = fileName && fileName.toLowerCase().endsWith('.pdf');
  const isDocx = fileName && (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc'));
  const isSupportedByAi = isPdf || isDocx;
  return (
    <div className={css.s27}>
      <div className={css.s28} style={aiAnalysisResult ? { maxWidth: '680px', transition: 'max-width 0.3s ease' } : { transition: 'max-width 0.3s ease' }}>
        <div className={css.s29}>
          <h3 className={css.s30}>Nộp tài liệu báo cáo đồ án</h3>
          <button onClick={onClose} className={css.s66}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmissionSubmit} className={css.s31}>
          {/* File upload selector */}
          <div className={css.s32}>
            <label className={css.s33}>
              Chọn báo cáo (PDF, ZIP, DOCX, giới hạn 10MB) <span className={css.s34}>*</span>
            </label>
            <div className={css.s35}>
              <input type="file" onChange={handleFileUpload} className={css.s36} />
              {uploadingFile ? (
                <div className={css.s37}>
                  <Spinner />
                  <span>Đang tải tệp tin và quét virus an toàn...</span>
                </div>
              ) : fileName ? (
                <div className={css.s38}>
                  <Check size={28} className={css.s39} />
                  <span className={css.s40}>{fileName}</span>
                  <span className={css.s41}>Nhấp để chọn tệp tin khác</span>
                </div>
              ) : (
                <div className={css.s42}>
                  <Upload size={28} className={css.s43} />
                  <span className={css.s44}>Kéo thả hoặc nhấp để chọn tệp tin tải lên</span>
                </div>
              )}
            </div>
          </div>

          {/* Prompt tip for non-supported files */}
          {uploadedFileId && !isSupportedByAi && (
            <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', color: '#f59e0b', fontSize: '12px', lineHeight: '1.4' }}>
              💡 <strong>Gợi ý học thuật:</strong> Trợ lý AI hỗ trợ thẩm định báo cáo dưới định dạng <strong>PDF</strong> hoặc <strong>Word (.docx)</strong>. Vui lòng tải đúng định dạng để chạy phân tích AI.
            </div>
          )}

          {/* AI Thesis Review Assistant Block */}
          {uploadedFileId && isSupportedByAi && (
            <div style={{ marginTop: '12px', marginBottom: '12px' }}>
              {isDocx && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '8px' }}>
                  ℹ️ Trợ lý AI sẽ trích xuất nội dung văn bản từ tệp Word để đánh giá cấu trúc bìa, logic nội dung và trích dẫn tài liệu tham khảo.
                </div>
              )}
              <div className={css.aiButtonBlock}>
                <Button
                  type="button"
                  onClick={() => runAiAnalysis(milestoneId, uploadedFileId)}
                  loading={analyzingFile}
                  disabled={analyzingFile}
                  className={css.aiButton}
                >
                  <Sparkle size={16} style={{ marginRight: '6px' }} />
                  Phân tích bản thảo bằng AI
                </Button>
              </div>

              {aiAnalysisResult && (
                <div className={css.aiAnalysisSection}>
                  <div className={css.aiHeader}>
                    <span className={css.aiTitle}>
                      <Sparkle size={18} />
                      Trợ lý AI nhận xét
                    </span>
                    <span
                      className={`${css.aiStatusBadge} ${
                        aiAnalysisResult.structureOk ? css.aiStatusOk : css.aiStatusError
                      }`}
                    >
                      {aiAnalysisResult.structureOk
                        ? 'Cấu trúc & Định dạng: ĐẠT'
                        : 'Cấu trúc & Định dạng: CHƯA ĐẠT'}
                    </span>
                  </div>

                  <div className={css.aiContent}>
                    {aiAnalysisResult.missingSections && aiAnalysisResult.missingSections.length > 0 && (
                      <div>
                        <div className={css.aiSectionTitle}>Phần/Yêu cầu thiếu hoặc lỗi:</div>
                        <ul className={css.aiMissingList}>
                          {aiAnalysisResult.missingSections.map((sec, i) => (
                            <li key={i} className={css.aiMissingItem}>
                              {sec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiAnalysisResult.weaknesses && (
                      <div>
                        <div className={css.aiSectionTitle}>Điểm yếu cần khắc phục:</div>
                        <div className={css.aiText}>{formatMarkdown(aiAnalysisResult.weaknesses)}</div>
                      </div>
                    )}

                    {aiAnalysisResult.suggestions && (
                      <div>
                        <div className={css.aiSectionTitle}>Gợi ý chỉnh sửa chi tiết:</div>
                        <div className={css.aiText}>{formatMarkdown(aiAnalysisResult.suggestions)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <Input
            label="Ghi chú đính kèm"
            value={submissionNote}
            onChange={(e) => setSubmissionNote(e.target.value)}
            placeholder="Nhập lời chào hoặc thông điệp gửi GVHD..."
          />

          <div className={css.s45}>
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={submittingWork} disabled={!uploadedFileId}>
              Nộp bài ngay
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
