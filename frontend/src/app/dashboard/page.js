'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/auth.store';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { getRoleLabel, formatDate, getStatus } from '@/lib/utils';
import api from '@/services/api';
import {
  Users,
  BookOpen,
  FolderSimple,
  CalendarBlank,
  FileText,
  Lightning,
} from '@phosphor-icons/react';

/* ─── Stat Card ──────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, accent }) {
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
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: accent || 'var(--accent-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} weight="duotone" style={{ color: 'var(--accent)' }} />
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
          {value ?? '—'}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {label}
        </p>
      </div>
    </div>
  );
}

/* ─── Dashboard Page ─────────────────────────────────────────────── */
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const loadDashboard = async () => {
      try {
        // Fetch relevant counts based on role
        const promises = [];

        if (['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(user?.role || user?.roles?.[0])) {
          promises.push(
            api.get('/periods', token).then((r) => ({ periods: r.data?.length || 0 })).catch(() => ({ periods: 0 })),
            api.get('/groups', token).then((r) => ({ groups: r.data?.length || 0 })).catch(() => ({ groups: 0 })),
            api.get('/topics', token).then((r) => ({ topics: r.data?.length || 0 })).catch(() => ({ topics: 0 })),
            api.get('/projects', token).then((r) => ({ projects: r.data?.length || 0 })).catch(() => ({ projects: 0 })),
          );
        } else {
          promises.push(
            api.get('/groups', token).then((r) => ({ groups: r.data?.length || 0 })).catch(() => ({ groups: 0 })),
            api.get('/topics', token).then((r) => ({ topics: r.data?.length || 0 })).catch(() => ({ topics: 0 })),
            api.get('/projects', token).then((r) => ({ projects: r.data?.length || 0 })).catch(() => ({ projects: 0 })),
          );
        }

        const results = await Promise.all(promises);
        const merged = Object.assign({}, ...results);
        setStats(merged);
      } catch {
        // Silently fail — dashboard is informational
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [token, user?.role]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  const isStaff = ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(user?.role || user?.roles?.[0]);

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="text-display">{greeting()}, {user?.name || 'Người dùng'}</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>
          <Badge variant="info">{getRoleLabel(user?.role || user?.roles?.[0])}</Badge>
          <span style={{ marginLeft: '8px' }}>
            Hôm nay là {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </p>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {isStaff && (
          <StatCard icon={CalendarBlank} label="Đợt đồ án" value={stats?.periods} />
        )}
        <StatCard icon={Users} label="Nhóm" value={stats?.groups} />
        <StatCard icon={BookOpen} label="Đề tài" value={stats?.topics} />
        <StatCard icon={FolderSimple} label="Dự án" value={stats?.projects} />
      </div>

      {/* Quick actions */}
      <Card title="Bắt đầu nhanh" subtitle="Các hành động thường dùng">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <QuickAction
            icon={BookOpen}
            label="Xem đề tài"
            href="/dashboard/topics"
          />
          <QuickAction
            icon={Users}
            label="Quản lý nhóm"
            href="/dashboard/groups"
          />
          <QuickAction
            icon={FileText}
            label="Nộp bài"
            href="/dashboard/submissions"
          />
          {isStaff && (
            <QuickAction
              icon={Lightning}
              label="Tạo đợt đồ án"
              href="/dashboard/periods"
            />
          )}
        </div>
      </Card>
    </div>
  );
}

/* ─── Quick Action ────────────────────────────────────────────────── */
function QuickAction({ icon: Icon, label, href }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
        fontFamily: 'inherit',
        color: 'var(--text-secondary)',
        textDecoration: 'none',
        transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--accent-glow)';
        e.currentTarget.style.color = 'var(--accent)';
        e.currentTarget.style.borderColor = 'rgba(79,142,247,0.25)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
        e.currentTarget.style.color = 'var(--text-secondary)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <Icon size={18} weight="duotone" />
      {label}
    </Link>
  );
}
