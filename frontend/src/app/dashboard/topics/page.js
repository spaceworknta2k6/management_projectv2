'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTopics } from './hooks/useTopics';
import TopicCard from './components/TopicCard';
import TopicModal from './components/TopicModal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import AcademicTermFilter from '@/components/dashboard/AcademicTermFilter';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import Tabs from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import api from '@/services/api';
import { handleApiError } from '@/lib/utils';
import { getAcademicUnitLabel, getTopicDomainLabel } from '@/lib/academicUnits';
import { filterRecordsByTerm } from '@/lib/academicTerm';
import usePeriodStore from '@/store/period.store';
import EmptyState from '@/components/ui/EmptyState';
import { BookOpen, Plus, FileText } from '@phosphor-icons/react';
import { exportToCSV } from '@/lib/export';
import css from './page.module.css';

const topicTabs = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending_review', label: 'Chờ duyệt' },
  { id: 'approved', label: 'Đã duyệt' },
  { id: 'rejected', label: 'Từ chối' },
  { id: 'history', label: 'Lịch sử' },
];

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const VALID_TABS = topicTabs.map((tab) => tab.id);

function getSafePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getSafePageSize(value) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : PAGE_SIZE;
}

function getInitialTopicsQuery() {
  if (typeof window === 'undefined') {
    return {
      page: 1,
      limit: PAGE_SIZE,
      tab: 'all',
      search: '',
    };
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') || 'all';
  return {
    page: getSafePositiveInt(params.get('page'), 1),
    limit: getSafePageSize(params.get('limit')),
    tab: VALID_TABS.includes(tab) ? tab : 'all',
    search: params.get('search') || '',
  };
}

export default function TopicsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const initialQuery = useMemo(() => getInitialTopicsQuery(), []);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [search, setSearch] = useState(initialQuery.search);
  const [topicToCancel, setTopicToCancel] = useState(null);
  const [cancellingTopic, setCancellingTopic] = useState(false);
  const [lecturers, setLecturers] = useState([]);
  const [assignTopic, setAssignTopic] = useState(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [assigningSupervisor, setAssigningSupervisor] = useState(false);
  const { selectedSchoolYear, selectedSemester } = usePeriodStore();
  const {
    user,
    token,
    periods,
    groups,
    loading,
    showProposeModal,
    setShowProposeModal,
    activeTab,
    setActiveTab,
    form,
    setForm,
    submitting,
    editingTopicId,
    setEditingTopicId,
    loadData,
    isStaff,
    isLecturer,
    isStudent,
    handleSubmitTopic,
    handleEditClick,
    handleApprove,
    handleReject,
    handleRequestRevision,
    handleCancelTopic,
    handleRegisterTopic,
    handlePublishTopic,
    handleUnpublishTopic,
    filteredTopics,
  } = useTopics(initialQuery.tab);
  const canSelectAcademicTerm = isStaff || isLecturer;

  const getPeriodByTopic = (topic) => {
    const periodId = topic?.periodId?._id || topic?.periodId;
    return periods.find((period) => String(period._id) === String(periodId)) || topic?.periodId || null;
  };

  const getCoordinatorLecturerId = (period) => (
    period?.coordinatorLecturerId?._id || period?.coordinatorLecturerId || ''
  );

  const getLecturerName = (lecturerId) => {
    const lecturer = lecturers.find((item) => String(item._id) === String(lecturerId));
    return lecturer
      ? `${lecturer.userId?.fullName || lecturer.name || lecturer._id} (${lecturer.userId?.email || lecturer.lecturerCode || 'chưa có email'})`
      : 'Giảng viên phụ trách của đợt học phần';
  };

  const onRegisterTopic = async (topicId, ownerType) => {
    let groupId = undefined;
    if (ownerType === 'group') {
      const topicItem = visibleTopics.find((t) => t._id === topicId);
      const pId = topicItem?.periodId?._id || topicItem?.periodId;
      const matchedGroup = groups.find((g) => (g.periodId?._id || g.periodId) === pId);
      if (!matchedGroup) {
        toast.error('Bạn chưa tham gia nhóm nào được xác nhận trong học phần này.');
        return;
      }
      groupId = matchedGroup._id;
    }
    await handleRegisterTopic(topicId, ownerType, groupId);
  };

  const keyword = search.trim().toLowerCase();
  const termTopics = filterRecordsByTerm(filteredTopics, periods, selectedSchoolYear, selectedSemester);
  const visibleTopics = keyword
    ? termTopics.filter((topic) => {
        const values = [
          topic.title,
          topic.summary,
          topic.groupId?.name,
          topic.periodId?.name,
          getAcademicUnitLabel(topic.academicUnit || topic.periodId?.academicUnit),
          getTopicDomainLabel(topic.topicDomain),
          topic.proposedSupervisorId?.userId?.fullName,
        ];
        return values.some((value) => String(value || '').toLowerCase().includes(keyword));
      })
    : termTopics;

  const totalPages = Math.max(1, Math.ceil(visibleTopics.length / pageSize));
  const pagedTopics = visibleTopics.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (activeTab !== 'all') params.set('tab', activeTab);
    if (search.trim()) params.set('search', search.trim());

    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [activeTab, currentPage, pageSize, pathname, router, search]);

  useEffect(() => {
    if (!token || !isStaff) {
      setLecturers([]);
      return;
    }

    api.get('/auth/lecturers', token)
      .then((res) => setLecturers(res.data || []))
      .catch(() => setLecturers([]));
  }, [isStaff, token]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

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

  const handlePageSizeChange = (nextPageSize) => {
    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  const handleExportExcel = () => {
    const headers = [
      'Mã Đề Tài',
      'Tên Đề Tài',
      'Tóm Tắt',
      'Đợt Đồ Án',
      'Khoa Chuyên Môn',
      'Hướng Chuyên Môn',
      'Nhóm Đăng Ký',
      'Học Kỳ',
      'Người Đề Xuất',
      'GVHD Đề Xuất',
      'Trạng Thái',
    ];

    const getStatusLabel = (status) => {
      switch (status) {
        case 'draft': return 'Bản nháp';
        case 'submitted': return 'Chờ duyệt';
                case 'pending_review': return 'Đang xem xét';
        case 'approved': return 'Đã duyệt';
        case 'rejected': return 'Từ chối';
        case 'needs_revision': return 'Yêu cầu sửa đổi';
        default: return 'Không xác định';
      }
    };

    const data = visibleTopics.map((topic) => [
      topic._id,
      topic.title,
      topic.summary || '',
      topic.periodId?.name || '',
      getAcademicUnitLabel(topic.academicUnit || topic.periodId?.academicUnit),
      getTopicDomainLabel(topic.topicDomain),
      topic.groupId?.name || 'Chưa đăng ký',
      topic.periodId?.semester ? `Kỳ ${topic.periodId.semester}` : '',
      topic.proposedByStudentId?.userId?.fullName || 'Giảng viên',
      topic.proposedSupervisorId?.userId?.fullName || '',
      getStatusLabel(topic.status),
    ]);

    exportToCSV(data, headers, `Danh_sach_de_tai_Karl_${new Date().toISOString().slice(0, 10)}`);
  };

  const handleConfirmCancelTopic = async () => {
    if (!topicToCancel) return;
    setCancellingTopic(true);
    const cancelled = await handleCancelTopic(topicToCancel._id);
    setCancellingTopic(false);
    if (cancelled) setTopicToCancel(null);
  };

  const openAssignSupervisorModal = (topic) => {
    const period = getPeriodByTopic(topic);
    const coordinatorLecturerId = getCoordinatorLecturerId(period);
    setAssignTopic(topic);
    setSelectedSupervisorId(coordinatorLecturerId || topic.supervisorId?._id || topic.proposedSupervisorId?._id || '');
  };

  const handleAssignSupervisor = async (e) => {
    e.preventDefault();
    if (!assignTopic) return;
    if (!selectedSupervisorId) {
      toast.warning('Vui lòng chọn giảng viên hướng dẫn trước khi phân công.');
      return;
    }

    setAssigningSupervisor(true);
    try {
      await api.post(`/topics/${assignTopic._id}/assign-supervisor`, {
        supervisorId: selectedSupervisorId,
      }, token);
      toast.success('Đã phân công GVHD và khởi tạo dự án cho đề tài.');
      setAssignTopic(null);
      setSelectedSupervisorId('');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setAssigningSupervisor(false);
    }
  };

  return (
    <div>
      {/* Page Header section */}
      <div className={css.s1}>
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <BookOpen size={28} className={css.s3} />
            Quản lý Đề tài
          </h1>
          <p className={css.s4}>
            Xem danh sách đề tài đồ án tốt nghiệp, duyệt đề xuất và quản lý đăng ký.
          </p>
        </div>
        {isStudent && (
          <div className={css.s5}>            <Button variant="primary" size="sm" onClick={() => setShowProposeModal(true)}>
              <Plus size={16} />
              Đề xuất đề tài mới
            </Button>
          </div>
        )}
        {!isStudent && (isStaff || isLecturer) && (
          <div className={css.s5}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              className={css.buttonGap}
            >
              <FileText size={16} />
              Xuất Excel
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowProposeModal(true)}>
              <Plus size={16} />
              Tạo đề tài
            </Button>
          </div>
        )}
      </div>

      <Tabs tabs={topicTabs} activeTab={activeTab} onChange={handleTabChange} />

      {/* Search form */}
      {canSelectAcademicTerm && (
        <div style={{ marginBottom: '16px' }}>
          <Card>
            <AcademicTermFilter periods={periods} />
          </Card>
        </div>
      )}
      <FilterCard
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearch={handleSearchSubmit}
        onReset={handleResetSearch}
        placeholder="Tìm theo tên đề tài, nhóm, GVHD..."
      />

      {/* List items */}
      {loading ? (
        <div className={css.s6}>
          <Spinner size="lg" />
        </div>
      ) : visibleTopics.length === 0 ? (
        <EmptyState
          title={search ? 'Không tìm thấy kết quả' : 'Chưa có đề tài'}
          description={search ? `Không tìm thấy kết quả cho từ khóa "${search}".` : 'Chưa có đề tài nào thuộc danh mục này.'}
          icon={BookOpen}
        />
      ) : (
        <div className={css.s8}>
          {pagedTopics.map((t) => (
            <TopicCard
              key={t._id}
              topic={t}
              user={user}
              isStaff={isStaff}
              isLecturer={isLecturer}
              isStudent={isStudent}
              handleRequestRevision={handleRequestRevision}
              handleReject={handleReject}
              handleApprove={handleApprove}
              handleAssignSupervisorClick={openAssignSupervisorModal}
              handleCancelClick={setTopicToCancel}
              handleEditClick={handleEditClick}              onRegisterTopic={onRegisterTopic}
              onPublishTopic={handlePublishTopic}
              onUnpublishTopic={handleUnpublishTopic}
            />
          ))}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            totalItems={visibleTopics.length}
          />
        </div>
      )}

      {/* Propose Topic Modal */}
      {showProposeModal && (
        <TopicModal
          editingTopicId={editingTopicId}
          form={form}
          setForm={setForm}
          periods={periods}
          groups={groups}
          handleSubmitTopic={handleSubmitTopic}
          onClose={() => {
            setShowProposeModal(false);
            setEditingTopicId(null);
            setForm((prev) => ({
              ...prev,
              ownerType: 'student',
              groupId: '',
              title: '',
              summary: '',
              proposedSupervisorId: '',
              proposedSupervisorEmail: '',
              allowIndividual: true,
              allowGroup: true,
              groupMinSize: '2',
              groupMaxSize: '5',
              capacityMaxStudents: '1',
              capacityMaxGroups: '1',
            }));
          }}
          submitting={submitting}
          isLecturerOrStaff={isLecturer || isStaff}
        />
      )}
      {assignTopic && (
        (() => {
          const assignedPeriod = getPeriodByTopic(assignTopic);
          const coordinatorLecturerId = getCoordinatorLecturerId(assignedPeriod);

          return (
        <div className={css.s27}>
          <div className={css.s28}>
            <div className={css.s29}>
              <div>
                <h3 className={css.s30}>Phân công giảng viên hướng dẫn</h3>
                <p className={css.assignModalSubtitle}>Sau khi xác nhận, hệ thống sẽ tạo dự án cho đề tài này.</p>
              </div>
            </div>
            <form onSubmit={handleAssignSupervisor} className={css.s31}>
              <div className={css.assignTopicSummary}>
                <span className={css.assignTopicLabel}>Đề tài</span>
                <strong>{assignTopic.title}</strong>
                <div className={css.assignStatusRow}>
                  <span>Đã duyệt</span>
                  <span>Chưa tạo dự án</span>
                  <span>Cần phân công GVHD</span>
                </div>
              </div>
              <div className={css.s32}>
                <label className={css.s33}>Giảng viên hướng dẫn</label>
                {coordinatorLecturerId ? (
                  <div className={css.readonlyField}>
                    {getLecturerName(coordinatorLecturerId)}
                  </div>
                ) : (
                  <select
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    className={css.s70}
                  >
                    <option value="">Chọn giảng viên</option>
                    {lecturers.map((lecturer) => (
                      <option key={lecturer._id} value={lecturer._id}>
                        {lecturer.userId?.fullName || lecturer._id} ({lecturer.userId?.email || 'chưa có email'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className={css.s36}>
                <Button variant="secondary" onClick={() => setAssignTopic(null)}>
                  Hủy
                </Button>
                <Button variant="primary" type="submit" loading={assigningSupervisor}>
                  Xác nhận phân công
                </Button>
              </div>
            </form>
          </div>
        </div>
          );
        })()
      )}
      <ConfirmDialog
        open={Boolean(topicToCancel)}
        title="Hủy đề tài"
        message={topicToCancel ? `Bạn có chắc chắn muốn hủy đề tài "${topicToCancel.title}"? Nếu đề tài đã có dự án liên kết, dự án đó cũng sẽ được hủy.` : ''}
        confirmLabel="Hủy đề tài"
        loading={cancellingTopic}
        onCancel={() => setTopicToCancel(null)}
        onConfirm={handleConfirmCancelTopic}
      />
    </div>
  );
}
