'use client';

import {
  ArrowsClockwise,
  PencilSimple,
  ShieldCheck,
  Trash,
  Users,
  Warning,
  X,
} from '@phosphor-icons/react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import FilterCard from '@/components/ui/FilterCard';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import useUsersPage from '@/features/users/useUsersPage';
import { PAGE_SIZE_OPTIONS, ROLE_OPTIONS } from '@/features/users/users.constants';
import { formatDate, getRoleLabel, getTechnicalLabel } from '@/lib/utils';
import css from './page.module.css';

function getRoleBadgeVariant(role) {
  const option = ROLE_OPTIONS.find((item) => item.value === role);
  return option ? option.badge : 'neutral';
}

function getStatusBadge(status) {
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
}

export default function UsersPage() {
  const {
    currentPage,
    currentUser,
    editRoles,
    editStatus,
    fetchUsers,
    handleDeleteConfirm,
    handleOpenDelete,
    handleOpenEdit,
    handlePageSizeChange,
    handleResetFilters,
    handleRoleToggle,
    handleSaveUser,
    handleSearchSubmit,
    loading,
    pagination,
    roleFilter,
    searchInput,
    selectedUser,
    setCurrentPage,
    setEditStatus,
    setRoleFilter,
    setSearchInput,
    setShowDeleteModal,
    setShowEditModal,
    setStatusFilter,
    showDeleteModal,
    showEditModal,
    statusFilter,
    submitting,
    users,
  } = useUsersPage();

  return (
    <div>
      <div className={css.s1}>
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <Users size={28} className={css.s3} />
            Quản lý tài khoản & Phân quyền
          </h1>
          <p className={css.s4}>
            Gán vai trò hệ thống, khóa tài khoản, và quản lý trạng thái hoạt động của thành viên
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchUsers} icon={<ArrowsClockwise size={16} />}>
          Làm mới
        </Button>
      </div>

      <FilterCard
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearch={handleSearchSubmit}
        onReset={handleResetFilters}
        placeholder="Tìm kiếm theo tên hoặc email..."
        hasFilters
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Vai trò</label>
          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
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
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
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
                          {item.roles?.map((role) => (
                            <Badge key={role} variant={getRoleBadgeVariant(role)}>{getRoleLabel(role)}</Badge>
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
            itemLabel="tài khoản"
            onPageChange={setCurrentPage}
            className={css.s38}
          />
        </Card>
      )}

      {showEditModal && selectedUser && (
        <div className={css.s39}>
          <div className={css.s40}>
            <div className={css.s41}>
              <h3 className={css.s42}>
                <ShieldCheck size={20} className={css.s43} />
                Phân quyền & Cấu hình tài khoản
              </h3>
              <button type="button" onClick={() => setShowEditModal(false)} className={css.s65}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className={css.s44}>
              <div>
                <p className={css.s45}>{selectedUser.fullName}</p>
                <p className={css.s46}>{selectedUser.email}</p>
              </div>

              <div>
                <label className={css.s47}>
                  Vai trò (Roles)
                </label>
                <div className={css.s48}>
                  {ROLE_OPTIONS.map((option) => {
                    const isChecked = editRoles.includes(option.value);
                    return (
                      <label key={option.value} className={css.s49}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRoleToggle(option.value)}
                          className={css.s66}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </div>

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
                      onChange={() => setEditStatus('active')}
                      className={css.s67}
                    />
                    Kích hoạt
                  </label>
                  <label className={css.s53}>
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={editStatus === 'inactive'}
                      onChange={() => setEditStatus('inactive')}
                      className={css.s68}
                    />
                    Không hoạt động
                  </label>
                  <label className={css.s54}>
                    <input
                      type="radio"
                      name="status"
                      value="locked"
                      checked={editStatus === 'locked'}
                      onChange={() => setEditStatus('locked')}
                      className={css.s69}
                    />
                    Khóa tài khoản
                  </label>
                </div>
              </div>

              <div className={css.s55}>
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>Hủy</Button>
                <Button variant="primary" type="submit" loading={submitting}>Lưu thay đổi</Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  Bạn có chắc chắn muốn xóa tài khoản của sinh viên/giảng viên <strong>{selectedUser.fullName} ({selectedUser.email})</strong>? Hành động này sẽ thực hiện soft-delete tài khoản này và hồ sơ liên quan của họ.
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
