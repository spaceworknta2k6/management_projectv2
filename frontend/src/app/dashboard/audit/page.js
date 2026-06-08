'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, getRoleLabel, truncate } from '@/lib/utils';
import {
  ArrowsClockwise,
  ClockCounterClockwise,
  Funnel,
  MagnifyingGlass,
  ShieldCheck,
  UserCircle,
  X,
} from '@phosphor-icons/react';

const auditEntityTypeOptions = [
  { value: 'ProjectTopic', label: 'Đề tài' },
  { value: 'ProjectPeriod', label: 'Đợt đồ án' },
  { value: 'ProjectGroup', label: 'Nhóm đồ án' },
  { value: 'ProjectRoster', label: 'Danh sách sinh viên' },
  { value: 'Project', label: 'Dự án' },
  { value: 'User', label: 'Tài khoản người dùng' },
];

const auditEntityTypeLabels = Object.fromEntries(
  auditEntityTypeOptions.map((option) => [option.value, option.label])
);

function getId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
}

function getEntityTypeLabel(entityType) {
  return auditEntityTypeLabels[entityType] || entityType || 'Không xác định';
}

function getActorName(actor) {
  if (!actor) return 'Không rõ người thao tác';
  if (typeof actor === 'string') return actor;
  return actor.fullName || actor.name || actor.email || getId(actor);
}

function getActionTone(action = '') {
  const upper = action.toUpperCase();
  if (upper.includes('REJECT') || upper.includes('DELETE') || upper.includes('LOCK')) return 'error';
  if (upper.includes('APPROVE') || upper.includes('ACCEPT') || upper.includes('PUBLISH')) return 'success';
  if (upper.includes('SUBMIT') || upper.includes('CREATE')) return 'info';
  return 'neutral';
}

function serializeMetadata(metadata) {
  if (!metadata) return '';
  if (Array.isArray(metadata)) return JSON.stringify(metadata, null, 2);
  if (typeof metadata === 'object') {
    const entries = Object.entries(metadata);
    if (entries.length === 0) return '';
    return JSON.stringify(Object.fromEntries(entries), null, 2);
  }
  return String(metadata);
}

function SelectField({ label, name, value, onChange, error, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {label && (
        <label
          htmlFor={name}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </label>
      )}

      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          height: '40px',
          padding: '0 12px',
          fontSize: '14px',
          fontFamily: 'inherit',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          backgroundColor: 'var(--bg-raised)',
          border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          cursor: 'pointer',
        }}
        onFocus={(e) => {
          if (!error) {
            e.target.style.borderColor = 'var(--accent)';
            e.target.style.boxShadow = '0 0 0 3px var(--accent-glow)';
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? 'var(--error)' : 'var(--border)';
          e.target.style.boxShadow = 'none';
        }}
      >
        {children}
      </select>

      {error && (
        <div style={{ fontSize: '12px', color: 'var(--error)' }}>
          {error}
        </div>
      )}
    </div>
  );
}

