'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { hasAnyRole } from '@/lib/utils';

export function useTopics() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [periods, setPeriods] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

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
    title: '',
    summary: '',
    periodId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState(null);

  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);
  const isStudent = hasAnyRole(user, ['STUDENT']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resPeriods, resTopics] = await Promise.all([
        api.get('/periods', token).catch(() => api.get('/auth/periods', token).catch(() => ({ data: [] }))),
        api.get('/topics', token)
      ]);
      
      const pList = resPeriods.data || [];
      setPeriods(pList);
      if (pList.length > 0) {
        setForm((prev) => ({ ...prev, periodId: pList[0]._id }));
      }
      setTopics(resTopics.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải dữ liệu đề tài');
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [loadData, token]);

  const handleSubmitTopic = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.periodId) return;

    setSubmitting(true);
    try {
      if (editingTopicId) {
        await api.put(`/topics/${editingTopicId}`, {
          title: form.title.trim(),
          summary: form.summary.trim(),
          periodId: form.periodId,
        }, token);
        toast.success('Cập nhật đề tài thành công! Chờ Giáo vụ duyệt lại.');
      } else {
        await api.post('/topics', {
          title: form.title.trim(),
          summary: form.summary.trim(),
          periodId: form.periodId,
        }, token);
        toast.success('Đề xuất đề tài thành công! Chờ Giáo vụ duyệt.');
      }
      setShowProposeModal(false);
      setEditingTopicId(null);
      setForm((prev) => ({ ...prev, title: '', summary: '' }));
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi đề xuất đề tài');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (t) => {
    setEditingTopicId(t._id);
    setForm({
      title: t.title,
      summary: t.summary || '',
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
      toast.error(err.message || 'Lỗi khi phê duyệt đề tài');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/topics/${id}/reject`, {}, token);
      toast.success('Đã từ chối đề tài.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối đề tài');
    }
  };

  const handleRequestRevision = async (id) => {
    try {
      await api.post(`/topics/${id}/request-revision`, {}, token);
      toast.success('Đã gửi yêu cầu chỉnh sửa đề tài.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi yêu cầu chỉnh sửa');
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
      title: s.title,
      summary: originalTopic?.summary || s.reason || '',
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
    if (!showOverrideModal || !overrideComment.trim()) return;

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

  // Filter topics based on activeTab
  const filteredTopics = topics.filter((t) => {
    if (activeTab === 'all') return true;
    const mappedStatus = (t.status === 'submitted' || t.status === 'ai_checked' || t.status === 'needs_revision') ? 'pending_review' : t.status;
    return mappedStatus === activeTab;
  });

  return {
    user,
    periods,
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
  };
}
