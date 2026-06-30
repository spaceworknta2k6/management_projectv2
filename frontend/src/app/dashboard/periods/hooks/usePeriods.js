'use client';

import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { ACADEMIC_UNITS } from '@/lib/academicUnits';

function getCurrentAcademicTerm() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month >= 8) {
    return { schoolYear: `${year}-${year + 1}`, semester: '1' };
  }

  if (month >= 6) {
    return { schoolYear: `${year - 1}-${year}`, semester: '3' };
  }

  return { schoolYear: `${year - 1}-${year}`, semester: '2' };
}

const CURRENT_ACADEMIC_TERM = getCurrentAcademicTerm();

const DEFAULT_FORM_STATE = {
  name: 'Đồ án cơ sở ngành',
  schoolYear: CURRENT_ACADEMIC_TERM.schoolYear,
  semester: CURRENT_ACADEMIC_TERM.semester,
  type: 'foundation_project',
  courseCode: 'IT3000',
  courseName: 'Đồ án cơ sở ngành',
  projectType: 'foundation',
  academicUnit: ACADEMIC_UNITS[0].value,
  coordinatorLecturerId: '',
  allowIndividual: true,
  allowGroup: true,
  groupMinSize: '2',
  groupMaxSize: '5',
  minGroupSize: '2',
  maxGroupSize: '5',
  rubricId: '',
  rubricVersion: 'v1.0',
  supervisorWeight: '0.5',
  reviewerWeight: '0.5',
  // Timelines
  registrationStart: '2026-06-05T08:00',
  registrationEnd: '2026-06-15T18:00',
  topicChangeDeadline: '2026-06-20T18:00',
  projectStart: '2026-06-25T08:00',
  projectEnd: '2026-09-15T18:00',
  finalSubmissionDeadline: '',
  gradingStart: '',
  gradingEnd: '',
  revisionDeadline: '',
  archiveDeadline: '',
};

const DEMO_PERIODS = [
  {
    _id: 'demo-period-software-design-2025-2',
    isDemo: true,
    name: 'Thiết kế phần mềm',
    schoolYear: '2025-2026',
    semester: '2',
    status: 'registration_open',
    type: 'foundation_project',
    courseCode: 'IT3180',
    courseName: 'Thiết kế phần mềm',
    projectType: 'foundation',
    academicUnit: ACADEMIC_UNITS[0].value,
    allowIndividual: true,
    allowGroup: true,
    groupMinSize: 2,
    groupMaxSize: 5,
    scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
    registrationStart: '2026-01-10T01:00:00.000Z',
    registrationEnd: '2026-01-20T11:00:00.000Z',
    topicChangeDeadline: '2026-01-25T11:00:00.000Z',
    projectStart: '2026-02-01T01:00:00.000Z',
    projectEnd: '2026-05-20T11:00:00.000Z',
  },
  {
    _id: 'demo-period-advanced-web-2024-1',
    isDemo: true,
    name: 'Thiết kế web nâng cao',
    schoolYear: '2024-2025',
    semester: '1',
    status: 'archived',
    type: 'foundation_project',
    courseCode: 'IT4409',
    courseName: 'Thiết kế web nâng cao',
    projectType: 'foundation',
    academicUnit: ACADEMIC_UNITS[0].value,
    allowIndividual: false,
    allowGroup: true,
    groupMinSize: 3,
    groupMaxSize: 5,
    scoringFormula: { supervisor: 0.4, reviewer: 0.6 },
    registrationStart: '2024-08-15T01:00:00.000Z',
    registrationEnd: '2024-08-25T11:00:00.000Z',
    topicChangeDeadline: '2024-09-01T11:00:00.000Z',
    projectStart: '2024-09-05T01:00:00.000Z',
    projectEnd: '2024-12-20T11:00:00.000Z',
  },
  {
    _id: 'demo-period-mobile-apps-2023-2',
    isDemo: true,
    name: 'Phát triển ứng dụng di động',
    schoolYear: '2023-2024',
    semester: '2',
    status: 'archived',
    type: 'foundation_project',
    courseCode: 'IT4788',
    courseName: 'Phát triển ứng dụng di động',
    projectType: 'foundation',
    academicUnit: ACADEMIC_UNITS[0].value,
    allowIndividual: true,
    allowGroup: true,
    groupMinSize: 2,
    groupMaxSize: 4,
    scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
    registrationStart: '2024-01-10T01:00:00.000Z',
    registrationEnd: '2024-01-20T11:00:00.000Z',
    topicChangeDeadline: '2024-01-28T11:00:00.000Z',
    projectStart: '2024-02-05T01:00:00.000Z',
    projectEnd: '2024-05-25T11:00:00.000Z',
  },
  {
    _id: 'demo-period-database-project-2022-3',
    isDemo: true,
    name: 'Cơ sở dữ liệu nâng cao',
    schoolYear: '2022-2023',
    semester: '3',
    status: 'archived',
    type: 'foundation_project',
    courseCode: 'IT3290',
    courseName: 'Cơ sở dữ liệu nâng cao',
    projectType: 'foundation',
    academicUnit: ACADEMIC_UNITS[0].value,
    allowIndividual: false,
    allowGroup: true,
    groupMinSize: 2,
    groupMaxSize: 5,
    scoringFormula: { supervisor: 0.5, reviewer: 0.5 },
    registrationStart: '2023-06-05T01:00:00.000Z',
    registrationEnd: '2023-06-12T11:00:00.000Z',
    topicChangeDeadline: '2023-06-18T11:00:00.000Z',
    projectStart: '2023-06-20T01:00:00.000Z',
    projectEnd: '2023-07-30T11:00:00.000Z',
  },
];

