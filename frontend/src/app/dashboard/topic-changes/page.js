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
import { formatDateTime, hasAnyRole } from '@/lib/utils';
import { getOwnerDisplay, getOwnerTypeLabel, isStudentProjectOwner } from '@/lib/projectOwner';
import { ArrowsClockwise, Check, FileText, Plus, X } from '@phosphor-icons/react';
import css from '../extensions/page.module.css';

const emptyForm = {
  topicId: '',
  newTitle: '',
  newScope: '',
  newPlan: '',
  reason: '',
};

const statusMeta = {
  pending: { label: 'Chờ xử lý', variant: 'warning' },
  approved: { label: 'Đã duyệt', variant: 'success' },
  rejected: { label: 'Từ chối', variant: 'error' },
  expired: { label: 'Hết hạn', variant: 'neutral' },
  cancelled: { label: 'Đã hủy', variant: 'error' },
};

const approvalMeta = {
  pending: { label: 'Chưa có ý kiến', variant: 'neutral' },
  approved: { label: 'Đồng ý', variant: 'success' },
  rejected: { label: 'Không đồng ý', variant: 'error' },
};

function StatusBadge({ status }) {
  const meta = statusMeta[status] || { label: status || 'Không xác định', variant: 'neutral' };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function ApprovalBadge({ status }) {
  const meta = approvalMeta[status || 'pending'] || approvalMeta.pending;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function FieldLabel({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className={css.s1}>
      {children}
    </label>
  );
}

function SelectField({ id, label, value, onChange, children }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select id={id} name={id} value={value} onChange={onChange} className={css.selectInput}>
        {children}
      </select>
    </div>
  );
}

function TextAreaField({ id, label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea id={id} name={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} className={css.s2} />
    </div>
  );
}

function getTopicTitle(topic) {
  return topic?.title || topic?.topicId?.title || 'Đề tài không xác định';
}

export default function TopicChangesPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const isStudent = hasAnyRole(user, ['STUDENT']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const isFaculty = hasAnyRole(user, ['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']);

  const visibleProjects = useMemo(() => {
    if (isStudent) {
      return projects.filter((project) => isStudentProjectOwner(project, user?.studentId));
    }
    return projects;
  }, [isStudent, projects, user?.studentId]);

  const topicOptions = visibleProjects
    .filter((project) => project.topicId && !['cancelled', 'finalized'].includes(project.status))
    .map((project) => ({
      projectId: project._id,
      topicId: project.topicId._id || project.topicId,
      title: project.topicId.title || project.topicId._id || project.topicId,
      scope: project.topicId.scope || '',
      plan: project.topicId.plan || '',
    }));

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [projectsRes, requestsRes] = await Promise.all([
        api.get('/projects', token),
        api.get('/topic-change-requests', token),
      ]);
      setProjects(projectsRes.data || []);
      setRequests(requestsRes.data || []);

      const firstTopic = (projectsRes.data || []).find((project) => project.topicId && !['cancelled', 'finalized'].includes(project.status));
      setForm((prev) => ({
        ...prev,
        topicId: prev.topicId || firstTopic?.topicId?._id || firstTopic?.topicId || '',
      }));
    } catch (err) {
      toast.error(err.message || 'Không thể tải dữ liệu đổi đề tài.');
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const validateCreateForm = () => {
    if (!form.topicId) return 'Vui lòng chọn đề tài cần đổi.';
    if (!form.newTitle.trim()) return 'Vui lòng nhập tên đề tài mới.';
    if (!form.newScope.trim()) return 'Vui lòng nhập phạm vi mới.';
    if (!form.newPlan.trim()) return 'Vui lòng nhập kế hoạch mới.';
    if (!form.reason.trim()) return 'Vui lòng nhập lý do đổi đề tài.';
    return '';
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    const message = validateCreateForm();
    if (message) {
      toast.error(message);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/topics/${form.topicId}/change-requests`, {
        newTitle: form.newTitle,
        newScope: form.newScope,
        newPlan: form.newPlan,
        reason: form.reason,
      }, token);
      toast.success('Đã gửi đơn đổi đề tài.');
      setForm((prev) => ({ ...emptyForm, topicId: prev.topicId }));
      loadData();
    } catch (err) {
      toast.error(err.message || 'Không thể gửi đơn đổi đề tài.');
    } finally {
      setSubmitting(false);
    }
  };

  const openReviewModal = (request, mode, decision) => {
    setReviewModal({ request, mode, decision });
    setReviewNote('');
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!reviewNote.trim()) {
      toast.error('Vui lòng nhập ghi chú xử lý.');
      return;
    }

    setReviewSubmitting(true);
    try {
      const { request, mode, decision } = reviewModal;
      const endpoint = mode === 'faculty'
        ? `/topic-change-requests/${request._id}/faculty-${decision}`
        : `/topic-change-requests/${request._id}/supervisor-${decision}`;
      await api.post(endpoint, { note: reviewNote }, token);
      toast.success('Đã xử lý đơn đổi đề tài.');
      setReviewModal(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Không thể xử lý đơn đổi đề tài.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleCancelRequest = async (request) => {
    if (!window.confirm('Hủy đơn đổi đề tài này?')) return;

    try {
      await api.post(`/topic-change-requests/${request._id}/cancel`, {}, token);
      toast.success('Đã hủy đơn đổi đề tài.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Không thể hủy đơn đổi đề tài.');
    }
  };

  const canSupervisorReview = (request) => (
    isLecturer &&
    request.status === 'pending' &&
    (request.supervisorApproval?.status || 'pending') === 'pending' &&
    String(request.topicId?.supervisorId) === String(user?.lecturerId)
  );

  const canFacultyDecide = (request) => (
    isFaculty &&
    request.status === 'pending' &&
    ['approved', 'rejected'].includes(request.supervisorApproval?.status || '')
  );

  const canCancelRequest = (request) => request.status === 'pending' && (isStudent || isFaculty);

  if (loading) {
    return (
      <div className={css.s3}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className={css.s4}>
        <div>
          <h1 className={`text-display ${css.s5}`}>
            <FileText size={28} className={css.s6} />
            Đổi đề tài
          </h1>
          <p className={css.s7}>
            Sinh viên gửi đơn, GVHD cho ý kiến và khoa/bộ môn duyệt phiên bản đề tài mới.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} icon={<ArrowsClockwise />} title="Làm mới" />
      </div>

      <div className={[css.extensionGrid, isStudent ? css.extensionGridStudent : ''].filter(Boolean).join(' ')}>
        {isStudent && (
          <Card title="Gửi đơn đổi đề tài" subtitle="Áp dụng cho đề tài/dự án cá nhân hoặc nhóm đang hoạt động">
            {topicOptions.length === 0 ? (
              <div className={css.s8}>Bạn chưa có đề tài đang hoạt động để gửi đơn đổi.</div>
            ) : (
              <form onSubmit={handleCreateRequest} className={css.s9}>
                <SelectField id="topic-change-topic" label="Đề tài hiện tại" value={form.topicId} onChange={(e) => setForm((prev) => ({ ...prev, topicId: e.target.value }))}>
                  {topicOptions.map((topic) => (
                    <option key={topic.topicId} value={topic.topicId}>
                      {topic.title}
                    </option>
                  ))}
                </SelectField>

                <Input
                  name="topic-change-new-title"
                  label="Tên đề tài mới"
                  value={form.newTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, newTitle: e.target.value }))}
                />

                <TextAreaField
                  id="topic-change-new-scope"
                  label="Phạm vi mới"
                  value={form.newScope}
                  onChange={(e) => setForm((prev) => ({ ...prev, newScope: e.target.value }))}
                  placeholder="Mô tả phạm vi mới của đề tài..."
                />

                <TextAreaField
                  id="topic-change-new-plan"
                  label="Kế hoạch mới"
                  value={form.newPlan}
                  onChange={(e) => setForm((prev) => ({ ...prev, newPlan: e.target.value }))}
                  placeholder="Nêu kế hoạch thực hiện sau khi đổi đề tài..."
                />

                <TextAreaField
                  id="topic-change-reason"
                  label="Lý do đổi đề tài"
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Nêu rõ lý do nghiệp vụ hoặc học thuật cần đổi..."
                />

                <Button type="submit" variant="primary" icon={<Plus />} isLoading={submitting}>
                  Gửi đơn
                </Button>
              </form>
            )}
          </Card>
        )}

        <Card title="Danh sách đơn đổi đề tài" subtitle={isStudent ? 'Theo dõi trạng thái đơn của cá nhân/nhóm' : 'Xử lý đơn đổi đề tài theo vai trò'}>
          {requests.length === 0 ? (
            <div className={css.s10}>
              <FileText size={36} weight="duotone" className={css.s11} />
              <p>Chưa có đơn đổi đề tài nào.</p>
            </div>
          ) : (
            <div className={css.s12}>
              {requests.map((request) => (
                <div key={request._id} className={css.s13}>
                  <div className={css.s14}>
                    <div className={css.s15}>
                      <h3 className={css.s16}>{request.newTitle}</h3>
                      <p className={css.s17}>
                        Từ: {request.oldTitle || getTopicTitle(request.topicId)} · {getOwnerTypeLabel(request)}: {getOwnerDisplay(request)}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>

                  <div className={css.s18}>
                    <div>
                      <div className="text-label">GVHD</div>
                      <div className={css.s20}><ApprovalBadge status={request.supervisorApproval?.status} /></div>
                    </div>
                    <div>
                      <div className="text-label">Khoa/Bộ môn</div>
                      <div className={css.s21}><ApprovalBadge status={request.facultyApproval?.status} /></div>
                    </div>
                    <div>
                      <div className="text-label">Ngày gửi</div>
                      <div className={css.s22}>{formatDateTime(request.createdAt)}</div>
                    </div>
                  </div>

                  <div className={css.s23}>
                    <strong className={css.s24}>Lý do:</strong> {request.reason}
                  </div>
                  <div className={css.s25}>
                    <div className={css.s26}><strong className={css.s27}>Phạm vi mới:</strong> {request.newScope}</div>
                    <div className={css.s28}><strong className={css.s29}>Kế hoạch mới:</strong> {request.newPlan}</div>
                  </div>

                  {(request.supervisorApproval?.note || request.facultyApproval?.note) && (
                    <div className={css.s25}>
                      {request.supervisorApproval?.note && (
                        <div className={css.s26}><strong className={css.s27}>Nhận xét GVHD:</strong> {request.supervisorApproval.note}</div>
                      )}
                      {request.facultyApproval?.note && (
                        <div className={css.s28}><strong className={css.s29}>Quyết định khoa/bộ môn:</strong> {request.facultyApproval.note}</div>
                      )}
                    </div>
                  )}

                  {(canSupervisorReview(request) || canFacultyDecide(request) || canCancelRequest(request)) && (
                    <div className={css.s30}>
                      {canSupervisorReview(request) && (
                        <>
                          <Button size="sm" variant="primary" icon={<Check />} onClick={() => openReviewModal(request, 'supervisor', 'approve')}>GVHD đồng ý</Button>
                          <Button size="sm" variant="secondary" icon={<X />} onClick={() => openReviewModal(request, 'supervisor', 'reject')}>GVHD từ chối</Button>
                        </>
                      )}
                      {canFacultyDecide(request) && (
                        <>
                          <Button size="sm" variant="primary" icon={<Check />} onClick={() => openReviewModal(request, 'faculty', 'approve')}>Duyệt đổi đề tài</Button>
                          <Button size="sm" variant="secondary" icon={<X />} onClick={() => openReviewModal(request, 'faculty', 'reject')}>Từ chối</Button>
                        </>
                      )}
                      {canCancelRequest(request) && (
                        <Button size="sm" variant="secondary" icon={<X />} onClick={() => handleCancelRequest(request)}>Hủy đơn</Button>
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
        <div className={css.s31}>
          <div className={css.s32}>
            <div className={css.s33}>
              <h2 className={css.s34}>
                {reviewModal.mode === 'faculty' ? 'Quyết định khoa/bộ môn' : 'Ý kiến GVHD'}
              </h2>
              <p className={css.s35}>{reviewModal.request.newTitle}</p>
            </div>

            <form onSubmit={submitReview} className={css.s36}>
              <TextAreaField
                id="topic-change-review-note"
                label="Ghi chú xử lý"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Nêu rõ căn cứ đồng ý hoặc từ chối..."
              />

              <div className={css.s37}>
                <Button variant="ghost" icon={<X />} onClick={() => setReviewModal(null)}>Hủy</Button>
                <Button type="submit" variant="primary" icon={<Check />} isLoading={reviewSubmitting}>Xác nhận</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
