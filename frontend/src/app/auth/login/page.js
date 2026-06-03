'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeSlash, User, Lock, Question } from '@phosphor-icons/react';
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

  const doLogin = async (loginEmail, loginPassword) => {
    setLoading(true);
    setError('');
    try {
      const loginResult = await authService.login(loginEmail, loginPassword);
      const token = loginResult.data.accessToken;

      // Fetch full user profile
      const profileResult = await authService.me(token);
      setAuth(token, profileResult.data);
      setUser(profileResult.data);

      router.push('/dashboard');
    } catch (err) {
      setError('Tên tài khoản hoặc mật khẩu không hợp lệ!');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Tên tài khoản hoặc mật khẩu không hợp lệ!');
      return;
    }
    doLogin(email, password);
  };

  const handleMicrosoftLogin = () => {
    // Chuyển hướng đến trang đăng nhập Microsoft chuẩn
    const clientId = "5392332e-2635-4e9f-a313-2e8cb0f80056";
    const redirectUri = encodeURIComponent(window.location.origin + "/auth/login");
    const msLoginUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile`;
    window.location.href = msLoginUrl;
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
          src="/images/bg-login.jpg"
          alt="background"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority
        />
        {/* Blue overlay to match Phenikaa style */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(10,40,120,0.85) 0%, rgba(5,25,90,0.85) 100%)',
        }} />
      </div>

      {/* Content wrapper */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: '420px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        margin: '20px',
      }}>
        
        {/* Logo at Top */}
        <div style={{ marginBottom: '32px' }}>
          <Image
            src="/images/logo-Phenikaa-w.png"
            alt="Phenikaa University"
            width={280}
            height={80}
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Main card */}
        <div style={{
          position: 'relative',
          width: '100%',
          background: 'linear-gradient(to top, rgb(240, 243, 253), rgb(178, 194, 240))',
          borderRadius: '20px',
          padding: '36px 40px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          animation: 'fadeIn 0.4s ease',
        }}>
          {/* Decorative Plane (login-line-1.png) */}
          <div style={{
            position: 'absolute',
            top: '-32px',
            right: '-12px',
            width: '274px',
            height: '89px',
            backgroundImage: 'url(/images/login-line-1.png)',
            backgroundSize: 'auto',
            backgroundPosition: '50% 0%',
            backgroundRepeat: 'no-repeat',
            pointerEvents: 'none',
            zIndex: 10
          }} />

          {/* Decorative Line (login-line-2.png) */}
          <div style={{
            position: 'absolute',
            bottom: '-24px',
            left: '-16px',
            width: '138px',
            height: '74px',
            backgroundImage: 'url(/images/login-line-2.png)',
            backgroundSize: 'auto',
            backgroundPosition: '50% 0%',
            backgroundRepeat: 'no-repeat',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '36px', position: 'relative', zIndex: 1 }}>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: '#1a3d9e',
              textTransform: 'uppercase',
            }}>
              ĐĂNG NHẬP
            </h1>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              fontSize: '13px',
              color: '#dc2626',
              marginBottom: '8px',
              position: 'relative',
              zIndex: 1
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1 }} noValidate>
            {/* Email field */}
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                color: '#6b7280', display: 'flex', alignItems: 'center',
              }}>
                <User size={18} />
              </span>
              <input
                type="text"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập tài khoản hoặc email"
                autoFocus
                style={{
                  width: '100%',
                  height: '46px',
                  paddingLeft: '44px',
                  paddingRight: '16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#111827',
                  backgroundColor: '#fff',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => e.target.style.borderColor = '#1a56db'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            {/* Password field */}
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                color: '#6b7280', display: 'flex', alignItems: 'center',
              }}>
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                style={{
                  width: '100%',
                  height: '46px',
                  paddingLeft: '44px',
                  paddingRight: '48px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#111827',
                  backgroundColor: '#fff',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => e.target.style.borderColor = '#1a56db'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6b7280', display: 'flex', alignItems: 'center', padding: '4px',
                }}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Links Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginTop: '4px', marginBottom: '8px' }}>
              <a href="#" style={{ color: '#1a3d9e', textDecoration: 'none' }} onClick={(e) => e.preventDefault()}>Quên mật khẩu</a>
              <a href="#" style={{ color: '#1a3d9e', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.preventDefault()}>
                <Question size={16} /> Trợ giúp!
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: loading ? '#3b5fbd' : '#1e3868',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#152a51'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#1e3868'; }}
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
              {loading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            margin: '24px 0', color: '#9ca3af', fontSize: '12px',
            position: 'relative', zIndex: 1
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
            <span>Hoặc đăng nhập</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#cbd5e1' }} />
          </div>

          {/* Microsoft SSO button */}
          <button
            type="button"
            onClick={handleMicrosoftLogin}
            style={{
              width: '100%',
              height: '46px',
              backgroundColor: '#005a9e',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontFamily: 'inherit',
              transition: 'background-color 0.15s',
              position: 'relative', zIndex: 1
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#004578'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#005a9e'}
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
          marginTop: '32px',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          © 2026 Đại học Phenikaa - Hệ thống Karl
        </p>
      </div>
    </div>
  );
}
