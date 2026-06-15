'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FilterCard from '@/components/ui/FilterCard';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
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
    COMMITTEE_MEMBER: [
      { criteriaCode: 'C1', criteriaName: 'Chất lượng sản phẩm/kết quả thực hiện', maxScore: 10, weight: 0.4 },
      { criteriaCode: 'C2', criteriaName: 'Chất lượng báo cáo đồ án', maxScore: 10, weight: 0.3 },
      { criteriaCode: 'C3', criteriaName: 'Trình bày và trả lời câu hỏi bảo vệ', maxScore: 10, weight: 0.3 },
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

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Selected session to score
  const [selectedSession, setSelectedSession] = useState(null);

  // Dynamic Rubric States
  const [loadingRubric, setLoadingRubric] = useState(false);
  const [activeRubric, setActiveRubric] = useState(null);
  const [selectedRole, setSelectedRole] = useState('COMMITTEE_MEMBER');
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/defense-sessions', token);
      setSessions(res.data || []);
    } catch (err) {
      toast.error('Lỗi khi tải danh sách dự án cần chấm');
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

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

  const handleOpenScoreModal = async (session) => {
    setSelectedSession(session);
    setLoadingRubric(true);
    setShowModal(true);

    const projectId = getEntityId(session.projectId);
    const periodId = getEntityId(session.committeeId?.periodId) || getEntityId(session.projectId?.periodId);

    try {
      if (!periodId) {
        throw new Error('Phiên bảo vệ chưa có thông tin đợt đồ án.');
      }

      // 1. Fetch period to get the linked active Rubric
      const periodRes = await api.get(`/periods/${periodId}`, token);
      const rubric = periodRes.data?.rubricId || DEFAULT_SCORE_RUBRIC;
      setActiveRubric(rubric || null);

      // Determine grader available roles
      const roles = [];
      const supervisorId = getEntityId(session.projectId?.supervisorId);
      const reviewerId = getEntityId(session.projectId?.reviewerId);
      const lecturerId = user?.lecturerId;

      if (supervisorId && supervisorId.toString() === lecturerId?.toString()) {
        roles.push('SUPERVISOR');
      }
      if (reviewerId && reviewerId.toString() === lecturerId?.toString()) {
        roles.push('REVIEWER');
      }
      roles.push('COMMITTEE_MEMBER');
      setAvailableRoles(roles);

      const defaultRole = roles[0] || 'COMMITTEE_MEMBER';
      setSelectedRole(defaultRole);

      // 2. Fetch existing score sheets for this project by this lecturer
      const sheetsRes = await api.get(`/scores/score-sheets?projectId=${projectId}&graderId=${lecturerId}`, token);
      const sheets = sheetsRes.data || [];
      setSavedSheets(sheets);

      loadFormForRole(defaultRole, rubric, sheets);
      if (!periodRes.data?.rubricId) {
        toast.warning?.('Đợt đồ án này chưa cấu hình tiêu chí chấm. Hệ thống đang dùng bộ tiêu chí mặc định.');
      }
    } catch (err) {
      setActiveRubric(DEFAULT_SCORE_RUBRIC);
      setAvailableRoles(['COMMITTEE_MEMBER']);
      setSelectedRole('COMMITTEE_MEMBER');
      setSavedSheets([]);
      setCurrentSheet(null);
      loadFormForRole('COMMITTEE_MEMBER', DEFAULT_SCORE_RUBRIC, []);
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
    if (!selectedSession || !selectedSession.projectId) return;

    const projectId = getEntityId(selectedSession.projectId);
    const groupId = getEntityId(selectedSession.groupId);
    const periodId = getEntityId(selectedSession.committeeId?.periodId) || getEntityId(selectedSession.projectId?.periodId);

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
      
      // Reload sheets
      const lecturerId = user?.lecturerId;
      const sheetsRes = await api.get(`/scores/score-sheets?projectId=${projectId}&graderId=${lecturerId}`, token);
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

      const projectId = getEntityId(selectedSession.projectId);
      const lecturerId = user?.lecturerId;
      const sheetsRes = await api.get(`/scores/score-sheets?projectId=${projectId}&graderId=${lecturerId}`, token);
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

  const visibleSessions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter((s) => {
      const values = [
        s.projectId?.topicId?.title,
        s.committeeId?.name,
        s.groupId?.name,
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

  const handleExportExcel = () => {
    const headers = [
      'Mã Ca Bảo Vệ',
      'Đề Tài Đồ Án',
      'Nhóm Thực Hiện',
      'Ca Số',
      'Hội Đồng Chấm',
      'Ngày Bảo Vệ',
    ];

    const data = visibleSessions.map((session) => [
      session._id,
      session.projectId?.topicId?.title || 'Đồ án',
      session.groupId?.name || 'Nhóm',
      `Ca ${session.orderNumber}`,
      session.committeeId?.name || 'Không xác định',
      formatDate(session.defenseDate).split(' ')[0],
    ]);

    exportToCSV(data, headers, `Danh_sach_ca_cham_diem_Karl_${new Date().toISOString().slice(0, 10)}`);
  };

  const printSubject = printData?.verificationSubject || {};
  const printPrimaryStudent = printSubject.primaryStudent || {};
  const printStudents = printSubject.students || [];

  return (
    <div>
      <div className={css.screenArea}>
        {loading ? (
          <div className={css.s1}><Spinner size="lg" /></div>
        ) : (
          <>
          <div className={`${css.s2} no-print`}>
            <div>
              <h1 className={`text-display ${css.s3}`}>
                <ClipboardText size={28} className={css.s4} />
                Chấm điểm Đồ án
              </h1>
              <p className={css.s5}>
                Nhập điểm đánh giá dành cho Giảng viên (Hội đồng, Phản biện, Hướng dẫn)
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={handleExportExcel}>
                <FileText size={16} />
                Xuất Excel
              </Button>
              <Button variant="outline" onClick={fetchData} icon={<ArrowsClockwise />} title="Làm mới" />
            </div>
          </div>

          <div className="no-print">
            <FilterCard
              searchInput={searchInput}
              setSearchInput={setSearchInput}
              onSearch={handleSearchSubmit}
              onReset={handleResetSearch}
              placeholder="Tìm theo tên đề tài, hội đồng, nhóm..."
            />
          </div>

          <div className={`${css.s6} no-print`}>
            {pagedSessions.map((session) => (
              <Card key={session._id} className={css.s7}>
                <div className={css.s8}>
                  <div>
                    <h3 className={css.s9}>
                      {session.projectId?.topicId?.title || 'Đồ án'}
                    </h3>
                    <div className={css.s10}>
                      Hội đồng: {session.committeeId?.name || 'Không xác định'}
                    </div>
                  </div>
                  <Badge variant="neutral">Ca {session.orderNumber}</Badge>
                </div>

                <div className={css.s11}>
                  <div><strong>Nhóm SV:</strong> {session.groupId?.name || 'Nhóm'}</div>
                  <div className={css.s12}><strong>Bảo vệ:</strong> {formatDate(session.defenseDate).split(' ')[0]}</div>
                </div>
                
                <div className={css.s13}>
                  <Button size="sm" variant="primary" icon={<CheckCircle />} onClick={() => handleOpenScoreModal(session)}>
                    Nhập phiếu điểm
                  </Button>
                </div>
              </Card>
            ))}

            {visibleSessions.length === 0 && (
              <div className={css.s14}>
                {search ? `Không tìm thấy kết quả cho "${search}".` : 'Bạn không có lịch bảo vệ nào cần chấm điểm'}
              </div>
            )}
          </div>
          <div className="no-print">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
              totalItems={visibleSessions.length}
            />
          </div>

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
                    <strong>Đề tài:</strong> {selectedSession?.projectId?.topicId?.title}<br/>
                    <strong>Nhóm:</strong> {selectedSession?.groupId?.name}
                  </div>

                  {loadingRubric ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}><Spinner /></div>
                  ) : (
                    <>
                      {availableRoles.length > 1 && (
                        <div style={{ marginBottom: '16px' }}>
                          <label className={css.s31}>Châm điểm với vai trò:</label>
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
                            {availableRoles.includes('REVIEWER') && <option value="REVIEWER">Giảng viên phản biện</option>}
                            {availableRoles.includes('COMMITTEE_MEMBER') && <option value="COMMITTEE_MEMBER">Thành viên Hội đồng</option>}
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
                                  required
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
                  
                  {currentSheet && !currentSheet.lockedAt && (
                    <Button variant="secondary" onClick={handleLockScoreSheet} isLoading={submitting} type="button" icon={<LockKey />}>
                      Khóa Điểm
                    </Button>
                  )}

                  {!currentSheet?.lockedAt ? (
                    <Button variant="primary" type="submit" form="score-form" isLoading={submitting}>
                      {currentSheet ? 'Cập Nhật Điểm' : 'Nộp Phiếu Điểm'}
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={handlePrintScoreSheet} icon={<Printer />} type="button">
                      In Phiếu Điểm
                    </Button>
                  )}
                </div>
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
            <div style={{ fontSize: '13px', fontWeight: '500' }}>TRƯỜNG ĐẠI HỌC BÁCH KHOA HÀ NỘI</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>KHOA CÔNG NGHỆ THÔNG TIN</div>
            <div className={css.printTitle}>PHIẾU CHẤM ĐIỂM ĐỒ ÁN TỐT NGHIỆP</div>
            <div style={{ fontStyle: 'italic', marginTop: '4px', fontSize: '13px' }}>
              Vai trò đánh giá: {
                printData.sheet?.rubricRole === 'SUPERVISOR' ? 'Giảng viên hướng dẫn' :
                printData.sheet?.rubricRole === 'REVIEWER' ? 'Giảng viên phản biện' : 'Thành viên Hội đồng'
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
            <div><strong>Đợt đồ án:</strong> {printData.sheet?.periodId?.name || 'N/A'}</div>
            <div style={{ gridColumn: 'span 2' }}><strong>Đề tài đồ án:</strong> {printData.sheet?.projectId?.topicId?.title || 'N/A'}</div>
            <div><strong>Giảng viên chấm điểm:</strong> {printData.sheet?.graderId?.userId?.fullName || 'N/A'}</div>
            <div><strong>Vai trò cụ thể:</strong> {printData.sheet?.graderRole || 'N/A'}</div>
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
