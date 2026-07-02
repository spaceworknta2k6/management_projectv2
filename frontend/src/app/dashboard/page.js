'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/auth.store';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { formatDate, getPrimaryRole, hasAnyRole } from '@/lib/utils';
import { getId, isStudentProjectOwner } from '@/lib/projectOwner';
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
import css from './page.module.css';

function isStudentInProject(project, studentId) {
  return isStudentProjectOwner(project, studentId);
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
  const toneClass = css[`tone${tone.charAt(0).toUpperCase()}${tone.slice(1)}`] || css.toneInfo;

  return (
    <div className={css.s1} >
      <div className={css.s2} >
        <Icon size={22} weight="duotone" className={toneClass} />
      </div>
      <div>
        <p className={css.s3} >
          {value ?? 0}
        </p>
        <p className={css.s4}>
          {label}
        </p>
      </div>
    </div>
  );
}

function ActionItem({ item }) {
  const Icon = item.icon || Lightning;
  const variant = item.variant || 'info';
  const iconClass = [
    css.actionIcon,
    css[`actionIcon${variant.charAt(0).toUpperCase()}${variant.slice(1)}`] || css.actionIconInfo,
  ].filter(Boolean).join(' ');

  return (
    <Link
      href={item.href} className={css.s5} >
      <div className={iconClass}>
        <Icon size={19} weight="duotone" />
      </div>

      <div className={css.s6}>
        <div className={css.s7}>
          <p className={css.s8}>
            {item.title}
          </p>
          <Badge variant={item.variant || 'info'}>{item.badge}</Badge>
        </div>
        <p className={css.s9}>
          {item.description}
        </p>
      </div>

      <span className={css.s10}>
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
      href={item.href} className={css.s11} >
      <div className={css.s12}>
        <p className={css.s13}>
          {item.title}
        </p>
        <p className={css.s14}>
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
      href={href} className={css.s15} >
      <Icon size={18} weight="duotone" />
      {label}
    </Link>
  );
}