function AuditEventRow({ event }) {
  const metadata = serializeMetadata(event.metadata);
  const actorRoles = event.actorRoles || event.actorId?.roles || [];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px minmax(0, 1fr)',
        gap: '14px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ShieldCheck size={20} weight="duotone" />
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <Badge variant={getActionTone(event.action)}>{event.action}</Badge>
          <Badge variant="neutral">{getEntityTypeLabel(event.entityType)}</Badge>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {formatDateTime(event.createdAt)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <UserCircle size={16} />
            {getActorName(event.actorId)}
          </span>
          {actorRoles.map((role) => (
            <Badge key={role} variant="neutral">{getRoleLabel(role)}</Badge>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '8px',
            marginBottom: event.reason || metadata ? '10px' : 0,
          }}
        >
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Mã bản ghi: <span style={{ color: 'var(--text-secondary)' }}>{getId(event.entityId)}</span>
          </p>
          {(event.fromStatus || event.toStatus) && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Trạng thái: <span style={{ color: 'var(--text-secondary)' }}>{event.fromStatus || 'N/A'} {'->'} {event.toStatus || 'N/A'}</span>
            </p>
          )}
          {event.ipAddress && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              IP: <span style={{ color: 'var(--text-secondary)' }}>{event.ipAddress}</span>
            </p>
          )}
        </div>

        {event.reason && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: metadata ? '10px' : 0 }}>
            {event.reason}
          </p>
        )}

        {metadata && (
          <pre
            style={{
              margin: 0,
              padding: '10px 12px',
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              lineHeight: 1.5,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {truncate(metadata, 700)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function AuditPage() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [visibleCount, setVisibleCount] = useState(50);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filters, setFilters] = useState({
    entityType: '',
    actorId: '',
    action: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    entityType: '',
    actorId: '',
    action: '',
  });
  const [historyForm, setHistoryForm] = useState({
    entityType: '',
    entityId: '',
  });
  const [historyError, setHistoryError] = useState('');

  const activeFilterCount = useMemo(
    () => Object.values(appliedFilters).filter(Boolean).length,
    [appliedFilters]
  );
  const visibleEvents = useMemo(
    () => events.slice(0, visibleCount),
    [events, visibleCount]
  );

  const fetchEvents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value.trim()) params.set(key, value.trim());
      });
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/audit/events${suffix}`, token);
      setEvents(res.data || []);
      setVisibleCount(50);
    } catch (err) {
      toast.error(err.message || 'Không thể tải nhật ký hệ thống.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, toast, token]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    setAppliedFilters(filters);
  };

  const handleResetFilters = () => {
    const empty = { entityType: '', actorId: '', action: '' };
    setFilters(empty);
    setAppliedFilters(empty);
  };

  const handleLoadHistory = async (e) => {
    e.preventDefault();
    setHistoryError('');

    const entityType = historyForm.entityType.trim();
    const entityId = historyForm.entityId.trim();
    if (!entityType || !entityId) {
      setHistoryError('Vui lòng chọn đối tượng thay đổi và nhập mã bản ghi.');
      return;
    }

    setHistoryLoading(true);
    try {
      const res = await api.get(
        `/audit/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
        token
      );
      setHistory(res.data || []);
      if ((res.data || []).length === 0) {
        toast.info('Không tìm thấy lịch sử cho thực thể này.');
      }
    } catch (err) {
      toast.error(err.message || 'Không thể tải lịch sử thực thể.');
    } finally {
      setHistoryLoading(false);
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
            <ClockCounterClockwise size={28} style={{ color: 'var(--accent)' }} />
            Nhật ký hệ thống
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Truy vết các thay đổi trạng thái, phê duyệt và tác vụ quan trọng trong hệ thống.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={fetchEvents} icon={<ArrowsClockwise size={16} />}>
          Làm mới
        </Button>
      </div>

      <Card style={{ marginBottom: '18px' }}>
        <form onSubmit={handleApplyFilters} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <SelectField
            label="Đối tượng thay đổi"
            name="audit-entity-type"
            value={filters.entityType}
            onChange={(e) => handleFilterChange('entityType', e.target.value)}
            style={{ flex: '1 1 190px' }}
          >
            <option value="">Tất cả đối tượng</option>
            {auditEntityTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <Input
            label="Người thao tác"
            name="audit-actor-id"
            placeholder="ObjectId người dùng"
            value={filters.actorId}
            onChange={(e) => handleFilterChange('actorId', e.target.value)}
            style={{ flex: '1 1 220px' }}
          />
          <Input
            label="Hành động"
            name="audit-action"
            placeholder="APPROVE_TOPIC..."
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            style={{ flex: '1 1 190px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="submit" variant="primary" icon={<Funnel size={16} />}>
              Lọc
            </Button>
            <Button type="button" variant="secondary" onClick={handleResetFilters} icon={<X size={16} />}>
              Xóa lọc
            </Button>
          </div>
        </form>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '18px',
        }}
      >
        <Card>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Sự kiện đang hiển thị</p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{events.length}</p>
        </Card>
        <Card>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Bộ lọc đang bật</p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
            {activeFilterCount}
          </p>
        </Card>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '70px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '42px 24px' }}>
            <ShieldCheck size={42} weight="duotone" style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 650, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Chưa có sự kiện phù hợp
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Thử xóa bộ lọc hoặc kiểm tra lại dữ liệu audit trong backend.
            </p>
          </div>
        </Card>
      ) : (
        <Card title="Dòng sự kiện" subtitle="Sắp xếp từ mới nhất đến cũ nhất" noPadding style={{ marginBottom: '18px' }}>
          {visibleEvents.map((event) => (
            <AuditEventRow key={event._id} event={event} />
          ))}
          {events.length > visibleCount && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 20px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setVisibleCount((count) => count + 50)}
              >
                Tải thêm {Math.min(50, events.length - visibleCount)} sự kiện
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card title="Lịch sử theo thực thể" subtitle="Tra cứu toàn bộ timeline của một bản ghi cụ thể">
        <form onSubmit={handleLoadHistory} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', marginBottom: '16px' }}>
          <SelectField
            label="Đối tượng thay đổi"
            name="audit-history-entity-type"
            value={historyForm.entityType}
            onChange={(e) => setHistoryForm((prev) => ({ ...prev, entityType: e.target.value }))}
            error={historyError && !historyForm.entityType.trim() ? historyError : ''}
            style={{ flex: '1 1 190px' }}
          >
            <option value="">Chọn đối tượng</option>
            {auditEntityTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <Input
            label="Mã bản ghi"
            name="audit-history-entity-id"
            placeholder="ObjectId"
            value={historyForm.entityId}
            onChange={(e) => setHistoryForm((prev) => ({ ...prev, entityId: e.target.value }))}
            error={historyError && !historyForm.entityId.trim() ? historyError : ''}
            style={{ flex: '2 1 280px' }}
          />
          <Button type="submit" loading={historyLoading} icon={<MagnifyingGlass size={16} />}>
            Tra cứu
          </Button>
        </form>

        {historyLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
            <Spinner />
          </div>
        ) : history.length > 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {history.map((event) => (
              <AuditEventRow key={event._id} event={event} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Chọn đối tượng thay đổi và nhập ObjectId để xem lịch sử riêng của bản ghi.
          </p>
        )}
      </Card>
    </div>
  );
}
