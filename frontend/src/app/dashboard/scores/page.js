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
import { formatDate } from '@/lib/utils';
import { ClipboardText, ArrowsClockwise, CheckCircle, Calculator } from '@phosphor-icons/react';

export default function ScoresPage() {
  const { user, token } = useAuthStore();
  const toast = useToast();
  
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Selected session to score
  const [selectedSession, setSelectedSession] = useState(null);

  // Form for grading
  const [form, setForm] = useState({
    comment: '',
    criteriaScores: [
      {
        criteriaCode: 'C1',
        criteriaName: 'Chất lượng Báo cáo',
        maxScore: 3,
        score: 0,
        weight: 0.3
      },
      {
        criteriaCode: 'C2',
        criteriaName: 'Chất lượng Sản phẩm / Source Code',
        maxScore: 4,
        score: 0,
        weight: 0.4
      },
      {
        criteriaCode: 'C3',
        criteriaName: 'Trình bày & Trả lời câu hỏi',
        maxScore: 3,
        score: 0,
        weight: 0.3
      }
    ]
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/defense-sessions', token);
      setSessions(res.data || []);
    } catch (err) {
      toast.error('Lỗi khi tải danh sách dự án cần chấm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleOpenScoreModal = (session) => {
    setSelectedSession(session);
    setForm({
      comment: '',
      criteriaScores: [
        { criteriaCode: 'C1', criteriaName: 'Chất lượng Báo cáo', maxScore: 3, score: 0, weight: 0.3 },
        { criteriaCode: 'C2', criteriaName: 'Chất lượng Sản phẩm / Source Code', maxScore: 4, score: 0, weight: 0.4 },
        { criteriaCode: 'C3', criteriaName: 'Trình bày & Trả lời câu hỏi', maxScore: 3, score: 0, weight: 0.3 }
      ]
    });
    setShowModal(true);
  };

  const handleScoreChange = (index, value) => {
    const newCriteria = [...form.criteriaScores];
    newCriteria[index].score = Number(value);
    setForm({ ...form, criteriaScores: newCriteria });
  };

  const getTotalScore = () => {
    return form.criteriaScores.reduce((sum, c) => sum + (c.score || 0), 0).toFixed(1);
  };

  const handleSubmitScore = async (e) => {
    e.preventDefault();
    if (!selectedSession || !selectedSession.projectId) return;

    const projectId = selectedSession.projectId._id || selectedSession.projectId;
    const groupId = selectedSession.groupId;
    // Assuming periodId exists on project or committee. For prototype, we extract it.
    const periodId = selectedSession.committeeId?.periodId || selectedSession.projectId?.periodId || '660a1b2c3d4e5f6a7b8c9d0e'; // Fallback if missing in populate

    const payload = {
      projectId,
      groupId,
      periodId,
      rubricRole: 'COMMITTEE_MEMBER',
      targetType: 'COMMITTEE_MEMBER',
      targetId: projectId,
      comment: form.comment,
      criteriaScores: form.criteriaScores
    };

    try {
      setSubmitting(true);
      await api.post('/scores/score-sheets', payload, token);
      toast.success('Đã nộp phiếu điểm thành công');
      setShowModal(false);
      // Optional: Call aggregate final grade
      try {
        await api.post(`/scores/final-grades/aggregate/${projectId}`, {}, token);
      } catch (e) {
        console.error('Aggregate failed', e);
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi nộp phiếu điểm');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardText size={28} style={{ color: 'var(--accent)' }} />
            Chấm điểm Đồ án
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Nhập điểm đánh giá dành cho Giảng viên (Hội đồng, Phản biện, Hướng dẫn)
          </p>
        </div>
        
        <Button variant="outline" onClick={fetchData} icon={<ArrowsClockwise />} title="Làm mới" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {sessions.map((session) => (
          <Card key={session._id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {session.projectId?.topicId?.title || 'Đồ án'}
                </h3>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Hội đồng: {session.committeeId?.name || 'Không xác định'}
                </div>
              </div>
              <Badge variant="neutral">Ca {session.orderNumber}</Badge>
            </div>

            <div style={{ flex: 1, backgroundColor: 'var(--surface-sunken)', padding: '12px', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div><strong>Nhóm SV:</strong> {session.groupId?.name || 'Nhóm'}</div>
              <div style={{ marginTop: '4px' }}><strong>Bảo vệ:</strong> {formatDate(session.defenseDate).split(' ')[0]}</div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" variant="primary" icon={<CheckCircle />} onClick={() => handleOpenScoreModal(session)}>
                Nhập phiếu điểm
              </Button>
            </div>
          </Card>
        ))}

        {sessions.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
            Bạn không có lịch bảo vệ nào cần chấm điểm
          </div>
        )}
      </div>

      {/* Modal Chấm Điểm */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', width: '100%', maxWidth: '550px',
            borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Phiếu chấm điểm</h2>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'var(--surface-sunken)', borderRadius: '8px', fontSize: '13px' }}>
                <strong>Đề tài:</strong> {selectedSession?.projectId?.topicId?.title}<br/>
                <strong>Nhóm:</strong> {selectedSession?.groupId?.name}
              </div>

              <form id="score-form" onSubmit={handleSubmitScore} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {form.criteriaScores.map((c, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.criteriaName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tối đa: {c.maxScore} điểm</div>
                      </div>
                      <div style={{ width: '100px' }}>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max={c.maxScore}
                          value={c.score}
                          onChange={(e) => handleScoreChange(index, e.target.value)}
                          required
                          style={{ textAlign: 'center', fontSize: '16px', fontWeight: 600 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--accent)', color: '#fff', borderRadius: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600 }}>
                    <Calculator size={20} /> Tổng điểm
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>
                    {getTotalScore()} / 10
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Nhận xét / Đánh giá</label>
                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm({...form, comment: e.target.value})}
                    rows="3"
                    placeholder="Nhập nhận xét của Giảng viên..."
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', resize: 'vertical' }}
                  ></textarea>
                </div>
              </form>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'var(--surface-sunken)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <Button variant="ghost" onClick={() => setShowModal(false)} type="button">Hủy</Button>
              <Button variant="primary" type="submit" form="score-form" isLoading={submitting}>Nộp Phiếu Điểm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
