'use client';

import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import usePeriodStore from '@/store/period.store';
import api from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { hasAnyRole, handleApiError } from '@/lib/utils';
import { ACADEMIC_UNITS } from '@/lib/academicUnits';
import { CURRENT_ACADEMIC_TERM, isPeriodInTerm } from '@/lib/academicTerm';

const initialForm = {
  ownerType: 'student',
  groupId: '',
  title: '',
  summary: '',
  academicUnit: ACADEMIC_UNITS[0].value,
  proposedSupervisorId: '',
  proposedSupervisorEmail: '',
  periodId: '',
};

export function useTopics(initialActiveTab = 'all') {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const { periods, fetchPeriods } = usePeriodStore();

  const [groups, setGroups] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState(null);

  const isStaff = hasAnyRole(user, ['FACULTY_STAFF', 'SYSTEM_ADMIN']);
  const isLecturer = hasAnyRole(user, ['LECTURER']);
  const isStudent = hasAnyRole(user, ['STUDENT']);

  const resetForm = useCallback(() => {
    setForm((prev) => ({
      ...initialForm,
      periodId: prev.periodId,
      academicUnit: prev.academicUnit || ACADEMIC_UNITS[0].value,
    }));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pList, resTopics] = await Promise.all([
        fetchPeriods(token),
        api.get('/topics', token),
      ]);

      if (pList && pList.length > 0) {
        const defaultPeriod = pList.find((period) => isPeriodInTerm(period, CURRENT_ACADEMIC_TERM.schoolYear, CURRENT_ACADEMIC_TERM.semester)) || pList[0];
        setForm((prev) => ({
          ...prev,
          periodId: prev.periodId || defaultPeriod._id,
          academicUnit: prev.academicUnit || defaultPeriod.academicUnit || ACADEMIC_UNITS[0].value,
        }));
      }

      setTopics(resTopics.data || []);
      if (isStudent) {
        const resGroups = await api.get('/groups', token).catch(() => ({ data: [] }));
        setGroups(resGroups.data || []);
      } else {
        setGroups([]);
      }
    } catch (err) {
      handleApiError(err, toast);
    } finally {
      setLoading(false);
    }
  }, [fetchPeriods, isStudent, toast, token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [loadData, token]);

  const handleSubmitTopic = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.periodId || !form.summary.trim()) {
      toast.error('Vui lòng nhập đầy đủ học phần, tên đề tài và tóm tắt nội dung.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedPeriod = periods.find((period) => period._id === form.periodId);
      const academicUnit = selectedPeriod?.academicUnit || ACADEMIC_UNITS[0].value;
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        objectives: form.summary.trim(),
        scope: form.summary.trim(),
        expectedResult: form.summary.trim(),
        plan: form.summary.trim(),
        academicUnit,
        periodId: form.periodId,
      };

      if (isLecturer || isStaff) {
        const lecturerPayload = {
          ...payload,
          proposedSupervisorId: form.proposedSupervisorId || undefined,
          proposedSupervisorEmail: form.proposedSupervisorEmail?.trim() || undefined,
        };

        if (editingTopicId) {
          await api.put(`/topics/${editingTopicId}`, lecturerPayload, token);
          toast.success('Cập nhật đề tài thành công!');
        } else {
          await api.post('/topics/lecturer', lecturerPayload, token);
          toast.success('Tạo đề tài giảng viên thành công!');
        }
      } else {
        if (!form.proposedSupervisorEmail?.trim()) {
          toast.error('Vui lòng nhập email giảng viên hướng dẫn đề xuất.');
          return;
        }
        if (form.ownerType === 'group' && !form.groupId) {
          toast.error('Vui lòng chọn nhóm khi đăng ký đề tài theo nhóm.');
          return;
        }

        const studentPayload = {
          ...payload,
          proposedSupervisorEmail: form.proposedSupervisorEmail.trim(),
          ownerType: form.ownerType,
          ...(form.ownerType === 'group' ? { groupId: form.groupId } : {}),
        };

        if (editingTopicId) {
          await api.put(`/topics/${editingTopicId}`, studentPayload, token);
          toast.success('Cập nhật đề xuất đề tài thành công!');
        } else {
          await api.post('/topics', studentPayload, token);
          toast.success('Đề xuất đề tài thành công! Chờ duyệt chuyên môn.');
        }
      }

      setShowProposeModal(false);
      setEditingTopicId(null);
      resetForm();
      loadData();
    } catch (err) {
      if (err.errors?.[0]?.message) {
        toast.error(err.errors[0].message);
        return;
      }
      handleApiError(err, toast);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (topic) => {
    setEditingTopicId(topic._id);
    setForm({
      ownerType: topic.ownerType || (topic.groupId ? 'group' : 'student'),
      groupId: topic.groupId?._id || topic.groupId || '',
      title: topic.title,
      summary: topic.summary || '',
      academicUnit: topic.academicUnit || topic.periodId?.academicUnit || ACADEMIC_UNITS[0].value,
      proposedSupervisorId: topic.proposedSupervisorId?._id || topic.proposedSupervisorId || '',
      proposedSupervisorEmail: topic.proposedSupervisorId?.userId?.email || '',
      periodId: topic.periodId?._id || topic.periodId || '',
    });
    setShowProposeModal(true);
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/topics/${id}/approve`, {}, token);
      toast.success('Đã phê duyệt đề tài thành công!');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/topics/${id}/reject`, {}, token);
      toast.success('Đã từ chối đề tài.');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const handleRequestRevision = async (id) => {
    try {
      await api.post(`/topics/${id}/request-revision`, {}, token);
      toast.success('Đã gửi yêu cầu chỉnh sửa đề tài.');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const handleCancelTopic = async (id) => {
    try {
      const res = await api.post(`/topics/${id}/cancel`, {}, token);
      const counts = res.data?.cancelledProjects
        ? ` Đã huỷ ${res.data.cancelledProjects} dự án liên kết.`
        : '';
      toast.success(`${res.message || 'Đã huỷ đề tài.'}${counts}`);
      loadData();
      return true;
    } catch (err) {
      handleApiError(err, toast);
      return false;
    }
  };

  const handleRegisterTopic = async (topicId, ownerType, groupId) => {
    try {
      const payload = {
        ownerType,
        ...(ownerType === 'group' ? { groupId } : {}),
      };
      await api.post(`/topics/${topicId}/register`, payload, token);
      toast.success('Đăng ký đề tài thành công!');
      loadData();
      return true;
    } catch (err) {
      handleApiError(err, toast);
      return false;
    }
  };

  const handlePublishTopic = async (id) => {
    try {
      await api.post(`/topics/${id}/publish`, {}, token);
      toast.success('Đã công khai đề tài thành công!');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const handleUnpublishTopic = async (id) => {
    try {
      await api.post(`/topics/${id}/unpublish`, {}, token);
      toast.success('Đã rút đề tài khỏi danh sách công khai.');
      loadData();
    } catch (err) {
      handleApiError(err, toast);
    }
  };

  const filteredTopics = topics.filter((topic) => {
    const mappedStatus = ['submitted', 'needs_revision'].includes(topic.status)
      ? 'pending_review'
      : topic.status;
    if (activeTab === 'all') return !['cancelled', 'completed'].includes(mappedStatus);
    if (activeTab === 'history') return ['cancelled', 'completed'].includes(mappedStatus);
    return mappedStatus === activeTab;
  });

  const availableGroups = groups.filter((group) => {
    if (form.periodId && (group.periodId?._id || group.periodId) !== form.periodId) return false;
    if (!user?.studentId) return false;
    return (group.members || []).some((member) => {
      const memberStudentId = member.studentId?._id || member.studentId;
      return String(memberStudentId) === String(user.studentId) && member.status === 'accepted';
    });
  });

  return {
    user,
    token,
    periods,
    groups: availableGroups,
    topics,
    loading,
    showProposeModal,
    setShowProposeModal,
    activeTab,
    setActiveTab,
    form,
    setForm,
    submitting,
    editingTopicId,
    setEditingTopicId,
    loadData,
    isStaff,
    isLecturer,
    isStudent,
    handleSubmitTopic,
    handleEditClick,
    handleApprove,
    handleReject,
    handleRequestRevision,
    handleCancelTopic,
    handleRegisterTopic,
    handlePublishTopic,
    handleUnpublishTopic,
    filteredTopics,
  };
}
