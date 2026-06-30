/**
 * Utility helpers for Karl frontend.
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

export function getUserRoles(user) {
  return user?.roles || (user?.role ? [user.role] : []);
}

export function getPrimaryRole(user) {
  return user?.role || user?.roles?.[0] || '';
}

export function hasAnyRole(user, allowedRoles = []) {
  return getUserRoles(user).some((role) => allowedRoles.includes(role));
}

/**
 * Map backend status strings to Vietnamese labels and badge variants.
 */
const STATUS_MAP = {
  // Period statuses
  draft: { label: 'Bản nháp', variant: 'neutral' },
  enrollment: { label: 'Đăng ký', variant: 'info' },
  registration_open: { label: 'Đăng ký', variant: 'info' },
  in_progress: { label: 'Đang diễn ra', variant: 'success' },
  grading: { label: 'Đang chấm điểm', variant: 'warning' },
  completed: { label: 'Hoàn thành', variant: 'success' },
  results_published: { label: 'Đã công bố điểm', variant: 'success' },
  appeal_open: { label: 'Đang nhận phúc khảo', variant: 'warning' },
  result_locked: { label: 'Đã khóa điểm', variant: 'neutral' },
  archived: { label: 'Lưu trữ', variant: 'neutral' },
  // Group statuses
  forming: { label: 'Đang thành lập', variant: 'info' },
  confirmed: { label: 'Đã xác nhận', variant: 'success' },
  invited: { label: 'Đã mời', variant: 'warning' },
  removed: { label: 'Đã rút', variant: 'error' },
  // Topic statuses
  assigned: { label: 'Đã phân công', variant: 'info' },
  ai_checked: { label: 'Đã kiểm tra AI', variant: 'info' },
  pending_review: { label: 'Chờ duyệt', variant: 'warning' },
  approved: { label: 'Đã duyệt', variant: 'success' },
  rejected: { label: 'Từ chối', variant: 'error' },
  needs_revision: { label: 'Yêu cầu chỉnh sửa', variant: 'warning' },
  locked: { label: 'Đã khóa', variant: 'success' },
  changed: { label: 'Đã thay đổi', variant: 'info' },
  cancelled: { label: 'Đã hủy', variant: 'error' },
  // Project statuses
  final_report_submitted: { label: 'Đã nộp báo cáo cuối', variant: 'info' },
  supervisor_reviewed: { label: 'GVHD đã nhận xét', variant: 'success' },
  reviewer_reviewed: { label: 'GV chấm 2 đã nhận xét', variant: 'success' },
  ready_for_grading: { label: 'Sẵn sàng chấm', variant: 'success' },
  post_report_revision: { label: 'Chỉnh sửa sau báo cáo', variant: 'warning' },
  finalized: { label: 'Đã hoàn tất', variant: 'success' },
  failed: { label: 'Không đạt', variant: 'error' },
  // Submission statuses
  missing: { label: 'Thiếu hồ sơ', variant: 'warning' },
  open: { label: 'Đang mở', variant: 'info' },
  submitted: { label: 'Đã nộp', variant: 'info' },
  accepted: { label: 'Đã chấp nhận', variant: 'success' },
  graded: { label: 'Đã chấm', variant: 'success' },
  late: { label: 'Trễ hạn', variant: 'error' },
  // Score statuses
  published: { label: 'Đã công bố', variant: 'success' },
  // Common/system statuses
  active: { label: 'Đang hoạt động', variant: 'success' },
  inactive: { label: 'Ngưng hoạt động', variant: 'neutral' },
  pending: { label: 'Đang chờ', variant: 'warning' },
  expired: { label: 'Đã hết hạn', variant: 'error' },
  queued: { label: 'Đang xếp hàng', variant: 'warning' },
  running: { label: 'Đang chạy', variant: 'warning' },
  succeeded: { label: 'Thành công', variant: 'success' },
  clean: { label: 'Sạch', variant: 'success' },
  infected: { label: 'Có mã độc', variant: 'error' },
};

export function getStatus(status) {
  return STATUS_MAP[status] || { label: status, variant: 'neutral' };
}

const TECHNICAL_LABELS = {
  TOPIC_APPROVED: 'Đề tài được duyệt',
  TOPIC_REJECTED: 'Đề tài bị từ chối',
  TOPIC_NEEDS_REVISION: 'Đề tài cần chỉnh sửa',
  TOPIC_SUBMITTED: 'Đề tài đã gửi duyệt',
  TOPIC_PROPOSED: 'Đề xuất đề tài',
  MILESTONE_DEADLINE_NEAR: 'Sắp đến hạn mốc báo cáo',
  USER_REGISTER_GOOGLE: 'Người dùng đăng ký qua Google',

  PROPOSE_TOPIC: 'Đề xuất đề tài',
  REVIEW_TOPIC_APPROVE: 'Duyệt đề tài',
  REVIEW_TOPIC_REJECT: 'Từ chối đề tài',
  REVIEW_TOPIC_NEEDS_REVISION: 'Yêu cầu chỉnh sửa đề tài',
  REVIEW_TOPIC_REQUEST_REVISION: 'Yêu cầu chỉnh sửa đề tài',
  RESUBMIT_TOPIC: 'Gửi lại đề tài',
  ASSIGN_SUPERVISOR: 'Phân công giảng viên hướng dẫn',
  SPAWN_PROJECT: 'Tạo dự án từ đề tài',
  START_PROJECT: 'Bắt đầu dự án',
  ASSIGN_REVIEWER: 'Phân công giảng viên chấm 2',
  MARK_READY_FOR_GRADING: 'Đánh dấu sẵn sàng chấm',
  FINALIZE_PROJECT: 'Hoàn tất dự án',
  CANCEL_PROJECT: 'Hủy dự án',

  CREATE_GROUP: 'Tạo nhóm',
  INVITE_MEMBER: 'Mời thành viên',
  ACCEPT_INVITATION: 'Chấp nhận lời mời',
  CONFIRM_GROUP: 'Xác nhận nhóm',
  UPDATE_GROUP: 'Cập nhật nhóm',
  SOFT_DELETE_GROUP: 'Xóa nhóm',

  CREATE_PERIOD: 'Tạo đợt đồ án',
  UPDATE_PERIOD: 'Cập nhật đợt đồ án',
  SOFT_DELETE_PERIOD: 'Xóa đợt đồ án',
  IMPORT_ROSTER: 'Nhập danh sách sinh viên',
  ADD_STUDENT_ROSTER: 'Thêm sinh viên vào danh sách',
  REMOVE_STUDENT_ROSTER: 'Xóa sinh viên khỏi danh sách',
  APPROVE_TOPIC: 'Duyệt đề tài',
};

export function getTechnicalLabel(value) {
  if (!value) return '';
  const key = String(value).toUpperCase().replace(/-/g, '_');
  if (TECHNICAL_LABELS[key]) return TECHNICAL_LABELS[key];

  return String(value)
    .toLowerCase()
    .replace(/-/g, '_')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const getNotificationTypeLabel = getTechnicalLabel;
export const getAuditActionLabel = getTechnicalLabel;

/**
 * Truncate long strings.
 */
export function truncate(str, maxLen = 60) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

/**
 * Global API error handler for frontend components.
 * Displays error using Toast if available, or logs it.
 * @param {Error|object} err
 * @param {object} toast - Toast context instance (from useToast)
 */
export function handleApiError(err, toast) {
  const errMsg = err?.message || 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
  if (toast && typeof toast.error === 'function') {
    toast.error(errMsg);
  } else {
    console.error('API Error:', err);
  }
  return errMsg;
}
