'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { PlusSquare } from '@phosphor-icons/react';
import css from '../page.module.css';

export default function CreateMilestoneModal({
  onClose,
  handleCreateMilestone,
  editingMilestone,
  newMilestone,
  setNewMilestone,
  creatingMilestone,
}) {
  return (
    <div className={css.s56}>
      <div className={css.s57}>
        <div className={css.s58}>
          <h3 className={css.s59}>
            {editingMilestone ? 'Chỉnh sửa mốc nộp báo cáo' : 'Tạo mốc nộp báo cáo mới'}
          </h3>
          <button onClick={onClose} className={css.s70}>
            &times;
          </button>
        </div>
        <form onSubmit={handleCreateMilestone} className={css.s60}>
          <Input
            label="Tên mốc báo cáo"
            name="title"
            value={newMilestone.title}
            onChange={(e) => setNewMilestone((p) => ({ ...p, title: e.target.value }))}
            required
          />

          <div className={css.s61}>
            <label className={css.s62}>Mô tả chi tiết</label>
            <textarea
              value={newMilestone.description}
              onChange={(e) => setNewMilestone((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className={css.s71}
            />
          </div>

          <Input
            label="Hạn chót nộp báo cáo"
            name="deadline"
            type="datetime-local"
            value={newMilestone.deadline}
            onChange={(e) => setNewMilestone((p) => ({ ...p, deadline: e.target.value }))}
            required
          />

          <div className={css.s63}>
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={creatingMilestone}>
              <PlusSquare size={16} /> {editingMilestone ? 'Cập nhật mốc' : 'Tạo mốc'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
