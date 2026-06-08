'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, getNotificationTypeLabel } from '@/lib/utils';
import {
  ArrowsClockwise,
  Bell,
  Check,
  CheckCircle,
  EnvelopeOpen,
  Warning,
} from '@phosphor-icons/react';

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

function NotificationRow({ notification, markingId, onMarkRead }) {
  const isRead = Boolean(notification.readAt);
  const tone = getNotificationTone(notification);
  const actionUrl = getNotificationActionUrl(notification);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px minmax(0, 1fr) auto',
        gap: '14px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: isRead ? 'transparent' : 'var(--accent-glow)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: isRead ? 'var(--bg-raised)' : 'var(--bg-surface)',
          color: isRead ? 'var(--text-muted)' : 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border)',
        }}
      >
        {isRead ? <EnvelopeOpen size={20} /> : <Bell size={20} weight="duotone" />}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 650, color: 'var(--text-primary)' }}>
            {notification.title || 'Thông báo hệ thống'}
          </h3>
          <Badge variant={tone}>{isRead ? 'Đã đọc' : 'Chưa đọc'}</Badge>
          {notification.type && <Badge variant="neutral">{getNotificationTypeLabel(notification.type)}</Badge>}
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {notification.body || 'Không có nội dung chi tiết.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {formatDateTime(notification.createdAt)}
          </span>
          {notification.deadlineAt && (
            <span style={{ fontSize: '12px', color: 'var(--warning)' }}>
              Hạn: {formatDateTime(notification.deadlineAt)}
            </span>
          )}
          {actionUrl && (
            <Link
              href={actionUrl}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent)',
                textDecoration: 'none',
              }}
            >
              Mở liên kết
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
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

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

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

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={28} style={{ color: 'var(--accent)' }} />
            Thông báo hệ thống
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Theo dõi các cập nhật mới về đề tài, báo cáo, hội đồng và các mốc quan trọng.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '18px',
        }}
      >
        <Card>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Tổng thông báo</p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{notifications.length}</p>
        </Card>
        <Card>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Chưa đọc</p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: unreadCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {unreadCount}
          </p>
        </Card>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '70px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '42px 24px' }}>
            <CheckCircle size={42} weight="duotone" style={{ color: 'var(--success)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 650, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Chưa có thông báo
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
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
          {notifications.map((notification) => (
            <NotificationRow
              key={notification._id}
              notification={notification}
              markingId={markingId}
              onMarkRead={handleMarkRead}
            />
          ))}
        </Card>
      )}

      {!loading && notifications.some((notification) => !notification.actionUrl) && (
        <p style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <Warning size={14} />
          Một số thông báo không có liên kết thao tác vì chỉ mang tính ghi nhận.
        </p>
      )}
    </div>
  );
}
