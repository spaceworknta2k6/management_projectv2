'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/auth.store';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { formatDate, getPrimaryRole, hasAnyRole } from '@/lib/utils';
import api from '@/services/api';
import {
  Users,
  BookOpen,
  FolderSimple,
  CalendarBlank,
  FileText,
  Lightning,
  Bell,
  CheckCircle,
  Clock,
  Warning,
} from '@phosphor-icons/react';

function getId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
}

function isStudentInProject(project, studentId) {
  if (!studentId) return false;
  return project.groupId?.members?.some((member) => getId(member.studentId) === studentId);
}

function isLecturerOnProject(project, user) {
  const lecturerId = getId(user?.lecturerId);
  const userId = getId(user?._id || user?.id);

  return (
    getId(project.supervisorId) === lecturerId ||
    getId(project.reviewerId) === lecturerId ||
    getId(project.supervisorId?.userId) === userId ||
    getId(project.reviewerId?.userId) === userId
  );
}

function getProjectTitle(project) {
  return project.topicId?.title || 'Dự án chưa cập nhật đề tài';
}

function getDaysUntil(date) {
  const deadline = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function StatCard({ icon: Icon, label, value, tone = 'info' }) {
  const toneColor = {
    info: 'var(--accent)',
    warning: 'var(--warning)',
    success: 'var(--success)',
    error: 'var(--error)',
  }[tone];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '18px 20px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        minHeight: '82px',
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--accent-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} weight="duotone" style={{ color: toneColor }} />
      </div>
      <div>
        <p
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          {value ?? 0}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function ActionItem({ item }) {
  const Icon = item.icon || Lightning;

  return (
    <Link
      href={item.href}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 0',
        color: 'inherit',
        textDecoration: 'none',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: item.variant === 'error' ? 'var(--error-bg)' : item.variant === 'warning' ? 'var(--warning-bg)' : 'var(--accent-glow)',
          color: item.variant === 'error' ? 'var(--error)' : item.variant === 'warning' ? 'var(--warning)' : 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={19} weight="duotone" />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '14px', fontWeight: 650, color: 'var(--text-primary)' }}>
            {item.title}
          </p>
          <Badge variant={item.variant || 'info'}>{item.badge}</Badge>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {item.description}
        </p>
      </div>

      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
        Xử lý
      </span>
    </Link>
  );
}

