'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDate, getStatus, hasAnyRole } from '@/lib/utils';
import { BookOpen, Plus, Check, X, Shield, Cpu, Sparkle, Pencil, Lightbulb, Star } from '@phosphor-icons/react';

export default function TopicsPage() {
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

  return (
    <div>
      {/* Page Header section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={28} style={{ color: 'var(--accent)' }} />
            Quản lý Đề tài
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Xem danh sách đề tài đồ án tốt nghiệp, duyệt đề xuất và thực hiện kiểm tra AI
          </p>
        </div>
        {isStudent && (
          <div style={{ display: 'flex', gap: '8px' }}>
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
              style={{ gap: '6px' }}
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

      {/* Tabs list filtering */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '10px',
        }}
      >
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'pending_review', label: 'Chờ duyệt' },
          { id: 'approved', label: 'Đã duyệt' },
          { id: 'rejected', label: 'Từ chối' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              backgroundColor: activeTab === tab.id ? 'var(--accent-glow)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List items */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : filteredTopics.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            Chưa có đề tài nào thuộc danh mục này.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTopics.map((t) => {
            const mappedStatus = (t.status === 'submitted' || t.status === 'ai_checked') ? 'pending_review' : t.status;
            const statusInfo = getStatus(mappedStatus);
            const aiJob = aiResults[t._id];

            return (
              <Card
                key={t._id}
                title={t.title}
                subtitle={`Sinh viên đề xuất: ${t.proposedByStudentId?.userId?.fullName || 'Giáo vụ'} | Học kỳ: ${t.periodId?.semester || '—'}`}
                actions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>

                    {isStaff && (t.status === 'pending_review' || t.status === 'submitted' || t.status === 'ai_checked') && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => handleRequestRevision(t._id)}>
                          <Pencil size={14} /> Yêu cầu sửa
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleReject(t._id)}>
                          <X size={14} /> Từ chối
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => handleApprove(t._id)}>
                          <Check size={14} /> Duyệt đề tài
                        </Button>
                      </>
                    )}

                    {isStudent && t.status === 'needs_revision' && t.proposedByStudentId?._id?.toString() === user?.studentId?.toString() && (
                      <Button variant="secondary" size="sm" onClick={() => handleEditClick(t)}>
                        <Pencil size={14} /> Chỉnh sửa
                      </Button>
                    )}
                  </div>
                }
              >
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Tóm tắt đề tài:</p>
                  <p style={{ marginBottom: '16px' }}>{t.summary || 'Không có tóm tắt chi tiết.'}</p>

                  {/* AI Duplicate Checker section */}
                  {isStaff && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-raised)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Cpu size={18} style={{ color: 'var(--accent)' }} />
                          <span style={{ fontWeight: 600 }}>Kiểm tra trùng lặp đề tài</span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={aiCheckingId === t._id}
                          onClick={() => handleCheckDuplicate(t._id)}
                        >
                          <Sparkle size={14} /> Kiểm tra trùng lặp
                        </Button>
                      </div>

                      {/* Display AI outcome */}
                      {aiJob && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                          {aiJob.status === 'running' ? (
                            <p style={{ color: 'var(--text-muted)' }}>AI đang phân tích độ tương đồng ngữ nghĩa...</p>
                          ) : aiJob.status === 'succeeded' ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <Badge variant={aiJob.result?.hasRisk ? 'error' : 'success'}>
                                  {aiJob.result?.hasRisk ? 'Có rủi ro trùng lặp cao' : 'An toàn'}
                                </Badge>
                                <span>Tỉ lệ trùng lặp: <strong style={{ color: aiJob.result?.hasRisk ? 'var(--error)' : 'var(--success)' }}>{aiJob.result?.riskScore}%</strong></span>
                              </div>
                              
                              {aiJob.result?.hasRisk && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <p style={{ color: 'var(--text-muted)' }}>Lý giải của AI: {aiJob.result?.reasoning}</p>
                                  {aiJob.manualOverride?.isOverridden ? (
                                    <div style={{ padding: '8px', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34,197,94,0.15)' }}>
                                      <strong style={{ color: 'var(--success)' }}>[ĐÃ GHI ĐÈ BỞI GIÁO VỤ]</strong> Lời phê: {aiJob.manualOverride?.comment}
                                    </div>
                                  ) : (
                                    <Button variant="danger" size="sm" style={{ alignSelf: 'flex-start', marginTop: '6px' }} onClick={() => setShowOverrideModal(aiJob._id)}>
                                      <Shield size={14} /> Phê duyệt ghi đè thủ công
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p style={{ color: 'var(--error)' }}>AI kiểm tra thất bại: {aiJob.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Propose Topic Modal */}
      {showProposeModal && (
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
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyBetween: 'space-between' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingTopicId ? 'Chỉnh sửa đề tài đồ án' : 'Đề xuất đề tài đồ án mới'}
              </h3>
            </div>
            <form onSubmit={handleSubmitTopic} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Chọn đợt đồ án</label>
                <select
                  value={form.periodId}
                  onChange={(e) => setForm((p) => ({ ...p, periodId: e.target.value }))}
                  style={{
                    height: '40px',
                    padding: '0 12px',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {periods.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <Input
                label="Tên đề tài đồ án"
                name="title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Nhập tên đề tài bằng tiếng Việt có dấu..."
                required
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Tóm tắt/Nội dung thực hiện</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  placeholder="Mô tả tóm tắt nội dung nghiên cứu, công nghệ sử dụng, và kết quả mong đợi..."
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
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowProposeModal(false);
                    setEditingTopicId(null);
                    setForm((prev) => ({ ...prev, title: '', summary: '' }));
                  }}
                >
                  Hủy
                </Button>
                <Button variant="primary" type="submit" loading={submitting}>
                  {editingTopicId ? 'Cập nhật' : 'Đề xuất'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff manual override modal */}
      {showOverrideModal && (
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
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Ghi đè thủ công kết quả trùng lặp AI
              </h3>
            </div>
            <form onSubmit={handleOverrideSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Lời phê bình/Lý do duyệt ghi đè</label>
                <textarea
                  value={overrideComment}
                  onChange={(e) => setOverrideComment(e.target.value)}
                  placeholder="Nhập lý do chi tiết từ Giáo vụ để lưu trữ nhật ký hệ thống (ví dụ: Hai đề tài sử dụng hai kiến trúc nghiệp vụ khác nhau hoàn toàn)..."
                  rows={4}
                  required
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Button variant="secondary" onClick={() => setShowOverrideModal(null)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={overriding}>Xác nhận Ghi đè</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Suggestion Chat panel */}
      {chatOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setChatOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--accent-glow)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Trợ lý Đề tài AI
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Tư vấn & điều chỉnh đề tài theo nguyện vọng của bạn
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={suggestLoading}
                  onClick={() => handleSuggestTopics(true)}
                  style={{ gap: '6px' }}
                >
                  <Sparkle size={13} /> Gợi ý lại
                </Button>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                backgroundColor: 'var(--bg-raised)',
              }}
            >
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    width: '100%',
                  }}
                >
                  {msg.type === 'suggestions' ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 500,
                      }}>
                        <Cpu size={14} style={{ color: 'var(--accent)' }} />
                        Phân tích hồ sơ hoàn tất &bull; {msg.suggestions.length} gợi ý phù hợp &bull;
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}> Bấm vào đề tài để chỉnh sửa</span>
                      </div>
                      
                      {msg.suggestions.length === 0 ? (
                        <div style={{
                          padding: '24px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          border: '1px dashed var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '13px',
                          backgroundColor: 'var(--bg-surface)',
                        }}>
                          Chưa tìm thấy đề tài phù hợp với hồ sơ hiện tại. Bạn có thể chat để mô tả định hướng của mình.
                        </div>
                      ) : (
                        msg.suggestions.map((s, si) => (
                          <div
                            key={s.topicId || si}
                            onClick={() => {
                              setChatInput(`Tôi muốn điều chỉnh đề tài "${s.title}" theo hướng: `);
                            }}
                            style={{
                              padding: '16px',
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--accent)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.1)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyBetween: 'space-between', gap: '12px' }}>
                              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                {s.title}
                              </span>
                              <span style={{
                                flexShrink: 0,
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                backgroundColor: s.confidence >= 75 ? 'rgba(34,197,94,0.12)' : s.confidence >= 50 ? 'rgba(251,191,36,0.12)' : 'rgba(148,163,184,0.12)',
                                color: s.confidence >= 75 ? 'var(--success)' : s.confidence >= 50 ? '#f59e0b' : 'var(--text-muted)',
                              }}>
                                <Star size={10} weight="fill" /> {s.confidence}%
                              </span>
                            </div>
                            
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                              {s.reason}
                            </p>
                            
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginTop: '8px',
                              paddingTop: '8px',
                              borderTop: '1px solid var(--border)',
                            }}>
                              <div style={{
                                fontSize: '11px',
                                color: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 500,
                              }}>
                                <Lightbulb size={12} /> Bấm để đề xuất chỉnh sửa
                              </div>
                              <Button
                                variant="primary"
                                size="sm"
                                style={{
                                  height: '26px',
                                  padding: '0 10px',
                                  fontSize: '11px',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSuggestedTopic(s);
                                }}
                              >
                                Chọn đề tài này
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : msg.role === 'user' ? (
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '12px 16px',
                        backgroundColor: 'var(--accent)',
                        color: 'white',
                        borderRadius: '16px 16px 2px 16px',
                        fontSize: '13.5px',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: '90%',
                        padding: '14px 18px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '2px 16px 16px 16px',
                        fontSize: '13.5px',
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  alignSelf: 'flex-start',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  <Spinner size="sm" />
                  <span>AI đang soạn câu trả lời...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-end',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Trao đổi với AI về đề tài của bạn... (Enter để gửi, Shift+Enter xuống dòng)"
                rows={2}
                disabled={chatLoading}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.5,
                }}
              />
              <Button
                variant="primary"
                size="sm"
                loading={chatLoading}
                disabled={!chatInput.trim()}
                onClick={handleSendChat}
                style={{ height: '42px', flexShrink: 0 }}
              >
                Gửi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
