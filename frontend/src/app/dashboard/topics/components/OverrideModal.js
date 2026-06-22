'use client';

import Button from '@/components/ui/Button';
import css from '../page.module.css';

export default function OverrideModal({
  overrideComment,
  setOverrideComment,
  handleOverrideSubmit,
  onClose,
  overriding,
}) {
  return (
    <div className={css.s37}>
      <div className={css.s38}>
        <div className={css.s39}>
          <h3 className={css.s40}>Ghi đè thủ công kết quả trùng lặp AI</h3>
        </div>
        <form onSubmit={handleOverrideSubmit} className={css.s41}>
          <div className={css.s42}>
            <label className={css.s43}>Lời phê bình/Lý do duyệt ghi đè</label>
            <textarea
              value={overrideComment}
              onChange={(e) => setOverrideComment(e.target.value)}
              placeholder="Nhập lý do chi tiết từ Giáo vụ để lưu trữ nhật ký hệ thống (ví dụ: Hai đề tài sử dụng hai kiến trúc nghiệp vụ khác nhau hoàn toàn)..."
              rows={4}
              className={css.s72}
            />
          </div>

          <div className={css.s44}>
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={overriding}>
              Xác nhận Ghi đè
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
