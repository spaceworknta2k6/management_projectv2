import api from './api';

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
   * POST /auth/logout (if backend supports it)
   */
  logout: (token) => api.post('/auth/logout', {}, token),
};
