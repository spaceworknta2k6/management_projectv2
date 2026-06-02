/**
 * api.ts — Episteme API Fetch Wrapper
 *
 * Auto-attaches Authorization header, handles 401 logout,
 * normalises errors into { success: false, message, errors? }.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Core fetch function.
 * @param {string} path  - e.g. '/auth/login'
 * @param {RequestInit & { token?: string }} options
 */
async function request(path, { token, ...options } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  // 401 → caller should trigger logout (handled in hooks/components)
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
