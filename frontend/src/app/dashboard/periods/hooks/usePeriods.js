'use client';

import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import { useToast } from '@/components/ui/Toast';

const DEFAULT_FORM_STATE = {
  name: 'Học phần Đồ án Cơ sở ngành Kỳ 20252',
  schoolYear: '2025-2026',
  semester: '2',
  type: 'foundation_project',
  courseCode: 'IT3000',
  courseName: 'Đồ án cơ sở ngành',
  projectType: 'foundation',
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
  committeeWeight: '0.0',
  // Timelines
  registrationStart: '2026-06-05T08:00',
  registrationEnd: '2026-06-15T18:00',
  topicChangeDeadline: '2026-06-20T18:00',
  projectStart: '2026-06-25T08:00',
  projectEnd: '2026-09-15T18:00',
  preDefenseSubmissionDeadline: '',
  defenseStart: '',
  defenseEnd: '',
  postDefenseRevisionDeadline: '',
  archiveDeadline: '',
};

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
    setForm(DEFAULT_FORM_STATE);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (period) => {
    setEditingPeriod(period);
    setForm({
      name: period.name || '',
      schoolYear: period.schoolYear || '',
      semester: period.semester || '',
      type: period.type || 'foundation_project',
      courseCode: period.courseCode || '',
      courseName: period.courseName || '',
      projectType: period.projectType || 'foundation',
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
      committeeWeight: String(period.scoringFormula?.committee ?? 0.0),
      registrationStart: toDateTimeLocal(period.registrationStart),
      registrationEnd: toDateTimeLocal(period.registrationEnd),
      topicChangeDeadline: toDateTimeLocal(period.topicChangeDeadline),
      projectStart: toDateTimeLocal(period.projectStart),
      projectEnd: toDateTimeLocal(period.projectEnd),
      preDefenseSubmissionDeadline: toDateTimeLocal(period.preDefenseSubmissionDeadline),
      defenseStart: toDateTimeLocal(period.defenseStart),
      defenseEnd: toDateTimeLocal(period.defenseEnd),
      postDefenseRevisionDeadline: toDateTimeLocal(period.postDefenseRevisionDeadline),
      archiveDeadline: toDateTimeLocal(period.archiveDeadline),
    });
    setFormErrors({});
    setShowModal(true);
  };

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/periods', token);
      setPeriods(res.data || []);
      const rubricsRes = await api.get('/rubrics', token);
      setRubrics(rubricsRes.data || []);
      const lecturersRes = await api.get('/auth/lecturers', token);
      setLecturers(lecturersRes.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách học phần đồ án');
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
      { name: 'name', label: 'Tên học phần đồ án' },
      { name: 'schoolYear', label: 'Năm học' },
      { name: 'semester', label: 'Học kỳ' },
      { name: 'courseCode', label: 'Mã học phần' },
      { name: 'courseName', label: 'Tên học phần' },
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
      name: form.name,
      schoolYear: form.schoolYear,
      semester: form.semester,
      type: form.type,
      courseCode: form.courseCode,
      courseName: form.courseName,
      projectType: form.projectType || (form.type === 'interdisciplinary_project' ? 'interdisciplinary' : 'foundation'),
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
        committee: 0.0,
      },
      registrationStart: new Date(form.registrationStart).toISOString(),
      registrationEnd: new Date(form.registrationEnd).toISOString(),
      topicChangeDeadline: new Date(form.topicChangeDeadline).toISOString(),
      projectStart: new Date(form.projectStart).toISOString(),
      projectEnd: new Date(form.projectEnd).toISOString(),
      preDefenseSubmissionDeadline: form.preDefenseSubmissionDeadline ? new Date(form.preDefenseSubmissionDeadline).toISOString() : undefined,
      defenseStart: form.defenseStart ? new Date(form.defenseStart).toISOString() : undefined,
      defenseEnd: form.defenseEnd ? new Date(form.defenseEnd).toISOString() : undefined,
      postDefenseRevisionDeadline: form.postDefenseRevisionDeadline ? new Date(form.postDefenseRevisionDeadline).toISOString() : undefined,
      archiveDeadline: form.archiveDeadline ? new Date(form.archiveDeadline).toISOString() : undefined,
    };

    try {
      if (editingPeriod) {
        await api.patch(`/periods/${editingPeriod._id}`, payload, token);
        toast.success('Đã cập nhật học phần đồ án thành công!');
      } else {
        await api.post('/periods', payload, token);
        toast.success('Đã khởi tạo học phần đồ án mới thành công!');
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
        toast.error(err.message || 'Lỗi khi tạo mới học phần đồ án');
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
      toast.success('Cập nhật trạng thái học phần đồ án thành công!');
      fetchPeriods();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật trạng thái');
    }
  };

  const handleDeletePeriod = async (period) => {
    setDeleting(true);
    try {
      await api.delete(`/periods/${period._id}`, token);
      toast.success('Đã xóa học phần đồ án thành công.');
      setPeriodToDelete(null);
      fetchPeriods();
    } catch (err) {
      toast.error(err.message || 'Không thể xóa học phần đồ án');
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
    openCreateModal,
    openEditModal,
    fetchPeriods,
    handleChange,
    handleSubmit,
    handleTransition,
    handleDeletePeriod,
  };
}
