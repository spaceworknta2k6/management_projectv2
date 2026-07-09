'use client';

import { useState } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import {
  DashboardAccessDeniedView,
  DashboardLoadingView,
  DashboardNetworkErrorView,
} from '@/components/dashboard/DashboardStatusViews';
import RealtimeNotificationHandler from '@/components/dashboard/RealtimeNotificationHandler';
import useDashboardSession from '@/components/dashboard/useDashboardSession';
import { ToastProvider } from '@/components/ui/Toast';
import css from '@/components/dashboard/DashboardLayout.module.css';

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    goDashboard,
    isAuthorized,
    loginAgain,
    networkError,
    ready,
    retryProfile,
    unreadNotificationsCount,
    user,
    userRole,
  } = useDashboardSession();

  if (!ready) {
    return <DashboardLoadingView />;
  }

  if (networkError) {
    return (
      <DashboardNetworkErrorView
        onRetry={retryProfile}
        onLoginAgain={loginAgain}
      />
    );
  }

  return (
    <ToastProvider>
      <RealtimeNotificationHandler />
      <DashboardSidebar
        collapsed={collapsed}
        mobileOpen={mobileMenuOpen}
        onToggle={() => setCollapsed((previous) => !previous)}
        onNavigate={() => setMobileMenuOpen(false)}
        user={user}
        unreadNotificationsCount={unreadNotificationsCount}
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
        <DashboardHeader
          user={user}
          onMobileMenuToggle={() => setMobileMenuOpen((previous) => !previous)}
        />

        <main className={`dashboard-main ${css.main}`}>
          {isAuthorized ? children : (
            <DashboardAccessDeniedView
              role={userRole}
              onBackHome={goDashboard}
            />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
