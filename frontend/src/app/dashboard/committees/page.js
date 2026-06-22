'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatDate, getTechnicalLabel, hasAnyRole } from '@/lib/utils';
import { Gavel, Plus, ArrowsClockwise, Users, Trash, CheckCircle, PlayCircle, PencilSimple, MagnifyingGlass } from '@phosphor-icons/react';
import css from './page.module.css';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

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

export default function CommitteesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token } = useAuthStore();
  const toast = useToast();

  const initialQuery = useMemo(() => getInitialQuery(), []);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [search, setSearch] = useState(initialQuery.search);
  
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
    
    if (!form.periodId) {
      toast.error('Vui lòng chọn đợt đồ án');
      return;
    }
    if (!form.name || !form.name.trim()) {
      toast.error('Vui lòng nhập tên hội đồng');
      return;
    }
    if (form.members.length < 3) {
      toast.error('Hội đồng phải có ít nhất 3 thành viên');
      return;
    }
    
    for (let i = 0; i < form.members.length; i++) {
      const member = form.members[i];
      if (!member.lecturerId) {
        toast.error(`Vui lòng chọn giảng viên cho thành viên thứ ${i + 1}`);
        return;
      }
      if (!member.role) {
        toast.error(`Vui lòng chọn vai trò cho thành viên thứ ${i + 1}`);
        return;
      }
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

  const isStaff = hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF']);

  const visibleCommittees = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return committees;
    return committees.filter((c) => {
      const values = [c.name, c.periodId?.name];
      return values.some((v) => String(v || '').toLowerCase().includes(keyword));
    });
  }, [committees, search]);

  const totalPages = Math.max(1, Math.ceil(visibleCommittees.length / pageSize));
  const pagedCommittees = visibleCommittees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) router.replace(nextUrl, { scroll: false });
  }, [currentPage, pageSize, pathname, router, search]);

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

  return (
    <div>
      {loading ? (
        <div className={css.s1}><Spinner size="lg" /></div>
      ) : (
        <>
      <div className={css.s2}>
        <div>
          <h1 className={`text-display ${css.s3}`}>
            <Gavel size={28} className={css.s4} />
            Quản lý Hội đồng
          </h1>
          <p className={css.s5}>
            Thành lập và phân công thành viên Hội đồng đánh giá đồ án
          </p>
        </div>
        
        <div className={css.s6}>
          <Button variant="outline" onClick={fetchData} icon={<ArrowsClockwise />} title="Làm mới" />
          {isStaff && (
            <Button variant="primary" icon={<Plus />} onClick={openCreateModal}>
              Tạo hội đồng
            </Button>
          )}
        </div>
      </div>

      <FilterCard
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearch={handleSearchSubmit}
        onReset={handleResetSearch}
        placeholder="Tìm theo tên hội đồng, đợt..."
      />

      <div className={css.s7}>
        {pagedCommittees.map((committee) => (
          <Card key={committee._id} className={css.s8}>
            <div className={css.s9}>
              <div>
                <h3 className={css.s10}>
                  {committee.name}
                </h3>
                <div className={css.s11}>
                  Đợt: {committee.periodId?.name || 'Không xác định'}
                </div>
              </div>
              {getStatusBadge(committee.status)}
            </div>

            <div className={css.s12}>
              <div className={css.s13}>
                <Users size={16} />
                <span>Thành viên ({committee.members?.length || 0})</span>
              </div>
              
              <div className={css.s14}>
                {committee.members?.map((m, idx) => {
                  const lecturerInfo = getLecturerDisplay(m);
                  return (
                    <div key={idx} className={css.s15}>
                      <div className={css.s16}>
                        <span className={css.s17}>
                          {lecturerInfo.fullName}
                        </span>
                        <span className={css.s18}>
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
            
            <div className={css.s19}>
              Tạo lúc: {formatDate(committee.createdAt)}
            </div>

            {isStaff && (
              <div className={css.s20}>
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

        {visibleCommittees.length === 0 && (
          <div className={css.s21}>
            {search ? `Không tìm thấy kết quả cho "${search}".` : 'Chưa có hội đồng nào được tạo'}
          </div>
        )}
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
        totalItems={visibleCommittees.length}
      />

      {/* Modal Tạo Hội đồng */}
      {showModal && (
        <div className={css.s22}>
          <div className={css.s23}>
            <div className={css.s24}>
              <h2 className={css.s25}>{editingCommittee ? 'Chỉnh sửa Hội đồng' : 'Tạo Hội đồng Đánh giá mới'}</h2>
            </div>
            
            <div className={css.s26}>
              <form id="committee-form" onSubmit={handleSubmit} className={css.s27}>
                <div>
                  <label className={css.s28}>Thuộc Đợt đồ án *</label>
                  <select
                    value={form.periodId}
                    onChange={(e) => setForm({...form, periodId: e.target.value})} className={css.s39}
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
                />
                
                <div className={css.s29}>
                  <div className={css.s30}>
                    <label className={css.s31}>
                      Thành viên Hội đồng * (Tối thiểu 3)
                    </label>
                    <Button variant="outline" size="sm" type="button" onClick={handleAddMember} icon={<Plus />}>
                      Thêm
                    </Button>
                  </div>
                  
                  {form.members.length === 0 ? (
                    <div className={css.s32}>
                      Chưa có thành viên nào. Vui lòng thêm ít nhất 3 thành viên.
                    </div>
                  ) : (
                    <div className={css.s33}>
                      {form.members.map((member, index) => (
                        <div key={index} className={css.s34}>
                          <div className={css.s35}>
                            <select
                              value={member.lecturerId}
                              onChange={(e) => handleMemberChange(index, 'lecturerId', e.target.value)} className={css.s40}
                            >
                              <option value="">-- Chọn Giảng viên --</option>
                              {lecturers.map(l => (
                                <option key={l._id} value={l._id}>
                                  {l.userId?.fullName} ({l.lecturerCode})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={css.s36}>
                            <select
                              value={member.role}
                              onChange={(e) => handleMemberChange(index, 'role', e.target.value)} className={css.s41}
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
                              className={css.s37}
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
            
            <div className={css.s38}>
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
        </>
      )}
    </div>
  );
}
