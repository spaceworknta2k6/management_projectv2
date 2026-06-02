'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import useAuthStore from '@/store/auth.store';
import { authService } from '@/services/auth.service';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const loginResult = await authService.login(email, password);
      const token = loginResult.data.accessToken;

      // Fetch full user profile
      const profileResult = await authService.me(token);
      setAuth(token, profileResult.data);
      setUser(profileResult.data);

      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: `
          radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79,142,247,0.06) 0%, transparent 70%),
          var(--bg-base)
        `,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '36px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--accent-glow)',
              border: '1px solid rgba(79,142,247,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <GraduationCap size={26} weight="duotone" style={{ color: 'var(--accent)' }} />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}
          >
            Episteme
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Quản lý Đồ án Tốt nghiệp
          </p>
        </div>

        {/* Login Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px 24px',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '20px',
            }}
          >
            Đăng nhập vào hệ thống
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@hust.edu.vn"
              required
              autoFocus
            />

            <Input
              label="Mật khẩu"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
            />

            {error && (
              <div
                style={{
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: 'var(--error)',
                  backgroundColor: 'var(--error-bg)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 'var(--radius-md)',
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg">
              Đăng nhập
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '24px',
          }}
        >
          Trường Đại học Bách khoa Hà Nội
        </p>
      </div>
    </div>
  );
}
