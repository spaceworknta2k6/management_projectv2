'use client';

import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatDate, hasAnyRole } from '@/lib/utils';
import { FileText, Calendar, Plus, Upload, Check, X, Shield, Clock, Download, PlusSquare, PencilSimple, Trash } from '@phosphor-icons/react';

export default function SubmissionsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  // Form states for Submitting Work (Student)
  const [showSubmitModal, setShowSubmitModal] = useState(null); // milestoneId
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState('');
  const [fileName, setFileName] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [submittingWork, setSubmittingWork] = useState(false);

  // Form states for Feedback (Lecturer)
  const [showFeedbackModal, setShowFeedbackModal] = useState(null); // milestoneId
  const [feedbackStatus, setFeedbackStatus] = useState('accepted');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Form states for Creating Milestone (Staff/Lecturer)
  const [showCreateMilestoneModal, setShowCreateMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [milestoneToDelete, setMilestoneToDelete] = useState(null);
  const [newMilestone, setNewMilestone] = useState({
    title: 'Báo cáo tiến độ 1',
    description: 'Nêu rõ kế hoạch khảo sát công nghệ và sơ đồ kiến trúc hệ thống đề xuất.',
    deadline: '2026-06-15T18:00',
  });
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [deletingMilestone, setDeletingMilestone] = useState(false);

  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const isStudent = hasAnyRole(user, ['STUDENT']);

  const currentProject = projects.find(p => p._id === selectedProjectId);
  const isSupervisor = isLecturer && currentProject && (
    String(currentProject.supervisorId?._id || currentProject.supervisorId) === String(user?.lecturerId)
  );

  // 1. Fetch active projects list to know which project we are working on
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects', token);
      let list = res.data || [];
      if (isStudent) {
        // Find student group project
        list = list.filter(p => 
          p.groupId?.members?.some(m => m.studentId?._id === user?.studentId || m.studentId === user?.studentId)
        );
      } else if (isLecturer) {
        list = list.filter(p => 
          p.supervisorId?._id === user?.lecturerId || 
          p.reviewerId?._id === user?.lecturerId ||
          p.supervisorId?.userId?._id === user?.id ||
          p.reviewerId?.userId?._id === user?.id
        );
      }

      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId(list[0]._id);
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tải danh sách dự án');
    } finally {
      setLoading(false);
    }
  }, [isLecturer, isStudent, toast, token, user?.id, user?.lecturerId, user?.studentId]);

  // 2. Fetch milestones for selected project
  const loadMilestones = useCallback(async (projId) => {
    if (!projId) return;
    setLoadingMilestones(true);
    try {
      const res = await api.get(`/projects/${projId}/milestones`, token);
      setMilestones(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải các mốc thời gian nộp bài');
    } finally {
      setLoadingMilestones(false);
    }
  }, [toast, token]);

  useEffect(() => {
    if (token) {
      queueMicrotask(loadProjects);
    }
  }, [loadProjects, token]);

  useEffect(() => {
    if (selectedProjectId) {
      queueMicrotask(() => loadMilestones(selectedProjectId));
    }
  }, [loadMilestones, selectedProjectId]);

  // File Upload handler (Multipart)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ownerType', 'project');
    formData.append('ownerId', selectedProjectId);

    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const res = await fetch(`${BASE_URL}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Tải file thất bại.');

      setUploadedFileId(result.data._id);
      setFileName(file.name);
      toast.success('Đã tải lên tệp tin và quét mã độc sạch thành công!');
    } catch (err) {
      toast.error(err.message || 'Lỗi khi upload tài liệu');
    } finally {
      setUploadingFile(false);
    }
  };

  // Submit Student Submission
  const handleSubmissionSubmit = async (e) => {
    e.preventDefault();
    if (!showSubmitModal || !uploadedFileId) {
      toast.error('Vui lòng chọn và tải lên tài liệu báo cáo trước.');
      return;
    }

    setSubmittingWork(true);
    try {
      await api.post(`/projects/${selectedProjectId}/milestones/${showSubmitModal}/submit`, {
        fileIds: [uploadedFileId],
        note: submissionNote,
      }, token);

      toast.success('Báo cáo đồ án của nhóm đã được nộp thành công!');
      setShowSubmitModal(null);
      setUploadedFileId('');
      setFileName('');
      setSubmissionNote('');
      loadMilestones(selectedProjectId);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi nộp bài');
    } finally {
      setSubmittingWork(false);
    }
  };

  // Submit Lecturer Feedback
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!showFeedbackModal) return;
    if (!feedbackComment.trim()) {
      toast.error('Vui lòng nhập nhận xét chi tiết trước khi gửi đánh giá.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await api.post(`/projects/${selectedProjectId}/milestones/${showFeedbackModal}/feedback`, {
        status: feedbackStatus,
        comment: feedbackComment,
      }, token);

      toast.success('Đã gửi đánh giá nhận xét cho sinh viên thành công!');
      setShowFeedbackModal(null);
      setFeedbackComment('');
      loadMilestones(selectedProjectId);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi nhận xét');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Create new milestone
  const handleCreateMilestone = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    setCreatingMilestone(true);
    try {
      const payload = {
        title: newMilestone.title,
        description: newMilestone.description,
        deadline: new Date(newMilestone.deadline).toISOString(),
      };

      if (editingMilestone) {
        await api.patch(`/projects/${selectedProjectId}/milestones/${editingMilestone._id}`, payload, token);
        toast.success('Đã cập nhật mốc nộp bài thành công!');
      } else {
        await api.post(`/projects/${selectedProjectId}/milestones`, payload, token);
        toast.success('Đã khởi tạo mốc nộp bài mới thành công!');
      }

      setShowCreateMilestoneModal(false);
      setEditingMilestone(null);
      loadMilestones(selectedProjectId);
    } catch (err) {
      toast.error(err.message || 'Không thể tạo mốc nộp bài');
    } finally {
      setCreatingMilestone(false);
    }
  };

  const openEditMilestone = (milestone) => {
    setEditingMilestone(milestone);
    setNewMilestone({
      title: milestone.title || '',
      description: milestone.description || '',
      deadline: milestone.deadline ? new Date(new Date(milestone.deadline).getTime() - new Date(milestone.deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
    });
    setShowCreateMilestoneModal(true);
  };

  const handleDeleteMilestone = async (milestone) => {
    setDeletingMilestone(true);
    try {
      await api.delete(`/projects/${selectedProjectId}/milestones/${milestone._id}`, token);
      toast.success('Đã xóa mốc nộp bài thành công.');
      setMilestoneToDelete(null);
      loadMilestones(selectedProjectId);
    } catch (err) {
      toast.error(err.message || 'Không thể xóa mốc nộp bài');
    } finally {
      setDeletingMilestone(false);
    }
  };

  // Lock/Unlock milestone
  const handleToggleLockMilestone = async (id, currentStatus) => {
    try {
      if (currentStatus === 'locked') {
        await api.post(`/projects/${selectedProjectId}/milestones/${id}/unlock`, {}, token);
        toast.success('Đã mở khóa mốc nộp bài thành công!');
      } else {
        await api.post(`/projects/${selectedProjectId}/milestones/${id}/lock`, {}, token);
        toast.success('Đã khóa mốc nộp bài thành công!');
      }
      loadMilestones(selectedProjectId);
    } catch (err) {
      toast.error(err.message || 'Không thể thay đổi trạng thái mốc nộp bài');
    }
  };

  // Secure file download helper (utilises signed URL fetch)
  const handleDownloadFile = async (fileId) => {
    try {
      const res = await api.get(`/files/${fileId}/download-url`, token);
      let downloadUrl = res.data?.downloadUrl;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
      const backendHost = apiBase.replace('/api/v1', '');

      if (downloadUrl) {
        if (downloadUrl.startsWith('/')) {
          downloadUrl = `${backendHost}${downloadUrl}`;
        }
      } else {
        downloadUrl = `${backendHost}/api/v1/files/${fileId}/download`;
      }

      // Open in a new window or secure download
      window.open(downloadUrl, '_blank');
    } catch (err) {
      toast.error(err.message || 'Lỗi khi giải mã tài liệu');
    }
  };

  const getMilestoneStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge variant="info">Chờ nộp bài</Badge>;
      case 'submitted':
        return <Badge variant="warning">Đã nộp</Badge>;
      case 'accepted':
        return <Badge variant="success">Đạt yêu cầu</Badge>;
      case 'needs_revision':
        return <Badge variant="warning">Cần chỉnh sửa</Badge>;
      case 'rejected':
        return <Badge variant="error">Từ chối</Badge>;
      case 'late':
        return <Badge variant="error">Nộp trễ</Badge>;
      case 'locked':
        return <Badge variant="secondary">Đã khóa</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={28} style={{ color: 'var(--accent)' }} />
            Nộp báo cáo & Mốc tiến độ
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Quản lý các mốc thời gian, nộp tài liệu báo cáo và xem đánh giá chi tiết từ giảng viên
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isSupervisor && (
            <Button variant="primary" size="sm" onClick={() => { setEditingMilestone(null); setShowCreateMilestoneModal(true); }}>
              <Plus size={16} />
              Tạo mốc nộp mới
            </Button>
          )}
        </div>
      </div>

      {/* Project Selector (for Staff/Lecturer) */}
      {!loading && projects.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Chọn dự án đồ án:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              height: '36px',
              padding: '0 12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              maxWidth: '460px',
            }}
          >
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.topicId?.title || 'Dự án chưa cập nhật đề tài'} (Nhóm: {p.groupId?.name})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main milestones loading */}
      {loading || loadingMilestones ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            Chưa thuộc về dự án đồ án đang hoạt động nào. Sinh viên cần hoàn tất đăng ký đề tài để bắt đầu nộp bài.
          </div>
        </Card>
      ) : milestones.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            Chưa có mốc thời gian nộp bài nào được thiết lập cho dự án này.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {milestones.map((m) => {
            const hasSubmissions = m.submissions && m.submissions.length > 0;
            const hasFeedbacks = m.feedback && m.feedback.length > 0;

            return (
              <Card
                key={m._id}
                title={m.title}
                subtitle={`Mô tả: ${m.description || 'Không có mô tả chi tiết.'}`}
                actions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getMilestoneStatusBadge(m.status)}

                    {/* Student Upload Button */}
                    {isStudent && m.status !== 'locked' && m.status !== 'accepted' && (
                      <Button variant="primary" size="sm" onClick={() => setShowSubmitModal(m._id)}>
                        <Upload size={14} /> Nộp bài
                      </Button>
                    )}

                    {/* Lecturer / Staff Actions */}
                    {(isLecturer || isStaff) && (
                      <>
                        {isSupervisor && (
                          <>
                            <Button variant="secondary" size="sm" onClick={() => openEditMilestone(m)}>
                              <PencilSimple size={14} /> Sửa
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={hasSubmissions}
                              title={hasSubmissions ? 'Mốc đã có bài nộp nên không thể xóa' : 'Xóa mốc nộp bài'}
                              onClick={() => setMilestoneToDelete(m)}
                            >
                              <Trash size={14} /> Xóa
                            </Button>
                          </>
                        )}
                        {hasSubmissions && m.status !== 'locked' && (
                          <Button variant="primary" size="sm" onClick={() => setShowFeedbackModal(m._id)}>
                            <Shield size={14} /> Đánh giá bản nộp
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => handleToggleLockMilestone(m._id, m.status)}>
                          <Clock size={14} /> {m.status === 'locked' ? 'Mở khóa' : 'Khóa mốc'}
                        </Button>
                      </>
                    )}
                  </div>
                }
              >
                {/* Milestone details (Deadline) */}
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                    <Calendar size={16} />
                    Hạn chót:
                  </span>
                  <strong style={{ color: 'var(--error)', fontFamily: 'var(--font-geist-mono)' }}>{formatDate(m.deadline)}</strong>
                </div>

                {/* Submissions section details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  {hasSubmissions ? (
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>Tài liệu sinh viên đã nộp:</p>
                      {m.submissions.map((sub, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            backgroundColor: 'var(--bg-raised)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '6px',
                          }}
                        >
                          <div>
                            <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                              Ghi chú sinh viên: &quot;{sub.note || 'Không có ghi chú.'}&quot;
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Người nộp: {sub.submittedBy?.fullName || 'Sinh viên'} | Thời gian: {formatDate(sub.submittedAt)}
                            </p>
                          </div>
                          {sub.fileIds?.map((fId) => (
                            <Button
                              key={fId}
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDownloadFile(fId)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Download size={14} /> Tải báo cáo
                            </Button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nhóm sinh viên chưa nộp tài liệu báo cáo cho mốc này.</p>
                  )}

                  {/* Feedback section details */}
                  {hasFeedbacks && (
                    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px', marginTop: '6px' }}>
                      <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>Ý kiến nhận xét đánh giá từ Giảng viên:</p>
                      {m.feedback.map((feed, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: feed.status === 'accepted' ? 'var(--success-bg)' : 'var(--error-bg)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <strong style={{ color: feed.status === 'accepted' ? 'var(--success)' : 'var(--warning)' }}>
                              [{feed.status === 'accepted' ? 'ĐẠT YÊU CẦU' : feed.status === 'needs_revision' ? 'CẦN CHỈNH SỬA' : 'TỪ CHỐI'}]
                            </strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(feed.createdAt)}</span>
                          </div>
                          <p style={{ marginTop: '4px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                            Lời phê: &quot;{feed.comment}&quot;
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Student Submit Report Modal */}
      {showSubmitModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Nộp tài liệu báo cáo đồ án
              </h3>
              <button
                onClick={() => setShowSubmitModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmissionSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* File upload selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Chọn báo cáo (PDF, ZIP, DOCX, giới hạn 10MB) <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <div
                  style={{
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    backgroundColor: 'var(--bg-raised)',
                  }}
                >
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                  {uploadingFile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Spinner />
                      <span>Đang tải tệp tin và quét virus an toàn...</span>
                    </div>
                  ) : fileName ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Check size={28} style={{ color: 'var(--success)' }} />
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fileName}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nhấp để chọn tệp tin khác</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Upload size={28} style={{ color: 'var(--accent)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Kéo thả hoặc nhấp để chọn tệp tin tải lên</span>
                    </div>
                  )}
                </div>
              </div>

              <Input
                label="Ghi chú đính kèm"
                value={submissionNote}
                onChange={(e) => setSubmissionNote(e.target.value)}
                placeholder="Nhập lời chào hoặc thông điệp gửi GVHD..."
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <Button variant="secondary" onClick={() => setShowSubmitModal(null)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={submittingWork} disabled={!uploadedFileId}>
                  Nộp bài ngay
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lecturer Review Feedback Modal */}
      {showFeedbackModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Đánh giá báo cáo đồ án của sinh viên
              </h3>
              <button
                onClick={() => setShowFeedbackModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleFeedbackSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Kết quả thẩm định</label>
                <select
                  value={feedbackStatus}
                  onChange={(e) => setFeedbackStatus(e.target.value)}
                  style={{
                    height: '40px',
                    padding: '0 12px',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                  }}
                >
                  <option value="accepted">Đạt yêu cầu (Accepted)</option>
                  <option value="needs_revision">Cần chỉnh sửa (Needs Revision)</option>
                  <option value="rejected">Từ chối (Rejected)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Nhận xét chi tiết</label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Nhập lời phê bình hoặc hướng dẫn chỉnh sửa chi tiết cho sinh viên..."
                  rows={4}
                  style={{
                    padding: '12px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <Button variant="secondary" onClick={() => setShowFeedbackModal(null)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={submittingFeedback}>Gửi đánh giá</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Milestone Modal */}
      {showCreateMilestoneModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingMilestone ? 'Chỉnh sửa mốc nộp báo cáo' : 'Tạo mốc nộp báo cáo mới'}
              </h3>
              <button
                onClick={() => { setShowCreateMilestoneModal(false); setEditingMilestone(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateMilestone} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input
                label="Tên mốc báo cáo"
                value={newMilestone.title}
                onChange={(e) => setNewMilestone(p => ({ ...p, title: e.target.value }))}
                required
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Mô tả chi tiết</label>
                <textarea
                  value={newMilestone.description}
                  onChange={(e) => setNewMilestone(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  style={{
                    padding: '12px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <Input
                label="Hạn chót nộp báo cáo"
                type="datetime-local"
                value={newMilestone.deadline}
                onChange={(e) => setNewMilestone(p => ({ ...p, deadline: e.target.value }))}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <Button variant="secondary" onClick={() => { setShowCreateMilestoneModal(false); setEditingMilestone(null); }}>Hủy</Button>
                <Button variant="primary" type="submit" loading={creatingMilestone}>
                  <PlusSquare size={16} /> {editingMilestone ? 'Cập nhật mốc' : 'Tạo mốc'}
                </Button>
              </div>
            </form>
          </div>
        </div>
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
