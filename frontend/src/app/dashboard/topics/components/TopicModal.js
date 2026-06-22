'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import css from '../page.module.css';

export default function TopicModal({
  editingTopicId,
  form,
  setForm,
  periods,
  groups = [],
  handleSubmitTopic,
  onClose,
  submitting,
  isLecturerOrStaff = false,
}) {
  return (
    <div className={css.s27}>
      <div className={css.s28}>
        <div className={css.s29}>
          <h3 className={css.s30}>
            {editingTopicId 
              ? (isLecturerOrStaff ? 'Chỉnh sửa đề tài' : 'Chỉnh sửa đề xuất đề tài') 
              : (isLecturerOrStaff ? 'Khởi tạo đề tài đồ án mới' : 'Đề xuất đề tài đồ án mới')}
          </h3>
        </div>
        <form onSubmit={handleSubmitTopic} className={css.s31}>
          <div className={css.s32}>
            <label className={css.s33}>Chọn học phần đồ án</label>
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

          {!editingTopicId && !isLecturerOrStaff && (
            <>
              <div className={css.s32}>
                <label className={css.s33}>Hình thức thực hiện</label>
                <select
                  name="ownerType"
                  value={form.ownerType}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    ownerType: e.target.value,
                    groupId: e.target.value === 'student' ? '' : p.groupId,
                  }))}
                  className={css.s70}
                >
                  <option value="student">Cá nhân</option>
                  <option value="group">Nhóm</option>
                </select>
              </div>

              {form.ownerType === 'group' && (
                <div className={css.s32}>
                  <label className={css.s33}>Chọn nhóm</label>
                  <select
                    value={form.groupId}
                    onChange={(e) => setForm((p) => ({ ...p, groupId: e.target.value }))}
                    className={css.s70}
                  >
                    <option value="">Chọn nhóm đã tham gia</option>
                    {groups.map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  {groups.length === 0 && (
                    <p className={css.s19}>Bạn chưa có nhóm đã chấp nhận trong học phần này.</p>
                  )}
                </div>
              )}

              {form.ownerType === 'student' && (
                <p className={css.s19}>Nếu bạn chưa có trong danh sách học phần này, hệ thống sẽ thông báo khi gửi đề xuất.</p>
              )}
            </>
          )}

          {isLecturerOrStaff && (
            <>
              <div className={css.s32} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className={css.s33}>Hình thức làm đồ án cho phép</label>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.allowIndividual === true || form.allowIndividual === 'true'}
                      onChange={(e) => setForm(p => ({ ...p, allowIndividual: e.target.checked }))}
                    />
                    Cá nhân
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.allowGroup === true || form.allowGroup === 'true'}
                      onChange={(e) => setForm(p => ({ ...p, allowGroup: e.target.checked }))}
                    />
                    Nhóm
                  </label>
                </div>
              </div>

              {(form.allowGroup === true || form.allowGroup === 'true') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <Input
                    label="Thành viên tối thiểu/nhóm"
                    type="number"
                    min="2"
                    value={form.groupMinSize}
                    onChange={(e) => setForm(p => ({ ...p, groupMinSize: e.target.value }))}
                  />
                  <Input
                    label="Thành viên tối đa/nhóm"
                    type="number"
                    min="2"
                    value={form.groupMaxSize}
                    onChange={(e) => setForm(p => ({ ...p, groupMaxSize: e.target.value }))}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <Input
                  label="Số SV cá nhân tối đa nhận"
                  type="number"
                  min="0"
                  value={form.capacityMaxStudents}
                  onChange={(e) => setForm(p => ({ ...p, capacityMaxStudents: e.target.value }))}
                />
                <Input
                  label="Số nhóm tối đa nhận"
                  type="number"
                  min="0"
                  value={form.capacityMaxGroups}
                  onChange={(e) => setForm(p => ({ ...p, capacityMaxGroups: e.target.value }))}
                />
              </div>
            </>
          )}

          <Input
            label="Tên đề tài đồ án"
            name="title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Nhập tên đề tài bằng tiếng Việt có dấu..."
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
              {editingTopicId ? 'Cập nhật' : (isLecturerOrStaff ? 'Khởi tạo' : 'Đề xuất')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
