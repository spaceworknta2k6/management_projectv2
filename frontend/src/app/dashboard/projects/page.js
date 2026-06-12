'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { getTechnicalLabel, hasAnyRole } from '@/lib/utils';
import { FolderSimple, UserCheck, ShieldCheck, CheckSquare, ArrowsClockwise, ChatsCircle, MagnifyingGlass, FileText } from '@phosphor-icons/react';
import { exportToCSV } from '@/lib/export';
import css from './page.module.css';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

function getSafePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getSafePageSize(value) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : PAGE_SIZE;
}

function getInitialQuery() {
  if (typeof window === 'undefined') return { page: 1, limit: PAGE_SIZE, search: '' };
  const params = new URLSearchParams(window.location.search);
  return {
    page: getSafePositiveInt(params.get('page'), 1),
    limit: getSafePageSize(params.get('limit')),
    search: params.get('search') || '',
  };
}

export default function ProjectsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const initialQuery = useMemo(() => getInitialQuery(), []);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [search, setSearch] = useState(initialQuery.search);

  const [projects, setProjects] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(null); // projectId
  const [selectedReviewerId, setSelectedReviewerId] = useState('');

  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const isStudent = hasAnyRole(user, ['STUDENT']);

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

  const visibleProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((p) => {
      const values = [
        p.topicId?.title,
        p.groupId?.name,
        p.periodId?.name,
        p.supervisorId?.userId?.fullName,
        p.reviewerId?.userId?.fullName,
      ];
      return values.some((v) => String(v || '').toLowerCase().includes(keyword));
    });
  }, [projects, search]);

  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / pageSize));
  const pagedProjects = visibleProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) router.replace(nextUrl, { scroll: false });
  }, [currentPage, pageSize, pathname, router, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setCurrentPage(1);
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setSearch('');
    setCurrentPage(1);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setCurrentPage(1);
  };

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

  const handleRequestDirectChat = async (lecturerUserId) => {
    if (!lecturerUserId) {
      toast.error('Chưa có thông tin tài khoản giảng viên để nhắn tin.');
      return;
    }

    try {
      const res = await api.post('/chat/direct-rooms', { lecturerUserId }, token);
      toast.success(
        res.data?.status === 'accepted'
          ? 'Đã mở cuộc trò chuyện.'
          : 'Đã gửi lời mời chat. Vui lòng chờ thầy cô chấp nhận.'
      );
      router.push(`/dashboard/chat?room=${res.data?._id || ''}`);
    } catch (err) {
      toast.error(err.message || 'Không thể tạo lời mời chat.');
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

  const handleExportExcel = () => {
    const headers = [
      'Mã Dự Án',
      'Tên Đề Tài',
      'Đợt Đồ Án',
      'Nhóm Thực Hiện',
      'Thành Viên Nhóm',
      'Giảng Viên Hướng Dẫn',
      'Giảng Viên Phản Biện',
      'Trạng Thái',
    ];

    const getStatusLabel = (status) => {
      switch (status) {
        case 'assigned': return 'Mới phân công';
        case 'in_progress': return 'Đang thực hiện';
        case 'pre_defense_submitted': return 'Đã nộp trước bảo vệ';
        case 'supervisor_reviewed': return 'GVHD đã đánh giá';
        case 'reviewer_reviewed': return 'GVPB đã đánh giá';
        case 'defense_eligible': return 'Đủ ĐK bảo vệ';
        case 'finalized': return 'Đã hoàn thành';
        case 'cancelled': return 'Đã hủy';
        default: return status || '';
      }
    };

    const data = visibleProjects.map((p) => {
      const membersText = (p.groupId?.members || [])
        .map((m) => `${m.studentId?.userId?.fullName || 'Sinh viên'} (${m.studentId?.userId?.email || ''})`)
        .join('; ');

      return [
        p._id,
        p.topicId?.title || 'Chưa cập nhật đề tài',
        p.periodId?.name || '',
        p.groupId?.name || '',
        membersText,
        p.supervisorId?.userId?.fullName || '',
        p.reviewerId?.userId?.fullName || 'Chưa phân công phản biện',
        getStatusLabel(p.status),
      ];
    });

    exportToCSV(data, headers, `Danh_sach_du_an_Karl_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div>
      {/* Page Header */}
      <div className={css.s1} >
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <FolderSimple size={28} className={css.s3} />
            Quản lý Dự án Đồ án
          </h1>
          <p className={css.s4}>
            Xem thông tin tiến độ, phân công phản biện và quản lý vòng đời thực hiện đề tài đồ án tốt nghiệp
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isStudent && (isStaff || isLecturer) && (
            <Button variant="secondary" size="sm" onClick={handleExportExcel}>
              <FileText size={16} />
              Xuất Excel
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={loadData}>
            <ArrowsClockwise size={16} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Projects list */}
      <FilterCard
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearch={handleSearchSubmit}
        onReset={handleResetSearch}
        placeholder="Tìm theo tên đề tài, nhóm, GVHD..."
      />

      {loading ? (
        <div className={css.s5}>
          <Spinner size="lg" />
        </div>
      ) : visibleProjects.length === 0 ? (
        <Card>
          <div className={css.s6}>
            {search ? `Không tìm thấy kết quả cho "${search}".` : 'Chưa có dự án đồ án nào được khởi tạo trong đợt này.'}
          </div>
        </Card>
      ) : (
        <div className={css.s7}>
          {pagedProjects.map((p) => {
            const allowedDefense = ['in_progress', 'pre_defense_submitted', 'supervisor_reviewed', 'reviewer_reviewed'].includes(p.status);

            return (
              <Card
                key={p._id}
                title={p.topicId?.title || 'Đang chờ cập nhật đề tài'}
                subtitle={`Nhóm: ${p.groupId?.name || 'Chưa rõ'} | Mã đợt: ${p.periodId?.name || '—'}`}
                actions={
                  <div className={css.s8}>
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
                <div className={css.s9}>
                  <div>
                    <p className={css.s10}>Giảng viên hướng dẫn:</p>
                    <div className={css.lecturerLine}>
                      <p className={css.s11}>
                        {p.supervisorId?.userId?.fullName || 'Chưa phân công'} ({p.supervisorId?.userId?.email || '—'})
                      </p>
                      {isStudent && p.supervisorId?.userId?._id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRequestDirectChat(p.supervisorId.userId._id)}
                          icon={<ChatsCircle size={14} />}
                        >
                          Nhắn tin
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className={css.s12}>Giảng viên phản biện:</p>
                    <div className={css.lecturerLine}>
                      <p className={css.s13}>
                        {p.reviewerId?.userId?.fullName ? (
                          <span>{p.reviewerId.userId.fullName} ({p.reviewerId.userId.email})</span>
                        ) : (
                          <span className={css.s14}>Chưa phân công phản biện</span>
                        )}
                      </p>
                      {isStudent && p.reviewerId?.userId?._id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRequestDirectChat(p.reviewerId.userId._id)}
                          icon={<ChatsCircle size={14} />}
                        >
                          Nhắn tin
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className={css.s15}>
                    <p className={css.s16}>Tóm tắt đề tài:</p>
                    <p className={css.s17}>{p.topicId?.summary || 'Không có tóm tắt chi tiết.'}</p>
                  </div>
                </div>
              </Card>
            );
          })}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            totalItems={visibleProjects.length}
          />
        </div>
      )}

      {/* Assign Reviewer Modal */}
      {showAssignModal && (
        <div className={css.s18} >
          <div className={css.s19} >
            <div className={css.s20}>
              <h3 className={css.s21}>
                Phân công Giảng viên phản biện
              </h3>
              <button
                onClick={() => setShowAssignModal(null)} className={css.s26} >
                &times;
              </button>
            </div>
            <form onSubmit={handleAssignReviewer} className={css.s22}>
              <div className={css.s23}>
                <label className={css.s24}>Chọn giảng viên phản biện</label>
                <select
                  value={selectedReviewerId}
                  onChange={(e) => setSelectedReviewerId(e.target.value)}
                  required className={css.s27} >
                  <option value="">-- Chọn giảng viên --</option>
                  {lecturers.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.userId?.fullName} ({l.userId?.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className={css.s25}>
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
