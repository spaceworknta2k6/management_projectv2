'use client';

import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { getTechnicalLabel, hasAnyRole } from '@/lib/utils';
import { FolderSimple, UserCheck, ShieldCheck, CheckSquare, ArrowsClockwise } from '@phosphor-icons/react';

export default function ProjectsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(null); // projectId
  const [selectedReviewerId, setSelectedReviewerId] = useState('');

  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all projects
      const resProjects = await api.get('/projects', token);
      
      // If student, filter projects by group members
      let projectList = resProjects.data || [];
      if (!isStaff && !isLecturer) {
        // Find projects matching student group
        projectList = projectList.filter(p => 
          p.groupId?.members?.some(m => m.studentId?._id === user?.studentId || m.studentId === user?.studentId)
        );
      } else if (isLecturer) {
        // If lecturer, show projects they supervise or review
        projectList = projectList.filter(p => 
          p.supervisorId?.userId?._id === user?.id || 
          p.supervisorId?._id === user?.lecturerId ||
          p.reviewerId?.userId?._id === user?.id || 
          p.reviewerId?._id === user?.lecturerId
        );
      }
      setProjects(projectList);

      // 2. Fetch lecturers for assignment (Staff only)
      if (isStaff) {
        const resLecturers = await api.get('/auth/lecturers', token);
        setLecturers(resLecturers.data || []);
      }
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách dự án');
    } finally {
      setLoading(false);
    }
  }, [isLecturer, isStaff, toast, token, user?.id, user?.lecturerId, user?.studentId]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [loadData, token]);

  const handleStartProject = async (id) => {
    try {
      await api.post(`/projects/${id}/mark-in-progress`, {}, token);
      toast.success('Dự án đã chính thức bắt đầu thực hiện!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi bắt đầu thực hiện dự án');
    }
  };

  const handleAssignReviewer = async (e) => {
    e.preventDefault();
    if (!showAssignModal || !selectedReviewerId) return;

    setSubmitting(true);
    try {
      await api.post(`/projects/${showAssignModal}/assign-reviewer`, {
        reviewerId: selectedReviewerId
      }, token);
      toast.success('Đã phân công giảng viên phản biện thành công!');
      setShowAssignModal(null);
      setSelectedReviewerId('');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi phân công phản biện');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDefenseEligible = async (id) => {
    try {
      await api.post(`/projects/${id}/mark-defense-eligible`, {}, token);
      toast.success('Phê duyệt dự án đủ điều kiện bảo vệ thành công!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi duyệt điều kiện bảo vệ');
    }
  };

  const handleFinalizeProject = async (id) => {
    try {
      await api.post(`/projects/${id}/finalize`, {}, token);
      toast.success('Chốt hoàn tất dự án đồ án thành công!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hoàn tất dự án');
    }
  };

  const getProjectStatusBadge = (status) => {
    switch (status) {
      case 'assigned':
        return <Badge variant="info">Mới phân công</Badge>;
      case 'in_progress':
        return <Badge variant="warning">Đang thực hiện</Badge>;
      case 'pre_defense_submitted':
        return <Badge variant="info">Đã nộp trước bảo vệ</Badge>;
      case 'supervisor_reviewed':
        return <Badge variant="success">GVHD đã đánh giá</Badge>;
      case 'reviewer_reviewed':
        return <Badge variant="success">GVPB đã đánh giá</Badge>;
      case 'defense_eligible':
        return <Badge variant="success">Đủ ĐK bảo vệ</Badge>;
      case 'finalized':
        return <Badge variant="success">Đã hoàn thành</Badge>;
      case 'cancelled':
        return <Badge variant="error">Đã hủy</Badge>;
      default:
        return <Badge variant="secondary">{getTechnicalLabel(status)}</Badge>;
    }
  };

  return (
    <div>
      {/* Page Header */}
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
            <FolderSimple size={28} style={{ color: 'var(--accent)' }} />
            Quản lý Dự án Đồ án
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Xem thông tin tiến độ, phân công phản biện và quản lý vòng đời thực hiện đề tài đồ án tốt nghiệp
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadData}>
          <ArrowsClockwise size={16} />
          Làm mới
        </Button>
      </div>

      {/* Projects list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            Chưa có dự án đồ án nào được khởi tạo trong đợt này.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projects.map((p) => {
            const allowedDefense = ['in_progress', 'pre_defense_submitted', 'supervisor_reviewed', 'reviewer_reviewed'].includes(p.status);

            return (
              <Card
                key={p._id}
                title={p.topicId?.title || 'Đang chờ cập nhật đề tài'}
                subtitle={`Nhóm: ${p.groupId?.name || 'Chưa rõ'} | Mã đợt: ${p.periodId?.name || '—'}`}
                actions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getProjectStatusBadge(p.status)}

                    {/* Student Start Project Action */}
                    {!isStaff && !isLecturer && p.status === 'assigned' && (
                      <Button variant="primary" size="sm" onClick={() => handleStartProject(p._id)}>
                        Bắt đầu thực hiện
                      </Button>
                    )}

                    {/* Staff actions */}
                    {isStaff && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setShowAssignModal(p._id);
                            setSelectedReviewerId(p.reviewerId?._id || '');
                          }}
                        >
                          <UserCheck size={14} /> Phân công phản biện
                        </Button>

                        {allowedDefense && (
                          <Button variant="primary" size="sm" onClick={() => handleMarkDefenseEligible(p._id)}>
                            <ShieldCheck size={14} /> Duyệt bảo vệ
                          </Button>
                        )}

                        {p.status === 'defense_eligible' && (
                          <Button variant="success" size="sm" onClick={() => handleFinalizeProject(p._id)}>
                            <CheckSquare size={14} /> Chốt hoàn tất
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                }
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <div>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Giảng viên hướng dẫn:</p>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {p.supervisorId?.userId?.fullName || 'Chưa phân công'} ({p.supervisorId?.userId?.email || '—'})
                    </p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Giảng viên phản biện:</p>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {p.reviewerId?.userId?.fullName ? (
                        <span>{p.reviewerId.userId.fullName} ({p.reviewerId.userId.email})</span>
                      ) : (
                        <span style={{ color: 'var(--warning)', fontStyle: 'italic' }}>Chưa phân công phản biện</span>
                      )}
                    </p>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Tóm tắt đề tài:</p>
                    <p style={{ lineHeight: 1.5 }}>{p.topicId?.summary || 'Không có tóm tắt chi tiết.'}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign Reviewer Modal */}
      {showAssignModal && (
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
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Phân công Giảng viên phản biện
              </h3>
              <button
                onClick={() => setShowAssignModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAssignReviewer} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Chọn giảng viên phản biện</label>
                <select
                  value={selectedReviewerId}
                  onChange={(e) => setSelectedReviewerId(e.target.value)}
                  required
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
                  <option value="">-- Chọn giảng viên --</option>
                  {lecturers.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.userId?.fullName} ({l.userId?.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <Button variant="secondary" onClick={() => setShowAssignModal(null)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={submitting}>Xác nhận phân công</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
