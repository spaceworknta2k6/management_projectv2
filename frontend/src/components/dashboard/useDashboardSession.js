'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import useAuthStore from '@/store/auth.store';
import useNotificationStore from '@/store/notification.store';
import useThemeStore from '@/store/theme.store';
import { getPrimaryRole, hasAnyRole } from '@/lib/utils';
import { findNavItemByPath } from './navigation';

export default function useDashboardSession() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, isLoading, hydrate, setUser, logout } = useAuthStore();
  const { applyTheme } = useThemeStore();
  const { fetchNotifications, unreadCount: unreadNotificationsCount } = useNotificationStore();
  const [ready, setReady] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    fetchNotifications(token);
  }, [token, user, fetchNotifications]);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const loadProfile = useCallback(() => {
    setNetworkError(false);

    authService.me(token).then((res) => {
      setUser(res.data);
      setReady(true);
    }).catch((err) => {
      if (err.status === 401 || err.status === 403) {
        logout();
        router.replace('/auth/login');
        return;
      }

      console.error('Network or server error on /auth/me:', err);
      setNetworkError(true);
      setReady(true);
    });
  }, [logout, router, setUser, token]);

  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      setNetworkError(false);
      setReady(false);
      router.replace('/auth/login');
      return;
    }

    if (user) {
      queueMicrotask(() => setReady(true));
      return;
    }

    queueMicrotask(loadProfile);
  }, [isLoading, loadProfile, router, token, user]);

  const currentNavItem = findNavItemByPath(pathname);
  const isAuthorized = !currentNavItem || !currentNavItem.roles || hasAnyRole(user, currentNavItem.roles);
  const userRole = getPrimaryRole(user);

  useEffect(() => {
    if (ready && !isAuthorized) {
      router.replace('/dashboard');
    }
  }, [ready, isAuthorized, router]);

  const retryProfile = useCallback(() => {
    setReady(false);
    loadProfile();
  }, [loadProfile]);

  const loginAgain = useCallback(() => {
    logout();
    router.replace('/auth/login');
  }, [logout, router]);

  const goDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  return {
    goDashboard,
    isAuthorized,
    loginAgain,
    networkError,
    ready,
    retryProfile,
    unreadNotificationsCount,
    user,
    userRole,
  };
}
