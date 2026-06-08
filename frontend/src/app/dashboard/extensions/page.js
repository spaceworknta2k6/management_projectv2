'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, hasAnyRole } from '@/lib/utils';
import {
  ArrowsClockwise,
  Calendar,
  Check,
  Clock,
  FileText,
  Plus,
  X,
} from '@phosphor-icons/react';

const emptyForm = {
  projectId: '',
  targetId: '',
  requestedTo: '',
  reason: '',
};

const statusMeta = {
  pending: { label: 'Chờ xử lý', variant: 'warning' },
  approved: { label: 'Đã duyệt', variant: 'success' },
  rejected: { label: 'Từ chối', variant: 'error' },
  expired: { label: 'Hết hạn', variant: 'neutral' },
};

const approvalMeta = {
  pending: { label: 'Chưa có ý kiến', variant: 'neutral' },
  approved: { label: 'Đồng ý', variant: 'success' },
  rejected: { label: 'Không đồng ý', variant: 'error' },
};

const targetTypeLabels = {
  milestone: 'Mốc tiến độ',
  submission: 'Hồ sơ nộp',
  defense_session: 'Lịch bảo vệ',
  project: 'Dự án',
};

function StatusBadge({ status }) {
  const meta = statusMeta[status] || { label: status || 'Không xác định', variant: 'neutral' };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function ApprovalBadge({ status }) {
  const meta = approvalMeta[status || 'pending'] || approvalMeta.pending;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function getProjectTitle(project) {
  if (!project) return 'Dự án không xác định';
  return project.topicId?.title || project.topicTitle || project._id || 'Dự án không xác định';
}

function getDateInputValue(date) {
  if (!date) return '';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

function FieldLabel({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        marginBottom: '6px',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </label>
  );
}

function SelectField({ id, label, value, onChange, children, disabled = false }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{
          width: '100%',
          height: '40px',
          padding: '0 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-raised)',
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          fontSize: '14px',
          outline: 'none',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {children}
      </select>
    </div>
  );
}

function TextAreaField({ id, label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-raised)',
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          fontSize: '14px',
          resize: 'vertical',
          outline: 'none',
        }}
      />
    </div>
  );
}

