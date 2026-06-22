'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import usePeriodStore from '@/store/period.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDate, hasAnyRole } from '@/lib/utils';
import { ClipboardText, ArrowsClockwise, CheckCircle, Calculator, MagnifyingGlass, FileText, Printer, LockKey } from '@phosphor-icons/react';
import { exportToCSV } from '@/lib/export';
import css from './page.module.css';

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_SCORE_RUBRIC = {
  version: 'default',
  criteria: {
    SUPERVISOR: [
      { criteriaCode: 'C1', criteriaName: 'Quá trình thực hiện và thái độ làm việc', maxScore: 10, weight: 0.3 },
      { criteriaCode: 'C2', criteriaName: 'Chất lượng chuyên môn của sản phẩm/đồ án', maxScore: 10, weight: 0.4 },
      { criteriaCode: 'C3', criteriaName: 'Chất lượng báo cáo và khả năng trình bày', maxScore: 10, weight: 0.3 },
    ],
    REVIEWER: [
      { criteriaCode: 'C1', criteriaName: 'Mức độ đáp ứng mục tiêu và yêu cầu đề tài', maxScore: 10, weight: 0.4 },
      { criteriaCode: 'C2', criteriaName: 'Chất lượng kỹ thuật và nội dung báo cáo', maxScore: 10, weight: 0.4 },
      { criteriaCode: 'C3', criteriaName: 'Khả năng phân tích, phản biện và trả lời câu hỏi', maxScore: 10, weight: 0.2 },
    ],
  },
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

function getInitialQuery() {
  if (typeof window === 'undefined') return { page: 1, limit: PAGE_SIZE, search: '' };
  const params = new URLSearchParams(window.location.search);
  return {
    page: getSafePositiveInt(params.get('page'), 1),
    limit: getSafePageSize(params.get('limit')),
    search: params.get('search') || '',
  };
}

function getEntityId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
}

