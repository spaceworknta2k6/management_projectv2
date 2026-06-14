'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
import css from './page.module.css';

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
  { id: 'general', label: 'Nhật ký chung' },
  { id: 'entity', label: 'Tra cứu theo thực thể' },
];

const auditTabLabels = {
  general: 'Nh\u1eadt k\u00fd chung',
  entity: 'Tra c\u1ee9u theo th\u1ef1c th\u1ec3',
};

const auditTabOptions = auditTabs.map((tab) => ({
  ...tab,
  label: auditTabLabels[tab.id] || tab.label,
}));

const PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const DEFAULT_FILTERS = {
  search: '',
  entityType: '',
  actorId: '',
  action: '',
  fromDate: '',
  toDate: '',
};

function getSafePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getSafePageSize(value) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : PAGE_SIZE;
}

function getInitialAuditQuery() {
  if (typeof window === 'undefined') {
    return {
      page: 1,
      limit: PAGE_SIZE,
      filters: DEFAULT_FILTERS,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const filters = { ...DEFAULT_FILTERS };
  Object.keys(filters).forEach((key) => {
    filters[key] = params.get(key) || '';
  });

  return {
    page: getSafePositiveInt(params.get('page'), 1),
    limit: getSafePageSize(params.get('limit')),
    filters,
  };
}

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

function SelectField({ label, name, value, onChange, error, children, className = '' }) {
  const rootClass = [css.selectField, className].filter(Boolean).join(' ');
  const selectClass = [
    css.selectInput,
    value ? '' : css.selectInputMuted,
    error ? css.selectInputError : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {label && (
        <label
          htmlFor={name} className={css.s1} >
          {label}
        </label>
      )}

      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={selectClass}
      >
        {children}
      </select>

      {error && (
        <div className={css.s2}>
          {error}
        </div>
      )}
    </div>
  );
}

function DetailLine({ label, value }) {
  return (
    <div className={css.s3}>
      <span className={css.s4}>{label}</span>
      <span className={css.s5}>
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
      }} className={css.s51} >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title" className={css.s6} >
        <div className={css.s7}>
          <div>
            <h3 id="audit-detail-title" className={css.s8}>
              Chi tiết bản ghi nhật ký
            </h3>
            <p className={css.s9}>
              {formatDateTime(event.createdAt)}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" icon={<X size={16} />} onClick={onClose} />
        </div>

        <div className={css.s10}>
          <div className={css.s11}>
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
            <div className={css.s12}>
              <p className={css.s13}>Dữ liệu bổ sung</p>
              <pre className={css.s14} >
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
      className={css.s52}
    >
      <div className={css.s15} >
        <ShieldCheck size={20} weight="duotone" />
      </div>

      <div className={css.s16}>
        <div className={css.s17}>
          <Badge variant={getActionTone(event.action)}>{getAuditActionLabel(event.action)}</Badge>
          <Badge variant="neutral">{getEntityTypeLabel(event.entityType)}</Badge>
          <span className={css.s18}>
            {formatDateTime(event.createdAt)}
          </span>
        </div>

        <div className={css.s19}>
          <span className={css.s20}>
            <UserCircle size={16} />
            {getActorName(event.actorId)}
          </span>
          {actorRoles.map((role) => (
            <Badge key={role} variant="neutral">{getRoleLabel(role)}</Badge>
          ))}
        </div>

        <div className={[css.eventMetaGrid, event.reason || metadata ? css.eventMetaGridSpaced : ''].filter(Boolean).join(' ')}>
          <p className={css.s21}>
            Mã bản ghi: <span className={css.s22}>{getId(event.entityId)}</span>
          </p>
          {(event.fromStatus || event.toStatus) && (
            <p className={css.s23}>
              Trạng thái: <span className={css.s24}>{getStatusTransitionLabel(event.fromStatus, event.toStatus)}</span>
            </p>
          )}
          {event.ipAddress && (
            <p className={css.s25}>
              IP: <span className={css.s26}>{event.ipAddress}</span>
            </p>
          )}
        </div>

        {event.reason && (
          <p className={[css.eventReason, metadata ? css.eventReasonSpaced : ''].filter(Boolean).join(' ')}>
            {translateReason(event.reason)}
          </p>
        )}

        {metadata && (
          <pre className={css.s27} >
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
  const router = useRouter();
  const pathname = usePathname();
  const initialQuery = useMemo(() => getInitialAuditQuery(), []);
  const [events, setEvents] = useState([]);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    limit: initialQuery.limit,
  });
  const [activeAuditTab, setActiveAuditTab] = useState('general');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState(initialQuery.filters);
  const [appliedFilters, setAppliedFilters] = useState(initialQuery.filters);
  const [historyForm, setHistoryForm] = useState({
    entityType: '',
    entityId: '',
  });
  const [historyError, setHistoryError] = useState('');

  const activeFilterCount = useMemo(
    () => Object.values(appliedFilters).filter(Boolean).length,
    [appliedFilters]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    Object.entries(appliedFilters).forEach(([key, value]) => {
      const trimmed = value.trim();
      if (trimmed) params.set(key, trimmed);
    });

    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [appliedFilters, currentPage, pageSize, pathname, router]);

  const fetchEvents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value.trim()) params.set(key, value.trim());
      });
      params.set('page', String(currentPage));
      params.set('limit', String(pageSize));
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/audit/events${suffix}`, token);
      setEvents(res.data || []);
      setPagination({
        total: res.pagination?.total || 0,
        totalPages: res.pagination?.totalPages || 1,
        limit: res.pagination?.limit || pageSize,
      });
    } catch (err) {
      toast.error(err.message || 'Không thể tải nhật ký hệ thống.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, currentPage, pageSize, toast, token]);

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
    const empty = { ...DEFAULT_FILTERS };
    setFilters(empty);
    setAppliedFilters(empty);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (nextPageSize) => {
    setPageSize(nextPageSize);
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
      <div className={css.s28} >
        <div>
          <h1 className={`text-display ${css.s29}`}>
            <ClockCounterClockwise size={28} className={css.s30} />
            Nhật ký hệ thống
          </h1>
          <p className={css.s31}>
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
          <Card className={css.s32}>
            <form onSubmit={handleApplyFilters} className={css.s33}>
              <Input
                label="Tìm kiếm"
                name="audit-search"
                placeholder="Hành động, nội dung, mã bản ghi"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)} className={css.filterSearch} />
              <SelectField
                label="Đối tượng thay đổi"
                name="audit-entity-type"
                value={filters.entityType}
                onChange={(e) => handleFilterChange('entityType', e.target.value)} className={css.s53} >
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
                onChange={(e) => handleFilterChange('actorId', e.target.value)} className={css.s54} />
              <SelectField
                label="Hành động"
                name="audit-action"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)} className={css.s55} >
                <option value="">Tất cả hành động</option>
                {auditActionOptions.map((action) => (
                  <option key={action} value={action}>
                    {getAuditActionLabel(action)}
                  </option>
                ))}
              </SelectField>
              <Input
                label="Từ ngày"
                name="audit-from-date"
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)} className={css.filterDate} />
              <Input
                label="Đến ngày"
                name="audit-to-date"
                type="date"
                value={filters.toDate}
                onChange={(e) => handleFilterChange('toDate', e.target.value)} className={css.filterDate} />
              <div className={css.s34}>
                <Button type="submit" variant="primary" icon={<Funnel size={16} />}>
                  Lọc
                </Button>
                <Button type="button" variant="secondary" onClick={handleResetFilters} icon={<X size={16} />}>
                  Xóa lọc
                </Button>
              </div>
            </form>
          </Card>

          <div className={css.s35} >
            <Card>
              <p className={css.s36}>Sự kiện đang hiển thị</p>
              <p className={css.s37}>{events.length}</p>
              <p className={css.metricHint}>{'T\u1ed5ng'} {pagination.total} {'b\u1ea3n ghi'}</p>
            </Card>
            <Card>
              <p className={css.s38}>Bộ lọc đang bật</p>
              <p className={[css.s37, activeFilterCount > 0 ? css.metricAccent : ''].filter(Boolean).join(' ')}>
                {activeFilterCount}
              </p>
            </Card>
          </div>

          {loading && events.length === 0 ? (
            <div className={css.s39}>
              <Spinner size="lg" />
            </div>
          ) : events.length === 0 ? (
            <Card>
              <div className={css.s40}>
                <ShieldCheck size={42} weight="duotone" className={css.s41} />
                <h3 className={css.s42}>
                  Chưa có sự kiện phù hợp
                </h3>
                <p className={css.s43}>
                  Thử xóa bộ lọc hoặc kiểm tra lại dữ liệu audit trong backend.
                </p>
              </div>
            </Card>
          ) : (
            <Card title="Dòng sự kiện" subtitle="Sắp xếp từ mới nhất đến cũ nhất" noPadding className={css.s44}>
              <div className={css.auditListWrap} aria-busy={loading}>
                <div className={loading ? css.auditListDimmed : ''}>
                  {events.map((event) => (
                    <AuditEventRow key={event._id} event={event} onSelect={setSelectedEvent} />
                  ))}
                </div>
                {loading && (
                  <div className={css.auditListLoading}>
                    <Spinner />
                    <span>{'\u0110ang t\u1ea3i b\u1ea3n ghi...'}</span>
                  </div>
                )}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                pageSize={pagination.limit}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={handlePageSizeChange}
                isLoading={loading}
                itemLabel={'b\u1ea3n ghi'}
                onPageChange={setCurrentPage}
              />
            </Card>
          )}
        </>
      ) : (
        <Card title="Lịch sử theo thực thể" subtitle="Tra cứu toàn bộ timeline của một bản ghi cụ thể">
          <form onSubmit={handleLoadHistory} className={css.s45}>
            <SelectField
              label="Đối tượng thay đổi"
              name="audit-history-entity-type"
              value={historyForm.entityType}
              onChange={(e) => setHistoryForm((prev) => ({ ...prev, entityType: e.target.value }))}
              error={historyError && !historyForm.entityType.trim() ? historyError : ''} className={css.s56} >
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
              error={historyError && !historyForm.entityId.trim() ? historyError : ''} className={css.s57} />
            <div className={css.s46}>
              <span className={css.s47}>&nbsp;</span>
              <Button type="submit" loading={historyLoading} icon={<MagnifyingGlass size={16} />}>
                Tra cứu
              </Button>
            </div>
          </form>

          {historyLoading ? (
            <div className={css.s48}>
              <Spinner />
            </div>
          ) : history.length > 0 ? (
            <div className={css.s49}>
              {history.map((event) => (
                <AuditEventRow key={event._id} event={event} onSelect={setSelectedEvent} />
              ))}
            </div>
          ) : (
            <p className={css.s50}>
              Chọn đối tượng thay đổi và nhập ID bản ghi để xem lịch sử riêng của bản ghi.
            </p>
          )}
        </Card>
      )}
      <AuditEventDetailDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