export default function ExtensionRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [milestonesByProject, setMilestonesByProject] = useState({});
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewStatus, setReviewStatus] = useState('approved');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const isStudent = hasAnyRole(user, ['STUDENT']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const isFaculty = hasAnyRole(user, ['FACULTY_STAFF']);

  const visibleProjects = useMemo(() => {
    if (isStudent) {
      return projects.filter((project) =>
        project.groupId?.members?.some((member) => String(member.studentId?._id || member.studentId) === String(user?.studentId))
      );
    }

    if (isLecturer && !isFaculty) {
      return projects.filter((project) => String(project.supervisorId?._id || project.supervisorId) === String(user?.lecturerId));
    }

    return projects;
  }, [isFaculty, isLecturer, isStudent, projects, user?.lecturerId, user?.studentId]);

  const selectedMilestones = milestonesByProject[form.projectId] || [];

  const milestoneMap = useMemo(() => {
    const map = {};
    Object.values(milestonesByProject).flat().forEach((milestone) => {
      map[milestone._id] = milestone;
    });
    return map;
  }, [milestonesByProject]);

  const loadData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const [projectsRes, requestsRes] = await Promise.all([
        api.get('/projects', token),
        api.get('/extensions', token),
      ]);

      const projectList = projectsRes.data || [];
      setProjects(projectList);
      setRequests(requestsRes.data || []);

      const scopedProjects = projectList.filter((project) => {
        if (isStudent) {
          return project.groupId?.members?.some((member) => String(member.studentId?._id || member.studentId) === String(user?.studentId));
        }
        if (isLecturer && !isFaculty) {
          return String(project.supervisorId?._id || project.supervisorId) === String(user?.lecturerId);
        }
        return true;
      });

      const milestoneEntries = await Promise.all(
        scopedProjects.map(async (project) => {
          try {
            const res = await api.get(`/projects/${project._id}/milestones`, token);
            return [project._id, res.data || []];
          } catch {
            return [project._id, []];
          }
        })
      );
      const nextMilestonesByProject = Object.fromEntries(milestoneEntries);
      setMilestonesByProject(nextMilestonesByProject);

      if (isStudent && scopedProjects.length > 0) {
        const firstProject = scopedProjects[0];
        const firstMilestone = nextMilestonesByProject[firstProject._id]?.[0];
        setForm((prev) => ({
          ...prev,
          projectId: prev.projectId || firstProject._id,
          targetId: prev.targetId || firstMilestone?._id || '',
          requestedTo: prev.requestedTo || getDateInputValue(firstMilestone?.deadline),
        }));
      }
    } catch (err) {
      toast.error(err.message || 'Không thể tải dữ liệu yêu cầu gia hạn.');
    } finally {
      setLoading(false);
    }
  }, [isFaculty, isLecturer, isStudent, toast, token, user?.lecturerId, user?.studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProjectChange = (projectId) => {
    const firstMilestone = milestonesByProject[projectId]?.[0];
    setForm((prev) => ({
      ...prev,
      projectId,
      targetId: firstMilestone?._id || '',
      requestedTo: getDateInputValue(firstMilestone?.deadline),
    }));
  };

  const validateCreateForm = () => {
    if (!form.projectId) return 'Vui lòng chọn dự án cần xin gia hạn.';
    if (!form.targetId) return 'Vui lòng chọn mốc tiến độ cần gia hạn.';
    if (!form.requestedTo) return 'Vui lòng chọn thời hạn mới đề xuất.';
    if (!form.reason.trim()) return 'Vui lòng nhập lý do xin gia hạn.';

    const requestedTo = new Date(form.requestedTo);
    const currentMilestone = milestoneMap[form.targetId];
    if (Number.isNaN(requestedTo.getTime())) return 'Thời hạn mới không hợp lệ.';
    if (currentMilestone?.deadline && requestedTo <= new Date(currentMilestone.deadline)) {
      return 'Thời hạn mới phải muộn hơn deadline hiện tại.';
    }

    return '';
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    const message = validateCreateForm();
    if (message) {
      toast.error(message);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/extensions', {
        targetType: 'milestone',
        targetId: form.targetId,
        projectId: form.projectId,
        reason: form.reason,
        requestedTo: new Date(form.requestedTo).toISOString(),
      }, token);

      toast.success('Đã gửi yêu cầu xin gia hạn tới giảng viên hướng dẫn.');
      const nextMilestone = selectedMilestones[0];
      setForm({
        ...emptyForm,
        projectId: form.projectId,
        targetId: nextMilestone?._id || '',
        requestedTo: getDateInputValue(nextMilestone?.deadline),
      });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Không thể gửi yêu cầu gia hạn.');
    } finally {
      setSubmitting(false);
    }
  };

  const openReviewModal = (request, mode) => {
    setReviewModal({ request, mode });
    setReviewStatus('approved');
    setReviewNote('');
  };

  const validateReview = () => {
    if (!reviewNote.trim()) {
      return reviewModal?.mode === 'faculty'
        ? 'Vui lòng nhập ghi chú quyết định của giáo vụ.'
        : 'Vui lòng nhập nhận xét khuyến nghị của GVHD.';
    }
    return '';
  };

  const submitReview = async (e) => {
    e.preventDefault();
    const message = validateReview();
    if (message) {
      toast.error(message);
      return;
    }

    const request = reviewModal?.request;
    if (!request) return;

    setReviewSubmitting(true);
    try {
      const endpoint = reviewModal.mode === 'faculty'
        ? `/extensions/${request._id}/faculty-approve`
        : `/extensions/${request._id}/supervisor-approve`;

      await api.post(endpoint, { status: reviewStatus, note: reviewNote }, token);
      toast.success(reviewModal.mode === 'faculty' ? 'Đã ghi nhận quyết định của giáo vụ.' : 'Đã gửi ý kiến khuyến nghị của GVHD.');
      setReviewModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Không thể xử lý yêu cầu gia hạn.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const canSupervisorReview = (request) => (
    isLecturer &&
    request.status === 'pending' &&
    (request.supervisorApproval?.status || 'pending') === 'pending' &&
    String(request.projectId?.supervisorId?._id || request.projectId?.supervisorId) === String(user?.lecturerId)
  );

  const canFacultyDecide = (request) => (
    isFaculty &&
    request.status === 'pending' &&
    ['approved', 'rejected'].includes(request.supervisorApproval?.status || '')
  );

  const getTargetLabel = (request) => {
    const milestone = milestoneMap[request.targetId];
    if (milestone) return milestone.title;
    return `${targetTypeLabels[request.targetType] || request.targetType}: ${String(request.targetId).slice(-6)}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={28} style={{ color: 'var(--accent)' }} />
            Gia hạn deadline
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Sinh viên gửi yêu cầu, GVHD khuyến nghị và giáo vụ ra quyết định cuối cùng
          </p>
        </div>
        <Button variant="outline" onClick={loadData} icon={<ArrowsClockwise />} title="Làm mới" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isStudent ? 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' : '1fr',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {isStudent && (
          <Card title="Gửi yêu cầu gia hạn" subtitle="Áp dụng cho mốc tiến độ của dự án nhóm">
            {visibleProjects.length === 0 ? (
              <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Bạn chưa có dự án đang tham gia để gửi yêu cầu gia hạn.
              </div>
            ) : (
              <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <SelectField id="extension-project" label="Dự án" value={form.projectId} onChange={(e) => handleProjectChange(e.target.value)}>
                  {visibleProjects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {getProjectTitle(project)}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="extension-target"
                  label="Mốc cần gia hạn"
                  value={form.targetId}
                  onChange={(e) => {
                    const milestone = milestoneMap[e.target.value];
                    setForm((prev) => ({
                      ...prev,
                      targetId: e.target.value,
                      requestedTo: getDateInputValue(milestone?.deadline),
                    }));
                  }}
                  disabled={selectedMilestones.length === 0}
                >
                  {selectedMilestones.length === 0 ? (
                    <option value="">Dự án chưa có mốc tiến độ</option>
                  ) : selectedMilestones.map((milestone) => (
                    <option key={milestone._id} value={milestone._id}>
                      {milestone.title} - hạn {formatDate(milestone.deadline)}
                    </option>
                  ))}
                </SelectField>

                <Input
                  name="extension-requested-to"
                  label="Thời hạn mới đề xuất"
                  type="datetime-local"
                  value={form.requestedTo}
                  onChange={(e) => setForm((prev) => ({ ...prev, requestedTo: e.target.value }))}
                />

                <TextAreaField
                  id="extension-reason"
                  label="Lý do xin gia hạn"
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Mô tả ngắn gọn sự cố, khối lượng còn lại và cam kết hoàn thành..."
                />

                <Button type="submit" variant="primary" icon={<Plus />} isLoading={submitting} disabled={selectedMilestones.length === 0}>
                  Gửi yêu cầu
                </Button>
              </form>
            )}
          </Card>
        )}

        <Card title="Danh sách yêu cầu" subtitle={isStudent ? 'Theo dõi trạng thái yêu cầu của nhóm' : 'Xử lý các yêu cầu gia hạn đang chờ'}>
          {requests.length === 0 ? (
            <div style={{ padding: '42px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Calendar size={36} weight="duotone" style={{ marginBottom: '10px' }} />
              <p>Chưa có yêu cầu gia hạn nào.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requests.map((request) => (
                <div
                  key={request._id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-sunken)',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                        {getProjectTitle(request.projectId)}
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Nhóm: {request.groupId?.name || 'Không xác định'} · {getTargetLabel(request)}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <div className="text-label">Deadline mới</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                        {formatDateTime(request.requestedTo)}
                      </div>
                    </div>
                    <div>
                      <div className="text-label">GVHD</div>
                      <div style={{ marginTop: '4px' }}>
                        <ApprovalBadge status={request.supervisorApproval?.status} />
                      </div>
                    </div>
                    <div>
                      <div className="text-label">Giáo vụ</div>
                      <div style={{ marginTop: '4px' }}>
                        <ApprovalBadge status={request.facultyDecision?.status} />
                      </div>
                    </div>
                    <div>
                      <div className="text-label">Ngày gửi</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                        {formatDateTime(request.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Lý do:</strong> {request.reason}
                  </div>

                  {(request.supervisorApproval?.note || request.facultyDecision?.note) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '10px', marginBottom: '12px' }}>
                      {request.supervisorApproval?.note && (
                        <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-raised)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Nhận xét GVHD:</strong> {request.supervisorApproval.note}
                        </div>
                      )}
                      {request.facultyDecision?.note && (
                        <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-raised)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Quyết định giáo vụ:</strong> {request.facultyDecision.note}
                        </div>
                      )}
                    </div>
                  )}

                  {(canSupervisorReview(request) || canFacultyDecide(request)) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      {canSupervisorReview(request) && (
                        <Button size="sm" variant="primary" icon={<FileText />} onClick={() => openReviewModal(request, 'supervisor')}>
                          Nhận xét GVHD
                        </Button>
                      )}
                      {canFacultyDecide(request) && (
                        <Button size="sm" variant="primary" icon={<Check />} onClick={() => openReviewModal(request, 'faculty')}>
                          Quyết định
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {reviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {reviewModal.mode === 'faculty' ? 'Quyết định của giáo vụ' : 'Khuyến nghị của GVHD'}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {getProjectTitle(reviewModal.request.projectId)}
              </p>
            </div>

            <form onSubmit={submitReview} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <SelectField id="extension-review-status" label="Kết quả" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                <option value="approved">Đồng ý gia hạn</option>
                <option value="rejected">Từ chối gia hạn</option>
              </SelectField>

              <TextAreaField
                id="extension-review-note"
                label={reviewModal.mode === 'faculty' ? 'Ghi chú quyết định' : 'Nhận xét khuyến nghị'}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={reviewModal.mode === 'faculty' ? 'Ghi rõ căn cứ phê duyệt hoặc từ chối...' : 'Nêu ý kiến chuyên môn cho giáo vụ...'}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '6px' }}>
                <Button variant="ghost" icon={<X />} onClick={() => setReviewModal(null)}>
                  Hủy
                </Button>
                <Button type="submit" variant="primary" icon={<Check />} isLoading={reviewSubmitting}>
                  Xác nhận
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
