'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import usePeriodStore from '@/store/period.store';
import api from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { hasAnyRole, handleApiError } from '@/lib/utils';
import { ACADEMIC_UNITS } from '@/lib/academicUnits';

export function useTopics(initialActiveTab = 'all') {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const { periods, fetchPeriods } = usePeriodStore();
  const [groups, setGroups] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [activeTab, setActiveTab] = useState(initialActiveTab);

  // AI states
  const [aiCheckingId, setAiCheckingId] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const [showOverrideModal, setShowOverrideModal] = useState(null); // jobId
  const [overrideComment, setOverrideComment] = useState('');
  const [overriding, setOverriding] = useState(false);

  // AI topic suggestion chat states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Proposed topic form
  const [form, setForm] = useState({
    ownerType: 'student',
    groupId: '',
    title: '',
    summary: '',
    academicUnit: ACADEMIC_UNITS[0].value,
    proposedSupervisorId: '',
    proposedSupervisorEmail: '',
    periodId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState(null);

  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const isStudent = hasAnyRole(user, ['STUDENT']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pList, resTopics] = await Promise.all([
        fetchPeriods(token),
        api.get('/topics', token)
      ]);
      
      if (pList && pList.length > 0) {
        setForm((prev) => ({
          ...prev,
          periodId: pList[0]._id,
          academicUnit: pList[0].academicUnit || ACADEMIC_UNITS[0].value,
        }));
      }
      setTopics(resTopics.data || []);
      if (isStudent) {
        const resGroups = await api.get('/groups', token).catch(() => ({ data: [] }));
        setGroups(resGroups.data || []);
      } else {
        setGroups([]);
      }
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setLoading(false);
    }
  }, [isStudent, toast, token, fetchPeriods]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [loadData, token]);

  const handleSubmitTopic = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.periodId || !form.summary.trim()) {
      toast.error('Vui lòng nhập đầy đủ đợt học phần, tên đề tài và tóm tắt nội dung.');
      return;
    }

    setSubmitting(true);
    try {
      let res;
      const selectedPeriod = periods.find((period) => period._id === form.periodId);
      const academicUnit = selectedPeriod?.academicUnit || ACADEMIC_UNITS[0].value;
      if (isLecturer || isStaff) {
        const payload = {
          title: form.title.trim(),
          summary: form.summary.trim(),
          objectives: form.summary.trim(),
          scope: form.summary.trim(),
          expectedResult: form.summary.trim(),
          plan: form.summary.trim(),
          academicUnit,
          periodId: form.periodId,
          proposedSupervisorId: form.proposedSupervisorId || undefined,
          proposedSupervisorEmail: form.proposedSupervisorEmail?.trim() || undefined,
        };
        if (editingTopicId) {
          res = await api.put(`/topics/${editingTopicId}`, payload, token);
          toast.success('Cập nhật đề tài thành công!');
        } else {
          res = await api.post('/topics/lecturer', payload, token);
          toast.success('Khởi tạo đề tài giảng viên thành công!');
        }
      } else {
        if (!form.proposedSupervisorEmail?.trim()) {
          toast.error('Vui lòng nhập email giảng viên hướng dẫn đề xuất.');
          setSubmitting(false);
          return;
        }
        if (form.ownerType === 'group' && !form.groupId) {
          toast.error('Vui lòng chọn nhóm khi đăng ký đề tài theo nhóm.');
          setSubmitting(false);
          return;
        }
        const payload = {
          title: form.title.trim(),
          summary: form.summary.trim(),
          objectives: form.summary.trim(),
          scope: form.summary.trim(),
          expectedResult: form.summary.trim(),
          plan: form.summary.trim(),
          academicUnit,
          periodId: form.periodId,
          proposedSupervisorEmail: form.proposedSupervisorEmail.trim(),
          ownerType: form.ownerType,
          ...(form.ownerType === 'group' ? { groupId: form.groupId } : {}),
        };
        if (editingTopicId) {
          res = await api.put(`/topics/${editingTopicId}`, payload, token);
          toast.success('Cập nhật đề xuất đề tài thành công!');
        } else {
          res = await api.post('/topics', payload, token);
          toast.success('Đề xuất đề tài thành công! Chờ duyệt chuyên môn.');
        }
      }

      setShowProposeModal(false);
      setEditingTopicId(null);
      setForm((prev) => ({
        ...prev,
        ownerType: 'student',
        groupId: '',
        title: '',
        summary: '',
        academicUnit: ACADEMIC_UNITS[0].value,
        proposedSupervisorId: '',
        proposedSupervisorEmail: '',
      }));
      loadData();
    } catch (err) {
      if (err.errors?.[0]?.message) {
        toast.error(err.errors[0].message);
        return;
      }
      handleApiError(err, toast);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (t) => {
    setEditingTopicId(t._id);
    setForm({
      ownerType: t.ownerType || (t.groupId ? 'group' : 'student'),
      groupId: t.groupId?._id || t.groupId || '',
      title: t.title,
      summary: t.summary || '',
      academicUnit: t.academicUnit || t.periodId?.academicUnit || ACADEMIC_UNITS[0].value,
      proposedSupervisorId: t.proposedSupervisorId?._id || t.proposedSupervisorId || '',
      proposedSupervisorEmail: t.proposedSupervisorId?.userId?.email || '',
      periodId: t.periodId?._id || t.periodId || '',
    });
    setShowProposeModal(true);
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/topics/${id}/approve`, {}, token);
      toast.success('Đã phê duyệt đề tài thành công!');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/topics/${id}/reject`, {}, token);
      toast.success('Đã từ chối đề tài.');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const handleRequestRevision = async (id) => {
    try {
      await api.post(`/topics/${id}/request-revision`, {}, token);
      toast.success('Đã gửi yêu cầu chỉnh sửa đề tài.');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const handleCancelTopic = async (id) => {
    try {
      const res = await api.post(`/topics/${id}/cancel`, {}, token);
      const counts = res.data?.cancelledProjects
        ? ` Đã hủy ${res.data.cancelledProjects} dự án liên kết.`
        : '';
      toast.success(`${res.message || 'Đã hủy đề tài.'}${counts}`);
      loadData();
      return true;
    } catch (err) {
      handleApiError(err, toast);
      return false;
    }
  };

  // Run AI topic suggestion for student — loads initial suggestions as first chat message
  const handleSuggestTopics = async (force = false) => {
    if (!user?.studentId) return;
    setSuggestLoading(true);
    try {
      const url = `/ai/students/${user.studentId}/topic-suggestions${force ? '?force=true' : ''}`;
      const res = await api.post(url, {}, token);
      const job = res.data;
      const list = job?.result?.suggestions || [];
      const textRepresentation = list.length === 0
        ? 'Hiện tại chưa có đề tài phù hợp trong hệ thống.'
        : 'Dựa trên hồ sơ của bạn, tôi gợi ý các đề tài sau:\n\n' +
          list.map((s, i) => `${i + 1}. "${s.title}" — ${s.confidence}% phù hợp\nLý do: ${s.reason}`).join('\n\n');
      setChatMessages([{ role: 'assistant', type: 'suggestions', suggestions: list, content: textRepresentation }]);
      setChatOpen(true);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      toast.error(err.message || 'Không thể lấy gợi ý đề tài từ hệ thống AI');
    } finally {
      setSuggestLoading(false);
    }
  };

  // Send a follow-up chat message to AI
  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading || !user?.studentId) return;
    const userMsg = { role: 'user', type: 'text', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const apiMessages = updatedMessages.map(m => ({ role: m.role, content: m.content }));
      const res = await api.post(`/ai/students/${user.studentId}/topic-chat`, { messages: apiMessages }, token);
      setChatMessages(prev => [...prev, { role: 'assistant', type: 'text', content: res.data.message }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi tin nhắn');
    } finally {
      setChatLoading(false);
    }
  };

  // Pre-fill proposal form from a suggested topic
  const handleSelectSuggestedTopic = (s) => {
    const originalTopic = topics.find(t => t._id === s.topicId);
    setForm({
      ownerType: 'student',
      groupId: '',
      title: s.title,
      summary: originalTopic?.summary || s.reason || '',
      academicUnit: originalTopic?.academicUnit || originalTopic?.periodId?.academicUnit || ACADEMIC_UNITS[0].value,
      proposedSupervisorId: originalTopic?.proposedSupervisorId?._id || originalTopic?.proposedSupervisorId || '',
      proposedSupervisorEmail: originalTopic?.proposedSupervisorId?.userId?.email || '',
      periodId: periods[0]?._id || '',
    });
    setChatOpen(false);
    setShowProposeModal(true);
  };

  // Run AI duplicate check
  const handleCheckDuplicate = async (id) => {
    setAiCheckingId(id);
    try {
      const res = await api.post(`/ai/topics/${id}/check-duplicate`, {}, token);
      const job = res.data;
      setAiResults((prev) => ({ ...prev, [id]: job }));
      toast.success('Tác vụ phân tích trùng lặp AI hoàn tất!');
    } catch (err) {
      toast.error(err.message || 'Không thể kiểm tra trùng lặp qua AI');
    } finally {
      setAiCheckingId(null);
    }
  };

  // Submit manual override
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideComment || !overrideComment.trim()) {
      toast.error('Vui lòng nhập lý do ghi đè.');
      return;
    }
    if (!showOverrideModal) return;

    setOverriding(true);
    try {
      const jobId = showOverrideModal;
      await api.post(`/ai/jobs/${jobId}/manual-override`, {
        result: {
          comment: overrideComment.trim()
        }
      }, token);
      toast.success('Đã phê duyệt ghi đè AI thành công!');
      setShowOverrideModal(null);
      setOverrideComment('');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi áp dụng ghi đè');
    } finally {
      setOverriding(false);
    }
  };

  const handleRegisterTopic = async (topicId, ownerType, groupId) => {
    try {
      const payload = {
        ownerType,
        ...(ownerType === 'group' ? { groupId } : {}),
      };
      await api.post(`/topics/${topicId}/register`, payload, token);
      toast.success('Đăng ký đề tài thành công!');
      loadData();
      return true;
    } catch (err) {
      handleApiError(err, toast);
      return false;
    }
  };

  const handlePublishTopic = async (id) => {
    try {
      await api.post(`/topics/${id}/publish`, {}, token);
      toast.success('Đã công khai đề tài thành công!');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const handleUnpublishTopic = async (id) => {
    try {
      await api.post(`/topics/${id}/unpublish`, {}, token);
      toast.success('Đã rút đề tài khỏi danh sách công khai.');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  // Filter topics based on activeTab
  const filteredTopics = topics.filter((t) => {
    const mappedStatus = (t.status === 'submitted' || t.status === 'ai_checked' || t.status === 'needs_revision') ? 'pending_review' : t.status;
    if (activeTab === 'all') return !['cancelled', 'completed'].includes(mappedStatus);
    if (activeTab === 'history') return ['cancelled', 'completed'].includes(mappedStatus);
    return mappedStatus === activeTab;
  });

  const availableGroups = groups.filter((group) => {
    if (form.periodId && (group.periodId?._id || group.periodId) !== form.periodId) return false;
    if (!user?.studentId) return false;
    return (group.members || []).some((member) => {
      const memberStudentId = member.studentId?._id || member.studentId;
      return String(memberStudentId) === String(user.studentId) && member.status === 'accepted';
    });
  });

  return {
    user,
    token,
    periods,
    groups: availableGroups,
    topics,
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
    setChatMessages,
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
    handleRegisterTopic,
    handlePublishTopic,
    handleUnpublishTopic,
    filteredTopics,
  };
}
