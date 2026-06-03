'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  GraduationCap,
  House,
  CalendarBlank,
  Users,
  BookOpen,
  FolderSimple,
  FileText,
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
} from '@phosphor-icons/react';
import useAuthStore from '@/store/auth.store';
import useThemeStore from '@/store/theme.store';
import { authService } from '@/services/auth.service';
import Spinner from '@/components/ui/Spinner';
import { getRoleLabel } from '@/lib/utils';
import { ToastProvider } from '@/components/ui/Toast';

/* ─── Navigation Items ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Tổng quan',     icon: House,            roles: null },
  { href: '/dashboard/periods',    label: 'Đợt đồ án',    icon: CalendarBlank,    roles: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/groups',     label: 'Nhóm',          icon: Users,            roles: null },
  { href: '/dashboard/topics',     label: 'Đề tài',        icon: BookOpen,         roles: null },
  { href: '/dashboard/projects',   label: 'Dự án',         icon: FolderSimple,     roles: null },
  { href: '/dashboard/submissions',label: 'Nộp bài',       icon: FileText,         roles: null },
  { href: '/dashboard/committees', label: 'Hội đồng',      icon: Gavel,            roles: ['LECTURER', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/defenses',   label: 'Bảo vệ',        icon: Sword,            roles: null },
  { href: '/dashboard/scores',     label: 'Điểm số',       icon: ChartBar,         roles: ['LECTURER', 'FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/notifications', label: 'Thông báo',  icon: Bell,             roles: null },
  { href: '/dashboard/audit',      label: 'Nhật ký',       icon: ClockCounterClockwise, roles: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
  { href: '/dashboard/users',      label: 'Quản lý tài khoản', icon: Users,            roles: ['SYSTEM_ADMIN'] },
];

/* ─── Sidebar ──────────────────────────────────────────────────────── */
function Sidebar({ collapsed, onToggle, userRole }) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <aside
      style={{
        width: collapsed ? '64px' : 'var(--sidebar-width)',
        height: '100dvh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div
        onClick={() => router.push('/dashboard')}
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 20px' : '0 16px',
          gap: '10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: '30px',
            height: '30px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--accent-glow)',
            border: '1px solid rgba(79,142,247,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <GraduationCap size={18} weight="duotone" style={{ color: 'var(--accent)' }} />
        </div>
        {!collapsed && (
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            Karl
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '10px 0' : '8px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: '100%',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'inherit',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--accent-glow)' : 'transparent',
                transition: 'background-color 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={20} weight={isActive ? 'duotone' : 'regular'} style={{ flexShrink: 0 }} />
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div
        style={{
          padding: '8px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onToggle}
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '10px',
            width: '100%',
            padding: collapsed ? '10px 0' : '8px 12px',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontFamily: 'inherit',
            color: 'var(--text-muted)',
            backgroundColor: 'transparent',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <CaretLeft
            size={18}
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
              flexShrink: 0,
            }}
          />
          {!collapsed && 'Thu gọn'}
        </button>
      </div>
    </aside>
  );
}

/* ─── Header ──────────────────────────────────────────────────────── */
function Header({ user, sidebarCollapsed, onMobileMenuToggle }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useThemeStore();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <header
      style={{
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={onMobileMenuToggle}
        style={{
          display: 'none',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          padding: '4px',
        }}
        className="mobile-menu-btn"
      >
        <List size={22} />
      </button>

      <div /> {/* Spacer */}

      {/* User area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'background-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {user.fullName || user.name || user.email}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {getRoleLabel(user.role || user.roles?.[0])}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Đăng xuất"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'background-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--error-bg)';
            e.currentTarget.style.color = 'var(--error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <SignOut size={18} />
        </button>
      </div>
    </header>
  );
}

/* ─── Dashboard Layout ───────────────────────────────────────────── */
export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { token, user, isLoading, hydrate, setUser, logout } = useAuthStore();
  const { applyTheme } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  // Apply saved theme on mount
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  // Hydrate auth from cookie on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Fetch user profile once token is available
  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      router.replace('/auth/login');
      return;
    }

    // Already have user? Done.
    if (user) {
      setReady(true);
      return;
    }

    // Fetch user profile
    authService.me(token).then((res) => {
      setUser(res.data);
      setReady(true);
    }).catch(() => {
      logout();
      router.replace('/auth/login');
    });
  }, [isLoading, token, user, router, setUser, logout]);

  // Loading state
  if (!ready) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          gap: '12px',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        <Spinner />
        Đang tải...
      </div>
    );
  }

  return (
    <ToastProvider>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((p) => !p)}
        userRole={user?.role || user?.roles?.[0]}
      />

      <div
        style={{
          marginLeft: collapsed ? '64px' : 'var(--sidebar-width)',
          minHeight: '100dvh',
          transition: 'margin-left 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header
          user={user}
          sidebarCollapsed={collapsed}
          onMobileMenuToggle={() => setCollapsed((p) => !p)}
        />

        <main
          style={{
            flex: 1,
            padding: '24px',
            maxWidth: '1400px',
            width: '100%',
          }}
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