function DeadlineItem({ item }) {
  const daysLeft = getDaysUntil(item.deadline);
  const isOverdue = daysLeft < 0;
  const isSoon = daysLeft >= 0 && daysLeft <= 3;

  return (
    <Link
      href={item.href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 0',
        color: 'inherit',
        textDecoration: 'none',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {item.title}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
          {item.projectTitle}
        </p>
      </div>
      <Badge variant={isOverdue ? 'error' : isSoon ? 'warning' : 'info'}>
        {isOverdue ? `Trễ ${Math.abs(daysLeft)} ngày` : daysLeft === 0 ? 'Hôm nay' : `${daysLeft} ngày`}
      </Badge>
    </Link>
  );
}

function QuickAction({ icon: Icon, label, href }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        textDecoration: 'none',
      }}
    >
      <Icon size={18} weight="duotone" />
      {label}
    </Link>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [dashboard, setDashboard] = useState({
    periods: [],
    groups: [],
    topics: [],
    projects: [],
    notifications: [],
    milestonesByProject: {},
  });
  const [loading, setLoading] = useState(true);

  const role = getPrimaryRole(user);
  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const isStudent = hasAnyRole(user, ['STUDENT']);

  useEffect(() => {
    if (!token || !user) return;

    let alive = true;

    async function loadDashboard() {
      setLoading(true);
      try {
        const [periodsRes, groupsRes, topicsRes, projectsRes, notificationsRes] = await Promise.all([
          isStaff ? api.get('/periods', token).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          api.get('/groups', token).catch(() => ({ data: [] })),
          api.get('/topics', token).catch(() => ({ data: [] })),
          api.get('/projects', token).catch(() => ({ data: [] })),
          api.get('/notifications', token).catch(() => ({ data: [] })),
        ]);

        let projects = projectsRes.data || [];
        if (isStudent) {
          projects = projects.filter((project) => isStudentInProject(project, getId(user.studentId)));
        } else if (isLecturer) {
          projects = projects.filter((project) => isLecturerOnProject(project, user));
        }

        const milestonePairs = await Promise.all(
          projects.slice(0, 12).map((project) =>
            api.get(`/projects/${project._id}/milestones`, token)
              .then((res) => [project._id, res.data || []])
              .catch(() => [project._id, []])
          )
        );

        if (!alive) return;

        setDashboard({
          periods: periodsRes.data || [],
          groups: groupsRes.data || [],
          topics: topicsRes.data || [],
          projects,
          notifications: notificationsRes.data || [],
          milestonesByProject: Object.fromEntries(milestonePairs),
        });
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      alive = false;
    };
  }, [token, user, role, isStaff, isLecturer, isStudent]);

  const actionItems = useMemo(() => {
    const items = [];
    const studentId = getId(user?.studentId);

    dashboard.notifications
      .filter((notification) => !notification.readAt)
      .slice(0, 3)
      .forEach((notification) => {
        items.push({
          id: `notification-${notification._id}`,
          icon: Bell,
          title: notification.title || 'Thông báo mới',
          description: notification.body || 'Có cập nhật mới cần xem.',
          href: notification.actionUrl || '/dashboard/notifications',
          badge: 'Thông báo',
          variant: 'info',
          priority: 20,
        });
      });

    if (isStaff) {
      dashboard.topics
        .filter((topic) => ['submitted', 'ai_checked', 'pending_review'].includes(topic.status))
        .slice(0, 5)
        .forEach((topic) => {
          items.push({
            id: `topic-review-${topic._id}`,
            icon: BookOpen,
            title: 'Duyệt đề tài đang chờ',
            description: topic.title,
            href: '/dashboard/topics',
            badge: 'Giáo vụ',
            variant: 'warning',
            priority: 10,
          });
        });

      dashboard.projects
        .filter((project) => !project.reviewerId)
        .slice(0, 5)
        .forEach((project) => {
          items.push({
            id: `reviewer-${project._id}`,
            icon: Users,
            title: 'Phân công giảng viên phản biện',
            description: getProjectTitle(project),
            href: '/dashboard/projects',
            badge: 'Thiếu phân công',
            variant: 'warning',
            priority: 12,
          });
        });

      dashboard.projects
        .filter((project) => project.status === 'defense_eligible')
        .slice(0, 4)
        .forEach((project) => {
          items.push({
            id: `finalize-${project._id}`,
            icon: CheckCircle,
            title: 'Chốt hoàn tất dự án đủ điều kiện',
            description: getProjectTitle(project),
            href: '/dashboard/projects',
            badge: 'Cần chốt',
            variant: 'success',
            priority: 16,
          });
        });
    }

    if (isStudent) {
      dashboard.topics
        .filter((topic) => topic.status === 'needs_revision' && getId(topic.proposedByStudentId) === studentId)
        .forEach((topic) => {
          items.push({
            id: `topic-revision-${topic._id}`,
            icon: Warning,
            title: 'Đề tài cần chỉnh sửa',
            description: topic.title,
            href: '/dashboard/topics',
            badge: 'Cần sửa',
            variant: 'warning',
            priority: 8,
          });
        });

      dashboard.projects
        .filter((project) => project.status === 'assigned')
        .forEach((project) => {
          items.push({
            id: `start-${project._id}`,
            icon: FolderSimple,
            title: 'Bắt đầu thực hiện dự án',
            description: getProjectTitle(project),
            href: '/dashboard/projects',
            badge: 'Dự án mới',
            variant: 'info',
            priority: 14,
          });
        });
    }

    if (isLecturer) {
      dashboard.projects.forEach((project) => {
        const milestones = dashboard.milestonesByProject[project._id] || [];
        milestones
          .filter((milestone) => milestone.status === 'submitted')
          .forEach((milestone) => {
            items.push({
              id: `feedback-${milestone._id}`,
              icon: FileText,
              title: 'Đánh giá báo cáo sinh viên',
              description: `${milestone.title} · ${getProjectTitle(project)}`,
              href: '/dashboard/submissions',
              badge: 'Cần nhận xét',
              variant: 'warning',
              priority: 9,
            });
          });
      });
    }

    return items.sort((a, b) => a.priority - b.priority).slice(0, 8);
  }, [dashboard, user, isStaff, isLecturer, isStudent]);

  const deadlines = useMemo(() => {
    const rows = [];

    dashboard.projects.forEach((project) => {
      const milestones = dashboard.milestonesByProject[project._id] || [];
      milestones
        .filter((milestone) => milestone.deadline && !['accepted', 'locked'].includes(milestone.status))
        .forEach((milestone) => {
          rows.push({
            id: milestone._id,
            title: milestone.title,
            projectTitle: getProjectTitle(project),
            deadline: milestone.deadline,
            href: '/dashboard/submissions',
          });
        });
    });

    return rows
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 6);
  }, [dashboard.projects, dashboard.milestonesByProject]);

  const stats = useMemo(() => {
    const pendingTopics = dashboard.topics.filter((topic) =>
      ['submitted', 'ai_checked', 'pending_review'].includes(topic.status)
    ).length;
    const unreadNotifications = dashboard.notifications.filter((notification) => !notification.readAt).length;
    const submittedMilestones = Object.values(dashboard.milestonesByProject)
      .flat()
      .filter((milestone) => milestone.status === 'submitted').length;

    return {
      periods: dashboard.periods.length,
      groups: dashboard.groups.length,
      topics: dashboard.topics.length,
      projects: dashboard.projects.length,
      pendingTopics,
      unreadNotifications,
      submittedMilestones,
    };
  }, [dashboard]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="text-display">
          {greeting}, {user?.fullName || user?.name || 'người dùng'}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>
          Hôm nay là {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {isStaff && <StatCard icon={CalendarBlank} label="Đợt đồ án" value={stats.periods} />}
        <StatCard icon={Users} label="Nhóm" value={stats.groups} />
        <StatCard icon={BookOpen} label={isStaff ? 'Đề tài chờ duyệt' : 'Đề tài'} value={isStaff ? stats.pendingTopics : stats.topics} tone={isStaff && stats.pendingTopics > 0 ? 'warning' : 'info'} />
        <StatCard icon={FolderSimple} label="Dự án" value={stats.projects} />
        <StatCard icon={Bell} label="Thông báo chưa đọc" value={stats.unreadNotifications} tone={stats.unreadNotifications > 0 ? 'warning' : 'success'} />
        {(isLecturer || hasAnyRole(user, ['SYSTEM_ADMIN'])) && <StatCard icon={FileText} label="Báo cáo cần xem" value={stats.submittedMilestones} tone={stats.submittedMilestones > 0 ? 'warning' : 'success'} />}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px',
          alignItems: 'start',
          marginBottom: '28px',
        }}
      >
        <Card title="Việc cần xử lý" subtitle="Các đầu việc quan trọng được gom theo vai trò của bạn">
          {actionItems.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <CheckCircle size={36} weight="duotone" style={{ color: 'var(--success)', marginBottom: '10px' }} />
              <p style={{ fontSize: '14px', fontWeight: 650, color: 'var(--text-primary)' }}>
                Chưa có việc gấp cần xử lý
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Khi có đề tài, báo cáo, thông báo hoặc phân công mới, hệ thống sẽ đưa lên đây.
              </p>
            </div>
          ) : (
            <div>
              {actionItems.map((item) => (
                <ActionItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Deadline gần" subtitle="Các mốc nộp bài chưa khóa hoặc chưa đạt">
          {deadlines.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <Clock size={34} weight="duotone" style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Chưa có deadline mở cho các dự án hiện tại.
              </p>
            </div>
          ) : (
            <div>
              {deadlines.map((item) => (
                <DeadlineItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Bắt đầu nhanh" subtitle="Các khu vực thường dùng">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <QuickAction icon={BookOpen} label="Xem đề tài" href="/dashboard/topics" />
          <QuickAction icon={Users} label="Quản lý nhóm" href="/dashboard/groups" />
          {(isStudent || isLecturer || hasAnyRole(user, ['SYSTEM_ADMIN'])) && <QuickAction icon={FileText} label="Nộp bài" href="/dashboard/submissions" />}
          <QuickAction icon={FolderSimple} label="Dự án" href="/dashboard/projects" />
          {isStaff && <QuickAction icon={Lightning} label="Tạo đợt đồ án" href="/dashboard/periods" />}
        </div>
      </Card>
    </div>
  );
}
