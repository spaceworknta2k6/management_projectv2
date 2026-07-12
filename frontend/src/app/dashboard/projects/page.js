'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import usePeriodStore from '@/store/period.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import AcademicTermFilter from '@/components/dashboard/AcademicTermFilter';
import { useToast } from '@/components/ui/Toast';
import { hasAnyRole } from '@/lib/utils';
import { getMemberDisplay, getOwnerDisplay, getOwnerTypeLabel, isStudentProjectOwner } from '@/lib/projectOwner';
import { getRecordPeriod, isPeriodInTerm } from '@/lib/academicTerm';
import { FolderSimple, ArrowsClockwise, FileText } from '@phosphor-icons/react';
import { exportToCSV } from '@/lib/export';
import ProjectCard from './components/ProjectCard';
import AssignReviewerModal from './components/AssignReviewerModal';
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

  const {
    periods,
    selectedPeriodId,
    selectedSchoolYear,
    selectedSemester,
    setSelectedPeriodId,
    fetchPeriods,
  } = usePeriodStore();

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
  const canSelectAcademicTerm = isStaff || isLecturer;

  const periodOptions = useMemo(
    () => periods.filter((period) => isPeriodInTerm(period, selectedSchoolYear, selectedSemester)),
    [periods, selectedSchoolYear, selectedSemester]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch periods first
      await fetchPeriods(token);

      // 2. Fetch all projects
      const resProjects = await api.get('/projects', token);
      
      // If student, filter projects by project owner (personal or group)
      let projectList = resProjects.data || [];
      if (!isStaff && !isLecturer) {
        projectList = projectList.filter((p) => isStudentProjectOwner(p, user?.studentId));
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

      // 3. Fetch lecturers for assignment (Staff only)
      if (isStaff) {
        const resLecturers = await api.get('/auth/lecturers', token);
        setLecturers(resLecturers.data || []);
      }
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách dự án');
    } finally {
      setLoading(false);
    }
  }, [isLecturer, isStaff, toast, token, user?.id, user?.lecturerId, user?.studentId, fetchPeriods]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [loadData, token]);

  const visibleProjects = useMemo(() => {
    let list = projects.filter((project) => isPeriodInTerm(getRecordPeriod(project, periods), selectedSchoolYear, selectedSemester));
    if (canSelectAcademicTerm && selectedPeriodId) {
      list = list.filter((p) => {
        const pId = p.periodId?._id || p.periodId;
        return pId === selectedPeriodId;
      });
    }
    const keyword = search.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter((p) => {
      const values = [
        p.topicId?.title,
        getOwnerDisplay(p),
        p.periodId?.name,
        p.supervisorId?.userId?.fullName,
        p.reviewerId?.userId?.fullName,
      ];
      return values.some((v) => String(v || '').toLowerCase().includes(keyword));
    });
  }, [canSelectAcademicTerm, periods, projects, selectedPeriodId, selectedSchoolYear, selectedSemester, search]);

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
    if (!selectedReviewerId) {
      toast.error('Vui lòng chọn giảng viên chấm 2.');
      return;
    }
    if (!showAssignModal) return;

    setSubmitting(true);
    try {
      await api.post(`/projects/${showAssignModal}/assign-reviewer`, {
        reviewerId: selectedReviewerId
      }, token);
      toast.success('Đã phân công giảng viên chấm 2 thành công!');
      setShowAssignModal(null);
      setSelectedReviewerId('');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi phân công giảng viên chấm 2');
    } finally {
      setSubmitting(false);
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


  const handleExportExcel = () => {
    const headers = [
      'Mã Dự Án',
      'Tên Đề Tài',
      'Đợt Đồ Án',
      'Cá nhân/Nhóm',
      'Thành viên/Người thực hiện',
      'Giảng Viên Hướng Dẫn',
      'Giảng Viên Chấm 2',
      'Trạng Thái',
    ];

    const getStatusLabel = (status) => {
      switch (status) {
        case 'assigned': return 'Mới phân công';
        case 'in_progress': return 'Đang thực hiện';
        case 'final_report_submitted': return 'Đã nộp báo cáo cuối';
        case 'supervisor_reviewed': return 'GVHD đã đánh giá';
        case 'reviewer_reviewed': return 'GV chấm 2 đã đánh giá';
        case 'ready_for_grading': return 'Sẵn sàng chấm';
        case 'finalized': return 'Đã hoàn thành';
        case 'cancelled': return 'Đã hủy';
        default: return 'Không xác định';
      }
    };

    const data = visibleProjects.map((p) => [
        p._id,
        p.topicId?.title || 'Chưa cập nhật đề tài',
        p.periodId?.name || '',
        `${getOwnerTypeLabel(p)}: ${getOwnerDisplay(p)}`,
        getMemberDisplay(p),
        p.supervisorId?.userId?.fullName || '',
        p.reviewerId?.userId?.fullName || 'Chưa phân công giảng viên chấm 2',
        getStatusLabel(p.status),
      ]);

    exportToCSV(data, headers, `Danh_sach_du_an_Karl_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div>
      {/* Page Header */}
      <div className={css.s1}>
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <FolderSimple size={28} className={css.s3} />
            Quản lý Dự án Đồ án
          </h1>
          <p className={css.s4}>
            Xem thông tin tiến độ, phân công giảng viên chấm 2 và quản lý vòng đời thực hiện đề tài học phần đồ án
          </p>
        </div>
        <div className={css.headerActions}>
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

      {/* Period Selection and Filter bar */}
      <div className={`no-print ${css.filterContainer}`}>
        {canSelectAcademicTerm && (
          <Card className={css.periodCard} noPadding>
            <div className={css.periodCardContent}>
              <AcademicTermFilter periods={periods} />
              <div>
                <label className={css.periodLabel}>Học phần đồ án</label>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className={css.periodSelect}
                >
                  <option value="">Tất cả học phần trong kỳ</option>
                  {periodOptions.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.courseCode || `Kỳ ${p.semester}`})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        )}
        
        <div className={css.searchWrapper}>
          <FilterCard
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            onSearch={handleSearchSubmit}
            onReset={handleResetSearch}
            placeholder="Tìm theo tên đề tài, cá nhân/nhóm, GVHD..."
          />
        </div>
      </div>


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
          {pagedProjects.map((p) => (
            <ProjectCard
              key={p._id}
              project={p}
              user={user}
              isStaff={isStaff}
              isLecturer={isLecturer}
              isStudent={isStudent}
              onStartProject={handleStartProject}
              onOpenAssignReviewer={(projId, currentReviewerId) => {
                setShowAssignModal(projId);
                setSelectedReviewerId(currentReviewerId);
              }}
              onFinalizeProject={handleFinalizeProject}
              onRequestDirectChat={handleRequestDirectChat}
            />
          ))}
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
      <AssignReviewerModal
        isOpen={Boolean(showAssignModal)}
        lecturers={lecturers}
        selectedReviewerId={selectedReviewerId}
        setSelectedReviewerId={setSelectedReviewerId}
        submitting={submitting}
        onSubmit={handleAssignReviewer}
        onClose={() => {
          setShowAssignModal(null);
          setSelectedReviewerId('');
        }}
      />
    </div>

  );
}
