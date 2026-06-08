'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, UserCircle } from '@phosphor-icons/react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { authService } from '@/services/auth.service';
import useAuthStore from '@/store/auth.store';
import { formatDate, getRoleLabel } from '@/lib/utils';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

const text = {
  title: 'Thông tin cá nhân',
  subtitle: 'Quản lý hồ sơ cơ bản, số điện thoại, khóa học và ảnh đại diện của tài khoản.',
  updateTitle: 'Cập nhật hồ sơ',
  updateSubtitle: 'Email, vai trò và trạng thái do quản trị viên quản lý.',
  fullName: 'Họ tên',
  email: 'Email',
  phoneNumber: 'Số điện thoại',
  cohort: 'Khóa',
  studentCode: 'Mã sinh viên',
  lecturerCode: 'Mã giảng viên',
  createdAt: 'Ngày tạo',
  empty: 'Chưa cập nhật',
  fullNamePlaceholder: 'Nhập họ tên',
  phonePlaceholder: 'VD: 0912345678',
  cohortPlaceholder: 'VD: K18',
  save: 'Lưu thay đổi',
  avatar: 'Đổi ảnh',
  avatarHint: 'JPG, PNG hoặc WEBP, tối đa 2MB',
};

const statusInfo = {
  active: { label: 'Kích hoạt', variant: 'success' },
  inactive: { label: 'Không hoạt động', variant: 'warning' },
  locked: { label: 'Đã khóa', variant: 'error' },
};

function getAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_ORIGIN}${url}`;
}

function validateProfile(form) {
  const errors = {};

  if (!form.fullName.trim()) {
    errors.fullName = 'Vui lòng nhập họ tên.';
  }

  if (form.phoneNumber.trim() && !/^[0-9+\-\s().]{8,20}$/.test(form.phoneNumber.trim())) {
    errors.phoneNumber = 'Số điện thoại không hợp lệ.';
  }

  if (form.cohort.trim() && !/^K\d{1,3}$/i.test(form.cohort.trim())) {
    errors.cohort = 'Khóa học phải có dạng K18, K67...';
  }

  return errors;
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right' }}>
        {value || text.empty}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { token, user, setUser } = useAuthStore();
  const toast = useToast();
  const avatarInputRef = useRef(null);
  const [form, setForm] = useState({ fullName: '', phoneNumber: '', cohort: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || user.name || '',
      phoneNumber: user.phoneNumber || '',
      cohort: user.cohort || '',
    });
  }, [user]);

  const roles = useMemo(() => user?.roles || (user?.role ? [user.role] : []), [user]);
  const status = statusInfo[user?.status] || { label: user?.status || statusInfo.active.label, variant: 'neutral' };
  const avatarUrl = getAssetUrl(user?.avatarUrl);
  const isStudent = roles.includes('STUDENT');
  const hasLecturerProfile = roles.includes('LECTURER') || roles.includes('DEPARTMENT_STAFF');

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WEBP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ảnh đại diện không được vượt quá 2MB.');
      return;
    }

    setAvatarUploading(true);
    try {
      const res = await authService.updateAvatar(file, token);
      setUser({ ...user, ...res.data });
      toast.success(res.message || 'Cập nhật ảnh đại diện thành công.');
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật ảnh đại diện.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateProfile(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error('Vui lòng kiểm tra lại thông tin cá nhân.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.updateMe({
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        cohort: form.cohort.trim().toUpperCase(),
      }, token);
      setUser({ ...user, ...res.data });
      toast.success(res.message || 'Cập nhật thông tin cá nhân thành công.');
    } catch (err) {
      const fieldErrors = {};
      err.errors?.forEach((item) => {
        fieldErrors[item.field] = item.message;
      });
      setErrors(fieldErrors);
      toast.error(err.message || 'Không thể cập nhật thông tin cá nhân.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '70px 0' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCircle size={28} style={{ color: 'var(--accent)' }} />
            {text.title}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {text.subtitle}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--accent-glow)',
                backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(79,142,247,0.2)',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {!avatarUrl && <UserCircle size={40} weight="duotone" />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {user.fullName || user.email}
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Camera size={15} />}
                  loading={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {text.avatar}
                </Button>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{text.avatarHint}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {roles.map((role) => (
              <Badge key={role} variant="neutral">{getRoleLabel(role)}</Badge>
            ))}
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>

          {isStudent && <InfoRow label={text.studentCode} value={user.studentCode} />}
          {hasLecturerProfile && <InfoRow label={text.lecturerCode} value={user.lecturerCode} />}
          <InfoRow label={text.email} value={user.email} />
          {isStudent && <InfoRow label={text.cohort} value={user.cohort} />}
          <InfoRow label={text.phoneNumber} value={user.phoneNumber} />
          <InfoRow label={text.createdAt} value={formatDate(user.createdAt)} />
        </Card>

        <Card title={text.updateTitle} subtitle={text.updateSubtitle}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px', maxWidth: '620px' }}>
            <Input
              label={text.fullName}
              name="profile-full-name"
              value={form.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              error={errors.fullName}
              placeholder={text.fullNamePlaceholder}
            />

            <Input
              label={text.phoneNumber}
              name="profile-phone-number"
              value={form.phoneNumber}
              onChange={(e) => handleChange('phoneNumber', e.target.value)}
              error={errors.phoneNumber}
              placeholder={text.phonePlaceholder}
            />

            {isStudent && (
              <Input
                label={text.cohort}
                name="profile-cohort"
                value={form.cohort}
                onChange={(e) => handleChange('cohort', e.target.value.toUpperCase())}
                error={errors.cohort}
                placeholder={text.cohortPlaceholder}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
              <Button type="submit" loading={submitting}>
                {text.save}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
