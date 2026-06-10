'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  GraduationCap,
  House,
  CalendarBlank,
  Users,
  BookOpen,
  FolderSimple,
  FileText,
  Clock,
  Gavel,
  Sword,
  ChartBar,
  Bell,
  ClockCounterClockwise,
  SignOut,
  CaretLeft,
  List,
  Sun,
  Moon,
  Warning,
} from '@phosphor-icons/react';
import useAuthStore from '@/store/auth.store';
import useThemeStore from '@/store/theme.store';
import { authService } from '@/services/auth.service';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { getAvatarUrl } from '@/lib/avatar';
import { getPrimaryRole, getRoleLabel, hasAnyRole } from '@/lib/utils';
import { ToastProvider } from '@/components/ui/Toast';
import css from './layout.module.css';

/* ─── Navigation Items ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Tổng quan',     icon: House,            roles: null },
  { href: '/dashboard/periods',    label: 'Đợt đồ án',    icon: CalendarBlank,    roles: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/groups',     label: 'Nhóm',          icon: Users,            roles: ['STUDENT', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/topics',     label: 'Đề tài',        icon: BookOpen,         roles: null },
  { href: '/dashboard/projects',   label: 'Dự án',         icon: FolderSimple,     roles: null },
  { href: '/dashboard/submissions',label: 'Nộp bài',       icon: FileText,         roles: ['STUDENT', 'LECTURER', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/extensions', label: 'Gia hạn',       icon: Clock,            roles: ['STUDENT', 'LECTURER', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/committees', label: 'Hội đồng',      icon: Gavel,            roles: ['LECTURER', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/defenses',   label: 'Bảo vệ',        icon: Sword,            roles: null },
  { href: '/dashboard/scores',     label: 'Điểm số',       icon: ChartBar,         roles: ['LECTURER', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/notifications', label: 'Thông báo',  icon: Bell,             roles: null },
  { href: '/dashboard/audit',      label: 'Nhật ký',       icon: ClockCounterClockwise, roles: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/users',      label: 'Quản lý tài khoản', icon: Users,            roles: ['SYSTEM_ADMIN'] },
];

/* ─── Sidebar ──────────────────────────────────────────────────────── */
function Sidebar({ collapsed, mobileOpen, onToggle, onNavigate, user }) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasAnyRole(user, item.roles)
  );

  return (
    <aside
      className={[
        'dashboard-sidebar',
        css.sidebar,
        collapsed ? css.sidebarCollapsed : '',
      ].filter(Boolean).join(' ')}
      data-mobile-open={mobileOpen ? 'true' : 'false'}
    >
      {/* Logo area */}
      <div
        onClick={() => router.push('/dashboard')}
        className={[css.logoArea, collapsed ? css.logoAreaCollapsed : ''].filter(Boolean).join(' ')}
      >
        <div className={css.s1} >
          <GraduationCap size={18} weight="duotone" className={css.s2} />
        </div>
        {!collapsed && (
          <span className={css.s3} >
            Karl
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className={css.s4} >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => {
                router.push(item.href);
                onNavigate?.();
              }}
              title={collapsed ? item.label : undefined}
              className={[
                css.navButton,
                collapsed ? css.navButtonCollapsed : '',
                isActive ? css.navButtonActive : '',
              ].filter(Boolean).join(' ')}
            >
              <Icon size={20} weight={isActive ? 'duotone' : 'regular'} className={css.s5} />
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className={css.s6} >
        <button
          onClick={onToggle}
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          className={[css.collapseButton, collapsed ? css.collapseButtonCollapsed : ''].filter(Boolean).join(' ')}
        >
          <CaretLeft
            size={18}
            className={[css.collapseIcon, collapsed ? css.collapseIconCollapsed : ''].filter(Boolean).join(' ')}
          />
          {!collapsed && 'Thu gọn'}
        </button>
      </div>
    </aside>
  );
}

