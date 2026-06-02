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
import { getStatus } from '@/lib/utils';
import { Users, Plus, Check, UserPlus, Warning } from '@phosphor-icons/react';

export default function GroupsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Student active group
  const [myGroup, setMyGroup] = useState(null);
  const [myInvitations, setMyInvitations] = useState([]);

  // Form states
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteStudentId, setInviteStudentId] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  const isStaff = ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(user?.role || user?.roles?.[0]);

  // Load periods
  const loadPeriods = async () => {
    try {
      // In a real-world scenario, we fetch all active periods
      // Staff can call /periods, students might fetch indirectly or we can attempt to get the list
      const res = await api.get('/periods', token).catch(() => api.get('/auth/periods', token).catch(() => ({ data: [] })));
      const activePeriods = res.data || [];
      setPeriods(activePeriods);
      if (activePeriods.length > 0) {
        setSelectedPeriodId(activePeriods[0]._id);
      }
    } catch {
      // Suppress
    }
  };

  // Load all groups (Staff only)
  const fetchAllGroups = async (periodId) => {
    if (!periodId) return;
    setLoading(true);
    try {
      const res = await api.get(`/groups?periodId=${periodId}`, token);
      setGroups(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách nhóm');
    } finally {
      setLoading(false);
    }
  };

  // Load student-specific group data
  const fetchStudentGroupData = async () => {
    setLoading(true);
    try {
      // To find the student's group, we fetch all groups in periods and check where the student is a member
      const resPeriods = await api.get('/periods', token).catch(() => ({ data: [] }));
      const activePeriods = resPeriods.data || [];
      
      let foundGroup = null;
      let invitations = [];

      for (const p of activePeriods) {
        const resG = await api.get(`/groups?periodId=${p._id}`, token).catch(() => ({ data: [] }));
        const list = resG.data || [];
        for (const g of list) {
          const isMember = g.members?.some(
            (m) => m.studentId?._id === user?.studentId || m.studentId === user?.studentId
          );
          if (isMember) {
            const myMemberInfo = g.members.find(
              (m) => (m.studentId?._id || m.studentId) === user?.studentId
            );
            if (myMemberInfo.status === 'accepted') {
              foundGroup = g;
            } else if (myMemberInfo.status === 'invited') {
              invitations.push({ group: g, period: p });
            }
          }
        }
      }

      setMyGroup(foundGroup);
      setMyInvitations(invitations);
    } catch (err) {
      toast.error(err.message || 'Không thể tải thông tin nhóm cá nhân');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    loadPeriods();
  }, [token, user]);

  useEffect(() => {
    if (!token || !user) return;
    if (isStaff) {
      fetchAllGroups(selectedPeriodId);
    } else {
      fetchStudentGroupData();
    }
  }, [selectedPeriodId, token, user]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    if (!periods.length) {
      toast.error('Không tìm thấy đợt đồ án đang hoạt động.');
      return;
    }

    setCreating(true);
    // Use the first registration_open period
    const activePeriod = periods.find((p) => p.status === 'enrollment' || p.status === 'draft') || periods[0];

    try {
      await api.post('/groups', {
        periodId: activePeriod._id,
        name: newGroupName.trim(),
      }, token);
      toast.success('Đã khởi tạo nhóm thành công!');
      setNewGroupName('');
      fetchStudentGroupData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lập nhóm mới');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteStudentId.trim() || !myGroup) return;

    setInviting(true);
    try {
      await api.post(`/groups/${myGroup._id}/invite`, {
        studentId: inviteStudentId.trim(),
      }, token);
      toast.success('Đã gửi lời mời tham gia nhóm!');
      setInviteStudentId('');
      fetchStudentGroupData();
    } catch (err) {
      toast.error(err.message || 'Không thể mời thành viên');
    } finally {
      setInviting(false);
    }
  };

  const handleAccept = async (groupId) => {
    try {
      await api.post(`/groups/${groupId}/accept`, {}, token);
      toast.success('Gia nhập nhóm thành công!');
      fetchStudentGroupData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi chấp nhận lời mời');
    }
  };

  const handleConfirm = async () => {
    if (!myGroup) return;
    try {
      await api.post(`/groups/${myGroup._id}/confirm`, {}, token);
      toast.success('Xác nhận chốt danh sách thành viên nhóm thành công!');
      fetchStudentGroupData();
    } catch (err) {
      toast.error(err.message || 'Không thể chốt danh sách nhóm');
    }
  };

  return (
    <div>
      {/* Page Title Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={28} style={{ color: 'var(--accent)' }} />
          Quản lý Nhóm đồ án
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {isStaff ? 'Xem chi tiết các nhóm thành lập trong từng học kỳ' : 'Thành lập nhóm và kết nối với các bạn sinh viên'}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : isStaff ? (
        /* ─── Staff View ─── */
        <div>
          {/* Period selector */}
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Chọn Đợt Đồ Án:</span>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
              }}
            >
              {periods.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.schoolYear})
                </option>
              ))}
            </select>
          </div>

          {groups.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                Chưa có nhóm nào được đăng ký trong đợt này.
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {groups.map((g) => {
                const statusInfo = getStatus(g.status);
                return (
                  <Card key={g._id} title={g.name} subtitle={`Trưởng nhóm: ${g.leaderStudentId?.userId?.fullName || 'Không rõ'}`}
                    actions={<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Thành viên nhóm:</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                        {g.members?.map((m) => (
                          <div
                            key={m.studentId?._id || m.studentId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              backgroundColor: 'var(--bg-raised)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <div>
                              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {m.studentId?.userId?.fullName || 'Đang mời...'}
                              </p>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {m.studentId?.userId?.email || 'Chờ phản hồi'}
                              </p>
                            </div>
                            <Badge variant={m.status === 'accepted' ? 'success' : 'warning'}>
                              {m.status === 'accepted' ? 'Đã tham gia' : 'Chờ duyệt'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ─── Student View ─── */
        <div>
          {/* My invitations */}
          {myInvitations.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warning)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Warning size={16} /> Lời mời gia nhập nhóm đang chờ xử lý
              </h3>
              {myInvitations.map(({ group, period }) => (
                <Card key={group._id} title={`Mời gia nhập nhóm: ${group.name}`} subtitle={`Đợt đồ án: ${period.name}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Bạn nhận được lời mời gia nhập nhóm này từ trưởng nhóm.
                    </p>
                    <Button variant="primary" size="sm" onClick={() => handleAccept(group._id)}>
                      <Check size={16} /> Đồng ý gia nhập
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {myGroup ? (
            /* Student has group */
            <Card title={myGroup.name} subtitle={`Mã nhóm: ${myGroup._id}`}
              actions={
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Badge variant={getStatus(myGroup.status).variant}>{getStatus(myGroup.status).label}</Badge>
                  {myGroup.status === 'draft' && myGroup.leaderStudentId?._id === user?.studentId && (
                    <Button variant="primary" size="sm" onClick={handleConfirm}>
                      Xác nhận chốt danh sách
                    </Button>
                  )}
                </div>
              }
            >
              {/* Group Members details */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Danh sách Thành viên Nhóm
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {myGroup.members?.map((m) => (
                    <div
                      key={m.studentId?._id || m.studentId}
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--bg-raised)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {m.studentId?.userId?.fullName || 'Đang gửi lời mời...'}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {m.studentId?.userId?.email || 'Chờ xác nhận'}
                        </p>
                      </div>
                      <Badge variant={m.status === 'accepted' ? 'success' : 'warning'}>
                        {m.status === 'accepted' ? 'Đã gia nhập' : 'Đang mời'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite member section (Leader only) */}
              {myGroup.status === 'draft' && myGroup.leaderStudentId?._id === user?.studentId && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Mời thành viên mới
                  </h4>
                  <form onSubmit={handleInvite} style={{ display: 'flex', gap: '12px', maxWidth: '420px' }}>
                    <Input
                      name="inviteStudentId"
                      value={inviteStudentId}
                      onChange={(e) => setInviteStudentId(e.target.value)}
                      placeholder="Nhập mã ID Sinh viên (ObjectId)..."
                      required
                      style={{ flex: 1 }}
                    />
                    <Button variant="primary" type="submit" loading={inviting} style={{ marginTop: '25px' }}>
                      <UserPlus size={16} /> Gửi lời mời
                    </Button>
                  </form>
                </div>
              )}
            </Card>
          ) : (
            /* Student has NO group */
            <Card title="Thành lập nhóm mới" subtitle="Khởi tạo nhóm của riêng bạn để đăng ký đề tài">
              <div style={{ maxWidth: '480px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Bạn chưa có nhóm đồ án nào trong học kỳ này. Hãy đặt tên nhóm và ấn "Khởi tạo nhóm" để bắt đầu mời các thành viên khác.
                </p>
                <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Input
                    label="Tên nhóm đồ án"
                    name="newGroupName"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Ví dụ: Nhóm Nghiên cứu AI K65"
                    required
                  />
                  <Button variant="primary" type="submit" loading={creating} style={{ alignSelf: 'flex-start' }}>
                    <Plus size={18} /> Khởi tạo nhóm
                  </Button>
                </form>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
