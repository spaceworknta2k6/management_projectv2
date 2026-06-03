const authService = require('./auth.service');
const crypto = require('crypto');

const googleSessions = new Map();
const GOOGLE_SESSION_TTL_MS = 2 * 60 * 1000;

const getFrontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const getBackendUrl = (req) => (
  process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`
).replace(/\/$/, '');

const getGoogleRedirectUri = (req) => (
  process.env.GOOGLE_REDIRECT_URI ||
  `${getBackendUrl(req)}/api/v1/auth/google/callback`
);

const getCookie = (req, name) => {
  const cookies = req.headers.cookie || '';
  const pair = cookies.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
};

const redirectGoogleError = (res, message) => {
  res.redirect(`${getFrontendUrl()}/auth/google?error=${encodeURIComponent(message)}`);
};

const cleanupGoogleSessions = () => {
  const now = Date.now();
  for (const [code, session] of googleSessions.entries()) {
    if (session.expiresAt <= now) googleSessions.delete(code);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const startGoogleLogin = async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return redirectGoogleError(res, 'Google login chưa được cấu hình. Liên hệ quản trị viên.');
    }

    const state = crypto.randomBytes(24).toString('hex');
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

    res.setHeader(
      'Set-Cookie',
      `gg_oauth_state=${encodeURIComponent(state)}; HttpOnly; Max-Age=600; SameSite=Lax; Path=/api/v1/auth/google${secure}`
    );

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', getGoogleRedirectUri(req));
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');

    return res.redirect(authUrl.toString());
  } catch (error) {
    next(error);
  }
};

const handleGoogleCallback = async (req, res, next) => {
  try {
    const { code, state, error } = req.query;
    const savedState = getCookie(req, 'gg_oauth_state');
    const clearStateCookie = 'gg_oauth_state=; HttpOnly; Max-Age=0; SameSite=Lax; Path=/api/v1/auth/google';

    if (error) {
      res.setHeader('Set-Cookie', clearStateCookie);
      return redirectGoogleError(res, 'Bạn đã hủy đăng nhập Google.');
    }

    if (!code || !state || !savedState || state !== savedState) {
      res.setHeader('Set-Cookie', clearStateCookie);
      return redirectGoogleError(res, 'Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.setHeader('Set-Cookie', clearStateCookie);
      return redirectGoogleError(res, 'Google login chưa được cấu hình. Liên hệ quản trị viên.');
    }

    // Đổi code lấy token từ Google
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getGoogleRedirectUri(req),
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      res.setHeader('Set-Cookie', clearStateCookie);
      return redirectGoogleError(res, 'Không thể xác thực mã token từ Google.');
    }

    // Lấy thông tin user profile từ Google userinfo endpoint
    let profile = {};
    if (tokenData.access_token) {
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      profile = await profileResponse.json().catch(() => ({}));
    }

    const email = profile.email;
    if (!email) {
      res.setHeader('Set-Cookie', clearStateCookie);
      return redirectGoogleError(res, 'Không lấy được email từ tài khoản Google.');
    }

    // Kiểm tra domain trường và xác thực đăng nhập
    const name = profile.name || profile.given_name || email.split('@')[0];
    const result = await authService.loginWithGoogleEmail(email, name);
    cleanupGoogleSessions();

    const sessionCode = crypto.randomBytes(24).toString('hex');
    googleSessions.set(sessionCode, {
      data: result,
      expiresAt: Date.now() + GOOGLE_SESSION_TTL_MS,
    });

    res.setHeader('Set-Cookie', clearStateCookie);
    return res.redirect(`${getFrontendUrl()}/auth/google?code=${sessionCode}`);
  } catch (error) {
    if (error.status) {
      return redirectGoogleError(res, error.message);
    }
    next(error);
  }
};

const consumeGoogleSession = async (req, res) => {
  cleanupGoogleSessions();

  const { code } = req.query;
  const session = googleSessions.get(code);
  if (!session) {
    return res.status(400).json({
      success: false,
      message: 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.',
    });
  }

  googleSessions.delete(code);
  return res.status(200).json({
    success: true,
    data: session.data,
  });
};

const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin cá nhân thành công!',
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.user._id, oldPassword, newPassword);

    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công! Hãy xóa token ở phía client.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  startGoogleLogin,
  handleGoogleCallback,
  consumeGoogleSession,
  getMe,
  changePassword,
  logout,
};
