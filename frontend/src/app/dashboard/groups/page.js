'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import usePeriodStore from '@/store/period.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { getStatus, hasAnyRole, handleApiError } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';
import { Users, Plus, Check, UserPlus, Warning, PencilSimple, Trash } from '@phosphor-icons/react';
import css from './page.module.css';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const ACADEMIC_YEAR_START = 2019;
const SEMESTER_OPTIONS = [
  { value: '1', label: 'Học kỳ 1' },
  { value: '2', label: 'Học kỳ 2' },
  { value: '3', label: 'Học kỳ 3' },
];

function getEntityId(value) {
  return value?._id || value?.id || value;
}

function getPeriodLabel(period) {
  return [period?.courseCode, period?.courseName || period?.name, period?.schoolYear, period?.semester]
    .filter(Boolean)
    .join(' - ');
}

function getAcademicYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = ACADEMIC_YEAR_START; year <= currentYear; year += 1) {
    years.push(`${year}-${year + 1}`);
  }
  return years;
}

function normalizeSemesterValue(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === '1' || raw === 'i' || raw.includes('kỳ i') || raw.includes('ky i') || raw.includes('kỳ 1') || raw.includes('ky 1')) return '1';
  if (raw === '2' || raw === 'ii' || raw.includes('kỳ ii') || raw.includes('ky ii') || raw.includes('kỳ 2') || raw.includes('ky 2')) return '2';
  if (raw === '3' || raw === 'iii' || raw.includes('kỳ iii') || raw.includes('ky iii') || raw.includes('kỳ 3') || raw.includes('ky 3')) return '3';
  return raw;
}

function getSafePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getSafePageSize(value) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : PAGE_SIZE;
}

function getInitialQuery() {
  if (typeof window === 'undefined') return { page: 1, limit: PAGE_SIZE, search: '' };
  const params = new URLSearchParams(window.location.search);
  return {
    page: getSafePositiveInt(params.get('page'), 1),
    limit: getSafePageSize(params.get('limit')),
    search: params.get('search') || '',
  };
}