export default function ScoresPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token } = useAuthStore();
  const toast = useToast();

  const initialQuery = useMemo(() => getInitialQuery(), []);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [search, setSearch] = useState(initialQuery.search);

  const { periods, selectedPeriodId, setSelectedPeriodId, fetchPeriods } = usePeriodStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Selected project to score
  const [selectedProject, setSelectedProject] = useState(null);

  // Dynamic Rubric States
  const [loadingRubric, setLoadingRubric] = useState(false);
  const [activeRubric, setActiveRubric] = useState(null);
  const [selectedRole, setSelectedRole] = useState('SUPERVISOR');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [savedSheets, setSavedSheets] = useState([]);
  const [currentSheet, setCurrentSheet] = useState(null);

  // Form for grading
  const [form, setForm] = useState({
    comment: '',
    criteriaScores: []
  });

  // Print Data State
  const [printData, setPrintData] = useState(null);

  // Variance Resolution modal/inline state
  const [resolvingGradeId, setResolvingGradeId] = useState(null);
  const [resolutionComment, setResolutionComment] = useState('');
  const [resolvingVariance, setResolvingVariance] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);

  const isStaffUser = useMemo(() => hasAnyRole(user, ['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN']), [user]);

  const fetchData = useCallback(async () => {
    if (!selectedPeriodId) return;
    try {
      setLoading(true);
      const res = await api.get(`/projects?periodId=${selectedPeriodId}`, token);
      const list = res.data || [];
      
      const detailed = await Promise.all(
        list.map(async (project) => {
          const [sheetsRes, gradeRes] = await Promise.all([
            api.get(`/scores/score-sheets?projectId=${project._id}`, token).catch(() => ({ data: [] })),
            api.get(`/scores/final-grades/project/${project._id}`, token).catch(() => ({ data: null })),
          ]);
          return {
            ...project,
            sheets: sheetsRes.data || [],
            finalGrade: gradeRes.data || null,
          };
        })
      );
      setProjects(detailed);
    } catch (err) {
      toast.error('Lỗi khi tải danh sách đồ án cần chấm');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId, token, toast]);

  useEffect(() => {
    if (token) {
      fetchPeriods(token);
    }
  }, [token, fetchPeriods]);

  useEffect(() => {
    if (token && selectedPeriodId) {
      fetchData();
    }
  }, [fetchData, token, selectedPeriodId]);

  const loadFormForRole = useCallback((role, rubric, sheetsList) => {
    const existingSheet = sheetsList.find(s => s.rubricRole === role);
    setCurrentSheet(existingSheet || null);

    if (existingSheet) {
      setForm({
        comment: existingSheet.comment || '',
        criteriaScores: existingSheet.criteriaScores.map(c => ({
          criteriaCode: c.criteriaCode,
          criteriaName: c.criteriaName,
          maxScore: c.maxScore,
          score: c.score,
          weight: c.weight
        }))
      });
    } else {
      const criteriaList = rubric?.criteria?.[role] || [];
      setForm({
        comment: '',
        criteriaScores: criteriaList.map(c => ({
          criteriaCode: c.criteriaCode,
          criteriaName: c.criteriaName,
          maxScore: c.maxScore,
          score: 0,
          weight: c.weight
        }))
      });
    }
  }, []);

  const handleOpenScoreModal = async (project) => {
    setSelectedProject(project);
    setLoadingRubric(true);
    setShowModal(true);

    const projectId = project._id;
    const periodId = project.periodId?._id || project.periodId;

    try {
      if (!periodId) {
        throw new Error('Đồ án chưa có cấu hình học phần.');
      }

      // 1. Fetch period to get the linked active Rubric
      const periodRes = await api.get(`/periods/${periodId}`, token);
      const rubric = periodRes.data?.rubricId || DEFAULT_SCORE_RUBRIC;
      setActiveRubric(rubric || null);

      // Determine grader available roles
      const roles = [];
      const supervisorId = getEntityId(project.supervisorId);
      const reviewerId = getEntityId(project.reviewerId);
      const lecturerId = user?.lecturerId;

      if (supervisorId && supervisorId.toString() === lecturerId?.toString()) {
        roles.push('SUPERVISOR');
      }
      if (reviewerId && reviewerId.toString() === lecturerId?.toString()) {
        roles.push('REVIEWER');
      }
      
      if (roles.length === 0) {
        roles.push('SUPERVISOR', 'REVIEWER');
      }
      setAvailableRoles(roles);

      const defaultRole = roles[0] || 'SUPERVISOR';
      setSelectedRole(defaultRole);

      // 2. Fetch score sheets
      const graderQuery = user?.lecturerId ? `&graderId=${user.lecturerId}` : '';
      const sheetsRes = await api.get(`/scores/score-sheets?projectId=${projectId}${graderQuery}`, token);
      const sheets = sheetsRes.data || [];
      setSavedSheets(sheets);

      loadFormForRole(defaultRole, rubric, sheets);
      if (!periodRes.data?.rubricId) {
        toast.warning?.('Học phần này chưa cấu hình tiêu chí chấm. Hệ thống đang dùng bộ tiêu chí mặc định.');
      }
    } catch (err) {
      setActiveRubric(DEFAULT_SCORE_RUBRIC);
      setAvailableRoles(['SUPERVISOR', 'REVIEWER']);
      setSelectedRole('SUPERVISOR');
      setSavedSheets([]);
      setCurrentSheet(null);
      loadFormForRole('SUPERVISOR', DEFAULT_SCORE_RUBRIC, []);
      toast.error(err.message || 'Lỗi khi tải cấu hình tiêu chí chấm điểm');
    } finally {
      setLoadingRubric(false);
    }
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    loadFormForRole(role, activeRubric, savedSheets);
  };

  const handleScoreChange = (index, value) => {
    const newCriteria = [...form.criteriaScores];
    newCriteria[index].score = value === '' ? '' : Number(value);
    setForm({ ...form, criteriaScores: newCriteria });
  };

  const getTotalScore = () => {
    const total = form.criteriaScores.reduce((sum, c) => sum + ((c.score || 0) * (c.weight || 1.0)), 0);
    return total.toFixed(2);
  };

  const handleSubmitScore = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    const projectId = selectedProject._id;
    const groupId = selectedProject.groupId?._id || selectedProject.groupId || undefined;
    const periodId = selectedProject.periodId?._id || selectedProject.periodId;

    // Local validation
    for (const c of form.criteriaScores) {
      if (c.score === undefined || c.score === '' || isNaN(c.score) || c.score < 0 || c.score > c.maxScore) {
        toast.error(`Điểm cho tiêu chí "${c.criteriaName}" phải từ 0 đến tối đa ${c.maxScore} điểm.`);
        return;
      }
    }

    const payload = {
      projectId,
      groupId,
      periodId,
      rubricRole: selectedRole,
      targetType: selectedRole,
      targetId: projectId,
      comment: form.comment,
      criteriaScores: form.criteriaScores,
      version: currentSheet ? currentSheet.version : undefined
    };

    try {
      setSubmitting(true);
      await api.post('/scores/score-sheets', payload, token);
      toast.success('Đã lưu phiếu điểm thành công');
      
      const lecturerId = user?.lecturerId;
      const graderQuery = lecturerId ? `&graderId=${lecturerId}` : '';
      const sheetsRes = await api.get(`/scores/score-sheets?projectId=${projectId}${graderQuery}`, token);
      const sheets = sheetsRes.data || [];
      setSavedSheets(sheets);

      const updatedSheet = sheets.find(s => s.rubricRole === selectedRole);
      setCurrentSheet(updatedSheet || null);

      try {
        await api.post(`/scores/final-grades/aggregate/${projectId}`, {}, token);
      } catch (e) {
        console.error('Aggregation failed', e);
      }
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi nộp phiếu điểm');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLockScoreSheet = async () => {
    if (!currentSheet) return;
    try {
      setSubmitting(true);
      await api.post(`/scores/score-sheets/${currentSheet._id}/lock`, {}, token);
      toast.success('Đã khóa phiếu điểm thành công!');

      const projectId = selectedProject._id;
      const lecturerId = user?.lecturerId;
      const graderQuery = lecturerId ? `&graderId=${lecturerId}` : '';
      const sheetsRes = await api.get(`/scores/score-sheets?projectId=${projectId}${graderQuery}`, token);
      const sheets = sheetsRes.data || [];
      setSavedSheets(sheets);

      const updatedSheet = sheets.find(s => s.rubricRole === selectedRole);
      setCurrentSheet(updatedSheet || null);

      try {
        await api.post(`/scores/final-grades/aggregate/${projectId}`, {}, token);
      } catch (e) {}
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi khóa phiếu điểm');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintScoreSheet = async () => {
    if (!currentSheet) return;
    try {
      const res = await api.get(`/scores/score-sheets/${currentSheet._id}/public-verify`, token);
      setPrintData(res.data);
      setTimeout(() => {
        window.print();
      }, 300);
    } catch (err) {
      toast.error('Không thể tải dữ liệu in ấn phiếu điểm.');
    }
  };

  const handleBulkPublish = async () => {
    if (!selectedPeriodId) return;
    try {
      setPublishingAll(true);
      const res = await api.post(`/scores/final-grades/publish-by-period/${selectedPeriodId}`, {}, token);
      toast.success(res.message || 'Đã công bố điểm cho toàn bộ đồ án trong học phần.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi công bố điểm');
    } finally {
      setPublishingAll(false);
    }
  };

  const handleOpenResolveVarianceModal = (grade) => {
    setResolvingGradeId(grade._id);
    setResolutionComment('');
  };

  const handleResolveVarianceSubmit = async (e) => {
    e.preventDefault();
    if (!resolvingGradeId || !resolutionComment.trim()) {
      toast.error('Vui lòng nhập phương án giải quyết.');
      return;
    }
    try {
      setResolvingVariance(true);
      await api.post(`/scores/final-grades/${resolvingGradeId}/resolve-variance`, {
        flagType: 'supervisor_reviewer_variance',
        resolution: resolutionComment.trim(),
      }, token);
      toast.success('Đã xử lý cờ chênh lệch điểm thành công!');
      setResolvingGradeId(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xử lý chênh lệch điểm');
    } finally {
      setResolvingVariance(false);
    }
  };

  const visibleProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((p) => {
      const values = [
        p.topicId?.title,
        p.groupId?.name,
        p.studentId?.userId?.fullName,
        p.supervisorId?.userId?.fullName,
        p.reviewerId?.userId?.fullName,
      ];
      return values.some((v) => String(v || '').toLowerCase().includes(keyword));
    });
  }, [projects, search]);

  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / pageSize));
  const pagedProjects = visibleProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  const handleExportExcel = () => {
    const headers = [
      'Tên Đề Tài',
      'Nhóm / Sinh viên',
      'GV Hướng Dẫn',
      'Điểm GVHD',
      'GV Chấm 2',
      'Điểm GV Chấm 2',
      'Điểm Tổng kết',
      'Trạng Thái',
    ];

    const data = visibleProjects.map((p) => {
      const supervisorSheet = p.sheets.find(s => s.rubricRole === 'SUPERVISOR');
      const reviewerSheet = p.sheets.find(s => s.rubricRole === 'REVIEWER' || s.rubricRole === 'SECOND_MARKER');
      return [
        p.topicId?.title || 'Chưa đăng ký đề tài',
        p.groupId?.name || p.studentId?.userId?.fullName || 'Sinh viên',
        p.supervisorId?.userId?.fullName || 'Chưa phân công',
        supervisorSheet ? supervisorSheet.roundedTotal : 'Chưa chấm',
        p.reviewerId?.userId?.fullName || 'Chưa phân công',
        reviewerSheet ? reviewerSheet.roundedTotal : 'Chưa chấm',
        p.finalGrade ? `${p.finalGrade.finalScore} (${p.finalGrade.letterGrade})` : 'Chưa có',
        p.finalGrade?.publishedAt ? 'Đã công bố' : 'Chưa công bố',
      ];
    });

    exportToCSV(data, headers, `Bảng_điểm_đồ_án_Karl_${new Date().toISOString().slice(0, 10)}`);
  };

  const printSubject = printData?.verificationSubject || {};
  const printPrimaryStudent = printSubject.primaryStudent || {};
  const printStudents = printSubject.students || [];

  return (
    <div>
      <div className={css.screenArea}>
        {loading && periods.length === 0 ? (
          <div className={css.s1}><Spinner size="lg" /></div>
        ) : (
          <>
          <div className={`${css.s2} no-print`}>
            <div>
              <h1 className={`text-display ${css.s3}`}>
                <ClipboardText size={28} className={css.s4} />
                Chấm điểm & Kết quả học phần
              </h1>
              <p className={css.s5}>
                Nhập điểm đánh giá dành cho Giảng viên hướng dẫn & Giảng viên chấm 2
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isStaffUser && selectedPeriodId && (
                <Button variant="primary" size="sm" onClick={handleBulkPublish} loading={publishingAll} className={css.buttonGap}>
                  Công bố kết quả
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={handleExportExcel} className={css.buttonGap}>
                <FileText size={16} />
                Xuất Excel
              </Button>
              <Button variant="outline" onClick={fetchData} icon={<ArrowsClockwise />} title="Làm mới" />
            </div>
          </div>

          <div className="no-print" style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '240px', flex: '1' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-secondary)' }}>Học phần đồ án</label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '14px',
                  height: '42px'
                }}
              >
                <option value="">Chọn học phần</option>
                {periods.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.courseCode})
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ flex: '2', minWidth: '300px', marginTop: '22px' }}>
              <FilterCard
                searchInput={searchInput}
                setSearchInput={setSearchInput}
                onSearch={handleSearchSubmit}
                onReset={handleResetSearch}
                placeholder="Tìm theo tên đề tài, nhóm, sinh viên, giảng viên..."
              />
            </div>
          </div>

          {loading ? (
            <div className={css.s1}><Spinner size="lg" /></div>
          ) : (
            <div className="no-print">
              {isStaffUser ? (
                <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-card-nested, #f8fafc)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Tên đề tài</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Nhóm / Sinh viên</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Điểm GVHD</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Điểm GV Chấm 2</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Điểm Tổng kết</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Trạng thái</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>Chênh lệch</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-secondary)', width: '120px' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedProjects.map((p) => {
                        const supervisorSheet = p.sheets.find(s => s.rubricRole === 'SUPERVISOR');
                        const reviewerSheet = p.sheets.find(s => s.rubricRole === 'REVIEWER' || s.rubricRole === 'SECOND_MARKER');
                        const activeVariance = p.finalGrade?.varianceFlags?.find(f => !f.resolvedAt);

                        return (
                          <tr key={p._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                            <td style={{ padding: '12px 16px', fontWeight: '500', color: 'var(--text-primary)' }}>{p.topicId?.title || 'Chưa đăng ký đề tài'}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{p.groupId?.name || p.studentId?.userId?.fullName || 'Sinh viên'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              {supervisorSheet ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong>{supervisorSheet.roundedTotal}</strong>
                                  <Badge variant={supervisorSheet.lockedAt ? 'success' : 'neutral'}>
                                    {supervisorSheet.lockedAt ? 'Đã khóa' : 'Nháp'}
                                  </Badge>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Chưa chấm</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {reviewerSheet ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong>{reviewerSheet.roundedTotal}</strong>
                                  <Badge variant={reviewerSheet.lockedAt ? 'success' : 'neutral'}>
                                    {reviewerSheet.lockedAt ? 'Đã khóa' : 'Nháp'}
                                  </Badge>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Chưa chấm</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                              {p.finalGrade ? (
                                <strong>{p.finalGrade.finalScore} ({p.finalGrade.letterGrade})</strong>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {p.finalGrade?.publishedAt ? (
                                <Badge variant="success">Đã công bố</Badge>
                              ) : p.finalGrade ? (
                                <Badge variant="warning">Chờ công bố</Badge>
                              ) : (
                                <Badge variant="neutral">Chưa có điểm</Badge>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {activeVariance ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                  <Badge variant="error">Chênh lệch lớn ({activeVariance.maxDifference}đ)</Badge>
                                  <Button size="xs" variant="outline" onClick={() => handleOpenResolveVarianceModal(p.finalGrade)}>
                                    Giải quyết
                                  </Button>
                                </div>
                              ) : p.finalGrade?.varianceFlags?.some(f => f.resolvedAt) ? (
                                <Badge variant="success">Đã giải quyết</Badge>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <Button size="xs" variant="primary" onClick={() => handleOpenScoreModal(p)}>
                                Nhập điểm
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={css.s6}>
                  {pagedProjects.map((p) => {
                    const supervisorSheet = p.sheets.find(s => s.rubricRole === 'SUPERVISOR');
                    const reviewerSheet = p.sheets.find(s => s.rubricRole === 'REVIEWER' || s.rubricRole === 'SECOND_MARKER');
                    
                    return (
                      <Card key={p._id} className={css.s7}>
                        <div className={css.s8}>
                          <div>
                            <h3 className={css.s9}>
                              {p.topicId?.title || 'Đồ án'}
                            </h3>
                          </div>
                        </div>

                        <div className={css.s11}>
                          <div><strong>Hình thức:</strong> {p.ownerType === 'group' ? `Nhóm: ${p.groupId?.name}` : `Cá nhân: ${p.studentId?.userId?.fullName}`}</div>
                          <div className={css.s12}>
                            <strong>GVHD:</strong> {p.supervisorId?.userId?.fullName || 'Chưa phân công'}{' '}
                            {supervisorSheet ? (
                              <Badge variant={supervisorSheet.lockedAt ? 'success' : 'neutral'}>
                                {supervisorSheet.roundedTotal}đ
                              </Badge>
                            ) : (
                              <Badge variant="warning">Chưa chấm</Badge>
                            )}
                          </div>
                          <div className={css.s12}>
                            <strong>GV Chấm 2:</strong> {p.reviewerId?.userId?.fullName || 'Chưa phân công'}{' '}
                            {reviewerSheet ? (
                              <Badge variant={reviewerSheet.lockedAt ? 'success' : 'neutral'}>
                                {reviewerSheet.roundedTotal}đ
                              </Badge>
                            ) : (
                              <Badge variant="warning">Chưa chấm</Badge>
                            )}
                          </div>
                          {p.finalGrade && (
                            <div className={css.s12}>
                              <strong>Điểm tổng kết:</strong> {p.finalGrade.finalScore} ({p.finalGrade.letterGrade}){' '}
                              {p.finalGrade.publishedAt ? <Badge variant="success">Đã công bố</Badge> : <Badge variant="warning">Chờ công bố</Badge>}
                            </div>
                          )}
                        </div>
                        
                        <div className={css.s13}>
                          <Button size="sm" variant="primary" icon={<CheckCircle />} onClick={() => handleOpenScoreModal(p)}>
                            Nhập phiếu điểm
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {visibleProjects.length === 0 && (
                <div className={css.s14}>
                  {search ? `Không tìm thấy kết quả cho "${search}".` : 'Không có đồ án nào cần chấm điểm trong học phần này.'}
                </div>
              )}

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
                totalItems={visibleProjects.length}
              />
            </div>
          )}

          {/* Modal Chấm Điểm */}
          {showModal && (
            <div className={`${css.s15} no-print`}>
              <div className={css.s16}>
                <div className={css.s17}>
                  <h2 className={css.s18}>Phiếu chấm điểm</h2>
                  <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                </div>
                
                <div className={css.s19}>
                  <div className={css.s20}>
                    <strong>Đề tài:</strong> {selectedProject?.topicId?.title}<br/>
                    <strong>Hình thức:</strong> {selectedProject?.ownerType === 'group' ? `Nhóm: ${selectedProject?.groupId?.name}` : `Cá nhân: ${selectedProject?.studentId?.userId?.fullName}`}
                  </div>

                  {loadingRubric ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}><Spinner /></div>
                  ) : (
                    <>
                      {availableRoles.length > 1 && (
                        <div style={{ marginBottom: '16px' }}>
                          <label className={css.s31}>Chấm điểm với vai trò:</label>
                          <select
                            value={selectedRole}
                            onChange={(e) => handleRoleChange(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: 'var(--bg-raised)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-primary)',
                              outline: 'none'
                            }}
                          >
                            {availableRoles.includes('SUPERVISOR') && <option value="SUPERVISOR">Giảng viên hướng dẫn</option>}
                            {availableRoles.includes('REVIEWER') && <option value="REVIEWER">Giảng viên chấm 2</option>}
                          </select>
                        </div>
                      )}

                      {currentSheet?.lockedAt && (
                        <div style={{ padding: '10px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid var(--warning)', borderRadius: '6px', fontSize: '13px', color: 'var(--warning)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <LockKey size={16} /> Phiếu điểm này đã khóa vào lúc {new Date(currentSheet.lockedAt).toLocaleString()}. Bạn không thể chỉnh sửa điểm nữa.
                        </div>
                      )}

                      <form id="score-form" onSubmit={handleSubmitScore} className={css.s21}>
                        <div className={css.s22}>
                          {form.criteriaScores.map((c, index) => (
                            <div key={index} className={css.s23}>
                              <div className={css.s24}>
                                <div className={css.s25}>{c.criteriaName}</div>
                                <div className={css.s26}>Tối đa: {c.maxScore} điểm (Trọng số: {c.weight})</div>
                              </div>
                              <div className={css.s27}>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={c.maxScore}
                                    value={c.score}
                                    onChange={(e) => handleScoreChange(index, e.target.value)}
                                    disabled={Boolean(currentSheet?.lockedAt)}
                                    className={css.s33}
                                  />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={css.s28}>
                          <div className={css.s29}>
                            <Calculator size={20} /> Điểm tổng
                          </div>
                          <div className={css.s30}>
                            {getTotalScore()} / 10
                          </div>
                        </div>

                        <div>
                          <label className={css.s31}>Nhận xét / Đánh giá</label>
                          <textarea
                            value={form.comment}
                            onChange={(e) => setForm({...form, comment: e.target.value})}
                            rows="3"
                            disabled={Boolean(currentSheet?.lockedAt)}
                            placeholder="Nhập nhận xét của Giảng viên..."
                            className={css.s34}
                          ></textarea>
                        </div>
                      </form>
                    </>
                  )}
                </div>
                
                <div className={css.s32}>
                  <Button variant="ghost" onClick={() => setShowModal(false)} type="button">Đóng</Button>
                  
                  {currentSheet && !currentSheet.lockedAt && !isStaffUser && (
                    <Button variant="secondary" onClick={handleLockScoreSheet} isLoading={submitting} type="button" icon={<LockKey />}>
                      Khóa Điểm
                    </Button>
                  )}

                  {!currentSheet?.lockedAt && !isStaffUser ? (
                    <Button variant="primary" type="submit" form="score-form" isLoading={submitting}>
                      {currentSheet ? 'Cập Nhật Điểm' : 'Nộp Phiếu Điểm'}
                    </Button>
                  ) : (
                    currentSheet?.lockedAt && (
                      <Button variant="secondary" onClick={handlePrintScoreSheet} icon={<Printer />} type="button">
                        In Phiếu Điểm
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal giải quyết chênh lệch */}
          {resolvingGradeId && (
            <div className={css.resolveModal}>
              <div className={css.resolveModalContent}>
                <div className={css.s17}>
                  <h3 className={css.s18}>Giải quyết chênh lệch điểm</h3>
                  <button onClick={() => setResolvingGradeId(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                </div>
                <form onSubmit={handleResolveVarianceSubmit}>
                  <div style={{ padding: '20px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Điểm chấm giữa Giảng viên hướng dẫn và Giảng viên chấm 2 có sự chênh lệch lớn (vượt ngưỡng quy định). Giáo vụ cần đưa ra phương án giải quyết để chốt điểm tổng kết.
                    </p>
                    <textarea
                      value={resolutionComment}
                      onChange={(e) => setResolutionComment(e.target.value)}
                      placeholder="Mô tả phương án giải quyết (ví dụ: Chốt điểm trung bình cộng 8.6; Giữ nguyên kết quả thống nhất...)"
                      rows="4"
                      required
                      className={css.s34}
                    />
                  </div>
                  <div className={css.s32}>
                    <Button variant="ghost" onClick={() => setResolvingGradeId(null)} type="button">Đóng</Button>
                    <Button variant="primary" type="submit" loading={resolvingVariance}>
                      Lưu phương án
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Printed Scorecard View (hidden on screen, visible only when printing) */}
      {printData && (
        <div className={css.printArea}>
          <div className={css.printHeader}>
            <div style={{ fontSize: '13px', fontWeight: '500' }}>TRƯỜNG ĐẠI HỌC PHENIKAA</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>KHOA CÔNG NGHỆ THÔNG TIN</div>
            <div className={css.printTitle}>PHIẾU CHẤM ĐIỂM ĐỒ ÁN HỌC PHẦN</div>
            <div style={{ fontStyle: 'italic', marginTop: '4px', fontSize: '13px' }}>
              Vai trò đánh giá: {
                printData.sheet?.rubricRole === 'SUPERVISOR' ? 'Giảng viên hướng dẫn' : 'Giảng viên chấm 2'
              }
            </div>
          </div>

          <div className={css.printInfoGrid}>
            <div><strong>Họ và tên sinh viên:</strong> {printPrimaryStudent.fullName || printSubject.displayName || 'N/A'}</div>
            <div><strong>Mã số sinh viên:</strong> {printPrimaryStudent.studentCode || 'N/A'}</div>
            <div><strong>Lớp sinh hoạt:</strong> {printPrimaryStudent.className || 'N/A'}</div>
            {printSubject.ownerType === 'group' && (
              <div><strong>Nhóm sinh viên:</strong> {printSubject.groupName || printSubject.displayName || 'N/A'}</div>
            )}
            <div><strong>Học phần đồ án:</strong> {printData.sheet?.periodId?.name || 'N/A'}</div>
            <div style={{ gridColumn: 'span 2' }}><strong>Đề tài đồ án:</strong> {printData.sheet?.projectId?.topicId?.title || 'N/A'}</div>
            <div><strong>Giảng viên chấm điểm:</strong> {printData.sheet?.graderId?.userId?.fullName || 'N/A'}</div>
            <div><strong>Vai trò cụ thể:</strong> {printData.sheet?.graderRole === 'SUPERVISOR' ? 'Giảng viên hướng dẫn' : 'Giảng viên chấm 2'}</div>
          </div>

          <table className={css.printTable}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Mã TC</th>
                <th>Tên tiêu chí chấm điểm</th>
                <th style={{ width: '90px' }}>Trọng số</th>
                <th style={{ width: '90px' }}>Điểm tối đa</th>
                <th style={{ width: '90px' }}>Điểm chấm</th>
              </tr>
            </thead>
            <tbody>
              {printData.sheet?.criteriaScores?.map((c, idx) => (
                <tr key={idx}>
                  <td>{c.criteriaCode}</td>
                  <td>{c.criteriaName}</td>
                  <td>{c.weight}</td>
                  <td>{c.maxScore}</td>
                  <td style={{ fontWeight: 'bold' }}>{c.score}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                <td colSpan="4" style={{ textAlign: 'right' }}>Tổng điểm (đã nhân trọng số):</td>
                <td>{printData.sheet?.roundedTotal} / 10</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '16px', fontSize: '14px' }}>
            <strong>Nhận xét, đánh giá của giảng viên:</strong>
            <p style={{ marginTop: '6px', border: '1px solid #000', padding: '10px', minHeight: '80px', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
              {printData.sheet?.comment || 'Không có nhận xét thêm.'}
            </p>
          </div>

          <div className={css.printSignatures}>
            <div>
              <strong>Sinh viên thực hiện</strong>
              <div style={{ marginTop: '60px', fontWeight: 'bold' }}>{printPrimaryStudent.fullName || printSubject.displayName}</div>
            </div>
            <div>
              <strong>Giảng viên chấm điểm</strong>
              <div style={{ marginTop: '60px', fontWeight: 'bold' }}>{printData.sheet?.graderId?.userId?.fullName}</div>
            </div>
          </div>

          <div className={css.printQrContainer}>
            <img
              className={css.printQrImage}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/verify/scores/${printData.sheet?._id}`
              )}`}
              alt="QR Verification"
            />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>MÃ XÁC THỰC PHIẾU ĐIỂM TRỰC TUYẾN</div>
              <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '11px', color: '#333', lineHeight: '1.4' }}>
                SCORECARD ID: {printData.sheet?._id}<br/>
                INTEGRITY HASH: {printData.integrityHash}
              </div>
              <div style={{ marginTop: '4px', color: '#555', fontSize: '12px' }}>
                Quét mã QR bằng điện thoại để truy xuất và đối chiếu bảng điểm số gốc được lưu trữ bảo mật trên hệ thống.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
