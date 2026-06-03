'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import useAuthStore from '@/store/auth.store';
import { authService } from '@/services/auth.service';

export default function MicrosoftMockLogin() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const bgImage = "https://aadcdn.msauthimages.net/447973e2-6kg7y-tc2wfxvxrjxy1vmwnpmeny97pje-dcjhl7t5u/logintenantbranding/0/illustration?ts=638018516893873885";
  const logoImage = "https://aadcdn.msauthimages.net/447973e2-6kg7y-tc2wfxvxrjxy1vmwnpmeny97pje-dcjhl7t5u/logintenantbranding/0/bannerlogo?ts=638018399907640586";

  const handleNext = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    // Validate domain
    if (!email.endsWith('@st.phenikaa-uni.edu.vn') && !email.endsWith('@phenikaa-uni.edu.vn')) {
      setError("Tài khoản này không tồn tại trong hệ thống của trường. Vui lòng sử dụng email Phenikaa.");
      return;
    }
    
    setError('');
    setStep(2);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Mock login process - we will use a dummy password to trigger the actual backend auth flow
      // Or we can bypass it if it fails by just redirecting anyway for demo purposes.
      try {
        const loginResult = await authService.login(email, '123456aA@');
        const token = loginResult.data.accessToken;
        const profileResult = await authService.me(token);
        setAuth(token, profileResult.data);
        setUser(profileResult.data);
      } catch (err) {
        // For the sake of the demo, if the user doesn't exist, we still simulate a successful OAuth return
        // by pushing to dashboard. Real OAuth would issue a token.
        // But since we want the app to actually work, we'll just show an error if it fails.
        setError("Tài khoản hoặc mật khẩu không chính xác.");
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError("Lỗi đăng nhập.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Segoe UI", "Helvetica Neue", "Lucida Grande", "Roboto", "Ebrima", "Nirmala UI", "Gadugi", "Segoe Xbox Symbol", "Segoe UI Symbol", "Meiryo UI", "Khmer UI", "Tunga", "Lao UI", "Raavi", "Iskoola Pota", "Latha", "Leelawadee", "Microsoft YaHei UI", "Microsoft JhengHei UI", "Malgun Gothic", "Estrangelo Edessa", "Microsoft Himalaya", "Microsoft New Tai Lue", "Microsoft PhagsPa", "Microsoft Tai Le", "Microsoft Yi Baiti", "Mongolian Baiti", "MV Boli", "Myanmar Text", "Cambria Math"',
      backgroundColor: '#f3f2f1',
    }}>
      {/* Background Image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 0
      }} />

      {/* Main Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          width: '100%', maxWidth: '440px',
          backgroundColor: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          padding: '44px',
          margin: '20px'
        }}>
          {/* Logo */}
          <div style={{ marginBottom: '24px' }}>
            <img src={logoImage} alt="Phenikaa University" style={{ maxHeight: '36px' }} />
          </div>

          {step === 1 ? (
            <form onSubmit={handleNext}>
              <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1b1b1b', marginBottom: '16px', lineHeight: '28px' }}>
                Đăng nhập
              </h1>
              
              {error && (
                <div style={{ color: '#e81123', fontSize: '15px', marginBottom: '16px' }}>{error}</div>
              )}

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email, điện thoại hoặc Skype"
                autoFocus
                style={{
                  width: '100%',
                  border: 'none',
                  borderBottom: '1px solid #666',
                  padding: '8px 0',
                  fontSize: '15px',
                  color: '#1b1b1b',
                  outline: 'none',
                  marginBottom: '16px',
                  backgroundColor: 'transparent'
                }}
                onFocus={(e) => e.target.style.borderBottom = '1px solid #0067b8'}
                onBlur={(e) => e.target.style.borderBottom = '1px solid #666'}
              />

              <div style={{ fontSize: '13px', color: '#0067b8', marginBottom: '32px' }}>
                Không thể truy nhập tài khoản của bạn?
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#0067b8',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 32px',
                    fontSize: '15px',
                    cursor: 'pointer',
                    minWidth: '108px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#005da6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0067b8'}
                >
                  Tiếp
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setStep(1)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    marginRight: '8px', color: '#1b1b1b'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                </button>
                <div style={{ fontSize: '15px', color: '#1b1b1b' }}>{email}</div>
              </div>

              <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1b1b1b', marginBottom: '16px', lineHeight: '28px' }}>
                Nhập mật khẩu
              </h1>

              {error && (
                <div style={{ color: '#e81123', fontSize: '15px', marginBottom: '16px' }}>{error}</div>
              )}

              <input
                type="password"
                placeholder="Mật khẩu"
                autoFocus
                style={{
                  width: '100%',
                  border: 'none',
                  borderBottom: '1px solid #666',
                  padding: '8px 0',
                  fontSize: '15px',
                  color: '#1b1b1b',
                  outline: 'none',
                  marginBottom: '16px',
                  backgroundColor: 'transparent'
                }}
                onFocus={(e) => e.target.style.borderBottom = '1px solid #0067b8'}
                onBlur={(e) => e.target.style.borderBottom = '1px solid #666'}
              />

              <div style={{ fontSize: '13px', color: '#0067b8', marginBottom: '32px' }}>
                Quên mật khẩu?
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: '#0067b8',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 32px',
                    fontSize: '15px',
                    cursor: loading ? 'wait' : 'pointer',
                    minWidth: '108px'
                  }}
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%',
        display: 'flex', justifyContent: 'flex-end',
        padding: '12px 24px',
        fontSize: '12px',
        color: '#fff',
        backgroundColor: 'rgba(0,0,0,0.6)'
      }}>
        <span>Điều khoản sử dụng</span>
        <span style={{ margin: '0 12px' }}>Quyền riêng tư & cookie</span>
        <span>...</span>
      </div>
    </div>
  );
}
