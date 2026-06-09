'use client';

import { useTopics } from './hooks/useTopics';
import TopicCard from './components/TopicCard';
import TopicModal from './components/TopicModal';
import OverrideModal from './components/OverrideModal';
import AiChatPanel from './components/AiChatPanel';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Tabs from '@/components/ui/Tabs';
import { BookOpen, Plus, Lightbulb } from '@phosphor-icons/react';
import css from './page.module.css';

const topicTabs = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending_review', label: 'Chờ duyệt' },
  { id: 'approved', label: 'Đã duyệt' },
  { id: 'rejected', label: 'Từ chối' },
];

export default function TopicsPage() {
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
  } = useTopics();

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
      </div>

      <Tabs tabs={topicTabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* List items */}
      {loading ? (
        <div className={css.s6}>
          <Spinner size="lg" />
        </div>
      ) : filteredTopics.length === 0 ? (
        <Card>
          <div className={css.s7}>Chưa có đề tài nào thuộc danh mục này.</div>
        </Card>
      ) : (
        <div className={css.s8}>
          {filteredTopics.map((t) => (
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
