'use client';

import { Warning } from '@phosphor-icons/react';
import { getRoleLabel } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import css from './DashboardLayout.module.css';

export function DashboardLoadingView() {
  return (
    <div className={css.loadingView}>
      <Spinner />
      Đang tải...
    </div>
  );
}

export function DashboardNetworkErrorView({ onRetry, onLoginAgain }) {
  return (
    <div className={css.networkErrorView}>
      <div className={css.statusIcon}>
        <Warning size={32} weight="duotone" />
      </div>
      <h2 className={css.statusTitle}>Lỗi kết nối máy chủ</h2>
      <p className={css.statusDescription}>
        Hệ thống không thể tải thông tin tài khoản của bạn do sự cố kết nối mạng hoặc máy chủ đang khởi động lại. Phiên đăng nhập của bạn vẫn được giữ.
      </p>
      <div className={css.statusActions}>
        <Button variant="primary" onClick={onRetry}>
          Thử lại
        </Button>
        <Button variant="secondary" onClick={onLoginAgain}>
          Đăng nhập lại
        </Button>
      </div>
    </div>
  );
}

export function DashboardAccessDeniedView({ role, onBackHome }) {
  return (
    <div className={css.accessDeniedView}>
      <div className={css.statusIcon}>
        <Warning size={32} weight="duotone" />
      </div>
      <h2 className={css.statusTitle}>Quyền truy cập bị từ chối</h2>
      <p className={css.statusDescription}>
        Tài khoản của bạn ({getRoleLabel(role)}) không có quyền truy cập chức năng này.
      </p>
      <Button variant="primary" onClick={onBackHome}>
        Quay lại trang chủ
      </Button>
    </div>
  );
}
