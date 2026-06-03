'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeSlash, User, Lock } from '@phosphor-icons/react';
import useAuthStore from '@/store/auth.store';
import useThemeStore from '@/store/theme.store';
import { authService } from '@/services/auth.service';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const { applyTheme } = useThemeStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Apply saved theme on login page too
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

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
    <div style={{
      position: 'relative',
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Background image */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
      }}>
        <Image
          src="/bg-login.jpg"
          alt="background"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority
        />
        {/* Blue overlay to match Phenikaa style */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(10,40,120,0.82) 0%, rgba(5,25,90,0.75) 100%)',
        }} />
      </div>

      {/* Decorative lines from brand kit */}
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, opacity: 0.5 }}>
        <Image src="/login-line-1.png" alt="" width={300} height={200} style={{ objectFit: 'contain' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 1, opacity: 0.5 }}>
        <Image src="/login-line-2.png" alt="" width={200} height={150} style={{ objectFit: 'contain' }} />
      </div>

      {/* Main card */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: '420px',
        margin: '20px',
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderRadius: '16px',
        padding: '40px 36px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.2)',
        animation: 'fadeIn 0.4s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Image
            src="/logo-Phenikaa-w.png"
            alt="Phenikaa University"
            width={180}
            height={60}
            style={{ objectFit: 'contain', filter: 'invert(1) brightness(0) saturate(100%) invert(22%) sepia(90%) saturate(600%) hue-rotate(200deg)' }}
          />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px', height: '52px',
            borderRadius: '50%',
            backgroundColor: '#e8f0fc',
            marginBottom: '12px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" fill="#1a56db"/>
              <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" fill="#1a56db"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#0f2d78',
            textTransform: 'uppercase',
          }}>
            Đăng nhập
          </h1>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Hệ thống Quản lý Đồ án Tốt nghiệp
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email field */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
              color: '#9ca3af', display: 'flex', alignItems: 'center',
            }}>
              <User size={18} />
            </span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập tài khoản hoặc email"
              required
              autoFocus
              style={{
                width: '100%',
                height: '48px',
                paddingLeft: '44px',
                paddingRight: '16px',
                border: '1.5px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#111827',
                backgroundColor: '#fff',
                outline: 'none',
                transition: 'border-color 0.15s',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => e.target.style.borderColor = '#1a56db'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Password field */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
              color: '#9ca3af', display: 'flex', alignItems: 'center',
            }}>
              <Lock size={18} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
              style={{
                width: '100%',
                height: '48px',
                paddingLeft: '44px',
                paddingRight: '48px',
                border: '1.5px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#111827',
                backgroundColor: '#fff',
                outline: 'none',
                transition: 'border-color 0.15s',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => e.target.style.borderColor = '#1a56db'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', display: 'flex', alignItems: 'center', padding: '4px',
              }}
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              padding: '10px 12px',
              fontSize: '13px',
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '48px',
              backgroundColor: loading ? '#6b88c7' : '#0f2d78',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#1a3d9e'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#0f2d78'; }}
          >
            {loading && (
              <span style={{
                width: '16px', height: '16px',
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
            )}
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          margin: '20px 0', color: '#9ca3af', fontSize: '12px',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
          <span>Hoặc đăng nhập</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
        </div>

        {/* Microsoft SSO button */}
        <button
          type="button"
          style={{
            width: '100%',
            height: '46px',
            backgroundColor: '#0f2d78',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontFamily: 'inherit',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a3d9e'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f2d78'}
        >
          {/* Microsoft logo (inline SVG) */}
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Sign in using Microsoft
        </button>
      </div>

      {/* Footer text */}
      <p style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: '12px',
        zIndex: 10,
        whiteSpace: 'nowrap',
      }}>
        © 2025 Trường Đại học Bách Khoa Hà Nội — Hệ thống Episteme
      </p>
    </div>
  );
}
