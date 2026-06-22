'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatDate, getTechnicalLabel, hasAnyRole } from '@/lib/utils';
import { Sword, Plus, ArrowsClockwise, VideoCamera, MapPin, Clock, PencilSimple, Trash, MagnifyingGlass, Calendar, List, CaretLeft, CaretRight, CheckCircle, Warning } from '@phosphor-icons/react';
import css from './page.module.css';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

function getSafePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getSafePageSize(value) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : PAGE_SIZE;
}

function getInitialQuery() {
  if (typeof window === 'undefined') return { page: 1, limit: PAGE_SIZE, search: '' };
  const params = new URLSearchParams(window.location.search);
  return {
    page: getSafePositiveInt(params.get('page'), 1),
    limit: getSafePageSize(params.get('limit')),
    search: params.get('search') || '',
  };
}

const TIME_SLOTS = [
  { number: 1, label: 'Ca 1', startTime: '08:00', endTime: '09:00' },
  { number: 2, label: 'Ca 2', startTime: '09:00', endTime: '10:00' },
  { number: 3, label: 'Ca 3', startTime: '10:00', endTime: '11:00' },
  { number: 4, label: 'Ca 4', startTime: '11:00', endTime: '12:00' },
  { number: 5, label: 'Ca 5', startTime: '13:30', endTime: '14:30' },
  { number: 6, label: 'Ca 6', startTime: '14:30', endTime: '15:30' },
  { number: 7, label: 'Ca 7', startTime: '15:30', endTime: '16:30' },
  { number: 8, label: 'Ca 8', startTime: '16:30', endTime: '17:30' },
];

function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDays(monday) {
  const days = [];
  for (let i = 0; i < 6; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    days.push(nextDay);
  }
  return days;
}

