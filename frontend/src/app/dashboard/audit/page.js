'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import Tabs from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, getAuditActionLabel, getRoleLabel, getStatus, truncate } from '@/lib/utils';
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

const auditActionOptions = [
  'PROPOSE_TOPIC',
  'REVIEW_TOPIC_APPROVE',
  'REVIEW_TOPIC_REJECT',
  'REVIEW_TOPIC_REQUEST-REVISION',
  'RESUBMIT_TOPIC',
  'ASSIGN_SUPERVISOR',
  'SPAWN_PROJECT',
  'CREATE_GROUP',
  'INVITE_MEMBER',
  'ACCEPT_INVITATION',
  'CONFIRM_GROUP',
  'UPDATE_GROUP',
  'SOFT_DELETE_GROUP',
  'CREATE_PERIOD',
  'UPDATE_PERIOD',
  'SOFT_DELETE_PERIOD',
  'START_PROJECT',
  'ASSIGN_REVIEWER',
  'MARK_DEFENSE_ELIGIBLE',
  'FINALIZE_PROJECT',
  'CANCEL_PROJECT',
  'IMPORT_ROSTER',
  'ADD_STUDENT_ROSTER',
  'REMOVE_STUDENT_ROSTER',
];

const auditTabs = [
  { id: 'general', label: 'Nháº­t kÃ½ chung' },
  { id: 'entity', label: 'Tra cá»©u theo thá»±c thá»ƒ' },
];

const auditTabLabels = {
  general: 'Nh\u1eadt k\u00fd chung',
  entity: 'Tra c\u1ee9u theo th\u1ef1c th\u1ec3',
};

const auditTabOptions = auditTabs.map((tab) => ({
  ...tab,
  label: auditTabLabels[tab.id] || tab.label,
}));

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

function getStatusLabel(status) {
  if (!status) return 'Không có';
  return getStatus(status).label || getAuditActionLabel(status);
}

function getStatusTransitionLabel(fromStatus, toStatus) {
  if (!fromStatus && !toStatus) return '';
  return `${getStatusLabel(fromStatus)} -> ${getStatusLabel(toStatus)}`;
}

function translateReason(reason = '') {
  return String(reason).replace(/\[([a-zA-Z0-9_-]+)\]/g, (_, status) => `[${getStatusLabel(status)}]`);
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

function DetailLine({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: '14px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
        {value || 'Không có'}
      </span>
    </div>
  );
}

function AuditEventDetailDialog({ event, onClose }) {
  if (!event) return null;

  const metadata = serializeMetadata(event.metadata);
  const actorRoles = event.actorRoles || event.actorId?.roles || [];

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '88dvh',
          overflow: 'auto',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 18px 60px rgba(15, 23, 42, 0.28)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 id="audit-detail-title" style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Chi tiết bản ghi nhật ký
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {formatDateTime(event.createdAt)}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" icon={<X size={16} />} onClick={onClose} />
        </div>

        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <Badge variant={getActionTone(event.action)}>{getAuditActionLabel(event.action)}</Badge>
            <Badge variant="neutral">{getEntityTypeLabel(event.entityType)}</Badge>
            {actorRoles.map((role) => (
              <Badge key={role} variant="neutral">{getRoleLabel(role)}</Badge>
            ))}
          </div>

          <DetailLine label="Mã nhật ký" value={getId(event._id)} />
          <DetailLine label="Mã bản ghi" value={getId(event.entityId)} />
          <DetailLine label="Người thao tác" value={getActorName(event.actorId)} />
          <DetailLine label="Hành động" value={getAuditActionLabel(event.action)} />
          <DetailLine label="Đối tượng" value={getEntityTypeLabel(event.entityType)} />
          <DetailLine label="Trạng thái" value={getStatusTransitionLabel(event.fromStatus, event.toStatus)} />
          <DetailLine label="Địa chỉ IP" value={event.ipAddress} />
          <DetailLine label="Nội dung" value={event.reason ? translateReason(event.reason) : ''} />

          {metadata && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Dữ liệu bổ sung</p>
              <pre
                style={{
                  margin: 0,
                  padding: '12px',
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
                {metadata}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditEventRow({ event, onSelect }) {
  const metadata = serializeMetadata(event.metadata);
  const actorRoles = event.actorRoles || event.actorId?.roles || [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(event);
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px minmax(0, 1fr)',
        gap: '14px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-raised)';
        e.currentTarget.style.transform = 'translateX(4px)';
        e.currentTarget.style.boxShadow = 'inset 3px 0 0 var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.boxShadow = 'inset 0 0 0 var(--accent)';
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
          <Badge variant={getActionTone(event.action)}>{getAuditActionLabel(event.action)}</Badge>
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
              Trạng thái: <span style={{ color: 'var(--text-secondary)' }}>{getStatusTransitionLabel(event.fromStatus, event.toStatus)}</span>
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
            {translateReason(event.reason)}
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
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 4;
  const [activeAuditTab, setActiveAuditTab] = useState('general');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
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
  const totalPages = useMemo(
    () => Math.ceil(events.length / PAGE_SIZE),
    [events]
  );
  const paginatedEvents = useMemo(
    () => events.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [events, currentPage]
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
      setCurrentPage(1);
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
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    const empty = { entityType: '', actorId: '', action: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    setCurrentPage(1);
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

      <Tabs tabs={auditTabOptions} activeTab={activeAuditTab} onChange={setActiveAuditTab} />

      {activeAuditTab === 'general' ? (
        <>
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
                placeholder="ID người dùng"
                value={filters.actorId}
                onChange={(e) => handleFilterChange('actorId', e.target.value)}
                style={{ flex: '1 1 220px' }}
              />
              <SelectField
                label="Hành động"
                name="audit-action"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                style={{ flex: '1 1 190px' }}
              >
                <option value="">Tất cả hành động</option>
                {auditActionOptions.map((action) => (
                  <option key={action} value={action}>
                    {getAuditActionLabel(action)}
                  </option>
                ))}
              </SelectField>
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
              {paginatedEvents.map((event) => (
                <AuditEventRow key={event._id} event={event} onSelect={setSelectedEvent} />
              ))}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={events.length}
                pageSize={PAGE_SIZE}
                itemLabel={'b\u1ea3n ghi'}
                onPageChange={setCurrentPage}
              />
            </Card>
          )}
        </>
      ) : (
        <Card title="Lịch sử theo thực thể" subtitle="Tra cứu toàn bộ timeline của một bản ghi cụ thể">
          <form onSubmit={handleLoadHistory} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
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
              placeholder="ID bản ghi"
              value={historyForm.entityId}
              onChange={(e) => setHistoryForm((prev) => ({ ...prev, entityId: e.target.value }))}
              error={historyError && !historyForm.entityId.trim() ? historyError : ''}
              style={{ flex: '2 1 280px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, visibility: 'hidden', userSelect: 'none' }}>&nbsp;</span>
              <Button type="submit" loading={historyLoading} icon={<MagnifyingGlass size={16} />}>
                Tra cứu
              </Button>
            </div>
          </form>

          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
              <Spinner />
            </div>
          ) : history.length > 0 ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {history.map((event) => (
                <AuditEventRow key={event._id} event={event} onSelect={setSelectedEvent} />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Chọn đối tượng thay đổi và nhập ID bản ghi để xem lịch sử riêng của bản ghi.
            </p>
          )}
        </Card>
      )}
      <AuditEventDetailDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
