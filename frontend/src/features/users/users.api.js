import api from '@/services/api';

export function fetchUsersList({ token, search, role, status, page, limit }) {
  const queryParams = new URLSearchParams({
    search,
    role,
    status,
    page: page.toString(),
    limit: String(limit),
  });

  return api.get(`/users?${queryParams.toString()}`, token);
}

export function updateUserRoles({ token, userId, roles }) {
  return api.patch(`/users/${userId}/role`, { roles }, token);
}

export function updateUserStatus({ token, userId, status }) {
  return api.patch(`/users/${userId}/status`, { status }, token);
}

export function deleteUserAccount({ token, userId }) {
  return api.delete(`/users/${userId}`, token);
}
