'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import { ClipboardText, ArrowsClockwise, CheckCircle, Calculator, MagnifyingGlass, FileText } from '@phosphor-icons/react';
import { exportToCSV } from '@/lib/export';
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

  // Form for grading
  const [form, setForm] = useState({
    comment: '',
    criteriaScores: [
      {
        criteriaCode: 'C1',
        criteriaName: 'Chất lượng Báo cáo',
        maxScore: 3,
        score: 0,
        weight: 0.3
      },
      {
        criteriaCode: 'C2',
        criteriaName: 'Chất lượng Sản phẩm / Source Code',
        maxScore: 4,
        score: 0,
        weight: 0.4
      },
      {
        criteriaCode: 'C3',
        criteriaName: 'Trình bày & Trả lời câu hỏi',
        maxScore: 3,
        score: 0,
        weight: 0.3
      }
    ]
  });

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

  const handleOpenScoreModal = (session) => {
    setSelectedSession(session);
    setForm({
      comment: '',
      criteriaScores: [
        { criteriaCode: 'C1', criteriaName: 'Chất lượng Báo cáo', maxScore: 3, score: 0, weight: 0.3 },
        { criteriaCode: 'C2', criteriaName: 'Chất lượng Sản phẩm / Source Code', maxScore: 4, score: 0, weight: 0.4 },
        { criteriaCode: 'C3', criteriaName: 'Trình bày & Trả lời câu hỏi', maxScore: 3, score: 0, weight: 0.3 }
      ]
    });
    setShowModal(true);
  };

  const handleScoreChange = (index, value) => {
    const newCriteria = [...form.criteriaScores];
    newCriteria[index].score = Number(value);
    setForm({ ...form, criteriaScores: newCriteria });
  };

  const getTotalScore = () => {
    return form.criteriaScores.reduce((sum, c) => sum + (c.score || 0), 0).toFixed(1);
  };

  const handleSubmitScore = async (e) => {
    e.preventDefault();
    if (!selectedSession || !selectedSession.projectId) return;

    const projectId = selectedSession.projectId._id || selectedSession.projectId;
    const groupId = selectedSession.groupId;
    // Assuming periodId exists on project or committee. For prototype, we extract it.
    const periodId = selectedSession.committeeId?.periodId || selectedSession.projectId?.periodId || '660a1b2c3d4e5f6a7b8c9d0e'; // Fallback if missing in populate

    const payload = {
      projectId,
      groupId,
      periodId,
      rubricRole: 'COMMITTEE_MEMBER',
      targetType: 'COMMITTEE_MEMBER',
      targetId: projectId,
      comment: form.comment,
      criteriaScores: form.criteriaScores
    };

    try {
      setSubmitting(true);
      await api.post('/scores/score-sheets', payload, token);
      toast.success('Đã nộp phiếu điểm thành công');
      setShowModal(false);
      // Optional: Call aggregate final grade
      try {
        await api.post(`/scores/final-grades/aggregate/${projectId}`, {}, token);
      } catch (e) {
        console.error('Aggregate failed', e);
      }
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi nộp phiếu điểm');
    } finally {
      setSubmitting(false);
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

  return (
    <div>
      {loading ? (
        <div className={css.s1}><Spinner size="lg" /></div>
      ) : (
        <>
      <div className={css.s2}>
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

      <form onSubmit={handleSearchSubmit} className={css.searchRow}>
        <Input
          placeholder="Tìm theo tên đề tài, hội đồng, nhóm..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          icon={<MagnifyingGlass size={16} />}
        />
        <Button type="submit" variant="secondary" size="sm">Tìm</Button>
        {search && (
          <Button type="button" variant="ghost" size="sm" onClick={handleResetSearch}>Xóa</Button>
        )}
      </form>

      <div className={css.s6}>
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
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
        totalItems={visibleSessions.length}
      />

      {/* Modal Chấm Điểm */}
      {showModal && (
        <div className={css.s15}>
          <div className={css.s16}>
            <div className={css.s17}>
              <h2 className={css.s18}>Phiếu chấm điểm</h2>
            </div>
            
            <div className={css.s19}>
              <div className={css.s20}>
                <strong>Đề tài:</strong> {selectedSession?.projectId?.topicId?.title}<br/>
                <strong>Nhóm:</strong> {selectedSession?.groupId?.name}
              </div>

              <form id="score-form" onSubmit={handleSubmitScore} className={css.s21}>
                <div className={css.s22}>
                  {form.criteriaScores.map((c, index) => (
                    <div key={index} className={css.s23}>
                      <div className={css.s24}>
                        <div className={css.s25}>{c.criteriaName}</div>
                        <div className={css.s26}>Tối đa: {c.maxScore} điểm</div>
                      </div>
                      <div className={css.s27}>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max={c.maxScore}
                          value={c.score}
                          onChange={(e) => handleScoreChange(index, e.target.value)}
                          required className={css.s33} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className={css.s28}>
                  <div className={css.s29}>
                    <Calculator size={20} /> Tổng điểm
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
                    placeholder="Nhập nhận xét của Giảng viên..." className={css.s34} ></textarea>
                </div>
              </form>
            </div>
            
            <div className={css.s32}>
              <Button variant="ghost" onClick={() => setShowModal(false)} type="button">Hủy</Button>
              <Button variant="primary" type="submit" form="score-form" isLoading={submitting}>Nộp Phiếu Điểm</Button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
