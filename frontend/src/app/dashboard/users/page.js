'use client';

import { useEffect, useState, useCallback } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { formatDate, getRoleLabel, getTechnicalLabel } from '@/lib/utils';
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

const ROLE_OPTIONS = [
  { value: 'SYSTEM_ADMIN', label: 'Quản trị viên', badge: 'error' },
  { value: 'FACULTY_STAFF', label: 'Giáo vụ Khoa', badge: 'warning' },
  { value: 'DEPARTMENT_STAFF', label: 'Giáo vụ Bộ môn', badge: 'info' },
  { value: 'LECTURER', label: 'Giảng viên', badge: 'neutral' },
  { value: 'STUDENT', label: 'Sinh viên', badge: 'success' }
];

export default function UsersPage() {
  const { token, user: currentUser } = useAuthStore();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 10 });

  // Filters State
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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
        limit: '10'
      });

      const res = await api.get(`/users?${queryParams.toString()}`, token);
      setUsers(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  }, [token, search, roleFilter, statusFilter, currentPage, toast]);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, fetchUsers]);

  // Handle Search and Filter Resets
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
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
      toast.error(err.message || 'Lỗi khi cập nhật thông tin tài khoản');
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
      toast.error(err.message || 'Không thể xóa tài khoản');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={28} style={{ color: 'var(--accent)' }} />
            Quản lý tài khoản & Phân quyền
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Gán vai trò hệ thống, khóa (ban), và quản lý trạng thái hoạt động của thành viên
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchUsers} icon={<ArrowsClockwise size={16} />}>
          Làm mới
        </Button>
      </div>

      {/* Search & Filters */}
      <Card style={{ marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <Input
              label="Tìm kiếm người dùng"
              placeholder="Nhập tên hoặc email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              icon={<MagnifyingGlass size={16} />}
            />
          </div>

          <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Vai trò</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                height: '40px',
                padding: '0 12px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
              }}
            >
              <option value="">Tất cả vai trò</option>
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                height: '40px',
                padding: '0 12px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Kích hoạt</option>
              <option value="inactive">Không hoạt động</option>
              <option value="locked">Đã khóa</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="primary" type="submit" style={{ height: '40px' }} icon={<MagnifyingGlass size={16} />}>
              Tìm kiếm
            </Button>
            {(search || roleFilter || statusFilter) && (
              <Button variant="ghost" type="button" onClick={handleResetFilters} style={{ height: '40px' }}>
                Xóa lọc
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Users Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Không tìm thấy tài khoản nào khớp với bộ lọc tìm kiếm.
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-sunken)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Họ và tên</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vai trò</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Trạng thái</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Ngày tạo</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = currentUser && currentUser._id.toString() === item._id.toString();
                  return (
                    <tr key={item._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                      <td style={{ padding: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.fullName}
                          {isSelf && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 600 }}>Tôi</span>}
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{item.email}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {item.roles?.map(r => (
                            <Badge key={r} variant={getRoleBadgeVariant(r)}>{getRoleLabel(r)}</Badge>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>{getStatusBadge(item.status)}</td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{formatDate(item.createdAt)}</td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
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
            currentItemCount={users.length}
            itemLabel={'t\u00e0i kho\u1ea3n'}
            onPageChange={setCurrentPage}
            style={{ backgroundColor: 'var(--surface-sunken)' }}
          />
        </Card>
      )}

      {/* Edit Roles & Status Modal */}
      {showEditModal && selectedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            width: '100%', maxWidth: '500px',
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
                Phân quyền & Cấu hình tài khoản
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveUser} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedUser.fullName}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedUser.email}</p>
              </div>

              {/* Roles Section */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Vai trò (Roles)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ROLE_OPTIONS.map(opt => {
                    const isChecked = editRoles.includes(opt.value);
                    return (
                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRoleToggle(opt.value)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Section */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Trạng thái tài khoản (Status)
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={editStatus === 'active'}
                      onChange={() => setEditStatus('active')}
                      style={{ cursor: 'pointer' }}
                    />
                    Kích hoạt
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={editStatus === 'inactive'}
                      onChange={() => setEditStatus('inactive')}
                      style={{ cursor: 'pointer' }}
                    />
                    Không hoạt động
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="status"
                      value="locked"
                      checked={editStatus === 'locked'}
                      onChange={() => setEditStatus('locked')}
                      style={{ cursor: 'pointer' }}
                    />
                    Khóa tài khoản
                  </label>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={submitting}>Lưu thay đổi</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            width: '100%', maxWidth: '440px',
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '24px 24px 12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                padding: '8px', borderRadius: '50%', backgroundColor: 'var(--error-bg)', color: 'var(--error)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Warning size={24} weight="fill" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Xác nhận xóa tài khoản?
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Bạn có chắc chắn muốn xóa tài khoản của sinh viên/giảng viên <strong>{selectedUser.fullName} ({selectedUser.email})</strong>? 
                  Hành động này sẽ thực hiện soft-delete tài khoản này và hồ sơ liên quan của họ.
                </p>
              </div>
            </div>

            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'var(--surface-sunken)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Hủy</Button>
              <Button variant="danger" onClick={handleDeleteConfirm} loading={submitting}>Đồng ý xóa</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
