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
import { Sword, Plus, ArrowsClockwise, VideoCamera, MapPin, Clock } from '@phosphor-icons/react';

export default function DefensesPage() {
  const { user, token } = useAuthStore();
  const toast = useToast();
  
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [committees, setCommittees] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [form, setForm] = useState({
    projectId: '',
    committeeId: '',
    mode: 'offline',
    room: '',
    meetingUrl: '',
    defenseDate: '',
    startTime: '',
    endTime: '',
    orderNumber: 1,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sessionsRes, projectsRes, committeesRes] = await Promise.all([
        api.get('/defense-sessions', token),
        api.get('/projects', token),
        api.get('/committees', token),
      ]);
      
      setSessions(sessionsRes.data.data);
      // Only show defense-eligible projects if not admin, but for now show all to easily test
      setProjects(projectsRes.data.data);
      setCommittees(committeesRes.data.data);
      
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu lịch bảo vệ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      // Clean up unneeded fields based on mode
      const payload = { ...form };
      if (payload.mode === 'offline') delete payload.meetingUrl;
      if (payload.mode === 'online') delete payload.room;
      
      await api.post('/defense-sessions', payload, token);
      toast.success('Đã xếp lịch bảo vệ thành công');
      setShowModal(false);
      setForm({
        ...form,
        projectId: '',
        room: '',
        meetingUrl: '',
        orderNumber: form.orderNumber + 1,
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi xếp lịch bảo vệ');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'scheduled': return <Badge variant="info">Đã lên lịch</Badge>;
      case 'in_progress': return <Badge variant="warning">Đang diễn ra</Badge>;
      case 'completed': return <Badge variant="success">Đã hoàn thành</Badge>;
      case 'cancelled': return <Badge variant="danger">Đã hủy</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const isStaff = user?.role === 'FACULTY_STAFF' || user?.role === 'DEPARTMENT_STAFF';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sword size={28} style={{ color: 'var(--accent)' }} />
            Lịch bảo vệ Đồ án
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Xem thời gian, ca thi, địa điểm phòng bảo vệ đồ án tốt nghiệp
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="outline" onClick={fetchData} icon={<ArrowsClockwise />} title="Làm mới" />
          {isStaff && (
            <Button variant="primary" icon={<Plus />} onClick={() => setShowModal(true)}>
              Xếp lịch bảo vệ
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {sessions.map((session) => (
          <Card key={session._id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <Badge variant="neutral" style={{ marginBottom: '8px' }}>
                  Ca số {session.orderNumber}
                </Badge>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {session.projectId?.topicId?.title || 'Đồ án chưa có tên'}
                </h3>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Hội đồng: {session.committeeId?.name || 'Không xác định'}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, backgroundColor: 'var(--surface-sunken)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Clock size={16} />
                <span>
                  {formatDate(session.defenseDate).split(' ')[0]} • {session.startTime} - {session.endTime}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {session.mode === 'online' ? (
                  <>
                    <VideoCamera size={16} color="var(--primary)" />
                    <a href={session.meetingUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                      Tham gia Online
                    </a>
                  </>
                ) : (
                  <>
                    <MapPin size={16} />
                    <span>Phòng: {session.room}</span>
                  </>
                )}
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {getStatusBadge(session.status)}
              {session.status === 'scheduled' && isStaff && (
                <Button size="sm" variant="outline">
                  Bắt đầu phiên
                </Button>
              )}
            </div>
          </Card>
        ))}

        {sessions.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
            Chưa có lịch bảo vệ nào được xếp
          </div>
        )}
      </div>

      {/* Modal Xếp Lịch Bảo Vệ */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', width: '100%', maxWidth: '600px',
            borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Xếp lịch bảo vệ Đồ án</h2>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <form id="defense-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Dự án cần bảo vệ *</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({...form, projectId: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">-- Chọn Dự án --</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>{p.topicId?.title || 'Đồ án'} ({p.groupId?.name || 'Nhóm'})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Hội đồng đánh giá *</label>
                  <select
                    value={form.committeeId}
                    onChange={(e) => setForm({...form, committeeId: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">-- Chọn Hội đồng --</option>
                    {committees.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Hình thức *</label>
                    <select
                      value={form.mode}
                      onChange={(e) => setForm({...form, mode: e.target.value})}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                      required
                    >
                      <option value="offline">Trực tiếp (Offline)</option>
                      <option value="online">Trực tuyến (Online)</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Số thứ tự bảo vệ *</label>
                    <Input
                      type="number"
                      min="1"
                      value={form.orderNumber}
                      onChange={(e) => setForm({...form, orderNumber: Number(e.target.value)})}
                      required
                    />
                  </div>
                </div>

                {form.mode === 'offline' ? (
                  <Input
                    label="Phòng bảo vệ *"
                    placeholder="VD: D9-204"
                    value={form.room}
                    onChange={(e) => setForm({...form, room: e.target.value})}
                    required
                  />
                ) : (
                  <Input
                    label="Link phòng họp Online (Teams/Zoom) *"
                    placeholder="https://teams.microsoft.com/..."
                    value={form.meetingUrl}
                    onChange={(e) => setForm({...form, meetingUrl: e.target.value})}
                    required
                  />
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Ngày bảo vệ *</label>
                    <Input
                      type="date"
                      value={form.defenseDate}
                      onChange={(e) => setForm({...form, defenseDate: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Giờ bắt đầu *</label>
                    <Input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({...form, startTime: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Giờ kết thúc *</label>
                    <Input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({...form, endTime: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'var(--surface-sunken)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <Button variant="ghost" onClick={() => setShowModal(false)} type="button">Hủy</Button>
              <Button variant="primary" type="submit" form="defense-form" isLoading={submitting}>Xếp lịch</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
