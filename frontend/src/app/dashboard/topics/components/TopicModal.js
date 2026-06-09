'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import css from '../page.module.css';

export default function TopicModal({
  editingTopicId,
  form,
  setForm,
  periods,
  handleSubmitTopic,
  onClose,
  submitting,
}) {
  return (
    <div className={css.s27}>
      <div className={css.s28}>
        <div className={css.s29}>
          <h3 className={css.s30}>
            {editingTopicId ? 'Chỉnh sửa đề tài đồ án' : 'Đề xuất đề tài đồ án mới'}
          </h3>
        </div>
        <form onSubmit={handleSubmitTopic} className={css.s31}>
          <div className={css.s32}>
            <label className={css.s33}>Chọn đợt đồ án</label>
            <select
              value={form.periodId}
              onChange={(e) => setForm((p) => ({ ...p, periodId: e.target.value }))}
              className={css.s70}
            >
              {periods.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Tên đề tài đồ án"
            name="title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Nhập tên đề tài bằng tiếng Việt có dấu..."
            required
          />

          <div className={css.s34}>
            <label className={css.s35}>Tóm tắt/Nội dung thực hiện</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
              placeholder="Mô tả tóm tắt nội dung nghiên cứu, công nghệ sử dụng, và kết quả mong đợi..."
              rows={4}
              className={css.s71}
            />
          </div>

          <div className={css.s36}>
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingTopicId ? 'Cập nhật' : 'Đề xuất'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
