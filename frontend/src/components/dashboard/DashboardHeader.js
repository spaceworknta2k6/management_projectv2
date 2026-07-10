'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { List, Moon, SignOut, Sun } from '@phosphor-icons/react';
import useAuthStore from '@/store/auth.store';
import useThemeStore from '@/store/theme.store';
import { getAvatarUrl } from '@/lib/avatar';
import { getPrimaryRole, getRoleLabel } from '@/lib/utils';
import css from './DashboardLayout.module.css';

export default function DashboardHeader({ user, onMobileMenuToggle }) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const { theme, toggleTheme } = useThemeStore();
  const avatarUrl = getAvatarUrl(user?.avatarUrl);

  const handleLogout = () => {
    logout();
    window.location.replace('/auth/login');
  };

  return (
    <header className={`dashboard-header ${css.header}`}>
      <button
        type="button"
        onClick={onMobileMenuToggle}
        className={`mobile-menu-btn ${css.mobileMenuButton}`}
        aria-label="Mở menu"
      >
        <List size={22} />
      </button>

      <div />

      <div className={`dashboard-user-area ${css.userArea}`}>
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          className={css.iconButton}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user && (
          <>
            <div className={`dashboard-user-meta ${css.userMeta}`}>
              <p className={css.userName}>
                {user.fullName || user.name || user.email}
              </p>
              <p className={css.userRole}>
                {getRoleLabel(getPrimaryRole(user))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/profile')}
              title="Thông tin cá nhân"
              aria-label="Mở thông tin cá nhân"
              className={css.avatarButton}
            >
              <Image src={avatarUrl} alt="" width={38} height={38} className={css.headerAvatar} />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleLogout}
          title="Đăng xuất"
          className={css.logoutButton}
        >
          <SignOut size={18} />
        </button>
      </div>
    </header>
  );
}