/* ─── Header ──────────────────────────────────────────────────────── */
function Header({ user, onMobileMenuToggle }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useThemeStore();
  const avatarUrl = getAvatarUrl(user?.avatarUrl);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <header className={`dashboard-header ${css.s7}`}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={onMobileMenuToggle} className={`mobile-menu-btn ${css.s8}`}
      >
        <List size={22} />
      </button>

      <div /> {/* Spacer */}

      {/* User area */}
      <div className={`dashboard-user-area ${css.s9}`}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          className={css.s10}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user && (
          <>
            <div className={`dashboard-user-meta ${css.s11}`}>
              <p className={css.s12}>
                {user.fullName || user.name || user.email}
              </p>
              <p className={css.s13}>
                {getRoleLabel(getPrimaryRole(user))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/profile')}
              title="Th\u00f4ng tin c\u00e1 nh\u00e2n"
              aria-label="M\u1edf th\u00f4ng tin c\u00e1 nh\u00e2n"
              className={css.avatarButton}
            >
              <Image src={avatarUrl} alt="" width={38} height={38} className={css.headerAvatar} />
            </button>
          </>
        )}
        <button
          onClick={handleLogout}
          title="Đăng xuất"
          className={css.s14}
        >
          <SignOut size={18} />
        </button>
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, isLoading, hydrate, setUser, logout } = useAuthStore();
  const { applyTheme } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  // Apply saved theme on mount
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  // Hydrate auth from cookie on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const userRole = getPrimaryRole(user);
  const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const currentNavItem = NAV_ITEMS.find(item => {
    if (item.href === '/dashboard') {
      return normalizedPath === '/dashboard';
    }
    return normalizedPath === item.href || normalizedPath.startsWith(item.href + '/');
  });
  const isAuthorized = !currentNavItem || !currentNavItem.roles || hasAnyRole(user, currentNavItem.roles);

  useEffect(() => {
    if (ready && !isAuthorized) {
      router.replace('/dashboard');
    }
  }, [ready, isAuthorized, router]);

  const loadProfile = useCallback(() => {
    setNetworkError(false);
    authService.me(token).then((res) => {
      setUser(res.data);
      setReady(true);
    }).catch((err) => {
      // Chỉ logout khi token thực sự hết hạn hoặc không hợp lệ (401 Unauthorized hoặc 403 Forbidden)
      if (err.status === 401 || err.status === 403) {
        logout();
        router.replace('/auth/login');
      } else {
        console.error('Network or server error on /auth/me:', err);
        setNetworkError(true);
        setReady(true); // Vẫn hiển thị trang để render view báo lỗi mạng
      }
    });
  }, [logout, router, setUser, token]);

  // Fetch user profile once token is available
  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      router.replace('/auth/login');
      return;
    }

    // Already have user? Done.
    if (user) {
      queueMicrotask(() => setReady(true));
      return;
    }

    queueMicrotask(loadProfile);
  }, [isLoading, loadProfile, token, user, router]);

  // Loading state
  if (!ready) {
    return (
      <div className={css.s15} >
        <Spinner />
        Đang tải...
      </div>
    );
  }

  // Network error state
  if (networkError) {
    return (
      <div className={css.s16} >
        <div className={css.s17} >
          <Warning size={32} weight="duotone" />
        </div>
        <h2 className={css.s18} >
          Lỗi kết nối máy chủ
        </h2>
        <p className={css.s19} >
          Hệ thống không thể tải thông tin tài khoản của bạn do sự cố kết nối mạng hoặc máy chủ đang khởi động lại. Phiên đăng nhập của bạn vẫn được giữ.
        </p>
        <div className={css.s20}>
          <Button variant="primary" onClick={() => { setReady(false); loadProfile(); }}>
            Thử lại
          </Button>
          <Button variant="secondary" onClick={() => { logout(); router.replace('/auth/login'); }}>
            Đăng nhập lại
          </Button>
        </div>
      </div>
    );
  }


  const accessDeniedView = (
    <div className={css.s21} >
      <div className={css.s22} >
        <Warning size={32} weight="duotone" />
      </div>
      <h2 className={css.s23} >
        Quyền truy cập bị từ chối
      </h2>
      <p className={css.s24} >
        Tài khoản của bạn ({getRoleLabel(userRole)}) không có quyền truy cập chức năng này.
      </p>
      <Button variant="primary" onClick={() => router.push('/dashboard')}>
        Quay lại trang chủ
      </Button>
    </div>
  );

  return (
    <ToastProvider>
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileMenuOpen}
        onToggle={() => setCollapsed((p) => !p)}
        onNavigate={() => setMobileMenuOpen(false)}
        user={user}
      />
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          className="dashboard-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={[
          'dashboard-shell',
          css.shell,
          collapsed ? css.shellCollapsed : '',
        ].filter(Boolean).join(' ')}
      >
        <Header
          user={user}
          onMobileMenuToggle={() => setMobileMenuOpen((p) => !p)}
        />

        <main className={`dashboard-main ${css.s25}`}
        >
          {isAuthorized ? children : accessDeniedView}
        </main>
      </div>
    </ToastProvider>
  );
}