export function usePeriods() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [periods, setPeriods] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [periodToDelete, setPeriodToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [formErrors, setFormErrors] = useState({});

  const toDateTimeLocal = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  };

  const openCreateModal = () => {
    setEditingPeriod(null);
    setForm({
      ...DEFAULT_FORM_STATE,
      schoolYear: CURRENT_ACADEMIC_TERM.schoolYear,
      semester: CURRENT_ACADEMIC_TERM.semester,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (period) => {
    setEditingPeriod(period);
    setForm({
      name: period.courseName || period.name || '',
      schoolYear: period.schoolYear || '',
      semester: period.semester || '',
      type: period.type || 'foundation_project',
      courseCode: period.courseCode || '',
      courseName: period.courseName || '',
      projectType: period.projectType || 'foundation',
      academicUnit: period.academicUnit || ACADEMIC_UNITS[0].value,
      coordinatorLecturerId: period.coordinatorLecturerId?._id || period.coordinatorLecturerId || '',
      allowIndividual: period.allowIndividual !== false,
      allowGroup: period.allowGroup !== false,
      groupMinSize: String(period.groupMinSize ?? 2),
      groupMaxSize: String(period.groupMaxSize ?? 5),
      minGroupSize: String(period.groupMinSize ?? 2),
      maxGroupSize: String(period.groupMaxSize ?? 5),
      rubricId: period.rubricId?._id || period.rubricId || '',
      rubricVersion: period.rubricVersion || '',
      supervisorWeight: String(period.scoringFormula?.supervisor ?? 0.5),
      reviewerWeight: String(period.scoringFormula?.reviewer ?? 0.5),
      registrationStart: toDateTimeLocal(period.registrationStart),
      registrationEnd: toDateTimeLocal(period.registrationEnd),
      topicChangeDeadline: toDateTimeLocal(period.topicChangeDeadline),
      projectStart: toDateTimeLocal(period.projectStart),
      projectEnd: toDateTimeLocal(period.projectEnd),
      finalSubmissionDeadline: toDateTimeLocal(period.finalSubmissionDeadline),
      gradingStart: toDateTimeLocal(period.gradingStart),
      gradingEnd: toDateTimeLocal(period.gradingEnd),
      revisionDeadline: toDateTimeLocal(period.revisionDeadline),
      archiveDeadline: toDateTimeLocal(period.archiveDeadline),
    });
    setFormErrors({});
    setShowModal(true);
  };

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/periods', token);
      setPeriods([...(res.data || []), ...DEMO_PERIODS]);
      const rubricsRes = await api.get('/rubrics', token);
      setRubrics(rubricsRes.data || []);
      const lecturersRes = await api.get('/auth/lecturers', token);
      setLecturers(lecturersRes.data || []);
    } catch (err) {
      setPeriods(DEMO_PERIODS);
      toast.error(err.message || 'Không thể tải danh sách học phần');
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  useEffect(() => {
    if (token) {
      fetchPeriods();
    }
  }, [fetchPeriods, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});

    const requiredFields = [
      { name: 'schoolYear', label: 'Năm học' },
      { name: 'semester', label: 'Học kỳ' },
      { name: 'courseCode', label: 'Mã học phần' },
      { name: 'courseName', label: 'Tên học phần' },
      { name: 'academicUnit', label: 'Khoa/đơn vị chuyên môn phụ trách' },
      { name: 'rubricId', label: 'Tiêu chí chấm' },
      { name: 'supervisorWeight', label: 'Trọng số GVHD' },
      { name: 'reviewerWeight', label: 'Trọng số GV Chấm 2' },
      { name: 'registrationStart', label: 'Bắt đầu đăng ký đề tài' },
      { name: 'registrationEnd', label: 'Kết thúc đăng ký đề tài' },
      { name: 'topicChangeDeadline', label: 'Hạn đổi đề tài' },
      { name: 'projectStart', label: 'Bắt đầu thực hiện' },
      { name: 'projectEnd', label: 'Kết thúc thực hiện' },
    ];

    const errors = {};
    for (const f of requiredFields) {
      if (form[f.name] === undefined || form[f.name] === null || !String(form[f.name]).trim()) {
        errors[f.name] = `${f.label} là bắt buộc.`;
      }
    }

    const isIndiv = form.allowIndividual === true || form.allowIndividual === 'true';
    const isGroup = form.allowGroup === true || form.allowGroup === 'true';

    if (!isIndiv && !isGroup) {
      errors.allowIndividual = 'Phải chọn ít nhất một hình thức làm đồ án (cá nhân hoặc nhóm).';
    }

    if (isGroup) {
      const minSz = parseInt(form.groupMinSize || 2, 10);
      const maxSz = parseInt(form.groupMaxSize || 5, 10);
      if (isNaN(minSz) || minSz < 2) {
        errors.groupMinSize = 'Số thành viên tối thiểu của nhóm phải từ 2 trở lên.';
      }
      if (isNaN(maxSz) || maxSz < minSz) {
        errors.groupMaxSize = 'Số thành viên tối đa phải lớn hơn hoặc bằng số thành viên tối thiểu.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      setSubmitting(false);
      return;
    }

    const sup = parseFloat(form.supervisorWeight || 0);
    const rev = parseFloat(form.reviewerWeight || 0);
    if (Math.abs(sup + rev - 1.0) > 0.001) {
      toast.error('Tổng trọng số điểm thành phần (GVHD + GV Chấm 2) phải bằng 1.0 (100%).');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: form.courseName,
      schoolYear: form.schoolYear,
      semester: form.semester,
      type: form.type,
      courseCode: form.courseCode,
      courseName: form.courseName,
      projectType: form.projectType || (form.type === 'interdisciplinary_project' ? 'interdisciplinary' : 'foundation'),
      academicUnit: form.academicUnit,
      coordinatorLecturerId: form.coordinatorLecturerId || undefined,
      allowIndividual: isIndiv,
      allowGroup: isGroup,
      groupMinSize: isGroup ? parseInt(form.groupMinSize, 10) : 2,
      groupMaxSize: isGroup ? parseInt(form.groupMaxSize, 10) : 5,
      minGroupSize: isGroup ? parseInt(form.groupMinSize, 10) : 2, // legacy
      maxGroupSize: isGroup ? parseInt(form.groupMaxSize, 10) : 5, // legacy
      rubricId: form.rubricId || undefined,
      rubricVersion: form.rubricVersion || '1.0',
      scoringFormula: {
        supervisor: sup,
        reviewer: rev,
      },
      registrationStart: new Date(form.registrationStart).toISOString(),
      registrationEnd: new Date(form.registrationEnd).toISOString(),
      topicChangeDeadline: new Date(form.topicChangeDeadline).toISOString(),
      projectStart: new Date(form.projectStart).toISOString(),
      projectEnd: new Date(form.projectEnd).toISOString(),
      finalSubmissionDeadline: form.finalSubmissionDeadline ? new Date(form.finalSubmissionDeadline).toISOString() : undefined,
      gradingStart: form.gradingStart ? new Date(form.gradingStart).toISOString() : undefined,
      gradingEnd: form.gradingEnd ? new Date(form.gradingEnd).toISOString() : undefined,
      revisionDeadline: form.revisionDeadline ? new Date(form.revisionDeadline).toISOString() : undefined,
      archiveDeadline: form.archiveDeadline ? new Date(form.archiveDeadline).toISOString() : undefined,
    };

    try {
      if (editingPeriod) {
        await api.patch(`/periods/${editingPeriod._id}`, payload, token);
        toast.success('Đã cập nhật học phần thành công!');
      } else {
        await api.post('/periods', payload, token);
        toast.success('Đã tạo đợt học phần thành công!');
      }
      setShowModal(false);
      setEditingPeriod(null);
      fetchPeriods();
    } catch (err) {
      if (err.errors) {
        const errorsMap = {};
        err.errors.forEach((errObj) => {
          errorsMap[errObj.field] = errObj.message;
        });
        setFormErrors(errorsMap);
        toast.error('Vui lòng kiểm tra lại các mốc thời gian và thông tin học phần.');
      } else {
        toast.error(err.message || 'Lỗi khi tạo đợt học phần');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransition = async (id, action) => {
    try {
      let endpoint = `/periods/${id}`;
      if (action === 'open-registration') endpoint += '/open-registration';
      else if (action === 'start') endpoint += '/start';
      else if (action === 'start-grading') endpoint += '/start-grading';
      else if (action === 'publish-results') endpoint += '/publish-results';
      else if (action === 'open-appeal') endpoint += '/open-appeal';
      else if (action === 'lock-results') endpoint += '/lock-results';
      else if (action === 'archive') endpoint += '/archive';

      await api.post(endpoint, {}, token);
      toast.success('Cập nhật trạng thái học phần thành công!');
      fetchPeriods();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật trạng thái');
    }
  };

  const handleDeletePeriod = async (period) => {
    setDeleting(true);
    try {
      await api.delete(`/periods/${period._id}`, token);
      toast.success('Đã xóa học phần thành công.');
      setPeriodToDelete(null);
      fetchPeriods();
    } catch (err) {
      toast.error(err.message || 'Không thể xóa học phần');
    } finally {
      setDeleting(false);
    }
  };

  return {
    periods,
    rubrics,
    lecturers,
    loading,
    showModal,
    setShowModal,
    editingPeriod,
    setEditingPeriod,
    periodToDelete,
    setPeriodToDelete,
    submitting,
    deleting,
    form,
    formErrors,
    currentAcademicTerm: CURRENT_ACADEMIC_TERM,
    openCreateModal,
    openEditModal,
    fetchPeriods,
    handleChange,
    handleSubmit,
    handleTransition,
    handleDeletePeriod,
  };
}
