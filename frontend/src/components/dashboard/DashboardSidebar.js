'use client';

import { usePathname, useRouter } from 'next/navigation';
import { CaretLeft, GraduationCap } from '@phosphor-icons/react';
import { hasAnyRole } from '@/lib/utils';
import { NAV_ITEMS } from './navigation';
import css from './DashboardLayout.module.css';

export default function DashboardSidebar({
  collapsed,
  mobileOpen,
  onToggle,
  onNavigate,
  user,
  unreadNotificationsCount,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || hasAnyRole(user, item.roles));

  return (
    <aside
      className={[
        'dashboard-sidebar',
        css.sidebar,
        collapsed ? css.sidebarCollapsed : '',
      ].filter(Boolean).join(' ')}
      data-mobile-open={mobileOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        className={[css.logoArea, collapsed ? css.logoAreaCollapsed : ''].filter(Boolean).join(' ')}
      >
        <span className={css.logoMark}>
          <GraduationCap size={18} weight="duotone" className={css.logoIcon} />
        </span>
        {!collapsed && <span className={css.logoText}>Karl</span>}
      </button>

      <nav className={css.navList}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isNotificationItem = item.href === '/dashboard/notifications';

          return (
            <button
              key={item.href}
              type="button"
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
              <span className={css.navIconWrap}>
                <Icon size={20} weight={isActive ? 'duotone' : 'regular'} className={css.navIcon} />
                {isNotificationItem && unreadNotificationsCount > 0 && (
                  <span className={css.notificationDot} />
                )}
              </span>

              {!collapsed && (
                <span className={css.navLabelWrap}>
                  <span>{item.label}</span>
                  {isNotificationItem && unreadNotificationsCount > 0 && (
                    <span className={css.notificationCount}>
                      {unreadNotificationsCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={css.sidebarFooter}>
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          className={[
            css.collapseButton,
            collapsed ? css.collapseButtonCollapsed : '',
          ].filter(Boolean).join(' ')}
        >
          <CaretLeft
            size={18}
            className={[
              css.collapseIcon,
              collapsed ? css.collapseIconCollapsed : '',
            ].filter(Boolean).join(' ')}
          />
          {!collapsed && 'Thu gọn'}
        </button>
      </div>
    </aside>
  );
}