function TopicDonutChart({ topics }) {
  const stats = useMemo(() => {
    const counts = { approved: 0, pending: 0, rejected: 0, revision: 0 };
    topics.forEach((t) => {
      if (t.status === 'approved') counts.approved++;
      else if (['submitted', 'pending_review'].includes(t.status)) counts.pending++;
      else if (t.status === 'rejected') counts.rejected++;
      else if (t.status === 'needs_revision') counts.revision++;
    });
    return counts;
  }, [topics]);

  const total = stats.approved + stats.pending + stats.rejected + stats.revision;

  if (total === 0) {
    return <div className={css.emptyChart}>Không có dữ liệu đề tài</div>;
  }

  const items = [
    { label: 'Đã duyệt', count: stats.approved, color: 'var(--success)' },
    { label: 'Chờ duyệt', count: stats.pending, color: 'var(--warning)' },
    { label: 'Cần sửa đổi', count: stats.revision, color: 'var(--accent)' },
    { label: 'Từ chối', count: stats.rejected, color: 'var(--error)' },
  ].filter((item) => item.count > 0);

  const size = 160;
  const r = 50;
  const circ = 2 * Math.PI * r;
  const strokeWidth = 14;
  const center = size / 2;

  let currentOffset = 0;

  return (
    <div className={css.chartWrapper}>
      <div className={css.svgContainer}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="transparent"
            stroke="var(--bg-raised)"
            strokeWidth={strokeWidth}
          />
          {items.map((item, idx) => {
            const pct = item.count / total;
            const strokeLength = pct * circ;
            const strokeOffset = circ - currentOffset + circ / 4;
            currentOffset += strokeLength;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={r}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${strokeLength} ${circ - strokeLength}`}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                className={css.donutSlice}
              />
            );
          })}
        </svg>
        <div className={css.chartCenterLabel}>
          <span className={css.chartCenterValue}>{total}</span>
          <span className={css.chartCenterSub}>Đề tài</span>
        </div>
      </div>
      <div className={css.chartLegend}>
        {items.map((item, idx) => (
          <div key={idx} className={css.legendItem}>
            <span className={css.legendBullet} style={{ backgroundColor: item.color }} />
            <span className={css.legendLabel}>{item.label}:</span>
            <span className={css.legendValue}>
              {item.count} ({Math.round((item.count / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectProgressBar({ projects }) {
  const stats = useMemo(() => {
    const counts = {
      assigned: 0,
      in_progress: 0,
      final_report_submitted: 0,
      ready_for_grading: 0,
      finalized: 0,
      cancelled: 0,
    };
    projects.forEach((p) => {
      if (p.status === 'assigned') counts.assigned++;
      else if (p.status === 'in_progress') counts.in_progress++;
      else if (['final_report_submitted', 'supervisor_reviewed', 'reviewer_reviewed'].includes(p.status)) {
        counts.final_report_submitted++;
      } else if (p.status === 'ready_for_grading') counts.ready_for_grading++;
      else if (p.status === 'finalized') counts.finalized++;
      else if (p.status === 'cancelled') counts.cancelled++;
    });
    return counts;
  }, [projects]);

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return <div className={css.emptyChart}>Không có dữ liệu dự án</div>;
  }

  const items = [
    { label: 'Mới phân công', count: stats.assigned, color: 'var(--accent)' },
    { label: 'Đang thực hiện', count: stats.in_progress, color: 'var(--warning)' },
    { label: 'Nộp báo cáo cuối', count: stats.final_report_submitted, color: '#a855f7' },
    { label: 'Sẵn sàng chấm', count: stats.ready_for_grading, color: '#10b981' },
    { label: 'Đã hoàn thành', count: stats.finalized, color: 'var(--success)' },
    { label: 'Đã hủy', count: stats.cancelled, color: 'var(--error)' },
  ].filter((item) => item.count > 0);

  return (
    <div className={css.barChartWrapper}>
      <div className={css.barContainer}>
        {items.map((item, idx) => {
          const pct = (item.count / total) * 100;
          return (
            <div
              key={idx}
              className={css.barSegment}
              style={{
                width: `${pct}%`,
                backgroundColor: item.color,
              }}
              title={`${item.label}: ${item.count} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <div className={css.barLegendGrid}>
        {items.map((item, idx) => (
          <div key={idx} className={css.legendItem}>
            <span className={css.legendBullet} style={{ backgroundColor: item.color }} />
            <span className={css.legendLabel}>{item.label}:</span>
            <span className={css.legendValue}>
              {item.count} ({Math.round((item.count / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
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
        .filter((topic) => ['submitted', 'pending_review'].includes(topic.status))
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
            title: 'Phân công giảng viên chấm 2',
            description: getProjectTitle(project),
            href: '/dashboard/projects',
            badge: 'Thiếu phân công',
            variant: 'warning',
            priority: 12,
          });
        });

      dashboard.projects
        .filter((project) => project.status === 'ready_for_grading')
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
      ['submitted', 'pending_review'].includes(topic.status)
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
      <div className={css.s16}>
        <Spinner size="lg" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div>
      <div className={css.s17}>
        <h1 className="text-display">
          {greeting}, {user?.fullName || user?.name || 'người dùng'}
        </h1>
        <p className={css.s18}>
          Hôm nay là {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className={css.s19} >
        {isStaff && <StatCard icon={CalendarBlank} label="Đợt đồ án" value={stats.periods} />}
        <StatCard icon={Users} label="Cá nhân/Nhóm" value={stats.groups} />
        <StatCard icon={BookOpen} label={isStaff ? 'Đề tài chờ duyệt' : 'Đề tài'} value={isStaff ? stats.pendingTopics : stats.topics} tone={isStaff && stats.pendingTopics > 0 ? 'warning' : 'info'} />
        <StatCard icon={FolderSimple} label="Dự án" value={stats.projects} />
        <StatCard icon={Bell} label="Thông báo chưa đọc" value={stats.unreadNotifications} tone={stats.unreadNotifications > 0 ? 'warning' : 'success'} />
        {(isLecturer || hasAnyRole(user, ['SYSTEM_ADMIN'])) && <StatCard icon={FileText} label="Báo cáo cần xem" value={stats.submittedMilestones} tone={stats.submittedMilestones > 0 ? 'warning' : 'success'} />}
      </div>

      <div className={css.chartsGrid}>
        <Card title="Trạng thái đề tài" subtitle="Biểu đồ phân bố trạng thái phê duyệt đề tài">
          <TopicDonutChart topics={dashboard.topics} />
        </Card>
        <Card title="Tiến độ dự án" subtitle="Tỉ lệ hoàn thành và trạng thái dự án đang thực hiện">
          <ProjectProgressBar projects={dashboard.projects} />
        </Card>
      </div>

      <div className={css.s20} >
        <Card title="Việc cần xử lý" subtitle="Các đầu việc quan trọng được gom theo vai trò của bạn">
          {actionItems.length === 0 ? (
            <div className={css.s21}>
              <CheckCircle size={36} weight="duotone" className={css.s22} />
              <p className={css.s23}>
                Chưa có việc gấp cần xử lý
              </p>
              <p className={css.s24}>
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
            <div className={css.s25}>
              <Clock size={34} weight="duotone" className={css.s26} />
              <p className={css.s27}>
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
        <div className={css.s28}>
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
