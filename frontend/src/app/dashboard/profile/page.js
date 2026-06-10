'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, UserCircle } from '@phosphor-icons/react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { authService } from '@/services/auth.service';
import useAuthStore from '@/store/auth.store';
import { getAvatarUrl } from '@/lib/avatar';
import { formatDate, getRoleLabel } from '@/lib/utils';
import css from './page.module.css';

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
    <div className={css.s1}>
      <span className={css.s2}>{label}</span>
      <span className={css.s3}>
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
  const avatarUrl = getAvatarUrl(user?.avatarUrl);
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
      <div className={css.s4}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className={css.s5}>
        <div>
          <h1 className={`text-display ${css.s6}`}>
            <UserCircle size={28} className={css.s7} />
            {text.title}
          </h1>
          <p className={css.s8}>
            {text.subtitle}
          </p>
        </div>
      </div>

      <div className={css.s9}>
        <Card>
          <div className={css.s10}>
            <div className={css.avatar}>
              <Image src={avatarUrl} alt="" width={72} height={72} className={css.avatarImage} />
            </div>
            <div className={css.s11}>
              <h2 className={css.s12}>
                {user.fullName || user.email}
              </h2>
              <div className={css.s13}>
                <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} className={css.s14} />
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
                <span className={css.s15}>{text.avatarHint}</span>
              </div>
            </div>
          </div>

          <div className={css.s16}>
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
          <form onSubmit={handleSubmit} className={css.s17}>
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

            <div className={css.s18}>
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
