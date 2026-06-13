'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, hasAnyRole } from '@/lib/utils';
import { getOwnerDisplay, getOwnerTypeLabel, isStudentProjectOwner } from '@/lib/projectOwner';
import {
  ArrowsClockwise,
  Calendar,
  Check,
  Clock,
  FileText,
  Plus,
  X,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import css from './page.module.css';

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
  cancelled: { label: 'Đã hủy', variant: 'error' },
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
      htmlFor={htmlFor} className={css.s1} >
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
        className={css.selectInput}
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
        rows={rows} className={css.s2} />
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_FILTERS = {
  search: '',
  status: '',
};

function getSafePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getSafePageSize(value) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : 10;
}

function getInitialExtensionsQuery() {
  if (typeof window === 'undefined') {
    return {
      page: 1,
      limit: 10,
      filters: DEFAULT_FILTERS,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    page: getSafePositiveInt(params.get('page'), 1),
    limit: getSafePageSize(params.get('limit')),
    filters: {
      search: params.get('search') || '',
      status: params.get('status') || '',
    },
  };
}


export default function ExtensionRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const initialQuery = useMemo(() => getInitialExtensionsQuery(), []);

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

  // Pagination & Filters State
  const [pagination, setPagination] = useState({ total: 0, page: initialQuery.page, pages: 1, limit: initialQuery.limit });
  const [searchInput, setSearchInput] = useState(initialQuery.filters.search);
  const [search, setSearch] = useState(initialQuery.filters.search);
  const [statusFilter, setStatusFilter] = useState(initialQuery.filters.status);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);

  const isStudent = hasAnyRole(user, ['STUDENT']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const isFaculty = hasAnyRole(user, ['FACULTY_STAFF']);

  const visibleProjects = useMemo(() => {
    if (isStudent) {
      return projects.filter((project) => isStudentProjectOwner(project, user?.studentId));
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
      const queryParams = new URLSearchParams({
        search,
        status: statusFilter,
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });

      const [projectsRes, requestsRes] = await Promise.all([
        api.get('/projects', token),
        api.get(`/extensions?${queryParams.toString()}`, token),
      ]);

      const projectList = projectsRes.data || [];
      setProjects(projectList);
      setRequests(requestsRes.data || []);
      if (requestsRes.pagination) {
        setPagination(requestsRes.pagination);
      }

      const scopedProjects = projectList.filter((project) => {
        if (isStudent) {
          return isStudentProjectOwner(project, user?.studentId);
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
  }, [token, search, statusFilter, currentPage, pageSize, isStudent, user?.studentId, isLecturer, isFaculty, user?.lecturerId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter.trim()) params.set('status', statusFilter.trim());

    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [currentPage, pageSize, pathname, router, search, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const handlePageSizeChange = (nextPageSize) => {
    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

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

  const canCancelRequest = (request) => request.status === 'pending' && (isFaculty || isStudent);

  const handleCancelRequest = async (request) => {
    if (!window.confirm('Hủy yêu cầu gia hạn này?')) return;

    try {
      await api.post(`/extensions/${request._id}/cancel`, {}, token);
      toast.success('Đã hủy yêu cầu gia hạn.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Không thể hủy yêu cầu gia hạn.');
    }
  };

  const getTargetLabel = (request) => {
    const milestone = milestoneMap[request.targetId];
    if (milestone) return milestone.title;
    return `${targetTypeLabels[request.targetType] || request.targetType}: ${String(request.targetId).slice(-6)}`;
  };

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
            <Clock size={28} className={css.s6} />
            Gia hạn deadline
          </h1>
          <p className={css.s7}>
            Sinh viên gửi yêu cầu, GVHD khuyến nghị và giáo vụ ra quyết định cuối cùng
          </p>
        </div>
        <Button variant="outline" onClick={loadData} icon={<ArrowsClockwise />} title="Làm mới" />
      </div>

      {/* Search & Filters */}
      <Card className={css.searchCard}>
        <form onSubmit={handleSearchSubmit} className={css.searchRow}>
          <div className={css.searchField}>
            <Input
              label="Tìm kiếm yêu cầu"
              placeholder="Nhập cá nhân/nhóm hoặc đề tài..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              icon={<MagnifyingGlass size={16} />}
            />
          </div>

          <div className={css.filterField}>
            <label className={css.filterLabel}>Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={css.selectFilter}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
              <option value="expired">Hết hạn</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          <div className={css.searchActions}>
            <Button variant="primary" type="submit" icon={<MagnifyingGlass size={16} />}>
              Tìm kiếm
            </Button>
            {(search || statusFilter) && (
              <Button variant="ghost" type="button" onClick={handleResetFilters}>
                Xóa lọc
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div className={[css.extensionGrid, isStudent ? css.extensionGridStudent : ''].filter(Boolean).join(' ')}>
        {isStudent && (
          <Card title="Gửi yêu cầu gia hạn" subtitle="Áp dụng cho mốc tiến độ của dự án cá nhân hoặc nhóm">
            {visibleProjects.length === 0 ? (
              <div className={css.s8}>
                Bạn chưa có dự án đang tham gia để gửi yêu cầu gia hạn.
              </div>
            ) : (
              <form onSubmit={handleCreateRequest} className={css.s9}>
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
 
        <Card title="Danh sách yêu cầu" subtitle={isStudent ? 'Theo dõi trạng thái yêu cầu của cá nhân/nhóm' : 'Xử lý các yêu cầu gia hạn đang chờ'}>
          {requests.length === 0 ? (
            <div className={css.s10}>
              <Calendar size={36} weight="duotone" className={css.s11} />
              <p>Chưa có yêu cầu gia hạn nào.</p>
            </div>
          ) : (
            <div className={css.s12}>
              {requests.map((request) => (
                <div
                  key={request._id} className={css.s13} >
                  <div className={css.s14}>
                    <div className={css.s15}>
                      <h3 className={css.s16}>
                        {getProjectTitle(request.projectId)}
                      </h3>
                      <p className={css.s17}>
                        {getOwnerTypeLabel(request)}: {getOwnerDisplay(request)} · {getTargetLabel(request)}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
 
                  <div className={css.s18}>
                    <div>
                      <div className="text-label">Deadline mới</div>
                      <div className={css.s19}>
                        {formatDateTime(request.requestedTo)}
                      </div>
                    </div>
                    <div>
                      <div className="text-label">GVHD</div>
                      <div className={css.s20}>
                        <ApprovalBadge status={request.supervisorApproval?.status} />
                      </div>
                    </div>
                    <div>
                      <div className="text-label">Giáo vụ</div>
                      <div className={css.s21}>
                        <ApprovalBadge status={request.facultyDecision?.status} />
                      </div>
                    </div>
                    <div>
                      <div className="text-label">Ngày gửi</div>
                      <div className={css.s22}>
                        {formatDateTime(request.createdAt)}
                      </div>
                    </div>
                  </div>
 
                  <div className={css.s23}>
                    <strong className={css.s24}>Lý do:</strong> {request.reason}
                  </div>
 
                  {(request.supervisorApproval?.note || request.facultyDecision?.note) && (
                    <div className={css.s25}>
                      {request.supervisorApproval?.note && (
                        <div className={css.s26}>
                          <strong className={css.s27}>Nhận xét GVHD:</strong> {request.supervisorApproval.note}
                        </div>
                      )}
                      {request.facultyDecision?.note && (
                        <div className={css.s28}>
                          <strong className={css.s29}>Quyết định giáo vụ:</strong> {request.facultyDecision.note}
                        </div>
                      )}
                    </div>
                  )}
 
                  {(canSupervisorReview(request) || canFacultyDecide(request)) && (
                    <div className={css.s30}>
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
                  {canCancelRequest(request) && (
                    <div className={css.s30}>
                      <Button size="sm" variant="secondary" icon={<X />} onClick={() => handleCancelRequest(request)}>
                        Hủy yêu cầu
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {requests.length > 0 && (
            <Pagination
              compact
              currentPage={currentPage}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              pageSize={pagination.limit}
              currentItemCount={requests.length}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={handlePageSizeChange}
              isLoading={loading}
              itemLabel={'yêu cầu'}
              onPageChange={setCurrentPage}
              className="mt-4"
            />
          )}
        </Card>
      </div>

      {reviewModal && (
        <div className={css.s31} >
          <div className={css.s32} >
            <div className={css.s33}>
              <h2 className={css.s34}>
                {reviewModal.mode === 'faculty' ? 'Quyết định của giáo vụ' : 'Khuyến nghị của GVHD'}
              </h2>
              <p className={css.s35}>
                {getProjectTitle(reviewModal.request.projectId)}
              </p>
            </div>

            <form onSubmit={submitReview} className={css.s36}>
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

              <div className={css.s37}>
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
