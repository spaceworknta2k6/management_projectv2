'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { hasAnyRole } from '@/lib/utils';
import { io } from 'socket.io-client';

const getId = (value) => value?._id || value;

const isStudentProjectOwner = (project, studentId) => (
  project?.ownerType === 'student' && String(getId(project.studentId) || getId(project.ownerId)) === String(studentId)
);


const isStudentGroupProjectMember = (project, studentId) => (
  Array.isArray(project?.groupId?.members) &&
  project.groupId.members.some((member) => member && String(getId(member.studentId)) === String(studentId))
);

export function useSubmissions() {
  const router = useRouter();
  const pathname = usePathname();
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
        list = list.filter((p) => isStudentProjectOwner(p, user?.studentId) || isStudentGroupProjectMember(p, user?.studentId));
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
        let initialId = list[0]._id;
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const urlProjId = params.get('projectId');
          if (urlProjId && list.some((p) => p._id === urlProjId)) {
            initialId = urlProjId;
          }
        }
        setSelectedProjectId(initialId);
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

  // Connect to socket.io for real-time milestone changes
  useEffect(() => {
    if (!token || !selectedProjectId) return;

    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    const SOCKET_URL = BASE_URL.replace('/api/v1', '');

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    socket.on('milestone:changed', ({ projectId }) => {
      if (String(projectId) === String(selectedProjectId)) {
        loadMilestones(selectedProjectId);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, selectedProjectId, loadMilestones]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const params = new URLSearchParams();
    params.set('projectId', selectedProjectId);
    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [selectedProjectId, pathname, router]);

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

      toast.success('Báo cáo đồ án đã được nộp thành công!');
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

    if (!newMilestone.title || !newMilestone.title.trim()) {
      toast.error('Vui lòng nhập tên mốc báo cáo.');
      return;
    }
    if (!newMilestone.deadline) {
      toast.error('Vui lòng chọn hạn chót nộp báo cáo.');
      return;
    }

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

      window.open(downloadUrl, '_blank');
    } catch (err) {
      toast.error(err.message || 'Lỗi khi giải mã tài liệu');
    }
  };

  return {
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
    loadProjects,
    loadMilestones,
    handleFileUpload,
    handleSubmissionSubmit,
    handleFeedbackSubmit,
    handleCreateMilestone,
    openEditMilestone,
    handleDeleteMilestone,
    handleToggleLockMilestone,
    handleDownloadFile,
  };
}
