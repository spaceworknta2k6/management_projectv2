'use client';

import Button from '@/components/ui/Button';
import css from '../page.module.css';

export default function ReviewFeedbackModal({
  onClose,
  handleFeedbackSubmit,
  feedbackStatus,
  setFeedbackStatus,
  feedbackComment,
  setFeedbackComment,
  submittingFeedback,
}) {
  return (
    <div className={css.s46}>
      <div className={css.s47}>
        <div className={css.s48}>
          <h3 className={css.s49}>Đánh giá báo cáo đồ án của sinh viên</h3>
          <button onClick={onClose} className={css.s67}>
            &times;
          </button>
        </div>
        <form onSubmit={handleFeedbackSubmit} className={css.s50}>
          <div className={css.s51}>
            <label className={css.s52}>Kết quả thẩm định</label>
            <select
              name="status"
              value={feedbackStatus}
              onChange={(e) => setFeedbackStatus(e.target.value)}
              className={css.s68}
            >
              <option value="accepted">Đạt yêu cầu (Accepted)</option>
              <option value="needs_revision">Cần chỉnh sửa (Needs Revision)</option>
              <option value="rejected">Từ chối (Rejected)</option>
            </select>
          </div>

          <div className={css.s53}>
            <label className={css.s54}>Nhận xét chi tiết</label>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Nhập lời phê bình hoặc hướng dẫn chỉnh sửa chi tiết cho sinh viên..."
              rows={4}
              className={css.s69}
            />
          </div>

          <div className={css.s55}>
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={submittingFeedback}>
              Gửi đánh giá
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
