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
import { getStatus, hasAnyRole } from '@/lib/utils';
import { Users, Plus, Check, UserPlus, Warning, PencilSimple, Trash } from '@phosphor-icons/react';
import css from './page.module.css';

export default function GroupsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Student active group
  const [myGroup, setMyGroup] = useState(null);
  const [myInvitations, setMyInvitations] = useState([]);

  // Form states
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteStudentId, setInviteStudentId] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);

  // Load periods
  const loadPeriods = useCallback(async () => {
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
  }, [token]);

  // Load all groups (Staff only)
  const fetchAllGroups = useCallback(async (periodId) => {
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
  }, [toast, token]);

  // Load student-specific group data
  const fetchStudentGroupData = useCallback(async () => {
    if (!user?.studentId) {
      setLoading(false);
      return;
    }
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
            (m) => (m.studentId?._id || m.studentId) === user?.studentId
          );
          if (isMember) {
            const myMemberInfo = g.members.find(
              (m) => (m.studentId?._id || m.studentId) === user?.studentId
            );
            if (myMemberInfo?.status === 'accepted') {
              foundGroup = g;
            } else if (myMemberInfo?.status === 'invited') {
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
  }, [toast, token, user?.studentId]);

  useEffect(() => {
    if (!token || !user) return;
    loadPeriods();
  }, [loadPeriods, token, user]);

  useEffect(() => {
    if (!token || !user) return;
    if (isStaff) {
      fetchAllGroups(selectedPeriodId);
    } else {
      fetchStudentGroupData();
    }
  }, [fetchAllGroups, fetchStudentGroupData, isStaff, selectedPeriodId, token, user]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    if (!periods.length) {
      toast.error('Không tìm thấy đợt đồ án đang hoạt động.');
      return;
    }

    setCreating(true);
    // Use the first registration_open period
    const activePeriod = periods.find((p) => p.status === 'enrollment' || p.status === 'registration_open' || p.status === 'draft') || periods[0];

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

  const reloadGroups = () => {
    if (isStaff) fetchAllGroups(selectedPeriodId);
    else fetchStudentGroupData();
  };

  const handleEditGroup = async (group) => {
    const name = window.prompt('Tên nhóm mới', group.name);
    if (!name || !name.trim() || name.trim() === group.name) return;
    try {
      await api.patch(`/groups/${group._id}`, { name: name.trim() }, token);
      toast.success('Đã cập nhật nhóm đồ án.');
      reloadGroups();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật nhóm');
    }
  };

  const handleDeleteGroup = async (group) => {
    setDeletingGroup(true);
    try {
      await api.delete(`/groups/${group._id}`, token);
      toast.success('Đã xóa nhóm đồ án thành công.');
      setGroupToDelete(null);
      reloadGroups();
    } catch (err) {
      toast.error(err.message || 'Không thể xóa nhóm');
    } finally {
      setDeletingGroup(false);
    }
  };

  return (
    <div>
      {/* Page Title Header */}
      <div className={css.s1}>
        <h1 className={`text-display ${css.s2}`}>
          <Users size={28} className={css.s3} />
          Quản lý Nhóm đồ án
        </h1>
        <p className={css.s4}>
          {isStaff ? 'Xem chi tiết các nhóm thành lập trong từng học kỳ' : 'Thành lập nhóm và kết nối với các bạn sinh viên'}
        </p>
      </div>

      {loading ? (
        <div className={css.s5}>
          <Spinner size="lg" />
        </div>
      ) : isStaff ? (
        /* ─── Staff View ─── */
        <div>
          {/* Period selector */}
          <div className={css.s6}>
            <span className={css.s7}>Chọn Đợt Đồ Án:</span>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)} className={css.s36} >
              {periods.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.schoolYear})
                </option>
              ))}
            </select>
          </div>

          {groups.length === 0 ? (
            <Card>
              <div className={css.s8}>
                Chưa có nhóm nào được đăng ký trong đợt này.
              </div>
            </Card>
          ) : (
            <div className={css.s9}>
              {groups.map((g) => {
                const statusInfo = getStatus(g.status);
                return (
                  <Card key={g._id} title={g.name} subtitle={`Trưởng nhóm: ${g.leaderStudentId?.userId?.fullName || 'Không rõ'}`}
                    actions={
                      <div className={css.s10}>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        <Button variant="secondary" size="sm" onClick={() => handleEditGroup(g)}>
                          <PencilSimple size={14} /> Sửa
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setGroupToDelete(g)}>
                          <Trash size={14} /> Xóa
                        </Button>
                      </div>
                    }
                  >
                    <div className={css.s11}>
                      <p className={css.s12}>Thành viên nhóm:</p>
                      <div className={css.s13}>
                        {g.members?.map((m) => (
                          <div
                            key={m.studentId?._id || m.studentId} className={css.s14} >
                            <div>
                              <p className={css.s15}>
                                {m.studentId?.userId?.fullName || 'Đang mời...'}
                              </p>
                              <p className={css.s16}>
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
            <div className={css.s17}>
              <h3 className={css.s18}>
                <Warning size={16} /> Lời mời gia nhập nhóm đang chờ xử lý
              </h3>
              {myInvitations.map(({ group, period }) => (
                <Card key={group._id} title={`Mời gia nhập nhóm: ${group.name}`} subtitle={`Đợt đồ án: ${period.name}`}>
                  <div className={css.s19}>
                    <p className={css.s20}>
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
                <div className={css.s21}>
                  <Badge variant={getStatus(myGroup.status).variant}>{getStatus(myGroup.status).label}</Badge>
                  {myGroup.status === 'draft' && myGroup.leaderStudentId?._id === user?.studentId && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => handleEditGroup(myGroup)}>
                        <PencilSimple size={14} /> Sửa
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setGroupToDelete(myGroup)}>
                        <Trash size={14} /> Xóa
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleConfirm}>
                        Xác nhận chốt danh sách
                      </Button>
                    </>
                  )}
                </div>
              }
            >
              {/* Group Members details */}
              <div className={css.s22}>
                <h4 className={css.s23}>
                  Danh sách Thành viên Nhóm
                </h4>
                <div className={css.s24}>
                  {myGroup.members?.map((m) => (
                    <div
                      key={m.studentId?._id || m.studentId} className={css.s25} >
                      <div>
                        <p className={css.s26}>
                          {m.studentId?.userId?.fullName || 'Đang gửi lời mời...'}
                        </p>
                        <p className={css.s27}>
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
                <div className={css.s28}>
                  <h4 className={css.s29}>
                    Mời thành viên mới
                  </h4>
                  <form onSubmit={handleInvite} className={css.s30}>
                    <Input
                      name="inviteStudentId"
                      value={inviteStudentId}
                      onChange={(e) => setInviteStudentId(e.target.value)}
                      placeholder="Nhập ID Sinh viên..."
                      required className={css.s37} />
                    <Button variant="primary" type="submit" loading={inviting} className={css.s31}>
                      <UserPlus size={16} /> Gửi lời mời
                    </Button>
                  </form>
                </div>
              )}
            </Card>
          ) : (
            /* Student has NO group */
            <Card title="Thành lập nhóm mới" subtitle="Khởi tạo nhóm của riêng bạn để đăng ký đề tài">
              <div className={css.s32}>
                <p className={css.s33}>
                  Bạn chưa có nhóm đồ án nào trong học kỳ này. Hãy đặt tên nhóm và ấn &quot;Khởi tạo nhóm&quot; để bắt đầu mời các thành viên khác.
                </p>
                <form onSubmit={handleCreateGroup} className={css.s34}>
                  <Input
                    label="Tên nhóm đồ án"
                    name="newGroupName"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Ví dụ: Nhóm Nghiên cứu AI K65"
                    required
                  />
                  <Button variant="primary" type="submit" loading={creating} className={css.s35}>
                    <Plus size={18} /> Khởi tạo nhóm
                  </Button>
                </form>
              </div>
            </Card>
          )}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(groupToDelete)}
        title="Xóa nhóm đồ án"
        message={groupToDelete ? `Bạn có chắc chắn muốn xóa nhóm "${groupToDelete.name}"?` : ''}
        confirmLabel="Xóa"
        loading={deletingGroup}
        onCancel={() => setGroupToDelete(null)}
        onConfirm={() => handleDeleteGroup(groupToDelete)}
      />
    </div>
  );
}
