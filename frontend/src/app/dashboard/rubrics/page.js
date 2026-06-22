'use client';

import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@/store/auth.store';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { ClipboardText, Plus, Trash, PencilSimple, ArrowsClockwise } from '@phosphor-icons/react';
import css from './page.module.css';

const DEFAULT_CRITERIA = [
  { criteriaCode: 'C1', criteriaName: 'Chất lượng Báo cáo', maxScore: 10, weight: 1.0 }
];

const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  version: '1.0',
  criteria: {
    SUPERVISOR: [...DEFAULT_CRITERIA],
    REVIEWER: [...DEFAULT_CRITERIA],
    COMMITTEE_MEMBER: [],
  }
};

export default function RubricsPage() {
  const { token, user } = useAuthStore();
  const toast = useToast();
  
  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRubric, setEditingRubric] = useState(null);
  const [rubricToDelete, setRubricToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [formErrors, setFormErrors] = useState({});

  const fetchRubrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/rubrics', token);
      setRubrics(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách tiêu chí đánh giá');
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  useEffect(() => {
    if (token) {
      fetchRubrics();
    }
  }, [fetchRubrics, token]);

  const openCreateModal = () => {
    setEditingRubric(null);
    setForm(JSON.parse(JSON.stringify(INITIAL_FORM_STATE)));
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (rubric) => {
    setEditingRubric(rubric);
    setForm({
      name: rubric.name || '',
      description: rubric.description || '',
      version: rubric.version || '1.0',
      criteria: {
        SUPERVISOR: rubric.criteria?.SUPERVISOR ? JSON.parse(JSON.stringify(rubric.criteria.SUPERVISOR)) : [],
        REVIEWER: rubric.criteria?.REVIEWER ? JSON.parse(JSON.stringify(rubric.criteria.REVIEWER)) : [],
        COMMITTEE_MEMBER: rubric.criteria?.COMMITTEE_MEMBER ? JSON.parse(JSON.stringify(rubric.criteria.COMMITTEE_MEMBER)) : [],
      }
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleCriteriaChange = (role, index, field, value) => {
    const updatedRoleCriteria = [...form.criteria[role]];
    if (field === 'maxScore' || field === 'weight') {
      updatedRoleCriteria[index][field] = value === '' ? '' : Number(value);
    } else {
      updatedRoleCriteria[index][field] = value;
    }
    setForm((prev) => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [role]: updatedRoleCriteria
      }
    }));
  };

  const addCriteriaRow = (role) => {
    const currentList = form.criteria[role];
    const newCode = `C${currentList.length + 1}`;
    const updatedRoleCriteria = [...currentList, { criteriaCode: newCode, criteriaName: '', maxScore: 10, weight: 1.0 }];
    setForm((prev) => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [role]: updatedRoleCriteria
      }
    }));
  };

  const removeCriteriaRow = (role, index) => {
    const updatedRoleCriteria = form.criteria[role].filter((_, idx) => idx !== index);
    // Re-code for consistency
    const updatedAndRecoded = updatedRoleCriteria.map((c, idx) => ({
      ...c,
      criteriaCode: `C${idx + 1}`
    }));
    setForm((prev) => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [role]: updatedAndRecoded
      }
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name || form.name.trim() === '') {
      errors.name = 'Tên tiêu chí đánh giá là bắt buộc.';
    }
    if (!form.version || form.version.trim() === '') {
      errors.version = 'Phiên bản là bắt buộc.';
    }

    const requiredRoles = ['SUPERVISOR', 'REVIEWER'];
    requiredRoles.forEach((role) => {
      const criteriaList = form.criteria[role];
      if (!criteriaList || criteriaList.length === 0) {
        errors[role] = 'Vai trò này phải có ít nhất một tiêu chí chấm.';
      }
    });

    const allRoles = ['SUPERVISOR', 'REVIEWER', 'COMMITTEE_MEMBER'];
    allRoles.forEach((role) => {
      const criteriaList = form.criteria[role] || [];
      criteriaList.forEach((c, idx) => {
        if (!c.criteriaName || c.criteriaName.trim() === '') {
          errors[`${role}_${idx}_criteriaName`] = 'Tên tiêu chí không được để trống.';
        }
        if (c.maxScore === undefined || c.maxScore === '' || isNaN(c.maxScore) || c.maxScore <= 0) {
          errors[`${role}_${idx}_maxScore`] = 'Điểm tối đa phải là số dương.';
        }
        if (c.weight === undefined || c.weight === '' || isNaN(c.weight) || c.weight < 0) {
          errors[`${role}_${idx}_weight`] = 'Trọng số không âm.';
        }
      });
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Vui lòng hoàn thiện đúng thông tin các trường tiêu chí.');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: form.name,
      description: form.description,
      version: form.version,
      criteria: form.criteria
    };

    try {
      if (editingRubric) {
        await api.patch(`/rubrics/${editingRubric._id}`, payload, token);
        toast.success('Cập nhật tiêu chí đánh giá thành công!');
      } else {
        await api.post('/rubrics', payload, token);
        toast.success('Tạo tiêu chí đánh giá thành công!');
      }
      setShowModal(false);
      setEditingRubric(null);
      fetchRubrics();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu tiêu chí đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRubric = async (rubric) => {
    setDeleting(true);
    try {
      await api.delete(`/rubrics/${rubric._id}`, token);
      toast.success('Xóa tiêu chí đánh giá thành công!');
      setRubricToDelete(null);
      fetchRubrics();
    } catch (err) {
      toast.error(err.message || 'Không thể xóa tiêu chí đánh giá');
    } finally {
      setDeleting(false);
    }
  };

  // Render role rubric configuration section in the modal
  const renderCriteriaConfigSection = (role, label) => {
    const list = form.criteria[role] || [];
    return (
      <div className={css.criteriaSection}>
        <div className={css.sectionHeader}>
          <span>{label}</span>
          <button type="button" className={css.addBtn} onClick={() => addCriteriaRow(role)}>
            <Plus size={14} /> Thêm tiêu chí
          </button>
        </div>
        
        {formErrors[role] && <div className="text-error" style={{ fontSize: '12px', marginBottom: '8px' }}>{formErrors[role]}</div>}

        {list.length > 0 && (
          <div className={css.criteriaTableHeader}>
            <span>Mã tiêu chí</span>
            <span>Tên tiêu chí</span>
            <span>Điểm tối đa</span>
            <span>Trọng số</span>
            <span>Xóa</span>
          </div>
        )}

        {list.map((c, idx) => (
          <div key={idx} className={css.criteriaRow}>
            <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)' }}>
              {c.criteriaCode}
            </div>
            <div>
              <Input
                placeholder="Ví dụ: Nội dung báo cáo"
                value={c.criteriaName}
                onChange={(e) => handleCriteriaChange(role, idx, 'criteriaName', e.target.value)}
                error={formErrors[`${role}_${idx}_criteriaName`]}
                style={{ height: '36px', minHeight: '36px' }}
              />
            </div>
            <div>
              <Input
                type="number"
                step="0.5"
                placeholder="10"
                value={c.maxScore}
                onChange={(e) => handleCriteriaChange(role, idx, 'maxScore', e.target.value)}
                error={formErrors[`${role}_${idx}_maxScore`]}
                style={{ height: '36px', minHeight: '36px' }}
              />
            </div>
            <div>
              <Input
                type="number"
                step="0.1"
                placeholder="1.0"
                value={c.weight}
                onChange={(e) => handleCriteriaChange(role, idx, 'weight', e.target.value)}
                error={formErrors[`${role}_${idx}_weight`]}
                style={{ height: '36px', minHeight: '36px' }}
              />
            </div>
            <div>
              <button type="button" className={css.removeBtn} onClick={() => removeCriteriaRow(role, idx)}>
                <Trash size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className={css.header}>
        <div className={css.titleContainer}>
          <h1 className={`text-display ${css.title}`}>
            <ClipboardText size={28} className={css.icon} />
            Quản lý Tiêu chí Đánh giá
          </h1>
          <p className={css.description}>
            Cấu hình bảng điểm tiêu chí đánh giá động cho các hội đồng và giảng viên
          </p>
        </div>
        <div className={css.actions}>
          <Button variant="secondary" size="sm" onClick={fetchRubrics}>
            <ArrowsClockwise size={16} />
            Làm mới
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus size={16} />
            Tạo tiêu chí mới
          </Button>
        </div>
      </div>

      {/* List content */}
      {loading ? (
        <div className={css.loadingContainer}>
          <Spinner size="lg" />
        </div>
      ) : rubrics.length === 0 ? (
        <Card>
          <div className={css.noData}>
            Chưa có bảng tiêu chí đánh giá nào trên hệ thống. Hãy nhấp &quot;Tạo tiêu chí mới&quot; để định nghĩa cấu hình.
          </div>
        </Card>
      ) : (
        <div className={css.list}>
          {rubrics.map((r) => (
            <Card key={r._id} className={css.card}>
              <div className={css.cardHeader}>
                <div className={css.cardTitle}>
                  {r.name}
                  <span className={css.cardVersion}>v{r.version}</span>
                </div>
                <div className={css.criteriaSummary}>
                  <span className={css.criteriaBadge}>GVHD: {r.criteria?.SUPERVISOR?.length || 0} TC</span>
                  <span className={css.criteriaBadge}>GV Chấm 2: {r.criteria?.REVIEWER?.length || 0} TC</span>
                  <span className={css.criteriaBadge}>Hội đồng: {r.criteria?.COMMITTEE_MEMBER?.length || 0} TC</span>
                </div>
              </div>
              <p className={css.cardDesc}>
                {r.description || 'Không có mô tả chi tiết.'}
              </p>
              <div className={css.cardDetails}>
                <div><strong>Người tạo:</strong> {r.createdBy?.fullName || 'Hệ thống'} ({r.createdBy?.email})</div>
                <div><strong>Cập nhật cuối:</strong> {new Date(r.updatedAt).toLocaleString()}</div>
              </div>
              <div className={css.cardActions}>
                <Button variant="secondary" size="sm" onClick={() => openEditModal(r)}>
                  <PencilSimple size={16} /> Chỉnh sửa
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRubricToDelete(r)}>
                  <Trash size={16} /> Xóa
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal CRUD */}
      {showModal && (
        <div className={css.modalBackdrop}>
          <div className={css.modal}>
            <div className={css.modalHeader}>
              <h3 className={css.modalTitle}>
                {editingRubric ? 'Chỉnh sửa bảng tiêu chí đánh giá' : 'Tạo bảng tiêu chí đánh giá mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className={css.closeBtn}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className={css.modalBody}>
                <div className={css.formGrid}>
                  <div className={css.spanFull}>
                    <Input
                      label="Tên bảng tiêu chí"
                      name="name"
                      placeholder="Ví dụ: Bảng tiêu chuẩn chấm đồ án CNTT K66"
                      value={form.name}
                      onChange={handleChange}
                      error={formErrors.name}
                    />
                  </div>
                  <div>
                    <Input
                      label="Phiên bản"
                      name="version"
                      placeholder="1.0"
                      value={form.version}
                      onChange={handleChange}
                      error={formErrors.version}
                    />
                  </div>
                  <div className={css.spanFull}>
                    <label className="text-secondary" style={{ fontSize: '13px', fontWeight: 500 }}>
                      Mô tả chi tiết
                    </label>
                    <textarea
                      name="description"
                      placeholder="Nhập mô tả thêm về bảng tiêu chí này..."
                      value={form.description}
                      onChange={handleChange}
                      rows="2"
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '14px',
                        backgroundColor: 'var(--bg-raised)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        marginTop: '6px'
                      }}
                    ></textarea>
                  </div>
                </div>

                {renderCriteriaConfigSection('SUPERVISOR', 'Tiêu chí Giảng viên hướng dẫn')}
                {renderCriteriaConfigSection('REVIEWER', 'Tiêu chí Giảng viên chấm 2')}
                {renderCriteriaConfigSection('COMMITTEE_MEMBER', 'Tiêu chí Hội đồng (Tùy chọn)')}
              </div>

              <div className={css.modalFooter}>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="primary" loading={submitting}>
                  {editingRubric ? 'Cập nhật' : 'Khởi tạo'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog confirm delete */}
      <ConfirmDialog
        open={Boolean(rubricToDelete)}
        title="Xóa bảng tiêu chí đánh giá"
        message={rubricToDelete ? `Bạn có chắc chắn muốn xóa bảng tiêu chí đánh giá "${rubricToDelete.name}"? Đợt đồ án liên kết sẽ không thể sử dụng bảng tiêu chí này sau khi xóa.` : ''}
        confirmLabel="Xóa"
        loading={deleting}
        onCancel={() => setRubricToDelete(null)}
        onConfirm={() => handleDeleteRubric(rubricToDelete)}
      />
    </div>
  );
}
