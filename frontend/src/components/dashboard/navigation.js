import {
  Bell,
  BookOpen,
  CalendarBlank,
  ChartBar,
  ChatsCircle,
  Clock,
  FileText,
  FolderSimple,
  House,
  Siren,
  Users,
} from '@phosphor-icons/react';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', icon: House, roles: null },
  { href: '/dashboard/periods', label: 'Học phần', icon: CalendarBlank, roles: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/rubrics', label: 'Tiêu chí đánh giá', icon: FileText, roles: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/rosters', label: 'Danh sách sinh viên', icon: Users, roles: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/groups', label: 'Nhóm', icon: Users, roles: ['STUDENT', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/topics', label: 'Đề tài', icon: BookOpen, roles: null },
  { href: '/dashboard/topic-changes', label: 'Đổi đề tài', icon: BookOpen, roles: ['STUDENT', 'LECTURER', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/projects', label: 'Dự án', icon: FolderSimple, roles: null },
  { href: '/dashboard/submissions', label: 'Nộp bài', icon: FileText, roles: ['STUDENT', 'LECTURER', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/extensions', label: 'Gia hạn', icon: Clock, roles: ['STUDENT', 'LECTURER', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/scores', label: 'Điểm số', icon: ChartBar, roles: ['STUDENT', 'LECTURER', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/appeals', label: 'Phúc khảo', icon: Siren, roles: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/notifications', label: 'Thông báo', icon: Bell, roles: null },
  { href: '/dashboard/chat', label: 'Chat', icon: ChatsCircle, roles: null },
  { href: '/dashboard/users', label: 'Quản lý tài khoản', icon: Users, roles: ['SYSTEM_ADMIN'] },
];

export function findNavItemByPath(pathname) {
  const normalizedPath = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;

  return NAV_ITEMS.find((item) => {
    if (item.href === '/dashboard') {
      return normalizedPath === '/dashboard';
    }

    return normalizedPath === item.href || normalizedPath.startsWith(`${item.href}/`);
  });
}
