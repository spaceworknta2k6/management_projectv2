'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Tabs from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, getNotificationTypeLabel } from '@/lib/utils';
import {
  ArrowsClockwise,
  Bell,
  Check,
  CheckCircle,
  EnvelopeOpen,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import css from './page.module.css';

function getNotificationTone(notification) {
  const type = String(notification.type || '').toUpperCase();
  if (type.includes('REJECT') || type.includes('LOCK') || type.includes('DEADLINE')) return 'warning';
  if (type.includes('APPROVE') || type.includes('ACCEPT') || type.includes('PUBLISH')) return 'success';
  return notification.readAt ? 'neutral' : 'info';
}

function getNotificationActionUrl(notification) {
  const rawUrl = notification.actionUrl || '';
  if (rawUrl.startsWith('http')) return rawUrl;
  if (rawUrl.startsWith('/dashboard')) return rawUrl;

  if (rawUrl === '/admin/users') return '/dashboard/users';
  if (rawUrl.startsWith('/admin/')) return `/dashboard/${rawUrl.slice('/admin/'.length)}`;

  const entityType = notification.entityType;
  if (entityType === 'ProjectTopic') return '/dashboard/topics';
  if (entityType === 'Project') return '/dashboard/projects';
  if (entityType === 'SubmissionPackage' || entityType === 'Milestone') return '/dashboard/submissions';
  if (entityType === 'ExtensionRequest') return '/dashboard/extensions';
  if (entityType === 'Committee') return '/dashboard/committees';
  if (entityType === 'DefenseSession') return '/dashboard/defenses';
  if (entityType === 'User') return '/dashboard/users';

  if (rawUrl === '/topics') return '/dashboard/topics';
  if (rawUrl === '/projects') return '/dashboard/projects';
  if (rawUrl === '/submissions') return '/dashboard/submissions';
  if (rawUrl === '/extensions') return '/dashboard/extensions';

  return rawUrl;
}

function NotificationRow({ notification, markingId, deletingId, onMarkRead, onRequestDelete }) {
  const isRead = Boolean(notification.readAt);
  const tone = getNotificationTone(notification);
  const actionUrl = getNotificationActionUrl(notification);

  return (
    <div className={[css.notificationRow, !isRead ? css.notificationUnread : ''].filter(Boolean).join(' ')}>
      <div className={[css.notificationIcon, !isRead ? css.notificationIconUnread : ''].filter(Boolean).join(' ')}>
        {isRead ? <EnvelopeOpen size={20} /> : <Bell size={20} weight="duotone" />}
      </div>

      <div className={css.s1}>
        <div className={css.s2}>
          <h3 className={css.s3}>
            {notification.title || 'Thông báo hệ thống'}
          </h3>
          <Badge variant={tone}>{isRead ? 'Đã đọc' : 'Chưa đọc'}</Badge>
          {notification.type && <Badge variant="neutral">{getNotificationTypeLabel(notification.type)}</Badge>}
        </div>

        <p className={css.s4}>
          {notification.body || 'Không có nội dung chi tiết.'}
        </p>

        <div className={css.s5}>
          <span className={css.s6}>
            {formatDateTime(notification.createdAt)}
          </span>
          {notification.deadlineAt && (
            <span className={css.s7}>
              Hạn: {formatDateTime(notification.deadlineAt)}
            </span>
          )}
          {actionUrl && (
            <Link
              href={actionUrl} className={css.s8} >
              Mở liên kết
            </Link>
          )}
        </div>
      </div>

      <div className={css.s9}>
        {!isRead && (
          <Button
            variant="secondary"
            size="sm"
            title="Đánh dấu đã đọc"
            loading={markingId === notification._id}
            onClick={() => onMarkRead(notification._id)}
            icon={<Check size={16} />}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          title="Xóa thông báo"
          loading={deletingId === notification._id}
          onClick={() => onRequestDelete(notification)}
          icon={<Trash size={16} />}
        />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );
  const readCount = notifications.length - unreadCount;
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((notification) => !notification.readAt);
    }
    if (activeTab === 'read') {
      return notifications.filter((notification) => notification.readAt);
    }
    return notifications;
  }, [activeTab, notifications]);
  const tabs = [
    { id: 'all', label: `Tất cả (${notifications.length})` },
    { id: 'unread', label: `Chưa đọc (${unreadCount})` },
    { id: 'read', label: `Đã đọc (${readCount})` },
  ];

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications', token);
      setNotifications(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách thông báo.');
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    setMarkingId(id);
    try {
      const res = await api.post(`/notifications/${id}/read`, {}, token);
      setNotifications((prev) =>
        prev.map((notification) => (notification._id === id ? res.data : notification))
      );
      toast.success('Đã đánh dấu thông báo là đã đọc.');
    } catch (err) {
      toast.error(err.message || 'Không thể đánh dấu thông báo.');
    } finally {
      setMarkingId('');
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post('/notifications/read-all', {}, token);
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          readAt: notification.readAt || new Date().toISOString(),
        }))
      );
      toast.success('Đã đánh dấu đọc toàn bộ thông báo.');
    } catch (err) {
      toast.error(err.message || 'Không thể đánh dấu đọc toàn bộ thông báo.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDeleteNotification = async () => {
    if (!notificationToDelete) return;

    setDeletingId(notificationToDelete._id);
    try {
      await api.delete(`/notifications/${notificationToDelete._id}`, token);
      setNotifications((prev) =>
        prev.filter((notification) => notification._id !== notificationToDelete._id)
      );
      setNotificationToDelete(null);
      toast.success('Đã xóa thông báo.');
    } catch (err) {
      toast.error(err.message || 'Không thể xóa thông báo.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div>
      <div className={css.s10} >
        <div>
          <h1 className={`text-display ${css.s11}`}>
            <Bell size={28} className={css.s12} />
            Thông báo hệ thống
          </h1>
          <p className={css.s13}>
            Theo dõi các cập nhật mới về đề tài, báo cáo, hội đồng và các mốc quan trọng.
          </p>
        </div>

        <div className={css.s14}>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchNotifications}
            icon={<ArrowsClockwise size={16} />}
          >
            Làm mới
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={unreadCount === 0}
            loading={markingAll}
            onClick={handleMarkAllRead}
            icon={<CheckCircle size={16} />}
          >
            Đọc tất cả
          </Button>
        </div>
      </div>

      <div className={css.s15} >
        <Card>
          <p className={css.s16}>Tổng thông báo</p>
          <p className={css.s17}>{notifications.length}</p>
        </Card>
        <Card>
          <p className={css.s18}>Chưa đọc</p>
          <p className={[css.s17, unreadCount > 0 ? css.unreadWarning : css.unreadSuccess].filter(Boolean).join(' ')}>
            {unreadCount}
          </p>
        </Card>
        <Card>
          <p className={css.s18}>Đã đọc</p>
          <p className={css.s17}>{readCount}</p>
        </Card>
      </div>

      {loading ? (
        <div className={css.s19}>
          <Spinner size="lg" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <div className={css.s20}>
            <CheckCircle size={42} weight="duotone" className={css.s21} />
            <h3 className={css.s22}>
              Chưa có thông báo
            </h3>
            <p className={css.s23}>
              Khi có cập nhật mới, hệ thống sẽ hiển thị tại đây.
            </p>
          </div>
        </Card>
      ) : (
        <Card
          title="Hòm thư"
          subtitle={`${unreadCount} thông báo chưa đọc`}
          noPadding
        >
          <div className={css.mailTabs}>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
          {filteredNotifications.length === 0 ? (
            <div className={css.emptyFilter}>
              Không có thông báo trong mục này.
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationRow
                key={notification._id}
                notification={notification}
                markingId={markingId}
                deletingId={deletingId}
                onMarkRead={handleMarkRead}
                onRequestDelete={setNotificationToDelete}
              />
            ))
          )}
        </Card>
      )}

      {!loading && notifications.some((notification) => !notification.actionUrl) && (
        <p className={css.s24}>
          <Warning size={14} />
          Một số thông báo không có liên kết thao tác vì chỉ mang tính ghi nhận.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(notificationToDelete)}
        title="Xóa thông báo"
        message={notificationToDelete ? `Bạn có chắc chắn muốn xóa thông báo "${notificationToDelete.title}"?` : ''}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        loading={Boolean(deletingId)}
        onConfirm={handleDeleteNotification}
        onCancel={() => {
          if (!deletingId) setNotificationToDelete(null);
        }}
      />
    </div>
  );
}
