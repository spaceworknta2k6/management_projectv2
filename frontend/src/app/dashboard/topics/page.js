'use client';

import { useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDate, getStatus } from '@/lib/utils';
import { BookOpen, Plus, Check, X, Shield, Cpu, Sparkle, Pencil } from '@phosphor-icons/react';

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

  // Proposed topic form
  const [form, setForm] = useState({
    title: '',
    summary: '',
    periodId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const isStaff = ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(user?.role || user?.roles?.[0]);
  const isStudent = (user?.role || user?.roles?.[0]) === 'STUDENT';

  const loadData = async () => {
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
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const handleSubmitTopic = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.periodId) return;

    setSubmitting(true);
    try {
      await api.post('/topics', {
        title: form.title.trim(),
        summary: form.summary.trim(),
        periodId: form.periodId,
      }, token);
      toast.success('Đề xuất đề tài thành công! Chờ Giáo vụ duyệt.');
      setShowProposeModal(false);
      setForm((prev) => ({ ...prev, title: '', summary: '' }));
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi đề xuất đề tài');
    } finally {
      setSubmitting(false);
    }
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
    const mappedStatus = (t.status === 'submitted' || t.status === 'ai_checked') ? 'pending_review' : t.status;
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
          <Button variant="primary" size="sm" onClick={() => setShowProposeModal(true)}>
            <Plus size={16} />
            Đề xuất đề tài mới
          </Button>
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
                          <span style={{ fontWeight: 600 }}>Gemini AI - Kiểm tra trùng lặp đề tài</span>
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
                Đề xuất đề tài đồ án mới
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
                <Button variant="secondary" onClick={() => setShowProposeModal(false)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={submitting}>Đề xuất</Button>
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
    </div>
  );
}
