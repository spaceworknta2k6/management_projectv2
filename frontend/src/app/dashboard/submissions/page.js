'use client';

import { useSubmissions } from './hooks/useSubmissions';
import usePeriodStore from '@/store/period.store';
import MilestoneCard from './components/MilestoneCard';
import SubmitReportModal from './components/SubmitReportModal';
import ReviewFeedbackModal from './components/ReviewFeedbackModal';
import CreateMilestoneModal from './components/CreateMilestoneModal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AcademicTermFilter from '@/components/dashboard/AcademicTermFilter';
import { FileText, Plus } from '@phosphor-icons/react';
import css from './page.module.css';

const getProjectOwnerLabel = (project) => (
  project?.ownerType === 'student'
    ? `Cá nhân: ${project.studentId?.userId?.fullName || project.studentId?.studentCode || 'Sinh viên'}`
    : `Nhóm: ${project.groupId?.name || 'Chưa rõ'}`
);

export default function SubmissionsPage() {
  const { periods } = usePeriodStore();
  const {
    user,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    milestones,
    loading,
    loadingMilestones,
    showSubmitModal,
    setShowSubmitModal,
    uploadingFile,
    uploadedFileId,
    setUploadedFileId,
    fileName,
    setFileName,
    submissionNote,
    setSubmissionNote,
    submittingWork,
    showFeedbackModal,
    setShowFeedbackModal,
    feedbackStatus,
    setFeedbackStatus,
    feedbackComment,
    setFeedbackComment,
    submittingFeedback,
    showCreateMilestoneModal,
    setShowCreateMilestoneModal,
    editingMilestone,
    setEditingMilestone,
    milestoneToDelete,
    setMilestoneToDelete,
    newMilestone,
    setNewMilestone,
    creatingMilestone,
    deletingMilestone,
    isStaff,
    isLecturer,
    isStudent,
    isSupervisor,
    handleFileUpload,
    handleSubmissionSubmit,
    handleFeedbackSubmit,
    handleCreateMilestone,
    openEditMilestone,
    handleDeleteMilestone,
    handleToggleLockMilestone,
    handleDownloadFile,
  } = useSubmissions();

  return (
    <div>
      {/* Page Header */}
      <div className={css.s1}>
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <FileText size={28} className={css.s3} />
            Nộp báo cáo & Mốc tiến độ
          </h1>
          <p className={css.s4}>
            Quản lý các mốc thời gian, nộp tài liệu báo cáo và xem đánh giá chi tiết từ giảng viên
          </p>
        </div>
        <div className={css.s5}>
          {isSupervisor && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingMilestone(null);
                setShowCreateMilestoneModal(true);
              }}
            >
              <Plus size={16} />
              Tạo mốc nộp mới
            </Button>
          )}
        </div>
      </div>

      {(isStaff || isLecturer) && (
        <div style={{ marginBottom: '16px' }}>
          <Card>
            <AcademicTermFilter periods={periods} />
          </Card>
        </div>
      )}

      {/* Project Selector (for Staff/Lecturer) */}
      {!loading && projects.length > 0 && (
        <div className={css.s6}>
          <span className={css.s7}>Chọn dự án đồ án:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className={css.s64}
          >
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.topicId?.title || 'Dự án chưa cập nhật đề tài'} ({getProjectOwnerLabel(p)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main milestones loading */}
      {loading || loadingMilestones ? (
        <div className={css.s8}>
          <Spinner size="lg" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <div className={css.s9}>
            Chưa thuộc về dự án đồ án đang hoạt động nào. Sinh viên cần hoàn tất đăng ký đề tài để bắt đầu nộp
            bài.
          </div>
        </Card>
      ) : milestones.length === 0 ? (
        <Card>
          <div className={css.s10}>Chưa có mốc thời gian nộp bài nào được thiết lập cho dự án này.</div>
        </Card>
      ) : (
        <div className={css.s11}>
          {milestones.map((m) => (
            <MilestoneCard
              key={m._id}
              milestone={m}
              isStudent={isStudent}
              isLecturer={isLecturer}
              isStaff={isStaff}
              isSupervisor={isSupervisor}
              setShowSubmitModal={setShowSubmitModal}
              openEditMilestone={openEditMilestone}
              setMilestoneToDelete={setMilestoneToDelete}
              setShowFeedbackModal={setShowFeedbackModal}
              handleToggleLockMilestone={handleToggleLockMilestone}
              handleDownloadFile={handleDownloadFile}
            />
          ))}
        </div>
      )}

      {/* Student Submit Report Modal */}
      {showSubmitModal && (
        <SubmitReportModal
          onClose={() => setShowSubmitModal(null)}
          handleSubmissionSubmit={handleSubmissionSubmit}
          handleFileUpload={handleFileUpload}
          uploadingFile={uploadingFile}
          uploadedFileId={uploadedFileId}
          fileName={fileName}
          submissionNote={submissionNote}
          setSubmissionNote={setSubmissionNote}
          submittingWork={submittingWork}
        />
      )}

      {/* Lecturer Review Feedback Modal */}
      {showFeedbackModal && (
        <ReviewFeedbackModal
          onClose={() => setShowFeedbackModal(null)}
          handleFeedbackSubmit={handleFeedbackSubmit}
          feedbackStatus={feedbackStatus}
          setFeedbackStatus={setFeedbackStatus}
          feedbackComment={feedbackComment}
          setFeedbackComment={setFeedbackComment}
          submittingFeedback={submittingFeedback}
        />
      )}

      {/* Create New Milestone Modal */}
      {showCreateMilestoneModal && (
        <CreateMilestoneModal
          onClose={() => {
            setShowCreateMilestoneModal(false);
            setEditingMilestone(null);
          }}
          handleCreateMilestone={handleCreateMilestone}
          editingMilestone={editingMilestone}
          newMilestone={newMilestone}
          setNewMilestone={setNewMilestone}
          creatingMilestone={creatingMilestone}
        />
      )}

      <ConfirmDialog
        open={Boolean(milestoneToDelete)}
        title="Xóa mốc nộp bài"
        message={milestoneToDelete ? `Bạn có chắc chắn muốn xóa mốc nộp bài "${milestoneToDelete.title}"?` : ''}
        confirmLabel="Xóa"
        loading={deletingMilestone}
        onCancel={() => setMilestoneToDelete(null)}
        onConfirm={() => handleDeleteMilestone(milestoneToDelete)}
      />
    </div>
  );
}
