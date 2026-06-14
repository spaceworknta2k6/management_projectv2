'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTopics } from './hooks/useTopics';
import TopicCard from './components/TopicCard';
import TopicModal from './components/TopicModal';
import OverrideModal from './components/OverrideModal';
import AiChatPanel from './components/AiChatPanel';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import Tabs from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import api from '@/services/api';
import { BookOpen, Plus, Lightbulb, MagnifyingGlass, FileText } from '@phosphor-icons/react';
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
    aiCheckingId,
    aiResults,
    showOverrideModal,
    setShowOverrideModal,
    overrideComment,
    setOverrideComment,
    overriding,
    chatOpen,
    setChatOpen,
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    suggestLoading,
    chatEndRef,
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
    handleSuggestTopics,
    handleSendChat,
    handleSelectSuggestedTopic,
    handleCheckDuplicate,
    handleOverrideSubmit,
    filteredTopics,
  } = useTopics(initialQuery.tab);

  const visibleTopics = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return filteredTopics;
    return filteredTopics.filter((topic) => {
      const values = [
        topic.title,
        topic.summary,
        topic.groupId?.name,
        topic.periodId?.name,
        topic.proposedSupervisorId?.userId?.fullName,
      ];
      return values.some((value) => String(value || '').toLowerCase().includes(keyword));
    });
  }, [filteredTopics, search]);

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
        case 'ai_checked': return 'AI đã kiểm tra';
        case 'pending_review': return 'Đang xem xét';
        case 'approved': return 'Đã duyệt';
        case 'rejected': return 'Từ chối';
        case 'needs_revision': return 'Yêu cầu sửa đổi';
        default: return status || '';
      }
    };

    const data = visibleTopics.map((topic) => [
      topic._id,
      topic.title,
      topic.summary || '',
      topic.periodId?.name || '',
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
    setAssignTopic(topic);
    setSelectedSupervisorId(topic.supervisorId?._id || topic.proposedSupervisorId?._id || '');
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
      toast.error(err.message || 'Không thể phân công giảng viên hướng dẫn.');
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
            Xem danh sách đề tài đồ án tốt nghiệp, duyệt đề xuất và thực hiện kiểm tra AI
          </p>
        </div>
        {isStudent && (
          <div className={css.s5}>
            <Button
              variant="secondary"
              size="sm"
              loading={suggestLoading}
              onClick={() => {
                if (chatMessages.length > 0) {
                  setChatOpen(true);
                } else {
                  handleSuggestTopics();
                }
              }}
              className={css.buttonGap}
            >
              <Lightbulb size={16} />
              Gợi ý đề tài cho tôi
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowProposeModal(true)}>
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
            >
              <FileText size={16} />
              Xuất Excel
            </Button>
          </div>
        )}
      </div>

      <Tabs tabs={topicTabs} activeTab={activeTab} onChange={handleTabChange} />

      {/* Search form */}
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
        <Card>
          <div className={css.s7}>
            {search ? `Không tìm thấy kết quả cho "${search}".` : 'Chưa có đề tài nào thuộc danh mục này.'}
          </div>
        </Card>
      ) : (
        <div className={css.s8}>
          {pagedTopics.map((t) => (
            <TopicCard
              key={t._id}
              topic={t}
              user={user}
              isStaff={isStaff}
              isStudent={isStudent}
              handleRequestRevision={handleRequestRevision}
              handleReject={handleReject}
              handleApprove={handleApprove}
              handleAssignSupervisorClick={openAssignSupervisorModal}
              handleCancelClick={setTopicToCancel}
              handleEditClick={handleEditClick}
              handleCheckDuplicate={handleCheckDuplicate}
              aiCheckingId={aiCheckingId}
              aiResults={aiResults}
              setShowOverrideModal={setShowOverrideModal}
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
            setForm((prev) => ({ ...prev, ownerType: 'student', groupId: '', title: '', summary: '' }));
          }}
          submitting={submitting}
        />
      )}

      {/* Staff manual override modal */}
      {showOverrideModal && (
        <OverrideModal
          overrideComment={overrideComment}
          setOverrideComment={setOverrideComment}
          handleOverrideSubmit={handleOverrideSubmit}
          onClose={() => setShowOverrideModal(null)}
          overriding={overriding}
        />
      )}

      {/* AI Suggestion Chat panel */}
      {chatOpen && (
        <AiChatPanel
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatLoading={chatLoading}
          suggestLoading={suggestLoading}
          chatEndRef={chatEndRef}
          handleSuggestTopics={handleSuggestTopics}
          handleSendChat={handleSendChat}
          handleSelectSuggestedTopic={handleSelectSuggestedTopic}
          onClose={() => setChatOpen(false)}
        />
      )}

      {assignTopic && (
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
