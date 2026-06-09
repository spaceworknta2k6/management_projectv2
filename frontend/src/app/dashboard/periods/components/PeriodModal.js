'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { FilePlus } from '@phosphor-icons/react';
import css from '../page.module.css';

export default function PeriodModal({
  editingPeriod,
  form,
  formErrors,
  handleChange,
  handleSubmit,
  onClose,
  submitting,
}) {
  return (
    <div className={css.s22}>
      <div className={css.s23}>
        {/* Modal Title Header */}
        <div className={css.s24}>
          <h3 className={css.s25}>
            {editingPeriod ? 'Chỉnh sửa đợt đồ án' : 'Khởi tạo đợt đồ án mới'}
          </h3>
          <button onClick={onClose} className={css.s38}>
            &times;
          </button>
        </div>

        {/* Modal Body form */}
        <form onSubmit={handleSubmit} className={css.s26}>
          <div className={css.s27}>
            <Input
              label="Tên đợt đồ án"
              name="name"
              value={form.name}
              onChange={handleChange}
              error={formErrors.name}
              required
              className={css.s28}
            />

            <Input
              label="Năm học"
              name="schoolYear"
              value={form.schoolYear}
              onChange={handleChange}
              error={formErrors.schoolYear}
              required
            />
            <Input
              label="Học kỳ"
              name="semester"
              value={form.semester}
              onChange={handleChange}
              error={formErrors.semester}
              required
            />

            <div className={css.s29}>
              <label className={css.s30}>
                Loại đồ án <span className={css.s31}>*</span>
              </label>
              <select name="type" value={form.type} onChange={handleChange} className={css.s32}>
                <option value="foundation_project">Đồ án cơ sở (Foundation Project)</option>
                <option value="interdisciplinary_project">Đồ án liên ngành (Interdisciplinary Project)</option>
              </select>
            </div>

            <Input
              label="Tiêu chí chấm (Rubric Version)"
              name="rubricVersion"
              value={form.rubricVersion}
              onChange={handleChange}
              error={formErrors.rubricVersion}
              required
            />

            <Input
              label="Số thành viên tối thiểu"
              name="minGroupSize"
              type="number"
              value={form.minGroupSize}
              onChange={handleChange}
              error={formErrors.minGroupSize}
              required
            />
            <Input
              label="Số thành viên tối đa"
              name="maxGroupSize"
              type="number"
              value={form.maxGroupSize}
              onChange={handleChange}
              error={formErrors.maxGroupSize}
              required
            />
          </div>

          {/* Scoring weights */}
          <h4 className={css.s33}>Cấu hình Trọng số Điểm (Tổng phải = 1.0)</h4>
          <div className={css.s34}>
            <Input
              label="Trọng số Giảng viên hướng dẫn"
              name="supervisorWeight"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={form.supervisorWeight}
              onChange={handleChange}
              required
            />
            <Input
              label="Trọng số Giảng viên phản biện"
              name="reviewerWeight"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={form.reviewerWeight}
              onChange={handleChange}
              required
            />
            <Input
              label="Trọng số Hội đồng bảo vệ"
              name="committeeWeight"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={form.committeeWeight}
              onChange={handleChange}
              required
            />
          </div>

          {/* Timelines dates */}
          <h4 className={css.s35}>Các mốc thời gian & Hạn chót</h4>
          <div className={css.s36}>
            <Input
              label="Bắt đầu đăng ký đề tài"
              name="registrationStart"
              type="datetime-local"
              value={form.registrationStart}
              onChange={handleChange}
              error={formErrors.registrationStart}
              required
            />
            <Input
              label="Kết thúc đăng ký đề tài"
              name="registrationEnd"
              type="datetime-local"
              value={form.registrationEnd}
              onChange={handleChange}
              error={formErrors.registrationEnd}
              required
            />

            <Input
              label="Hạn đổi đề tài"
              name="topicChangeDeadline"
              type="datetime-local"
              value={form.topicChangeDeadline}
              onChange={handleChange}
              error={formErrors.topicChangeDeadline}
              required
            />
            <div />

            <Input
              label="Bắt đầu thực hiện"
              name="projectStart"
              type="datetime-local"
              value={form.projectStart}
              onChange={handleChange}
              error={formErrors.projectStart}
              required
            />
            <Input
              label="Kết thúc thực hiện"
              name="projectEnd"
              type="datetime-local"
              value={form.projectEnd}
              onChange={handleChange}
              error={formErrors.projectEnd}
              required
            />

            <Input
              label="Hạn nộp báo cáo trước bảo vệ"
              name="preDefenseSubmissionDeadline"
              type="datetime-local"
              value={form.preDefenseSubmissionDeadline}
              onChange={handleChange}
              error={formErrors.preDefenseSubmissionDeadline}
              required
            />
            <div />

            <Input
              label="Bắt đầu bảo vệ hội đồng"
              name="defenseStart"
              type="datetime-local"
              value={form.defenseStart}
              onChange={handleChange}
              error={formErrors.defenseStart}
              required
            />
            <Input
              label="Kết thúc bảo vệ hội đồng"
              name="defenseEnd"
              type="datetime-local"
              value={form.defenseEnd}
              onChange={handleChange}
              error={formErrors.defenseEnd}
              required
            />

            <Input
              label="Hạn hoàn thiện sau bảo vệ"
              name="postDefenseRevisionDeadline"
              type="datetime-local"
              value={form.postDefenseRevisionDeadline}
              onChange={handleChange}
              error={formErrors.postDefenseRevisionDeadline}
              required
            />
            <Input
              label="Hạn nộp báo cáo lưu trữ"
              name="archiveDeadline"
              type="datetime-local"
              value={form.archiveDeadline}
              onChange={handleChange}
              error={formErrors.archiveDeadline}
              required
            />
          </div>

          {/* Action Buttons */}
          <div className={css.s37}>
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              <FilePlus size={18} />
              {editingPeriod ? 'Cập nhật' : 'Khởi tạo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
