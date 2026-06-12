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
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import Tabs from '@/components/ui/Tabs';
import { BookOpen, Plus, Lightbulb, MagnifyingGlass, FileText } from '@phosphor-icons/react';
import { exportToCSV } from '@/lib/export';
import css from './page.module.css';

const topicTabs = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending_review', label: 'Chờ duyệt' },
  { id: 'approved', label: 'Đã duyệt' },
  { id: 'rejected', label: 'Từ chối' },
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
  const initialQuery = useMemo(() => getInitialTopicsQuery(), []);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [search, setSearch] = useState(initialQuery.search);
  const {
    user,
    periods,
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
    isStaff,
    isStudent,
    handleSubmitTopic,
    handleEditClick,
    handleApprove,
    handleReject,
    handleRequestRevision,
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
      <form onSubmit={handleSearchSubmit} className={css.searchRow}>
        <Input
          placeholder="Tìm theo tên đề tài, nhóm, GVHD..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          icon={<MagnifyingGlass size={16} />}
        />
        <Button type="submit" variant="secondary" size="sm">Tìm</Button>
        {search && (
          <Button type="button" variant="ghost" size="sm" onClick={handleResetSearch}>Xóa</Button>
        )}
      </form>

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
          handleSubmitTopic={handleSubmitTopic}
          onClose={() => {
            setShowProposeModal(false);
            setEditingTopicId(null);
            setForm((prev) => ({ ...prev, title: '', summary: '' }));
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
    </div>
  );
}
