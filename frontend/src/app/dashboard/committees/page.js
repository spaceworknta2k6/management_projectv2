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
import { formatDate, getTechnicalLabel, hasAnyRole } from '@/lib/utils';
import { Gavel, Plus, ArrowsClockwise, Users, Trash, CheckCircle, PlayCircle, PencilSimple } from '@phosphor-icons/react';

export default function CommitteesPage() {
  const { user, token } = useAuthStore();
  const toast = useToast();
  
  const [committees, setCommittees] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [periods, setPeriods] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState(null);
  const [committeeToDelete, setCommitteeToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  // Form
  const [form, setForm] = useState({
    periodId: '',
    name: '',
    evaluationMode: 'defense',
    members: [], // array of { lecturerId, role }
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [committeesRes, periodsRes, lecturersRes] = await Promise.all([
        api.get('/committees', token),
        api.get('/periods', token),
        api.get('/auth/lecturers', token),
      ]);
      
      setCommittees(committeesRes.data || []);
      setPeriods(periodsRes.data || []);
      setLecturers(lecturersRes.data || []);
      
      if (periodsRes.data && periodsRes.data.length > 0 && !form.periodId) {
        setForm(prev => ({ ...prev, periodId: periodsRes.data[0]._id }));
      }
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu hội đồng');
    } finally {
      setLoading(false);
    }
  }, [form.periodId, toast, token]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

  const handleAddMember = () => {
    setForm({
      ...form,
      members: [...form.members, { lecturerId: '', role: 'COMMITTEE_MEMBER' }]
    });
  };

  const handleRemoveMember = (index) => {
    const newMembers = [...form.members];
    newMembers.splice(index, 1);
    setForm({ ...form, members: newMembers });
  };

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...form.members];
    newMembers[index][field] = value;
    setForm({ ...form, members: newMembers });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.members.length < 3) {
      toast.error('Hội đồng phải có ít nhất 3 thành viên');
      return;
    }
    
    // Check duplicates
    const memberIds = form.members.map(m => m.lecturerId);
    const uniqueIds = new Set(memberIds);
    if (uniqueIds.size !== memberIds.length) {
      toast.error('Có thành viên bị trùng lặp trong hội đồng');
      return;
    }

    try {
      setSubmitting(true);
      if (editingCommittee) {
        await api.patch(`/committees/${editingCommittee._id}`, {
          name: form.name,
          evaluationMode: form.evaluationMode,
          members: form.members,
        }, token);
        toast.success('Đã cập nhật hội đồng');
      } else {
        await api.post('/committees', form, token);
        toast.success('Đã tạo Hội đồng thành công');
      }
      setShowModal(false);
      setEditingCommittee(null);
      setForm({
        ...form,
        name: '',
        members: [],
      });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo hội đồng');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setEditingCommittee(null);
    setForm({
      ...form,
      name: '',
      members: [],
    });
    setShowModal(true);
  };

  const openEditModal = (committee) => {
    setEditingCommittee(committee);
    setForm({
      periodId: committee.periodId?._id || committee.periodId || '',
      name: committee.name || '',
      evaluationMode: committee.evaluationMode || 'defense',
      members: (committee.members || []).map((m) => ({
        lecturerId: m.lecturerId?._id || m.lecturerId,
        role: m.role,
      })),
    });
    setShowModal(true);
  };

  const handleDeleteCommittee = async (committee) => {
    try {
      setActionLoading(`delete:${committee._id}`);
      await api.delete(`/committees/${committee._id}`, token);
      toast.success('Đã xóa hội đồng thành công.');
      setCommitteeToDelete(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Không thể xóa hội đồng');
    } finally {
      setActionLoading('');
    }
  };

  const handleApproveCommittee = async (committeeId) => {
    try {
      setActionLoading(`approve:${committeeId}`);
      await api.post(`/committees/${committeeId}/approve`, {}, token);
      toast.success('Đã phê duyệt hội đồng');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi phê duyệt hội đồng');
    } finally {
      setActionLoading('');
    }
  };

  const handleActivateCommittee = async (committeeId) => {
    try {
      setActionLoading(`activate:${committeeId}`);
      await api.post(`/committees/${committeeId}/activate`, {}, token);
      toast.success('Đã kích hoạt hội đồng');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi kích hoạt hội đồng');
    } finally {
      setActionLoading('');
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'draft': return <Badge variant="warning">Bản nháp</Badge>;
      case 'approved': return <Badge variant="info">Đã duyệt</Badge>;
      case 'active': return <Badge variant="success">Đang hoạt động</Badge>;
      case 'finished': return <Badge variant="neutral">Đã kết thúc</Badge>;
      default: return <Badge>{getTechnicalLabel(status)}</Badge>;
    }
  };

  const getLecturerDisplay = (member) => {
    const populatedLecturer = typeof member.lecturerId === 'object' ? member.lecturerId : null;
    const lecturerId = populatedLecturer?._id || member.lecturerId;
    const fallbackLecturer = lecturers.find((l) => l._id === lecturerId);
    const lecturer = populatedLecturer || fallbackLecturer || {};
    const userInfo = lecturer.userId || fallbackLecturer?.userId || {};

    return {
      fullName: userInfo.fullName || lecturer.fullName || 'Chưa có tên giảng viên',
      lecturerCode: lecturer.lecturerCode || lecturer.employeeId || fallbackLecturer?.lecturerCode || fallbackLecturer?.employeeId || '',
    };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const isStaff = hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF']);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gavel size={28} style={{ color: 'var(--accent)' }} />
            Quản lý Hội đồng
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Thành lập và phân công thành viên Hội đồng đánh giá đồ án
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="outline" onClick={fetchData} icon={<ArrowsClockwise />} title="Làm mới" />
          {isStaff && (
            <Button variant="primary" icon={<Plus />} onClick={openCreateModal}>
              Tạo hội đồng
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px', position: 'relative', zIndex: 0 }}>
        {committees.map((committee) => (
          <Card key={committee._id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {committee.name}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Đợt: {committee.periodId?.name || 'Không xác định'}
                </div>
              </div>
              {getStatusBadge(committee.status)}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <Users size={16} />
                <span>Thành viên ({committee.members?.length || 0})</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {committee.members?.map((m, idx) => {
                  const lecturerInfo = getLecturerDisplay(m);
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '8px', backgroundColor: 'var(--surface-sunken)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {lecturerInfo.fullName}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {lecturerInfo.lecturerCode}
                        </span>
                      </div>
                      <Badge variant={m.role === 'COMMITTEE_CHAIR' ? 'danger' : m.role === 'COMMITTEE_SECRETARY' ? 'warning' : 'neutral'}>
                        {m.role === 'COMMITTEE_CHAIR' ? 'Chủ tịch' : 
                         m.role === 'COMMITTEE_SECRETARY' ? 'Thư ký' : 
                         m.role === 'REVIEWER' ? 'Phản biện' : 'Ủy viên'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Tạo lúc: {formatDate(committee.createdAt)}
            </div>

            {isStaff && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                {committee.status === 'draft' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<PencilSimple size={14} />}
                    onClick={() => openEditModal(committee)}
                  >
                    Sửa
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash size={14} />}
                  loading={actionLoading === `delete:${committee._id}`}
                  onClick={() => setCommitteeToDelete(committee)}
                >
                  Xóa
                </Button>
                {committee.status === 'draft' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<CheckCircle size={14} />}
                    loading={actionLoading === `approve:${committee._id}`}
                    onClick={() => handleApproveCommittee(committee._id)}
                  >
                    Duyệt
                  </Button>
                )}
                {committee.status === 'approved' && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<PlayCircle size={14} />}
                    loading={actionLoading === `activate:${committee._id}`}
                    onClick={() => handleActivateCommittee(committee._id)}
                  >
                    Kích hoạt
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}

        {committees.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
            Chưa có hội đồng nào được tạo
          </div>
        )}
      </div>

      {/* Modal Tạo Hội đồng */}
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
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{editingCommittee ? 'Chỉnh sửa Hội đồng' : 'Tạo Hội đồng Đánh giá mới'}</h2>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <form id="committee-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Thuộc Đợt đồ án *</label>
                  <select
                    value={form.periodId}
                    onChange={(e) => setForm({...form, periodId: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">-- Chọn đợt đồ án --</option>
                    {periods.map(p => (
                      <option key={p._id} value={p._id}>{p.name} ({p.schoolYear})</option>
                    ))}
                  </select>
                </div>
                
                <Input
                  label="Tên Hội đồng *"
                  placeholder="Ví dụ: Hội đồng HĐ-01, Hội đồng KHMT-01..."
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  required
                />
                
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500 }}>
                      Thành viên Hội đồng * (Tối thiểu 3)
                    </label>
                    <Button variant="outline" size="sm" type="button" onClick={handleAddMember} icon={<Plus />}>
                      Thêm
                    </Button>
                  </div>
                  
                  {form.members.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Chưa có thành viên nào. Vui lòng thêm ít nhất 3 thành viên.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {form.members.map((member, index) => (
                        <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <select
                              value={member.lecturerId}
                              onChange={(e) => handleMemberChange(index, 'lecturerId', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                              required
                            >
                              <option value="">-- Chọn Giảng viên --</option>
                              {lecturers.map(l => (
                                <option key={l._id} value={l._id}>
                                  {l.userId?.fullName} ({l.lecturerCode})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ width: '150px' }}>
                            <select
                              value={member.role}
                              onChange={(e) => handleMemberChange(index, 'role', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                              required
                            >
                              <option value="COMMITTEE_CHAIR">Chủ tịch</option>
                              <option value="COMMITTEE_SECRETARY">Thư ký</option>
                              <option value="REVIEWER">Phản biện</option>
                              <option value="COMMITTEE_MEMBER">Ủy viên</option>
                            </select>
                          </div>
                          <Button 
                            variant="outline" 
                            type="button" 
                            style={{ padding: '8px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                            onClick={() => handleRemoveMember(index)}
                            icon={<Trash />}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'var(--surface-sunken)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <Button variant="ghost" onClick={() => { setShowModal(false); setEditingCommittee(null); }} type="button">Hủy</Button>
              <Button variant="primary" type="submit" form="committee-form" isLoading={submitting}>{editingCommittee ? 'Cập nhật Hội đồng' : 'Tạo Hội đồng'}</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(committeeToDelete)}
        title="Xóa hội đồng"
        message={committeeToDelete ? `Bạn có chắc chắn muốn xóa hội đồng "${committeeToDelete.name}"?` : ''}
        confirmLabel="Xóa"
        loading={actionLoading === `delete:${committeeToDelete?._id}`}
        onCancel={() => setCommitteeToDelete(null)}
        onConfirm={() => handleDeleteCommittee(committeeToDelete)}
      />
    </div>
  );
}
