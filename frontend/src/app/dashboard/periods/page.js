'use client';

import { useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDate, getStatus } from '@/lib/utils';
import { CalendarBlank, Plus, ArrowsClockwise, FilePlus } from '@phosphor-icons/react';

export default function PeriodsPage() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields State
  const [form, setForm] = useState({
    name: 'Đợt Đồ án Tốt nghiệp Kỳ 20252',
    schoolYear: '2025-2026',
    semester: '2',
    type: 'foundation_project',
    minGroupSize: '1',
    maxGroupSize: '3',
    rubricVersion: 'HUST-SET-2026',
    supervisorWeight: '0.3',
    reviewerWeight: '0.2',
    committeeWeight: '0.5',
    // Timelines
    registrationStart: '2026-06-05T08:00',
    registrationEnd: '2026-06-15T18:00',
    topicChangeDeadline: '2026-06-20T18:00',
    projectStart: '2026-06-25T08:00',
    projectEnd: '2026-09-15T18:00',
    preDefenseSubmissionDeadline: '2026-09-01T18:00',
    defenseStart: '2026-09-05T08:00',
    defenseEnd: '2026-09-10T18:00',
    postDefenseRevisionDeadline: '2026-09-20T18:00',
    archiveDeadline: '2026-09-30T18:00',
  });

  const [formErrors, setFormErrors] = useState({});

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const res = await api.get('/periods', token);
      setPeriods(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách đợt đồ án');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPeriods();
    }
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});

    // Validate weights sum
    const sup = parseFloat(form.supervisorWeight || 0);
    const rev = parseFloat(form.reviewerWeight || 0);
    const com = parseFloat(form.committeeWeight || 0);
    if (Math.abs(sup + rev + com - 1.0) > 0.001) {
      toast.error('Tổng trọng số điểm thành phần phải bằng 1.0 (100%).');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: form.name,
      schoolYear: form.schoolYear,
      semester: form.semester,
      type: form.type,
      minGroupSize: parseInt(form.minGroupSize, 10),
      maxGroupSize: parseInt(form.maxGroupSize, 10),
      rubricVersion: form.rubricVersion,
      scoringFormula: {
        supervisor: sup,
        reviewer: rev,
        committee: com,
      },
      registrationStart: new Date(form.registrationStart).toISOString(),
      registrationEnd: new Date(form.registrationEnd).toISOString(),
      topicChangeDeadline: new Date(form.topicChangeDeadline).toISOString(),
      projectStart: new Date(form.projectStart).toISOString(),
      projectEnd: new Date(form.projectEnd).toISOString(),
      preDefenseSubmissionDeadline: new Date(form.preDefenseSubmissionDeadline).toISOString(),
      defenseStart: new Date(form.defenseStart).toISOString(),
      defenseEnd: new Date(form.defenseEnd).toISOString(),
      postDefenseRevisionDeadline: new Date(form.postDefenseRevisionDeadline).toISOString(),
      archiveDeadline: new Date(form.archiveDeadline).toISOString(),
    };

    try {
      await api.post('/periods', payload, token);
      toast.success('Đã khởi tạo đợt đồ án mới thành công!');
      setShowModal(false);
      fetchPeriods();
    } catch (err) {
      if (err.errors) {
        const errorsMap = {};
        err.errors.forEach((errObj) => {
          errorsMap[errObj.field] = errObj.message;
        });
        setFormErrors(errorsMap);
        toast.error('Vui lòng kiểm tra lại các mốc thời gian và thông tin đợt đồ án.');
      } else {
        toast.error(err.message || 'Lỗi khi tạo mới đợt đồ án');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransition = async (id, action) => {
    try {
      let endpoint = `/periods/${id}`;
      if (action === 'open-registration') endpoint += '/open-registration';
      else if (action === 'start') endpoint += '/start';
      else if (action === 'lock-results') endpoint += '/lock-results';
      else if (action === 'archive') endpoint += '/archive';

      await api.post(endpoint, {}, token);
      toast.success('Cập nhật trạng thái đợt đồ án thành công!');
      fetchPeriods();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật trạng thái');
    }
  };

  return (
    <div>
      {/* Header section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarBlank size={28} style={{ color: 'var(--accent)' }} />
            Quản lý Đợt đồ án
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Cấu hình thời gian, mốc bảo vệ và công thức tính điểm của đợt đồ án
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={fetchPeriods}>
            <ArrowsClockwise size={16} />
            Làm mới
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Khởi tạo đợt mới
          </Button>
        </div>
      </div>

      {/* List items */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : periods.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            Chưa có đợt đồ án nào được định cấu hình trên hệ thống. Hãy nhấp "Khởi tạo đợt mới" để bắt đầu.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {periods.map((p) => {
            const statusInfo = getStatus(p.status);
            return (
              <Card key={p._id} title={p.name} subtitle={`Năm học: ${p.schoolYear} | Học kỳ: ${p.semester}`}
                actions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    
                    {p.status === 'draft' && (
                      <Button variant="primary" size="sm" onClick={() => handleTransition(p._id, 'open-registration')}>
                        Mở đăng ký đề tài
                      </Button>
                    )}
                    {p.status === 'enrollment' && (
                      <Button variant="primary" size="sm" onClick={() => handleTransition(p._id, 'start')}>
                        Bắt đầu thực hiện
                      </Button>
                    )}
                    {p.status === 'defense' && (
                      <Button variant="primary" size="sm" onClick={() => handleTransition(p._id, 'lock-results')}>
                        Khóa điểm số & kết quả
                      </Button>
                    )}
                    {p.status === 'completed' && (
                      <Button variant="secondary" size="sm" onClick={() => handleTransition(p._id, 'archive')}>
                        Lưu trữ đợt đồ án
                      </Button>
                    )}
                  </div>
                }
              >
                {/* Dates Timeline details */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Thời hạn Đăng ký: </span>
                    <strong style={{ fontFamily: 'var(--font-geist-mono)' }}>{formatDate(p.registrationStart)} - {formatDate(p.registrationEnd)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Hạn đổi đề tài: </span>
                    <strong style={{ fontFamily: 'var(--font-geist-mono)' }}>{formatDate(p.topicChangeDeadline)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Thời gian thực hiện: </span>
                    <strong style={{ fontFamily: 'var(--font-geist-mono)' }}>{formatDate(p.projectStart)} - {formatDate(p.projectEnd)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Hạn nộp báo cáo bảo vệ: </span>
                    <strong style={{ fontFamily: 'var(--font-geist-mono)' }}>{formatDate(p.preDefenseSubmissionDeadline)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Thời gian bảo vệ: </span>
                    <strong style={{ fontFamily: 'var(--font-geist-mono)' }}>{formatDate(p.defenseStart)} - {formatDate(p.defenseEnd)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Công thức tính điểm: </span>
                    <strong>HD: {p.scoringFormula?.supervisor} | PB: {p.scoringFormula?.reviewer} | HĐ: {p.scoringFormula?.committee}</strong>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal create new */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90dvh',
            }}
          >
            {/* Modal Title Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Khởi tạo đợt đồ án mới
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body form */}
            <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <Input
                  label="Tên đợt đồ án"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  error={formErrors.name}
                  required
                  style={{ gridColumn: 'span 2' }}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Loại đồ án <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    style={{
                      height: '40px',
                      padding: '0 12px',
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      outline: 'none',
                    }}
                  >
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
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                Cấu hình Trọng số Điểm (Tổng phải = 1.0)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                Các mốc thời gian & Hạn chót
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '28px',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '16px',
                }}
              >
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Hủy
                </Button>
                <Button variant="primary" type="submit" loading={submitting}>
                  <FilePlus size={18} />
                  Khởi tạo
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
