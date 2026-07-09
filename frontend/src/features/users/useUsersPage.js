'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import { useToast } from '@/components/ui/Toast';
import { handleApiError } from '@/lib/utils';
import {
  DEFAULT_FILTERS,
  getInitialUsersQuery,
} from './users.constants';
import {
  deleteUserAccount,
  fetchUsersList,
  updateUserRoles,
  updateUserStatus,
} from './users.api';

function didRolesChange(previousRoles = [], nextRoles = []) {
  return JSON.stringify(previousRoles) !== JSON.stringify(nextRoles);
}

export default function useUsersPage() {
  const { token, user: currentUser } = useAuthStore();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const initialQuery = useMemo(() => getInitialUsersQuery(), []);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    page: initialQuery.page,
    pages: 1,
    limit: initialQuery.limit,
  });

  const [searchInput, setSearchInput] = useState(initialQuery.filters.search);
  const [search, setSearch] = useState(initialQuery.filters.search);
  const [roleFilter, setRoleFilter] = useState(initialQuery.filters.role);
  const [statusFilter, setStatusFilter] = useState(initialQuery.filters.status);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editRoles, setEditRoles] = useState([]);
  const [editStatus, setEditStatus] = useState('active');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsersList({
        token,
        search,
        role: roleFilter,
        status: statusFilter,
        page: currentPage,
        limit: pageSize,
      });

      setUsers(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, roleFilter, search, statusFilter, toast, token]);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [fetchUsers, token]);

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

  const handleSearchSubmit = (event) => {
    event.preventDefault();
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

  const handleRoleToggle = (roleValue) => {
    if (editRoles.includes(roleValue)) {
      setEditRoles(editRoles.filter((role) => role !== roleValue));
      return;
    }

    setEditRoles([...editRoles, roleValue]);
  };

  const handleSaveUser = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;

    if (editRoles.length === 0) {
      toast.error('Tài khoản phải có ít nhất một vai trò.');
      return;
    }

    setSubmitting(true);
    try {
      const updates = [];

      if (didRolesChange(selectedUser.roles, editRoles)) {
        updates.push(updateUserRoles({ token, userId: selectedUser._id, roles: editRoles }));
      }

      if (selectedUser.status !== editStatus) {
        updates.push(updateUserStatus({ token, userId: selectedUser._id, status: editStatus }));
      }

      if (updates.length > 0) {
        await Promise.all(updates);
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

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      await deleteUserAccount({ token, userId: selectedUser._id });
      toast.success(`Đã xóa tài khoản ${selectedUser.email} thành công!`);
      setShowDeleteModal(false);
      fetchUsers();
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setSubmitting(false);
    }
  };

  return {
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
    pageSize,
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
  };
}
