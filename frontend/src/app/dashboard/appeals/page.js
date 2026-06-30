'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import usePeriodStore from '@/store/period.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDate, hasAnyRole } from '@/lib/utils';
import { Siren, ArrowsClockwise, CheckCircle, UserPlus } from '@phosphor-icons/react';

const STATUS_LABELS = {
  pending: { label: 'Chờ xử lý', variant: 'warning' },
  grading: { label: 'Đang chấm', variant: 'primary' },
  completed: { label: 'Hoàn tất', variant: 'success' },
  cancelled: { label: 'Đã rút', variant: 'neutral' },
};

export default function AppealsPage() {
  const { user, token } = useAuthStore();
  const toast = useToast();
  const { periods, selectedPeriodId, setSelectedPeriodId, fetchPeriods } = usePeriodStore();

  const [appeals, setAppeals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Assign modal state
  const [assignModal, setAssignModal] = useState(null); // appealId
  const [lecturers, setLecturers] = useState([]);
  const [recheckGraderId, setRecheckGraderId] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Complete modal
  const [completing, setCompleting] = useState(null); // appealId

  const [selectedAppealProject, setSelectedAppealProject] = useState(null);

  const isStaffUser = useMemo(() => hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']), [user]);

  const fetchAppeals = useCallback(async () => {
    if (!selectedPeriodId || !token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ periodId: selectedPeriodId });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/appeals?${params.toString()}`, token);
      setAppeals(res.data?.appeals || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      toast.error('Lỗi khi tải danh sách đơn phúc khảo');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId, statusFilter, token, toast]);

  useEffect(() => {
    if (token) fetchPeriods(token);
  }, [token, fetchPeriods]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const loadLecturers = async (project) => {
    try {
      const res = await api.get('/users?role=LECTURER&limit=200', token);
      const allLecturers = res.data?.users || res.data || [];
      
      // Ẩn GVHD và GV chấm ban đầu của dự án
      const supervisorId = project?.supervisorId?._id || project?.supervisorId;
      const reviewerId = project?.reviewerId?._id || project?.reviewerId;
      
      const filtered = allLecturers.filter(l => {
        const idToCheck = l.lecturerId || l._id;
        return idToCheck !== supervisorId && idToCheck !== reviewerId;
      });
      
      setLecturers(filtered);
    } catch {
      // fallback
    }
  };

  const handleOpenAssign = async (appeal) => {
    setAssignModal(appeal._id);
    setSelectedAppealProject(appeal.projectId);
    setRecheckGraderId('');
    setAdminNote('');
    await loadLecturers(appeal.projectId);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!recheckGraderId) {
      toast.error('Vui lòng chọn giảng viên chấm lại.');
      return;
    }
    try {
      setAssigning(true);
      await api.patch(`/appeals/${assignModal}/assign`, {
        recheckGraderId,
        adminNote,
        feePaidAt: new Date().toISOString(),
      }, token);
      toast.success('Phân công giảng viên chấm phúc khảo thành công!');
      setAssignModal(null);
      fetchAppeals();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi phân công');
    } finally {
      setAssigning(false);
    }
  };

  const handleComplete = async (appealId) => {
    if (!confirm('Xác nhận hoàn tất phúc khảo? Điểm tổng kết sẽ được cập nhật ngay.')) return;
    try {
      setCompleting(appealId);
      await api.post(`/appeals/${appealId}/complete`, {}, token);
      toast.success('Hoàn tất phúc khảo. Điểm đã được cập nhật và công bố lại.');
      fetchAppeals();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hoàn tất phúc khảo');
    } finally {
      setCompleting(null);
    }
  };

  if (!isStaffUser) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Bạn không có quyền truy cập trang này.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Siren size={28} style={{ color: 'var(--warning)' }} />
            Quản lý Phúc Khảo
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Xem danh sách đơn phúc khảo, phân công giảng viên chấm lại và hoàn tất kết quả.
          </p>
        </div>
        <Button variant="outline" onClick={fetchAppeals} icon={<ArrowsClockwise />} title="Làm mới" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '240px', flex: '1' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>Học phần đồ án</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '14px', height: '42px' }}
          >
            <option value="">Chọn học phần</option>
            {periods.map((p) => (
              <option key={p._id} value={p._id}>{p.name} ({p.courseCode})</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '14px', height: '42px' }}
          >
            <option value="">Tất cả</option>
            <option value="pending">Chờ xử lý</option>
            <option value="grading">Đang chấm</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Đã rút</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size="lg" /></div>
      ) : appeals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          {selectedPeriodId ? 'Không có đơn phúc khảo nào.' : 'Vui lòng chọn học phần để xem danh sách.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card-nested, #f8fafc)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', width: '22%' }}>Sinh viên</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', width: '18%' }}>Đề tài</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', width: '10%' }}>Điểm cũ</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', width: '20%' }}>Lý do & Lệ phí</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', width: '15%' }}>GV Chấm Lại</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', width: '15%' }}>Điểm mới</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', width: '10%' }}>Trạng thái</th>
                <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', width: '10%', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {appeals.map((appeal) => {
                const student = appeal.studentId;
                const statusInfo = STATUS_LABELS[appeal.status] || { label: appeal.status, variant: 'neutral' };
                const recheckSheet = appeal.recheckScoreSheetId;
                return (
                  <tr key={appeal._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-nested)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{student?.userId?.fullName || '—'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{student?.userId?.email}</div>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-primary)', verticalAlign: 'middle', fontWeight: '500' }}>
                      {appeal.projectId?.topicId?.title || '—'}
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      {appeal.finalGradeId ? (
                        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {appeal.finalGradeId.finalScore} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>({appeal.finalGradeId.letterGrade})</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }} title={appeal.reason}>
                        {appeal.reason}
                      </div>
                      {appeal.feePaidAt ? (
                        <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--success)', borderRadius: '50%' }}></span>
                          Đã nộp phí ({formatDate(appeal.feePaidAt)})
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--warning)', marginTop: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--warning)', borderRadius: '50%' }}></span>
                          Chưa nộp phí
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      {appeal.recheckGraderId ? (
                        <div>
                          <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{appeal.recheckGraderId?.userId?.fullName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{appeal.recheckGraderId?.userId?.email}</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa phân công</span>}
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      {recheckSheet?.lockedAt ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--success)' }}>{recheckSheet.roundedTotal}</span>
                          <Badge variant="success">Đã khóa</Badge>
                        </div>
                      ) : recheckSheet ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--warning)' }}>{recheckSheet.roundedTotal}</span>
                          <Badge variant="warning">Nháp</Badge>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </td>
                    <td style={{ padding: '16px 20px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                        {appeal.status === 'pending' && (
                          <Button size="sm" variant="primary" icon={<UserPlus size={14} />} onClick={() => handleOpenAssign(appeal)}>
                            Phân công
                          </Button>
                        )}
                        {appeal.status === 'grading' && recheckSheet?.lockedAt && (
                          <Button
                            size="sm"
                            variant="success"
                            icon={<CheckCircle size={14} />}
                            onClick={() => handleComplete(appeal._id)}
                            loading={completing === appeal._id}
                          >
                            Hoàn tất
                          </Button>
                        )}
                        {appeal.status === 'grading' && !recheckSheet?.lockedAt && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chờ chấm</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
            Tổng số đơn: {total}
          </div>
        </div>
      )}

      {/* Modal Phân Công GV Chấm Lại */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '12px', width: '480px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Phân công Giảng viên Chấm Phúc Khảo</h2>
              <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            <form onSubmit={handleAssign}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px', backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid var(--info, #3b82f6)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  ℹ️ Giảng viên chấm lại phải là người <strong>khác</strong> với Giảng viên hướng dẫn và Giảng viên chấm ban đầu của dự án.
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Giảng viên chấm lại <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <select
                    value={recheckGraderId}
                    onChange={(e) => setRecheckGraderId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px' }}
                  >
                    <option value="">-- Chọn giảng viên --</option>
                    {lecturers.map((l) => (
                      <option key={l.lecturerId || l._id} value={l.lecturerId || l._id}>
                        {l.fullName || l.userId?.fullName} ({l.email || l.userId?.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Ghi chú (tùy chọn)
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows="3"
                    placeholder="Hướng dẫn hoặc ghi chú cho giảng viên chấm lại..."
                    style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ padding: '10px', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid var(--success, #10b981)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  ✓ Lệ phí phúc khảo sẽ được ghi nhận là <strong>đã nộp</strong> khi bạn xác nhận phân công.
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                <Button variant="ghost" type="button" onClick={() => setAssignModal(null)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={assigning}>Xác nhận phân công</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
