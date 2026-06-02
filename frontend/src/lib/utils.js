/**
 * Utility helpers for Episteme frontend.
 */

/**
 * Format a date string/Date to Vietnamese locale.
 * @param {string|Date} date
 * @param {object} opts - Intl.DateTimeFormat options
 */
export function formatDate(date, opts = {}) {
  if (!date) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...opts,
  }).format(new Date(date));
}

/**
 * Format date with time.
 */
export function formatDateTime(date) {
  return formatDate(date, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Map backend role string to Vietnamese label.
 */
const ROLE_LABELS = {
  SYSTEM_ADMIN: 'Quản trị hệ thống',
  FACULTY_STAFF: 'Giáo vụ Khoa',
  LECTURER: 'Giảng viên',
  STUDENT: 'Sinh viên',
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

/**
 * Map backend status strings to Vietnamese labels and badge variants.
 */
const STATUS_MAP = {
  // Period statuses
  draft: { label: 'Bản nháp', variant: 'neutral' },
  enrollment: { label: 'Đăng ký', variant: 'info' },
  in_progress: { label: 'Đang diễn ra', variant: 'success' },
  defense: { label: 'Bảo vệ', variant: 'warning' },
  completed: { label: 'Hoàn thành', variant: 'success' },
  archived: { label: 'Lưu trữ', variant: 'neutral' },
  // Group statuses
  forming: { label: 'Đang thành lập', variant: 'info' },
  confirmed: { label: 'Đã xác nhận', variant: 'success' },
  // Topic statuses
  pending_review: { label: 'Chờ duyệt', variant: 'warning' },
  approved: { label: 'Đã duyệt', variant: 'success' },
  rejected: { label: 'Từ chối', variant: 'error' },
  // Submission statuses
  submitted: { label: 'Đã nộp', variant: 'info' },
  graded: { label: 'Đã chấm', variant: 'success' },
  late: { label: 'Trễ hạn', variant: 'error' },
  // Defense statuses
  scheduled: { label: 'Đã lên lịch', variant: 'info' },
  started: { label: 'Đang diễn ra', variant: 'warning' },
  // Score statuses
  locked: { label: 'Đã khoá', variant: 'success' },
  published: { label: 'Đã công bố', variant: 'success' },
};

export function getStatus(status) {
  return STATUS_MAP[status] || { label: status, variant: 'neutral' };
}

/**
 * Truncate long strings.
 */
export function truncate(str, maxLen = 60) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}
