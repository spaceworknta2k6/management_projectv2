'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import FilterCard from '@/components/ui/FilterCard';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/utils';
import {
  Users,
  ArrowsClockwise,
  Plus,
  Trash,
  PencilSimple,
  UploadSimple,
  DownloadSimple,
  X,
  Warning,
  CheckCircle,
} from '@phosphor-icons/react';
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

export default function RostersPage() {
  const { token } = useAuthStore();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const initialQuery = useMemo(() => getInitialQuery(), []);
  const [currentPage, setCurrentPage] = useState(initialQuery.page);
  const [pageSize, setPageSize] = useState(initialQuery.limit);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [search, setSearch] = useState(initialQuery.search);

  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showSingleAddModal, setShowSingleAddModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

  // Edit state
  const [editingRoster, setEditingRoster] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', studentCode: '', classSection: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Form states
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [singleStudent, setSingleStudent] = useState({
    studentCode: '',
    classSection: '',
    fullName: '',
    email: '',
  });

  const loadPeriods = useCallback(async () => {
    try {
      const res = await api.get('/periods', token);
      const activePeriods = res.data || [];
      setPeriods(activePeriods);
      if (activePeriods.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(activePeriods[0]._id);
      }
    } catch (err) {
      toast.error('Không thể tải danh sách đợt đồ án');
    }
  }, [token, selectedPeriodId, toast]);

  const fetchRoster = useCallback(async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await api.get(`/periods/${selectedPeriodId}/rosters`, token);
      setRoster(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách sinh viên đợt này');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId, token, toast]);

  useEffect(() => {
    if (token) {
      loadPeriods();
    }
  }, [loadPeriods, token]);

  useEffect(() => {
    if (token && selectedPeriodId) {
      fetchRoster();
    }
  }, [fetchRoster, token, selectedPeriodId]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (search.trim()) params.set('search', search.trim());

    const nextUrl = `${pathname}?${params.toString()}`;
    if (typeof window === 'undefined') return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      router.replace(nextUrl, { scroll: false });
    }
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

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').map((l) => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    const resultList = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const cols = parseCSVLine(line);
      const student = {};

      if (headers.includes('studentcode')) {
        student.studentCode = cols[headers.indexOf('studentcode')];
        student.classSection = cols[headers.indexOf('classsection')];
        student.fullName = cols[headers.indexOf('fullname')];
        student.email = cols[headers.indexOf('email')];
      } else {
        // Fallback column index
        student.studentCode = cols[0];
        student.classSection = cols[1];
        student.fullName = cols[2];
        student.email = cols[3];
      }

      if (student.studentCode && student.classSection && student.fullName && student.email) {
        resultList.push(student);
      }
    }
    return resultList;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) {
      toast.error('Dữ liệu tải lên trống.');
      return;
    }

    const students = parseCSV(csvText);
    if (students.length === 0) {
      toast.error('Không tìm thấy bản ghi hợp lệ nào trong tệp CSV. Vui lòng kiểm tra lại cấu trúc.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/periods/${selectedPeriodId}/rosters/import`, { roster: students }, token);
      toast.success(res.message || `Đã nhập thành công ${students.length} sinh viên.`);
      setShowImportModal(false);
      setCsvText('');
      setFileName('');
      fetchRoster();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi nạp danh sách sinh viên');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSingleAddSubmit = async (e) => {
    e.preventDefault();
    const { studentCode, classSection, fullName, email } = singleStudent;
    if (!studentCode.trim() || !classSection.trim() || !fullName.trim() || !email.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/periods/${selectedPeriodId}/rosters`, singleStudent, token);
      toast.success('Đã thêm sinh viên vào danh sách thành công!');
      setShowSingleAddModal(false);
      setSingleStudent({ studentCode: '', classSection: '', fullName: '', email: '' });
      fetchRoster();
    } catch (err) {
      toast.error(err.message || 'Không thể thêm sinh viên này');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete || !selectedPeriodId) return;

    setDeletingStudent(true);
    try {
      await api.delete(`/periods/${selectedPeriodId}/rosters/${studentToDelete._id}`, token);
      toast.success('Đã xóa sinh viên khỏi danh sách đợt đồ án thành công.');
      setStudentToDelete(null);
      fetchRoster();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa sinh viên khỏi danh sách');
    } finally {
      setDeletingStudent(false);
    }
  };

  const handleEditOpen = (item) => {
    setEditingRoster(item);
    setEditForm({
      fullName: item.studentId?.userId?.fullName || '',
      studentCode: item.studentId?.studentCode || '',
      classSection: item.classSection || '',
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim() || !editForm.studentCode.trim() || !editForm.classSection.trim()) {
      toast.error('Vui lòng điền đầy đủ cả 3 trường.');
      return;
    }
    const studentId = editingRoster.studentId?._id;
    setEditSubmitting(true);
    try {
      await api.patch(
        `/periods/${selectedPeriodId}/rosters/${studentId}`,
        editForm,
        token
      );
      toast.success('Đã cập nhật thông tin sinh viên thành công!');
      setEditingRoster(null);
      fetchRoster();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật thông tin sinh viên');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFFstudentCode,classSection,fullName,email\n22021435,IT4911,Hoàng Anh,hoanganh@hust.edu.vn\n22021499,IT4911,Nguyễn Văn Nam,namnv@hust.edu.vn\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'roster_template_karl.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const visibleRoster = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return roster;
    return roster.filter((item) => {
      const student = item.studentId || {};
      const user = student.userId || {};
      const values = [
        student.studentCode,
        user.fullName,
        user.email,
        item.classSection,
      ];
      return values.some((val) => String(val || '').toLowerCase().includes(keyword));
    });
  }, [roster, search]);

  const totalPages = Math.max(1, Math.ceil(visibleRoster.length / pageSize));
  const pagedRoster = visibleRoster.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div>
      {/* Page Header */}
      <div className={css.s1}>
        <div>
          <h1 className={`text-display ${css.s2}`}>
            <Users size={28} className={css.s3} />
            Quản lý Danh sách Sinh viên
          </h1>
          <p className={css.s4}>
            Tải danh sách sinh viên đủ điều kiện làm đồ án, cấu hình lớp học phần và gỡ sinh viên khỏi đợt đồ án
          </p>
        </div>
        <div className={css.s5}>
          <Button variant="secondary" size="sm" onClick={handleDownloadTemplate} icon={<DownloadSimple size={16} />}>
            Tải file mẫu
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)} icon={<UploadSimple size={16} />}>
            Nạp từ file
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowSingleAddModal(true)} icon={<Plus size={16} />}>
            Thêm sinh viên lẻ
          </Button>
        </div>
      </div>

      {/* Filter Card */}
      <FilterCard
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearch={handleSearchSubmit}
        onReset={handleResetSearch}
        placeholder="Tìm theo mã sinh viên, họ tên, email, lớp..."
        hasFilters={true}
      >
        <div>
          <label className={css.selectLabel}>Đợt Đồ Án</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => {
              setSelectedPeriodId(e.target.value);
              setCurrentPage(1);
            }}
            className={css.selectField}
          >
            {periods.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.schoolYear})
              </option>
            ))}
          </select>
        </div>
      </FilterCard>

      {/* Table section */}
      {loading ? (
        <div className={css.s6}>
          <Spinner size="lg" />
        </div>
      ) : roster.length === 0 ? (
        <Card>
          <div className={css.emptyMessage}>
            Chưa có danh sách sinh viên cho đợt đồ án này. Vui lòng tải file mẫu và nhấn &quot;Nạp từ file&quot; để nạp danh sách.
          </div>
        </Card>
      ) : visibleRoster.length === 0 ? (
        <Card>
          <div className={css.emptyMessage}>Không tìm thấy kết quả phù hợp với &quot;{search}&quot;.</div>
        </Card>
      ) : (
        <Card noPadding>
          <div className={css.tableWrapper}>
            <table className={css.table}>
              <thead>
                <tr className={css.tableHeaderRow}>
                  <th className={css.th}>Mã sinh viên</th>
                  <th className={css.th}>Họ và tên</th>
                  <th className={css.th}>Email</th>
                  <th className={css.th}>Lớp học phần</th>
                  <th className={css.th}>Ngày thêm</th>
                  <th className={css.th}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedRoster.map((item) => {
                  const student = item.studentId || {};
                  const studentUser = student.userId || {};
                  return (
                    <tr key={item._id} className={css.tableRow}>
                      <td className={css.tdCode}>{student.studentCode}</td>
                      <td className={css.tdName}>{studentUser.fullName || '—'}</td>
                      <td className={css.tdEmail}>{studentUser.email || '—'}</td>
                      <td className={css.tdClass}>
                        <Badge variant="neutral">{item.classSection}</Badge>
                      </td>
                      <td className={css.tdDate}>
                        {item.importedAt ? formatDate(item.importedAt) : '—'}
                      </td>
                      <td className={css.tdActions}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<PencilSimple size={16} />}
                          onClick={() => handleEditOpen(item)}
                          title="Sửa thông tin sinh viên"
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash size={16} />}
                          onClick={() => setStudentToDelete(student)}
                          title="Rút tên khỏi đợt đồ án"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            compact
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={visibleRoster.length}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            itemLabel="sinh viên"
          />
        </Card>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className={css.modalOverlay}>
          <div className={css.modalContainer}>
            <div className={css.modalHeader}>
              <h2 className={css.modalTitle}>Nạp danh sách sinh viên từ file</h2>
              <button className={css.closeBtn} onClick={() => setShowImportModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleImportSubmit} className={css.modalForm}>
              <div className={css.uploadZone}>
                <UploadSimple size={36} className={css.uploadZoneIcon} />
                <p className={css.uploadZoneText}>
                  {fileName ? (
                    <strong className={css.fileNameSelected}>{fileName}</strong>
                  ) : (
                    'Kéo thả file .csv ở đây hoặc nhấp để chọn file'
                  )}
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className={css.fileInputHidden}
                />
              </div>

              <div className={css.csvTextareaSection}>
                <label className={css.textareaLabel}>Hoặc dán trực tiếp nội dung file ở đây:</label>
                <textarea
                  className={css.csvTextarea}
                  rows={6}
                  placeholder={`studentCode,classSection,fullName,email\n22021435,IT4911,Hoàng Anh,hoanganh@hust.edu.vn`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
              </div>

              <div className={css.modalActions}>
                <Button variant="secondary" onClick={() => setShowImportModal(false)}>
                  Hủy
                </Button>
                <Button variant="primary" type="submit" loading={submitting}>
                  Nạp danh sách
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Add Modal */}
      {showSingleAddModal && (
        <div className={css.modalOverlay}>
          <div className={css.modalContainer}>
            <div className={css.modalHeader}>
              <h2 className={css.modalTitle}>Thêm sinh viên đơn lẻ</h2>
              <button className={css.closeBtn} onClick={() => setShowSingleAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSingleAddSubmit} className={css.modalForm}>
              <Input
                label="Mã số sinh viên (MSSV) *"
                placeholder="VD: 22021500"
                value={singleStudent.studentCode}
                onChange={(e) => setSingleStudent({ ...singleStudent, studentCode: e.target.value })}
                required
              />
              <Input
                label="Họ và tên *"
                placeholder="VD: Trần Đức Việt"
                value={singleStudent.fullName}
                onChange={(e) => setSingleStudent({ ...singleStudent, fullName: e.target.value })}
                required
              />
              <Input
                label="Địa chỉ Email *"
                type="email"
                placeholder="VD: viettd@hust.edu.vn"
                value={singleStudent.email}
                onChange={(e) => setSingleStudent({ ...singleStudent, email: e.target.value })}
                required
              />
              <Input
                label="Mã lớp học phần *"
                placeholder="VD: IT4912"
                value={singleStudent.classSection}
                onChange={(e) => setSingleStudent({ ...singleStudent, classSection: e.target.value })}
                required
              />

              <div className={css.modalActions}>
                <Button variant="secondary" onClick={() => setShowSingleAddModal(false)}>
                  Hủy
                </Button>
                <Button variant="primary" type="submit" loading={submitting}>
                  Xác nhận thêm
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRoster && (
        <div className={css.modalOverlay}>
          <div className={css.modalContainer} style={{ maxWidth: '480px' }}>
            <div className={css.modalHeader}>
              <h2 className={css.modalTitle}>Sửa thông tin sinh viên</h2>
              <button className={css.closeBtn} onClick={() => setEditingRoster(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSave} className={css.modalForm}>
              <Input
                label="Họ và tên *"
                placeholder="VD: Nguyễn Văn A"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                required
              />
              <Input
                label="Mã số sinh viên *"
                placeholder="VD: 22021500"
                value={editForm.studentCode}
                onChange={(e) => setEditForm({ ...editForm, studentCode: e.target.value })}
                required
              />
              <Input
                label="Mã lớp học phần *"
                placeholder="VD: IT4912"
                value={editForm.classSection}
                onChange={(e) => setEditForm({ ...editForm, classSection: e.target.value })}
                required
              />
              <div className={css.modalActions}>
                <Button variant="secondary" onClick={() => setEditingRoster(null)}>
                  Hủy
                </Button>
                <Button variant="primary" type="submit" loading={editSubmitting}>
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(studentToDelete)}
        title="Xóa sinh viên khỏi danh sách đợt đồ án"
        message={
          studentToDelete
            ? `Bạn có chắc chắn muốn rút tên sinh viên "${studentToDelete.userId?.fullName}" (MSSV: ${studentToDelete.studentCode}) khỏi danh sách đợt đồ án này? Sinh viên này sẽ không thể tham gia đăng ký nhóm.`
            : ''
        }
        confirmLabel="Xóa khỏi đợt"
        loading={deletingStudent}
        onCancel={() => setStudentToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
