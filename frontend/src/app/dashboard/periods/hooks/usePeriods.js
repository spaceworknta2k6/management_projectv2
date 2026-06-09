'use client';

import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import { useToast } from '@/components/ui/Toast';

const DEFAULT_FORM_STATE = {
  name: 'Đợt Đồ án Tốt nghiệp Kỳ 20252',
  schoolYear: '2025-2026',
  semester: '2',
  type: 'foundation_project',
  minGroupSize: '1',
  maxGroupSize: '3',
  rubricVersion: 'HUST-SET-2026',
  supervisorWeight: '0.3',
  reviewerWeight: '0.2',
  committeeWeight: '0.5',
  // Timelines
  registrationStart: '2026-06-05T08:00',
  registrationEnd: '2026-06-15T18:00',
  topicChangeDeadline: '2026-06-20T18:00',
  projectStart: '2026-06-25T08:00',
  projectEnd: '2026-09-15T18:00',
  preDefenseSubmissionDeadline: '2026-09-01T18:00',
  defenseStart: '2026-09-05T08:00',
  defenseEnd: '2026-09-10T18:00',
  postDefenseRevisionDeadline: '2026-09-20T18:00',
  archiveDeadline: '2026-09-30T18:00',
};

export function usePeriods() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [periods, setPeriods] = useState([]);
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
      minGroupSize: String(period.minGroupSize || 1),
      maxGroupSize: String(period.maxGroupSize || 3),
      rubricVersion: period.rubricVersion || '',
      supervisorWeight: String(period.scoringFormula?.supervisor ?? 0.3),
      reviewerWeight: String(period.scoringFormula?.reviewer ?? 0.2),
      committeeWeight: String(period.scoringFormula?.committee ?? 0.5),
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
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách đợt đồ án');
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

    const sup = parseFloat(form.supervisorWeight || 0);
    const rev = parseFloat(form.reviewerWeight || 0);
    const com = parseFloat(form.committeeWeight || 0);
    if (Math.abs(sup + rev + com - 1.0) > 0.001) {
      toast.error('Tổng trọng số điểm thành phần phải bằng 1.0 (100%).');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: form.name,
      schoolYear: form.schoolYear,
      semester: form.semester,
      type: form.type,
      minGroupSize: parseInt(form.minGroupSize, 10),
      maxGroupSize: parseInt(form.maxGroupSize, 10),
      rubricVersion: form.rubricVersion,
      scoringFormula: {
        supervisor: sup,
        reviewer: rev,
        committee: com,
      },
      registrationStart: new Date(form.registrationStart).toISOString(),
      registrationEnd: new Date(form.registrationEnd).toISOString(),
      topicChangeDeadline: new Date(form.topicChangeDeadline).toISOString(),
      projectStart: new Date(form.projectStart).toISOString(),
      projectEnd: new Date(form.projectEnd).toISOString(),
      preDefenseSubmissionDeadline: new Date(form.preDefenseSubmissionDeadline).toISOString(),
      defenseStart: new Date(form.defenseStart).toISOString(),
      defenseEnd: new Date(form.defenseEnd).toISOString(),
      postDefenseRevisionDeadline: new Date(form.postDefenseRevisionDeadline).toISOString(),
      archiveDeadline: new Date(form.archiveDeadline).toISOString(),
    };

    try {
      if (editingPeriod) {
        await api.patch(`/periods/${editingPeriod._id}`, payload, token);
        toast.success('Đã cập nhật đợt đồ án thành công!');
      } else {
        await api.post('/periods', payload, token);
        toast.success('Đã khởi tạo đợt đồ án mới thành công!');
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
        toast.error('Vui lòng kiểm tra lại các mốc thời gian và thông tin đợt đồ án.');
      } else {
        toast.error(err.message || 'Lỗi khi tạo mới đợt đồ án');
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
      else if (action === 'lock-results') endpoint += '/lock-results';
      else if (action === 'archive') endpoint += '/archive';

      await api.post(endpoint, {}, token);
      toast.success('Cập nhật trạng thái đợt đồ án thành công!');
      fetchPeriods();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật trạng thái');
    }
  };

  const handleDeletePeriod = async (period) => {
    setDeleting(true);
    try {
      await api.delete(`/periods/${period._id}`, token);
      toast.success('Đã xóa đợt đồ án thành công.');
      setPeriodToDelete(null);
      fetchPeriods();
    } catch (err) {
      toast.error(err.message || 'Không thể xóa đợt đồ án');
    } finally {
      setDeleting(false);
    }
  };

  return {
    periods,
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
