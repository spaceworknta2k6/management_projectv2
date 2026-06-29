import useAuthStore from '@/store/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(null, token));
  refreshSubscribers = [];
}

function onRefreshFailed(error) {
  refreshSubscribers.forEach((cb) => cb(error));
  refreshSubscribers = [];
}

/**
 * Core fetch function with automatic JWT token refresh.
 * @param {string} path  - e.g. '/auth/login'
 * @param {RequestInit & { token?: string }} options
 */
async function request(path, { token, ...options } = {}) {
  const state = useAuthStore.getState();
  const currentToken = token || state.token;

  const headers = {
    'Content-Type': 'application/json',
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    ...(options.headers || {}),
  };

  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  let data = await res.json().catch(() => ({}));

  // Auto-refresh token on 401 Unauthorized
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newToken = refreshData.data?.accessToken;
          if (newToken) {
            state.setAuth(newToken, state.user);
            onRefreshed(newToken);
            isRefreshing = false;

            // Retry original request with new token
            const retryHeaders = {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            };
            res = await fetch(`${BASE_URL}${path}`, {
              ...options,
              credentials: 'include',
              headers: retryHeaders,
            });
            data = await res.json().catch(() => ({}));
          } else {
            throw new Error('Invalid refresh response');
          }
        } else {
          throw new Error('Refresh token expired');
        }
      } catch (refreshErr) {
        isRefreshing = false;
        state.logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
        const error = new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
        error.status = 401;
        onRefreshFailed(error);
        throw error;
      }
    } else {
      // Queue requests until token is refreshed
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(async (refreshError, newToken) => {
          if (refreshError) {
            reject(refreshError);
            return;
          }
          try {
            const retryHeaders = {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            };
            const retryRes = await fetch(`${BASE_URL}${path}`, {
              ...options,
              credentials: 'include',
              headers: retryHeaders,
            });
            const retryData = await retryRes.json().catch(() => ({}));
            if (!retryRes.ok) {
              const err = new Error(retryData.message || 'Lỗi khi gửi lại yêu cầu.');
              err.status = retryRes.status;
              reject(err);
            } else {
              resolve(retryData);
            }
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  }

  if (!res.ok) {
    const error = new Error(data.message || 'Đã xảy ra lỗi không xác định.');
    error.status = res.status;
    error.errors = data.errors || null;
    throw error;
  }

  return data;
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

export const api = {
  get: (path, token) => request(path, { method: 'GET', token }),

  post: (path, body, token) =>
    request(path, { method: 'POST', token, body: JSON.stringify(body) }),

  put: (path, body, token) =>
    request(path, { method: 'PUT', token, body: JSON.stringify(body) }),

  patch: (path, body, token) =>
    request(path, { method: 'PATCH', token, body: JSON.stringify(body) }),

  delete: (path, token) => request(path, { method: 'DELETE', token }),
};

export default api;
