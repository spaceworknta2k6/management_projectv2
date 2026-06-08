import api from './api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const authService = {
  /**
   * POST /auth/login
   * @returns {{ data: { accessToken, user } }}
   */
  login: (email, password) => api.post('/auth/login', { email, password }),

  /**
   * GET /auth/me — fetch current user profile
   */
  me: (token) => api.get('/auth/me', token),

  /**
   * PATCH /auth/me — update current user profile
   */
  updateMe: (profile, token) => api.patch('/auth/me', profile, token),

  /**
   * PATCH /auth/me/avatar — upload current user avatar
   */
  updateAvatar: async (file, token) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(`${BASE_URL}/auth/me/avatar`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || 'Không thể cập nhật ảnh đại diện.');
      error.status = res.status;
      throw error;
    }

    return data;
  },

  /**
   * POST /auth/logout (if backend supports it)
   */
  logout: (token) => api.post('/auth/logout', {}, token),

  /**
   * GET /auth/google/session — consume one-time Google login code
   */
  googleSession: (code) => api.get(`/auth/google/session?code=${encodeURIComponent(code)}`),
};
