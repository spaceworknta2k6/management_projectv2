'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import FilterCard from '@/components/ui/FilterCard';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { formatDate, getRoleLabel, getTechnicalLabel, handleApiError } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';
import { 
  Users, 
  ArrowsClockwise, 
  PencilSimple, 
  Trash, 
  Funnel, 
  MagnifyingGlass, 
  ShieldCheck,
  Warning,
  Lock,
  CheckCircle,
  Eye,
  X
} from '@phosphor-icons/react';
import css from './page.module.css';

const ROLE_OPTIONS = [
  { value: 'SYSTEM_ADMIN', label: 'Quản trị viên', badge: 'error' },
  { value: 'FACULTY_STAFF', label: 'Giáo vụ Khoa', badge: 'warning' },
  { value: 'LECTURER', label: 'Giảng viên', badge: 'neutral' },
  { value: 'STUDENT', label: 'Sinh viên', badge: 'success' }
];

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_FILTERS = {
  search: '',
  role: '',
  status: '',
};

function getSafePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getSafePageSize(value) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : PAGE_SIZE;
}

function getInitialUsersQuery() {
  if (typeof window === 'undefined') {
    return {
      page: 1,
      limit: PAGE_SIZE,
      filters: DEFAULT_FILTERS,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    page: getSafePositiveInt(params.get('page'), 1),
    limit: getSafePageSize(params.get('limit')),
    filters: {
      search: params.get('search') || '',
      role: params.get('role') || '',
      status: params.get('status') || '',
    },
  };
}

export default function UsersPage() {
  const { token, user: currentUser } = useAuthStore();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const initialQuery = useMemo(() => getInitialUsersQuery(), []);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: initialQuery.page, pages: 1, limit: initialQuery.limit });

  // Filters State
  const [searchInput, setSearchInput] = useState(initialQuery.filters.search);
  const [search, setSearch] = useState(initialQuery.filters.search);
  const [roleFilter, setRoleFilter] = useState(initialQuery.filters.role);
  const [statusFilter, setStatusFilter] = useState(initialQuery.filters.status);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);

  // Modals State
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit Form State
  const [editRoles, setEditRoles] = useState([]);
  const [editStatus, setEditStatus] = useState('active');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        search,
        role: roleFilter,
        status: statusFilter,
        page: currentPage.toString(),
        limit: String(pageSize)
      });

      const res = await api.get(`/users?${queryParams.toString()}`, token);
      setUsers(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setLoading(false);
    }
  }, [token, search, roleFilter, statusFilter, currentPage, pageSize, toast]);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, fetchUsers]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    if (roleFilter.trim()) params.set('role', roleFilter.trim());
    if (statusFilter.trim()) params.set('status', statusFilter.trim());

    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [currentPage, pageSize, pathname, roleFilter, router, search, statusFilter]);

  // Handle Search and Filter Resets
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput);
  };

  const handleResetFilters = () => {
    setSearchInput(DEFAULT_FILTERS.search);
    setSearch(DEFAULT_FILTERS.search);
    setRoleFilter(DEFAULT_FILTERS.role);
    setStatusFilter(DEFAULT_FILTERS.status);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (nextPageSize) => {
    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  // Open Modals
  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setEditRoles(user.roles || []);
    setEditStatus(user.status || 'active');
    setShowEditModal(true);
  };

  const handleOpenDelete = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  // Toggle role checked state in modal
  const handleRoleToggle = (roleValue) => {
    if (editRoles.includes(roleValue)) {
      setEditRoles(editRoles.filter(r => r !== roleValue));
    } else {
      setEditRoles([...editRoles, roleValue]);
    }
  };

  // Submit Updates
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (editRoles.length === 0) {
      toast.error('Tài khoản phải có ít nhất một vai trò.');
      return;
    }

    setSubmitting(true);
    try {
      const promises = [];

      // Check if roles changed
      const rolesChanged = JSON.stringify(selectedUser.roles) !== JSON.stringify(editRoles);
      if (rolesChanged) {
        promises.push(api.patch(`/users/${selectedUser._id}/role`, { roles: editRoles }, token));
      }

      // Check if status changed
      if (selectedUser.status !== editStatus) {
        promises.push(api.patch(`/users/${selectedUser._id}/status`, { status: editStatus }, token));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        toast.success(`Cập nhật thông tin tài khoản ${selectedUser.email} thành công!`);
        setShowEditModal(false);
        fetchUsers();
      } else {
        setShowEditModal(false);
      }
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setSubmitting(false);
    }
  };

  // Soft Delete User
  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await api.delete(`/users/${selectedUser._id}`, token);
      toast.success(`Đã xóa tài khoản ${selectedUser.email} thành công!`);
      setShowDeleteModal(false);
      fetchUsers();
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadgeVariant = (role) => {
    const opt = ROLE_OPTIONS.find(o => o.value === role);
    return opt ? opt.badge : 'neutral';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Kích hoạt</Badge>;
      case 'locked':
        return <Badge variant="error">Đã khóa</Badge>;
      case 'inactive':
        return <Badge variant="warning">Không hoạt động</Badge>;
      default:
        return <Badge>{getTechnicalLabel(status)}</Badge>;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className={css.s1}>
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <Users size={28} className={css.s3} />
            Quản lý tài khoản & Phân quyền
          </h1>
          <p className={css.s4}>
            Gán vai trò hệ thống, khóa (ban), và quản lý trạng thái hoạt động của thành viên
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchUsers} icon={<ArrowsClockwise size={16} />}>
          Làm mới
        </Button>
      </div>

      {/* Search & Filters */}
      <FilterCard
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearch={handleSearchSubmit}
        onReset={handleResetFilters}
        placeholder="Tìm kiếm theo tên hoặc email..."
        hasFilters={true}
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Vai trò</label>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            <option value="">Tất cả vai trò</option>
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Kích hoạt</option>
            <option value="inactive">Không hoạt động</option>
            <option value="locked">Đã khóa</option>
          </select>
        </div>
      </FilterCard>

      {/* Users Table */}
      {loading ? (
        <div className={css.s15}>
          <Spinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title="Không tìm thấy tài khoản"
          description="Không tìm thấy tài khoản nào khớp với bộ lọc tìm kiếm."
          icon={Users}
        />
      ) : (
        <Card className={css.s17}>
          <div className={css.s18}>
            <table className={css.s19}>
              <thead>
                <tr className={css.s20}>
                  <th className={css.s21}>Họ và tên</th>
                  <th className={css.s22}>Email</th>
                  <th className={css.s23}>Vai trò</th>
                  <th className={css.s24}>Trạng thái</th>
                  <th className={css.s25}>Ngày tạo</th>
                  <th className={css.s26}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = currentUser && currentUser._id.toString() === item._id.toString();
                  return (
                    <tr key={item._id} className={css.s27}>
                      <td className={css.s28}>
                        <div className={css.s29}>
                          {item.fullName}
                          {isSelf && <span className={css.s30}>Tôi</span>}
                        </div>
                      </td>
                      <td className={css.s31}>{item.email}</td>
                      <td className={css.s32}>
                        <div className={css.s33}>
                          {item.roles?.map(r => (
                            <Badge key={r} variant={getRoleBadgeVariant(r)}>{getRoleLabel(r)}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className={css.s34}>{getStatusBadge(item.status)}</td>
                      <td className={css.s35}>{formatDate(item.createdAt)}</td>
                      <td className={css.s36}>
                        <div className={css.s37}>
                          <Button
                            variant="secondary"
                            size="sm"
                            title="Chỉnh sửa vai trò và trạng thái"
                            onClick={() => handleOpenEdit(item)}
                            icon={<PencilSimple size={16} />}
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            title="Xóa tài khoản"
                            disabled={isSelf}
                            onClick={() => handleOpenDelete(item)}
                            icon={<Trash size={16} />}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            compact
            currentPage={currentPage}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            pageSize={pagination.limit}
            currentItemCount={users.length}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={handlePageSizeChange}
            isLoading={loading}
            itemLabel={'t\u00e0i kho\u1ea3n'}
            onPageChange={setCurrentPage} className={css.s38} />
        </Card>
      )}

      {/* Edit Roles & Status Modal */}
      {showEditModal && selectedUser && (
        <div className={css.s39}>
          <div className={css.s40}>
            <div className={css.s41}>
              <h3 className={css.s42}>
                <ShieldCheck size={20} className={css.s43} />
                Phân quyền & Cấu hình tài khoản
              </h3>
              <button onClick={() => setShowEditModal(false)} className={css.s65}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveUser} className={css.s44}>
              <div>
                <p className={css.s45}>{selectedUser.fullName}</p>
                <p className={css.s46}>{selectedUser.email}</p>
              </div>

              {/* Roles Section */}
              <div>
                <label className={css.s47}>
                  Vai trò (Roles)
                </label>
                <div className={css.s48}>
                  {ROLE_OPTIONS.map(opt => {
                    const isChecked = editRoles.includes(opt.value);
                    return (
                      <label key={opt.value} className={css.s49}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRoleToggle(opt.value)} className={css.s66} />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Section */}
              <div>
                <label className={css.s50}>
                  Trạng thái tài khoản (Status)
                </label>
                <div className={css.s51}>
                  <label className={css.s52}>
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={editStatus === 'active'}
                      onChange={() => setEditStatus('active')} className={css.s67} />
                    Kích hoạt
                  </label>
                  <label className={css.s53}>
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={editStatus === 'inactive'}
                      onChange={() => setEditStatus('inactive')} className={css.s68} />
                    Không hoạt động
                  </label>
                  <label className={css.s54}>
                    <input
                      type="radio"
                      name="status"
                      value="locked"
                      checked={editStatus === 'locked'}
                      onChange={() => setEditStatus('locked')} className={css.s69} />
                    Khóa tài khoản
                  </label>
                </div>
              </div>

              {/* Action buttons */}
              <div className={css.s55}>
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={submitting}>Lưu thay đổi</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className={css.s56}>
          <div className={css.s57}>
            <div className={css.s58}>
              <div className={css.s59}>
                <Warning size={24} weight="fill" />
              </div>
              <div>
                <h3 className={css.s60}>
                  Xác nhận xóa tài khoản?
                </h3>
                <p className={css.s61}>
                  Bạn có chắc chắn muốn xóa tài khoản của sinh viên/giảng viên <strong>{selectedUser.fullName} ({selectedUser.email})</strong>? 
                  Hành động này sẽ thực hiện soft-delete tài khoản này và hồ sơ liên quan của họ.
                </p>
              </div>
            </div>

            <div className={css.s62}>
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Hủy</Button>
              <Button variant="danger" onClick={handleDeleteConfirm} loading={submitting}>Đồng ý xóa</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