export default function DefensesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token } = useAuthStore();
  const toast = useToast();

  const initialQuery = useMemo(() => getInitialQuery(), []);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [search, setSearch] = useState(initialQuery.search);

  
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [committees, setCommittees] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);

  // Form
  const [form, setForm] = useState({
    projectId: '',
    committeeId: '',
    mode: 'offline',
    room: '',
    meetingUrl: '',
    defenseDate: '',
    startTime: '',
    endTime: '',
    orderNumber: 1,
  });

  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [validationResult, setValidationResult] = useState({ loading: false, success: null, message: '' });
  const [dragOverCell, setDragOverCell] = useState(null); // 'YYYY-MM-DD-slotNumber'

  const runValidation = useCallback(async (payload) => {
    if (!payload.projectId || !payload.committeeId || !payload.defenseDate || !payload.startTime || !payload.endTime) {
      setValidationResult({ loading: false, success: null, message: '' });
      return;
    }
    try {
      setValidationResult(prev => ({ ...prev, loading: true }));
      await api.post('/defense-sessions/validate', {
        projectId: payload.projectId,
        committeeId: payload.committeeId,
        defenseDate: payload.defenseDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        excludeSessionId: editingSession?._id || null,
      }, token);
      setValidationResult({ loading: false, success: true, message: 'Quy chế hợp lệ (Không trùng lịch & không xung đột lợi ích).' });
    } catch (err) {
      setValidationResult({
        loading: false,
        success: false,
        message: err.message || 'Lỗi khi kiểm tra quy chế.'
      });
    }
  }, [editingSession, token]);

  useEffect(() => {
    if (showModal && token) {
      const timer = setTimeout(() => {
        runValidation(form);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setValidationResult({ loading: false, success: null, message: '' });
    }
  }, [form.projectId, form.committeeId, form.defenseDate, form.startTime, form.endTime, showModal, token, runValidation]);

  const startOfWeek = useMemo(() => getStartOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(startOfWeek), [startOfWeek]);

  const unscheduledProjects = useMemo(() => {
    const scheduledProjectIds = new Set(
      sessions
        .filter(s => s.status !== 'cancelled' && !s.isDeleted)
        .map(s => s.projectId?._id || s.projectId)
    );
    return projects.filter(p => !scheduledProjectIds.has(p._id));
  }, [projects, sessions]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [sessionsRes, projectsRes, committeesRes] = await Promise.all([
        api.get('/defense-sessions', token),
        api.get('/projects', token),
        api.get('/committees', token),
      ]);
      
      setSessions(sessionsRes.data || []);
      setProjects(projectsRes.data || []);
      setCommittees(committeesRes.data || []);
      
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu lịch bảo vệ');
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projectId) {
      toast.error('Vui lòng chọn dự án cần bảo vệ.');
      return;
    }
    if (!form.committeeId) {
      toast.error('Vui lòng chọn hội đồng đánh giá.');
      return;
    }
    if (!form.mode) {
      toast.error('Vui lòng chọn hình thức bảo vệ.');
      return;
    }
    if (!form.orderNumber || form.orderNumber < 1) {
      toast.error('Vui lòng nhập số thứ tự bảo vệ hợp lệ.');
      return;
    }
    if (form.mode === 'offline' && (!form.room || !form.room.trim())) {
      toast.error('Vui lòng nhập phòng bảo vệ.');
      return;
    }
    if (form.mode === 'online' && (!form.meetingUrl || !form.meetingUrl.trim())) {
      toast.error('Vui lòng nhập link phòng họp trực tuyến.');
      return;
    }
    if (!form.defenseDate) {
      toast.error('Vui lòng chọn ngày bảo vệ.');
      return;
    }
    if (!form.startTime) {
      toast.error('Vui lòng nhập giờ bắt đầu.');
      return;
    }
    if (!form.endTime) {
      toast.error('Vui lòng nhập giờ kết thúc.');
      return;
    }
    if (validationResult.success === false) {
      toast.error(validationResult.message || 'Lịch bảo vệ không hợp lệ theo quy chế.');
      return;
    }
    try {
      setSubmitting(true);
      
      // Clean up unneeded fields based on mode
      const payload = { ...form };
      if (payload.mode === 'offline') delete payload.meetingUrl;
      if (payload.mode === 'online') delete payload.room;
      
      if (editingSession) {
        await api.patch(`/defense-sessions/${editingSession._id}`, payload, token);
        toast.success('Đã cập nhật lịch bảo vệ thành công');
      } else {
        await api.post('/defense-sessions', payload, token);
        toast.success('Đã xếp lịch bảo vệ thành công');
      }
      setShowModal(false);
      setEditingSession(null);
      setForm({
        ...form,
        projectId: '',
        room: '',
        meetingUrl: '',
        orderNumber: form.orderNumber + 1,
      });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xếp lịch bảo vệ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragStartProject = (e, project) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'project', projectId: project._id }));
  };

  const handleDragStartSession = (e, session) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'session', sessionId: session._id }));
  };

  const handleDragOver = (e, dayDate, slot) => {
    e.preventDefault();
    const cellKey = `${dayDate.toISOString().split('T')[0]}-${slot.number}`;
    if (dragOverCell !== cellKey) {
      setDragOverCell(cellKey);
    }
  };

  const handleDragLeave = (e) => {
    setDragOverCell(null);
  };

  const handleDrop = async (e, dayDate, slot) => {
    e.preventDefault();
    setDragOverCell(null);
    
    const dataStr = e.dataTransfer.getData('text/plain');
    if (!dataStr) return;
    
    let data;
    try {
      data = JSON.parse(dataStr);
    } catch (err) {
      return;
    }
    
    const defenseDateStr = dayDate.toISOString().split('T')[0];
    const startTime = slot.startTime;
    const endTime = slot.endTime;
    const orderNumber = slot.number;
    
    if (data.type === 'project') {
      const proj = projects.find(p => p._id === data.projectId);
      if (!proj) return;
      
      setEditingSession(null);
      setForm({
        projectId: proj._id,
        committeeId: '',
        mode: 'offline',
        room: '',
        meetingUrl: '',
        defenseDate: defenseDateStr,
        startTime: startTime,
        endTime: endTime,
        orderNumber: orderNumber,
      });
      setShowModal(true);
    } else if (data.type === 'session') {
      const session = sessions.find(s => s._id === data.sessionId);
      if (!session) return;
      
      const origDateStr = new Date(session.defenseDate).toISOString().split('T')[0];
      if (origDateStr === defenseDateStr && session.startTime === startTime) {
        return;
      }
      
      try {
        toast.info('Đang kiểm tra quy chế xếp lịch...');
        
        await api.post('/defense-sessions/validate', {
          projectId: session.projectId?._id || session.projectId,
          committeeId: session.committeeId?._id || session.committeeId,
          defenseDate: defenseDateStr,
          startTime: startTime,
          endTime: endTime,
          excludeSessionId: session._id,
        }, token);
        
        await api.patch(`/defense-sessions/${session._id}`, {
          defenseDate: defenseDateStr,
          startTime: startTime,
          endTime: endTime,
          orderNumber: orderNumber,
        }, token);
        
        toast.success(`Đã dời lịch bảo vệ thành công sang ca ${orderNumber} ngày ${defenseDateStr}`);
        fetchData();
      } catch (err) {
        toast.error(err.message || 'Lỗi trùng lịch hoặc vi phạm quy chế. Không thể dời lịch!');
      }
    }
  };

  const handlePrevWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() - 7);
    setSelectedDate(next);
  };

  const handleNextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    setSelectedDate(next);
  };

  const openCreateModal = () => {
    setEditingSession(null);
    setShowModal(true);
  };

  const openEditModal = (session) => {
    setEditingSession(session);
    setForm({
      projectId: session.projectId?._id || session.projectId || '',
      committeeId: session.committeeId?._id || session.committeeId || '',
      mode: session.mode || 'offline',
      room: session.room || '',
      meetingUrl: session.meetingUrl || '',
      defenseDate: session.defenseDate ? new Date(session.defenseDate).toISOString().slice(0, 10) : '',
      startTime: session.startTime || '',
      endTime: session.endTime || '',
      orderNumber: session.orderNumber || 1,
    });
    setShowModal(true);
  };

  const handleDeleteSession = async (session) => {
    setDeletingSession(true);
    try {
      await api.delete(`/defense-sessions/${session._id}`, token);
      toast.success('Đã xóa phiên bảo vệ thành công.');
      setSessionToDelete(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Không thể xóa phiên bảo vệ');
    } finally {
      setDeletingSession(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'scheduled': return <Badge variant="info">Đã lên lịch</Badge>;
      case 'in_progress': return <Badge variant="warning">Đang diễn ra</Badge>;
      case 'completed': return <Badge variant="success">Đã hoàn thành</Badge>;
      case 'cancelled': return <Badge variant="danger">Đã hủy</Badge>;
      default: return <Badge>{getTechnicalLabel(status)}</Badge>;
    }
  };

  const getCommitteeStatusLabel = (status) => {
    switch(status) {
      case 'draft': return 'Bản nháp';
      case 'approved': return 'Đã duyệt';
      case 'active': return 'Đang hoạt động';
      case 'finished': return 'Đã kết thúc';
      default: return status || 'Không rõ';
    }
  };

  const isStaff = hasAnyRole(user, ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF']);

  const visibleSessions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter((s) => {
      const values = [
        s.projectId?.topicId?.title,
        s.committeeId?.name,
        s.room,
      ];
      return values.some((v) => String(v || '').toLowerCase().includes(keyword));
    });
  }, [sessions, search]);

  const totalPages = Math.max(1, Math.ceil(visibleSessions.length / pageSize));
  const pagedSessions = visibleSessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) router.replace(nextUrl, { scroll: false });
  }, [currentPage, pageSize, pathname, router, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setCurrentPage(1);
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setSearch('');
    setCurrentPage(1);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setCurrentPage(1);
  };

  return (
    <div>
      {loading ? (
        <div className={css.s1}><Spinner size="lg" /></div>
      ) : (
        <>
      <div className={css.s2}>
        <div>
          <h1 className={`text-display ${css.s3}`}>
            <Sword size={28} className={css.s4} />
            Lịch bảo vệ Đồ án
          </h1>
          <p className={css.s5}>
            Xem thời gian, ca thi, địa điểm phòng bảo vệ đồ án tốt nghiệp
          </p>
        </div>
        
        <div className={css.s6}>
          {isStaff && (
            <div className={css.s6} style={{ marginRight: '12px' }}>
              <Button
                variant={viewMode === 'list' ? 'primary' : 'outline'}
                icon={<List size={16} />}
                onClick={() => setViewMode('list')}
              >
                Danh sách
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'primary' : 'outline'}
                icon={<Calendar size={16} />}
                onClick={() => setViewMode('calendar')}
              >
                Lịch
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={fetchData} icon={<ArrowsClockwise />} title="Làm mới" />
          {isStaff && (
            <Button variant="primary" icon={<Plus />} onClick={openCreateModal}>
              Xếp lịch bảo vệ
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
          <FilterCard
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            onSearch={handleSearchSubmit}
            onReset={handleResetSearch}
            placeholder="Tìm theo tên đề tài, hội đồng, phòng..."
          />

          <div className={css.s7}>
            {pagedSessions.map((session) => (
              <Card key={session._id} className={css.s8}>
                <div className={css.s9}>
                  <div>
                    <Badge variant="neutral" className={css.s10}>
                      Ca số {session.orderNumber}
                    </Badge>
                    <h3 className={css.s11}>
                      {session.projectId?.topicId?.title || 'Đồ án chưa có tên'}
                    </h3>
                    <div className={css.s12}>
                      Hội đồng: {session.committeeId?.name || 'Không xác định'}
                    </div>
                  </div>
                </div>

                <div className={css.s13}>
                  <div className={css.s14}>
                    <Clock size={16} />
                    <span>
                      {formatDate(session.defenseDate).split(' ')[0]} • {session.startTime} - {session.endTime}
                    </span>
                  </div>
                  
                  <div className={css.s15}>
                    {session.mode === 'online' ? (
                      <>
                        <VideoCamera size={16} color="var(--primary)" />
                        <a href={session.meetingUrl} target="_blank" rel="noreferrer" className={css.s16}>
                          Tham gia Online
                        </a>
                      </>
                    ) : (
                      <>
                        <MapPin size={16} />
                        <span>Phòng: {session.room}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className={css.s17}>
                  {getStatusBadge(session.status)}
                  {isStaff && (
                    <div className={css.s18}>
                      {['scheduled', 'rescheduled'].includes(session.status) && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => openEditModal(session)}>
                            <PencilSimple size={14} /> Sửa
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setSessionToDelete(session)}>
                            <Trash size={14} /> Xóa
                          </Button>
                        </>
                      )}
                      {session.status === 'scheduled' && (
                        <Button size="sm" variant="outline">
                          Bắt đầu phiên
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}

            {visibleSessions.length === 0 && (
              <div className={css.s19}>
                {search ? `Không tìm thấy kết quả cho "${search}".` : 'Chưa có lịch bảo vệ nào được xếp'}
              </div>
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            totalItems={visibleSessions.length}
          />
        </>
      ) : (
        <div className={css.calendarContainer}>
          {/* Left Sidebar: Unscheduled Projects */}
          <div className={css.sidebar}>
            <div className={css.sidebarTitle}>
              <span>Đồ án chưa xếp lịch</span>
              <span className={css.sidebarCount}>{unscheduledProjects.length}</span>
            </div>
            {unscheduledProjects.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '16px 0', textAlign: 'center' }}>
                Tất cả đồ án đã được xếp lịch
              </div>
            ) : (
              unscheduledProjects.map(project => (
                <div
                  key={project._id}
                  className={css.projectCard}
                  draggable
                  onDragStart={(e) => handleDragStartProject(e, project)}
                >
                  <div className={css.projectTitle}>{project.topicId?.title || 'Đồ án chưa có tên'}</div>
                  <div className={css.projectInfo}>
                    <span>Nhóm: {project.groupId?.name || 'Chưa phân nhóm'}</span>
                    <span>GVHD: {project.supervisorId?.userId?.fullName || 'Không có'}</span>
                    <span>GVPB: {project.reviewerId?.userId?.fullName || 'Không có'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Panel: Calendar Grid */}
          <div className={css.gridContainer}>
            <div className={css.gridHeader}>
              <div className={css.weekNav}>
                <Button variant="outline" onClick={handlePrevWeek} icon={<CaretLeft size={16} />} />
                <span className={css.weekLabel}>
                  Tuần: {formatDate(startOfWeek).split(' ')[0]} - {formatDate(new Date(startOfWeek.getTime() + 5 * 24 * 60 * 60 * 1000)).split(' ')[0]}
                </span>
                <Button variant="outline" onClick={handleNextWeek} icon={<CaretRight size={16} />} />
              </div>
              <div>
                <input
                  type="date"
                  className={css.s38}
                  style={{ width: 'auto' }}
                  value={selectedDate.toISOString().slice(0, 10)}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                />
              </div>
            </div>

            <div className={css.grid}>
              {/* Header row */}
              <div className={css.gridHeaderCell}>Ca / Ngày</div>
              {weekDays.map((dayDate, i) => {
                const isToday = new Date().toDateString() === dayDate.toDateString();
                const dayLabel = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][i];
                return (
                  <div key={i} className={`${css.gridHeaderCell} ${isToday ? css.gridHeaderCellToday : ''}`}>
                    <div>{dayLabel}</div>
                    <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>
                      {dayDate.getDate()}/{dayDate.getMonth() + 1}
                    </div>
                  </div>
                );
              })}

              {/* Rows for Time Slots */}
              {TIME_SLOTS.map((slot) => {
                const getSessionsForSlot = (dayDate, slot) => {
                  const dayStr = dayDate.toISOString().split('T')[0];
                  return sessions.filter(s => {
                    if (s.isDeleted || s.status === 'cancelled') return false;
                    const sDateStr = new Date(s.defenseDate).toISOString().split('T')[0];
                    return sDateStr === dayStr && s.startTime === slot.startTime;
                  });
                };
                return (
                  <div key={slot.number} style={{ display: 'contents' }}>
                    {/* Time cell */}
                    <div className={css.timeColCell}>
                      <div>{slot.label}</div>
                      <div className={css.timeRange}>{slot.startTime} - {slot.endTime}</div>
                    </div>

                    {/* Day cells */}
                    {weekDays.map((dayDate, i) => {
                      const dayStr = dayDate.toISOString().split('T')[0];
                      const cellKey = `${dayStr}-${slot.number}`;
                      const slotSessions = getSessionsForSlot(dayDate, slot);
                      const isOver = dragOverCell === cellKey;

                      return (
                        <div
                          key={i}
                          className={`${css.gridCell} ${isOver ? css.dragOver : ''}`}
                          onDragOver={(e) => handleDragOver(e, dayDate, slot)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, dayDate, slot)}
                        >
                          {slotSessions.map(session => (
                            <div
                              key={session._id}
                              className={css.sessionCard}
                              draggable={isStaff}
                              onDragStart={(e) => handleDragStartSession(e, session)}
                            >
                              <div className={css.sessionCardHeader}>
                                <span className={`${css.sessionRoom} ${session.mode === 'online' ? css.sessionRoomOnline : ''}`}>
                                  {session.mode === 'online' ? 'Online' : session.room}
                                </span>
                                {isStaff && (
                                  <div className={css.sessionActions}>
                                    <button
                                      type="button"
                                      className={css.actionBtn}
                                      onClick={() => openEditModal(session)}
                                      title="Sửa"
                                    >
                                      <PencilSimple size={10} />
                                    </button>
                                    <button
                                      type="button"
                                      className={`${css.actionBtn} ${css.actionBtnDelete}`}
                                      onClick={() => setSessionToDelete(session)}
                                      title="Xóa"
                                    >
                                      <Trash size={10} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className={css.sessionTitle}>
                                {session.projectId?.topicId?.title || 'Đồ án chưa có tên'}
                              </div>
                              <div className={css.sessionMeta}>
                                <span>HĐ: {session.committeeId?.name || 'Không rõ'}</span>
                                <span>Nhóm: {session.projectId?.groupId?.name || 'Lẻ'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Xếp Lịch Bảo Vệ */}
      {showModal && (
        <div className={css.s20}>
          <div className={css.s21}>
            <div className={css.s22}>
              <h2 className={css.s23}>{editingSession ? 'Chỉnh sửa lịch bảo vệ' : 'Xếp lịch bảo vệ Đồ án'}</h2>
            </div>
            
            <div className={css.s24}>
              <form id="defense-form" onSubmit={handleSubmit} className={css.s25}>
                <div>
                  <label className={css.s26}>Dự án cần bảo vệ *</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({...form, projectId: e.target.value})} className={css.s38}
                  >
                    <option value="">-- Chọn Dự án --</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>{p.topicId?.title || 'Đồ án'} ({p.groupId?.name || 'Nhóm'})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className={css.s27}>Hội đồng đánh giá *</label>
                  <select
                    value={form.committeeId}
                    onChange={(e) => setForm({...form, committeeId: e.target.value})} className={css.s39}
                  >
                    <option value="">-- Chọn Hội đồng --</option>
                    {committees.map(c => (
                      <option key={c._id} value={c._id} disabled={!['approved', 'active'].includes(c.status)}>
                        {c.name} - {getCommitteeStatusLabel(c.status)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={css.s28}>
                  <div className={css.s29}>
                    <label className={css.s30}>Hình thức *</label>
                    <select
                      value={form.mode}
                      onChange={(e) => setForm({...form, mode: e.target.value})} className={css.s40}
                    >
                      <option value="offline">Trực tiếp (Offline)</option>
                      <option value="online">Trực tuyến (Online)</option>
                    </select>
                  </div>
                  <div className={css.s31}>
                    <label className={css.s32}>Số thứ tự bảo vệ *</label>
                    <Input
                      type="number"
                      min="1"
                      value={form.orderNumber}
                      onChange={(e) => setForm({...form, orderNumber: Number(e.target.value)})}
                    />
                  </div>
                </div>

                {form.mode === 'offline' ? (
                  <Input
                    label="Phòng bảo vệ *"
                    placeholder="VD: D9-204"
                    value={form.room}
                    onChange={(e) => setForm({...form, room: e.target.value})}
                  />
                ) : (
                  <Input
                    label="Link phòng họp Online (Teams/Zoom) *"
                    placeholder="https://teams.microsoft.com/..."
                    value={form.meetingUrl}
                    onChange={(e) => setForm({...form, meetingUrl: e.target.value})}
                  />
                )}

                <div className={css.s33}>
                  <div>
                    <label className={css.s34}>Ngày bảo vệ *</label>
                    <Input
                      type="date"
                      value={form.defenseDate}
                      onChange={(e) => setForm({...form, defenseDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className={css.s35}>Giờ bắt đầu *</label>
                    <Input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({...form, startTime: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className={css.s36}>Giờ kết thúc *</label>
                    <Input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({...form, endTime: e.target.value})}
                    />
                  </div>
                </div>

                {/* Validation Status */}
                {validationResult.loading && (
                  <div className={`${css.validationStatus} ${css.validationSuccess}`} style={{ opacity: 0.7 }}>
                    Đang kiểm tra quy chế hội đồng...
                  </div>
                )}
                {!validationResult.loading && validationResult.success === true && (
                  <div className={`${css.validationStatus} ${css.validationSuccess}`}>
                    <CheckCircle size={16} style={{ flexShrink: 0 }} />
                    <div className={css.validationText}>{validationResult.message}</div>
                  </div>
                )}
                {!validationResult.loading && validationResult.success === false && (
                  <div className={`${css.validationStatus} ${css.validationError}`}>
                    <Warning size={16} style={{ flexShrink: 0 }} />
                    <div className={css.validationText}>{validationResult.message}</div>
                  </div>
                )}
              </form>
            </div>
            
            <div className={css.s37}>
              <Button variant="ghost" onClick={() => { setShowModal(false); setEditingSession(null); }} type="button">Hủy</Button>
              <Button
                variant="primary"
                type="submit"
                form="defense-form"
                isLoading={submitting}
                disabled={validationResult.loading || validationResult.success === false}
              >
                {editingSession ? 'Cập nhật lịch' : 'Xếp lịch'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(sessionToDelete)}
        title="Xóa phiên bảo vệ"
        message={sessionToDelete ? `Bạn có chắc chắn muốn xóa phiên bảo vệ ca số ${sessionToDelete.orderNumber}?` : ''}
        confirmLabel="Xóa"
        loading={deletingSession}
        onCancel={() => setSessionToDelete(null)}
        onConfirm={() => handleDeleteSession(sessionToDelete)}
      />
        </>
      )}
    </div>
  );
}