export default function GroupsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const initialQuery = useMemo(() => getInitialQuery(), []);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [search, setSearch] = useState(initialQuery.search);

  const { periods, selectedPeriodId, fetchPeriods, setSelectedPeriodId } = usePeriodStore();
  const [groups, setGroups] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [groupToCancelAndDelete, setGroupToCancelAndDelete] = useState(null);
  const [cancellingLinkedWork, setCancellingLinkedWork] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupError, setEditGroupError] = useState('');
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const [staffSchoolYear, setStaffSchoolYear] = useState('');
  const [staffSemester, setStaffSemester] = useState('');
  const [studentPeriods, setStudentPeriods] = useState([]);

  // Student active group
  const [myGroup, setMyGroup] = useState(null);
  const [myInvitations, setMyInvitations] = useState([]);

  // Form states
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteStudentCode, setInviteStudentCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const canViewGroupDirectory = isStaff || isLecturer;
  const staffSchoolYears = useMemo(() => getAcademicYearOptions(), []);
  const staffPeriodOptions = useMemo(() => periods.filter((period) => {
    if (staffSchoolYear && period.schoolYear !== staffSchoolYear) return false;
    if (staffSemester && normalizeSemesterValue(period.semester) !== staffSemester) return false;
    return true;
  }), [periods, staffSchoolYear, staffSemester]);
  const selectedStudentPeriod = useMemo(
    () => studentPeriods.find((period) => getEntityId(period) === selectedPeriodId) || null,
    [selectedPeriodId, studentPeriods]
  );

  // Load all groups (Staff only)
  const fetchAllGroups = useCallback(async (periodId) => {
    if (!periodId) {
      setGroups([]);
      setInitialLoading(false);
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      const res = await api.get(`/groups?periodId=${periodId}`, token);
      setGroups(res.data || []);
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [toast, token]);

  const fetchStudentPeriods = useCallback(async () => {
    try {
      const res = await api.get('/periods?enrolledOnly=true', token);
      const list = res.data || [];
      setStudentPeriods(list);
      const hasSelected = list.some((period) => getEntityId(period) === selectedPeriodId);
      if (!hasSelected) {
        setSelectedPeriodId(list[0]?._id || '');
      }
      return list;
    } catch (err) {
      handleApiError(err, toast);
      setStudentPeriods([]);
      setSelectedPeriodId('');
      return [];
    }
  }, [selectedPeriodId, setSelectedPeriodId, toast, token]);

  const fetchStudentGroupData = useCallback(async () => {
    if (!user?.studentId) {
      setInitialLoading(false);
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      const resPeriods = await api.get('/periods?enrolledOnly=true', token).catch(() => ({ data: [] }));
      const activePeriods = resPeriods.data || [];
      setStudentPeriods(activePeriods);
      const scopedPeriods = selectedPeriodId
        ? activePeriods.filter((period) => getEntityId(period) === selectedPeriodId)
        : activePeriods.slice(0, 1);

      // Fetch tất cả periods song song thay vì tuần tự
      const groupsPerPeriod = await Promise.all(
        scopedPeriods.map((p) =>
          api.get(`/groups?periodId=${p._id}`, token)
            .then((res) => ({ period: p, groups: res.data || [] }))
            .catch(() => ({ period: p, groups: [] }))
        )
      );

      const acceptedGroups = [];
      let invitations = [];

      for (const { period, groups: list } of groupsPerPeriod) {
        for (const g of list) {
          const myMemberInfo = g.members?.find(
            (m) => getEntityId(m.studentId) === user?.studentId
          );
          if (!myMemberInfo) continue;
          if (myMemberInfo.status === 'accepted') {
            acceptedGroups.push({ group: g, period });
          } else if (myMemberInfo.status === 'invited') {
            invitations.push({ group: g, period });
          }
        }
      }

      acceptedGroups.sort((a, b) => {
        const groupDiff = (a.group.status === 'draft' ? 0 : 1) - (b.group.status === 'draft' ? 0 : 1);
        if (groupDiff !== 0) return groupDiff;
        return new Date(b.group.createdAt || 0) - new Date(a.group.createdAt || 0);
      });

      setMyGroup(acceptedGroups[0]?.group || null);
      setMyInvitations(invitations);
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriodId, toast, token, user?.studentId]);

  useEffect(() => {
    if (!token || !user) return;
    if (canViewGroupDirectory) {
      fetchPeriods(token);
    } else {
      fetchStudentPeriods();
    }
  }, [canViewGroupDirectory, fetchPeriods, fetchStudentPeriods, token, user]);

  useEffect(() => {
    if (!token || !user) return;
    if (canViewGroupDirectory) {
      fetchAllGroups(selectedPeriodId);
    } else {
      fetchStudentGroupData();
    }
  }, [canViewGroupDirectory, fetchAllGroups, fetchStudentGroupData, selectedPeriodId, token, user]);

  useEffect(() => {
    if (!canViewGroupDirectory || periods.length === 0) return;
    if (staffPeriodOptions.length === 0) {
      if (selectedPeriodId) setSelectedPeriodId('');
      return;
    }
    const hasSelectedPeriod = staffPeriodOptions.some((period) => getEntityId(period) === selectedPeriodId);
    if (!hasSelectedPeriod) {
      setSelectedPeriodId(staffPeriodOptions[0]._id);
    }
  }, [canViewGroupDirectory, periods.length, selectedPeriodId, setSelectedPeriodId, staffPeriodOptions]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm đồ án.');
      return;
    }
    if (!studentPeriods.length) {
      toast.error('Không tìm thấy đợt đồ án đang hoạt động.');
      return;
    }

    const activePeriod = selectedStudentPeriod;
    if (!activePeriod) {
      toast.error('Chưa có đợt đồ án nào đang mở đăng ký nhóm.');
      return;
    }

    if (activePeriod.status !== 'registration_open') {
      toast.error('Học phần này chưa mở đăng ký nhóm.');
      return;
    }

    setCreating(true);
    try {
      await api.post('/groups', {
        periodId: getEntityId(activePeriod),
        name: newGroupName.trim(),
      }, token);
      toast.success('Đã khởi tạo nhóm thành công!');
      setNewGroupName('');
      fetchStudentGroupData();
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteStudentCode.trim()) {
      toast.error('Vui lòng nhập email hoặc mã sinh viên cần mời.');
      return;
    }
    if (!myGroup) return;

    setInviting(true);
    try {
      const identifier = inviteStudentCode.trim();
      const payload = identifier.includes('@')
        ? { email: identifier.toLowerCase() }
        : { studentCode: identifier };
      await api.post(`/groups/${myGroup._id}/invite`, payload, token);
      toast.success('Đã gửi lời mời tham gia nhóm!');
      setInviteStudentCode('');
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
    const acceptedMembersCount = myGroup.members?.filter(m => m.status === 'accepted').length || 0;
    if (acceptedMembersCount < 2) {
      toast.warning('Không thể chốt nhóm: Nhóm đồ án phải có ít nhất 2 thành viên đã xác nhận tham gia.');
      return;
    }
    try {
      await api.post(`/groups/${myGroup._id}/confirm`, {}, token);
      toast.success('Xác nhận chốt danh sách thành viên nhóm thành công!');
      fetchStudentGroupData();
    } catch (err) {
      toast.error(err.message || 'Không thể chốt danh sách nhóm');
    }
  };

  const reloadGroups = () => {
    if (canViewGroupDirectory) fetchAllGroups(selectedPeriodId);
    else fetchStudentGroupData();
  };

  const canInviteMembers = myGroup?.status === 'draft' && getEntityId(myGroup.leaderStudentId) === user?.studentId;

  const visibleGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter((g) => {
      const values = [g.name, g.leaderStudentId?.userId?.fullName, g.leaderStudentId?.userId?.email];
      return values.some((v) => String(v || '').toLowerCase().includes(keyword));
    });
  }, [groups, search]);

  const totalPages = Math.max(1, Math.ceil(visibleGroups.length / pageSize));
  const pagedGroups = visibleGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!canViewGroupDirectory) return;
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) router.replace(nextUrl, { scroll: false });
  }, [canViewGroupDirectory, currentPage, pageSize, pathname, router, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setCurrentPage(1);
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setSearch('');
    setCurrentPage(1);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setCurrentPage(1);
  };

  const handleEditGroup = (group) => {
    setGroupToEdit(group);
    setEditGroupName(group.name || '');
    setEditGroupError('');
  };

  const handleCancelEditGroup = () => {
    if (updatingGroup) return;
    setGroupToEdit(null);
    setEditGroupName('');
    setEditGroupError('');
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!groupToEdit) return;
    const name = editGroupName.trim();
    if (!name) {
      setEditGroupError('Vui lòng nhập tên nhóm mới.');
      return;
    }
    if (name === groupToEdit.name) {
      handleCancelEditGroup();
      return;
    }
    setUpdatingGroup(true);
    try {
      await api.patch(`/groups/${groupToEdit._id}`, { name }, token);
      toast.success('Đã cập nhật nhóm đồ án.');
      setGroupToEdit(null);
      setEditGroupName('');
      setEditGroupError('');
      reloadGroups();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật nhóm');
    } finally {
      setUpdatingGroup(false);
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
      if (
        isStaff &&
        err.status === 400 &&
        String(err.message || '').includes('đề tài/dự án liên kết')
      ) {
        setGroupToDelete(null);
        setGroupToCancelAndDelete(group);
        return;
      }
      toast.error(err.message || 'Không thể xóa nhóm');
    } finally {
      setDeletingGroup(false);
    }
  };

  const handleCancelLinkedWorkAndDeleteGroup = async (group) => {
    setCancellingLinkedWork(true);
    try {
      const result = await api.post(`/groups/${group._id}/cancel-linked-and-delete`, {}, token);
      const counts = result.data
        ? ` Đã hủy ${result.data.cancelledTopics} đề tài và ${result.data.cancelledProjects} dự án liên kết.`
        : '';
      toast.success(`${result.message || 'Đã xóa mềm nhóm đồ án.'}${counts}`);
      setGroupToCancelAndDelete(null);
      reloadGroups();
    } catch (err) {
      toast.error(err.message || 'Không thể hủy liên kết và xóa nhóm');
    } finally {
      setCancellingLinkedWork(false);
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
          {canViewGroupDirectory
            ? isLecturer && !isStaff
              ? 'Xem các nhóm đồ án bạn đang hướng dẫn trong từng học kỳ'
              : 'Xem chi tiết các nhóm thành lập trong từng học kỳ'
            : 'Thành lập nhóm và kết nối với các bạn sinh viên'}
        </p>
      </div>

      {initialLoading ? (
        <div className={css.s5}>
          <Spinner size="lg" />
        </div>
      ) : canViewGroupDirectory ? (
        /* ─── Staff/Lecturer View ─── */
        <div>
          <Card className={css.s47}>
            <div className={css.s48}>
              <div>
                <label className={css.s46}>Năm học</label>
                <select
                  value={staffSchoolYear}
                  onChange={(e) => {
                    setStaffSchoolYear(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={css.s36}
                >
                  <option value="">Tất cả năm học</option>
                  {staffSchoolYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={css.s46}>Học kỳ</label>
                <select
                  value={staffSemester}
                  onChange={(e) => {
                    setStaffSemester(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={css.s36}
                >
                  <option value="">Tất cả học kỳ</option>
                  {SEMESTER_OPTIONS.map((semester) => (
                    <option key={semester.value} value={semester.value}>{semester.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={css.s46}>Học phần / đợt đồ án</label>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => {
                    setSelectedPeriodId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={css.s36}
                >
                  {staffPeriodOptions.length === 0 ? (
                    <option value="">Không có học phần phù hợp</option>
                  ) : staffPeriodOptions.map((p) => (
                    <option key={p._id} value={p._id}>
                      {getPeriodLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <FilterCard
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            onSearch={handleSearchSubmit}
            onReset={handleResetSearch}
            placeholder="Tìm theo tên nhóm, trưởng nhóm..."
            hasFilters={false}
          />
          {refreshing && (
            <div className={css.s49}>
              <Spinner size="sm" /> Đang cập nhật danh sách nhóm...
            </div>
          )}

          {periods.length === 0 ? (
            <Card>
              <div className={css.s8}>
                Chưa có đợt đồ án nào được tạo trong hệ thống. Vui lòng tạo đợt đồ án trước khi quản lý nhóm đồ án.
              </div>
            </Card>
          ) : visibleGroups.length === 0 ? (
            <EmptyState
              title={search ? 'Không tìm thấy kết quả' : 'Chưa có nhóm nào'}
              description={search ? `Không tìm thấy kết quả cho từ khóa "${search}".` : 'Chưa có nhóm nào được đăng ký trong đợt này.'}
              icon={Users}
            />
          ) : (
            <div className={css.s9}>
              {pagedGroups.map((g) => {
                const statusInfo = getStatus(g.status);
                return (
                  <Card key={g._id} title={g.name} subtitle={`Trưởng nhóm: ${g.leaderStudentId?.userId?.fullName || 'Không rõ'}`}
                    actions={
                      <div className={css.s10}>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {isStaff && (
                          <>
                            <Button variant="secondary" size="sm" onClick={() => handleEditGroup(g)}>
                              <PencilSimple size={14} /> Sửa
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => setGroupToDelete(g)}>
                              <Trash size={14} /> Xóa
                            </Button>
                          </>
                        )}
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
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
                totalItems={visibleGroups.length}
              />
            </div>
          )}
        </div>
      ) : (
        /* ─── Student View ─── */
        <div>
          <Card className={css.s47} title="Chọn học phần" subtitle="Chỉ hiển thị các học phần có tên bạn trong danh sách đăng ký">
            {studentPeriods.length === 0 ? (
              <p className={css.s33}>Bạn chưa có học phần nào trong danh sách đăng ký.</p>
            ) : (
              <select
                value={selectedPeriodId}
                onChange={(e) => {
                  setSelectedPeriodId(e.target.value);
                  setCurrentPage(1);
                }}
                className={css.s36}
              >
                {studentPeriods.map((period) => (
                  <option key={period._id} value={period._id}>
                    {getPeriodLabel(period)}
                  </option>
                ))}
              </select>
            )}
          </Card>
          {refreshing && (
            <div className={css.s49}>
              <Spinner size="sm" /> Đang cập nhật nhóm của học phần...
            </div>
          )}

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

          {studentPeriods.length === 0 ? (
            <EmptyState
              title="Chưa có học phần"
              description="Bạn chưa có tên trong danh sách đăng ký học phần nào nên chưa thể tạo nhóm."
              icon={Users}
            />
          ) : myGroup ? (
            /* Student has group */
            <Card title={myGroup.name} subtitle={`Mã nhóm: ${myGroup._id}`}
              actions={
                <div className={css.s21}>
                  <Badge variant={getStatus(myGroup.status).variant}>{getStatus(myGroup.status).label}</Badge>
                  {myGroup.status === 'draft' && getEntityId(myGroup.leaderStudentId) === user?.studentId && (
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
              {canInviteMembers && (
                <div className={css.s28}>
                  <h4 className={css.s29}>
                    Mời thành viên mới
                  </h4>
                  <form onSubmit={handleInvite} className={css.s30} noValidate>
                    <Input
                      label="Email hoặc mã sinh viên"
                      name="inviteStudentCode"
                      value={inviteStudentCode}
                      onChange={(e) => setInviteStudentCode(e.target.value)}
                      placeholder="Ví dụ: namnv@hust.edu.vn hoặc 22021435"
                      className={css.s37}
                    />
                    <Button variant="primary" type="submit" loading={inviting} className={css.s31}>
                      <UserPlus size={16} /> Gửi lời mời
                    </Button>
                  </form>
                  <p className={css.s45}>Nhập email hoặc MSSV của bạn cùng lớp học phần. Hệ thống sẽ tự kiểm tra sinh viên đó có trong danh sách học phần và chưa thuộc nhóm khác.</p>
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
                <form onSubmit={handleCreateGroup} className={css.s34} noValidate>
                  <Input
                    label="Tên nhóm đồ án"
                    name="newGroupName"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Ví dụ: Nhóm Nghiên cứu AI K65"
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
      {groupToEdit && (
        <div
          role="presentation"
          className={css.s38}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleCancelEditGroup();
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-group-title"
            className={css.s39}
            onSubmit={handleUpdateGroup}
            noValidate
          >
            <div className={css.s40}>
              <h3 id="edit-group-title" className={css.s41}>
                Sửa tên nhóm
              </h3>
              <p className={css.s42}>
                Cập nhật tên nhóm đồ án đang hiển thị trong danh sách.
              </p>
            </div>
            <Input
              label="Tên nhóm mới"
              name="editGroupName"
              value={editGroupName}
              onChange={(e) => {
                setEditGroupName(e.target.value);
                if (editGroupError) setEditGroupError('');
              }}
              placeholder="Nhập tên nhóm mới"
              error={editGroupError}
              autoFocus
            />
            <div className={css.s43}>
              <Button type="button" variant="secondary" onClick={handleCancelEditGroup} disabled={updatingGroup}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" loading={updatingGroup}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
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
      <ConfirmDialog
        open={Boolean(groupToCancelAndDelete)}
        title="Hủy liên kết và xóa nhóm"
        message={groupToCancelAndDelete ? `Nhóm "${groupToCancelAndDelete.name}" đã có đề tài/dự án liên kết. Thao tác này sẽ hủy và xóa mềm đề tài/dự án liên quan, sau đó xóa mềm nhóm.` : ''}
        confirmLabel="Hủy & xóa mềm"
        loading={cancellingLinkedWork}
        onCancel={() => setGroupToCancelAndDelete(null)}
        onConfirm={() => handleCancelLinkedWorkAndDeleteGroup(groupToCancelAndDelete)}
      />
    </div>
  );
}
