export const ROLE_OPTIONS = [
  { value: 'SYSTEM_ADMIN', label: 'Quản trị viên', badge: 'error' },
  { value: 'FACULTY_STAFF', label: 'Giáo vụ Khoa', badge: 'warning' },
  { value: 'LECTURER', label: 'Giảng viên', badge: 'neutral' },
  { value: 'STUDENT', label: 'Sinh viên', badge: 'success' },
];

export const PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50];
export const DEFAULT_FILTERS = {
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

export function getInitialUsersQuery() {
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
