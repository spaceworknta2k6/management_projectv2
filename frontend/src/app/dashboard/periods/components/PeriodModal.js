'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { FilePlus } from '@phosphor-icons/react';
import { ACADEMIC_UNITS } from '@/lib/academicUnits';
import css from '../page.module.css';

export default function PeriodModal({
  editingPeriod,
  form,
  formErrors,
  handleChange,
  handleSubmit,
  onClose,
  submitting,
  schoolYearOptions = [],
  rubrics = [],
  lecturers = [],
}) {
  const isGroupChecked = form.allowGroup === true || form.allowGroup === 'true';

  return (
    <div className={css.s22}>
      <div className={css.s23}>
        {/* Modal Title Header */}
        <div className={css.s24}>
          <h3 className={css.s25}>
            {editingPeriod ? 'Chỉnh sửa đợt học phần' : 'Tạo đợt học phần'}
          </h3>
          <button onClick={onClose} className={css.s38}>
            &times;
          </button>
        </div>

        {/* Modal Body form */}
        <form onSubmit={handleSubmit} className={css.s26}>
          <div className={css.s27}>
            <Input
              label="Tên học phần"
              name="courseName"
              value={form.courseName}
              onChange={handleChange}
              error={formErrors.courseName}
              className={css.s28}
            />

            <Input
              label="Mã học phần"
              name="courseCode"
              value={form.courseCode}
              onChange={handleChange}
              error={formErrors.courseCode}
            />

            <div className={css.s29}>
              <label className={css.s30}>Năm học</label>
              <select
                name="schoolYear"
                value={form.schoolYear}
                onChange={handleChange}
                className={css.s32}
              >
                {schoolYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {formErrors.schoolYear && (
                <span className="text-error" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {formErrors.schoolYear}
                </span>
              )}
            </div>

            <div className={css.s29}>
              <label className={css.s30}>Học kỳ</label>
              <select
                name="semester"
                value={form.semester}
                onChange={handleChange}
                className={css.s32}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
              {formErrors.semester && (
                <span className="text-error" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {formErrors.semester}
                </span>
              )}
            </div>

            <div className={css.s29}>
              <label className={css.s30}>
                Loại đồ án <span className={css.s31}>*</span>
              </label>
              <select 
                name="projectType" 
                value={form.projectType || 'foundation'} 
                onChange={(e) => {
                  handleChange(e);
                  // Sync legacy type field
                  const legacyType = e.target.value === 'interdisciplinary' ? 'interdisciplinary_project' : 'foundation_project';
                  handleChange({ target: { name: 'type', value: legacyType } });
                }} 
                className={css.s32}
              >
                <option value="foundation">Đồ án cơ sở</option>
                <option value="interdisciplinary">Đồ án liên ngành</option>
              </select>
            </div>

            <div className={css.s29}>
              <label className={css.s30}>
                Khoa/đơn vị phụ trách <span className={css.s31}>*</span>
              </label>
              <select
                name="academicUnit"
                value={form.academicUnit || ACADEMIC_UNITS[0].value}
                onChange={handleChange}
                className={css.s32}
              >
                {ACADEMIC_UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
              {formErrors.academicUnit && (
                <span className="text-error" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {formErrors.academicUnit}
                </span>
              )}
            </div>

            <div className={css.s29}>
              <label className={css.s30}>
                Giảng viên phụ trách <span className={css.s31}>*</span>
              </label>
              <select
                name="coordinatorLecturerId"
                value={form.coordinatorLecturerId || ''}
                onChange={handleChange}
                className={css.s32}
              >
                <option value="">-- Chọn giảng viên phụ trách --</option>
                {lecturers.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.userId?.fullName || l.name} ({l.lecturerCode})
                  </option>
                ))}
              </select>
              {formErrors.coordinatorLecturerId && (
                <span className="text-error" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {formErrors.coordinatorLecturerId}
                </span>
              )}
            </div>

            <div className={css.s29}>
              <label className={css.s30}>
                Tiêu chí chấm <span className={css.s31}>*</span>
              </label>
              <select
                name="rubricId"
                value={form.rubricId || ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const foundRubric = rubrics.find((r) => r._id === selectedId);
                  handleChange({ target: { name: 'rubricId', value: selectedId } });
                  handleChange({ target: { name: 'rubricVersion', value: foundRubric ? foundRubric.version : '1.0' } });
                }}
                className={css.s32}
              >
                <option value="">-- Chọn tiêu chí chấm --</option>
                {rubrics.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name} (v{r.version})
                  </option>
                ))}
              </select>
              {formErrors.rubricId && (
                <span className="text-error" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {formErrors.rubricId}
                </span>
              )}
            </div>

            <div className={css.s29} style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2' }}>
              <label className={css.s30}>Hình thức làm đồ án</label>
              <div style={{ display: 'flex', gap: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="allowIndividual"
                    checked={form.allowIndividual === true || form.allowIndividual === 'true'}
                    onChange={(e) => handleChange({ target: { name: 'allowIndividual', value: e.target.checked } })}
                  />
                  Cá nhân (1 SV)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="allowGroup"
                    checked={isGroupChecked}
                    onChange={(e) => handleChange({ target: { name: 'allowGroup', value: e.target.checked } })}
                  />
                  Nhóm (từ 2 SV trở lên)
                </label>
              </div>
              {formErrors.allowIndividual && (
                <span className="text-error" style={{ fontSize: '12px' }}>
                  {formErrors.allowIndividual}
                </span>
              )}
            </div>

            {isGroupChecked && (
              <>
                <Input
                  label="Số thành viên nhóm tối thiểu"
                  name="groupMinSize"
                  type="number"
                  min="2"
                  value={form.groupMinSize}
                  onChange={handleChange}
                  error={formErrors.groupMinSize}
                />
                <Input
                  label="Số thành viên nhóm tối đa"
                  name="groupMaxSize"
                  type="number"
                  min="2"
                  value={form.groupMaxSize}
                  onChange={handleChange}
                  error={formErrors.groupMaxSize}
                />
              </>
            )}
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
            />
            <Input
              label="Trọng số Giảng viên chấm 2"
              name="reviewerWeight"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={form.reviewerWeight}
              onChange={handleChange}
              error={formErrors.reviewerWeight}
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
            />
            <Input
              label="Kết thúc đăng ký đề tài"
              name="registrationEnd"
              type="datetime-local"
              value={form.registrationEnd}
              onChange={handleChange}
              error={formErrors.registrationEnd}
            />

            <Input
              label="Hạn đổi đề tài"
              name="topicChangeDeadline"
              type="datetime-local"
              value={form.topicChangeDeadline}
              onChange={handleChange}
              error={formErrors.topicChangeDeadline}
            />



            <Input
              label="Bắt đầu thực hiện"
              name="projectStart"
              type="datetime-local"
              value={form.projectStart}
              onChange={handleChange}
              error={formErrors.projectStart}
            />
            <Input
              label="Kết thúc thực hiện"
              name="projectEnd"
              type="datetime-local"
              value={form.projectEnd}
              onChange={handleChange}
              error={formErrors.projectEnd}
            />
            <Input
              label="Hạn nộp báo cáo cuối"
              name="finalSubmissionDeadline"
              type="datetime-local"
              value={form.finalSubmissionDeadline}
              onChange={handleChange}
              error={formErrors.finalSubmissionDeadline}
            />
            <Input
              label="Bắt đầu chấm điểm"
              name="gradingStart"
              type="datetime-local"
              value={form.gradingStart}
              onChange={handleChange}
              error={formErrors.gradingStart}
            />
            <Input
              label="Kết thúc chấm điểm"
              name="gradingEnd"
              type="datetime-local"
              value={form.gradingEnd}
              onChange={handleChange}
              error={formErrors.gradingEnd}
            />
            <Input
              label="Hạn chỉnh sửa sau báo cáo"
              name="revisionDeadline"
              type="datetime-local"
              value={form.revisionDeadline}
              onChange={handleChange}
              error={formErrors.revisionDeadline}
            />
          </div>

          {/* Action Buttons */}
          <div className={css.s37}>
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              <FilePlus size={18} />
              {editingPeriod ? 'Cập nhật' : 'Tạo đợt'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
