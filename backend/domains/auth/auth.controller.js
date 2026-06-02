const authService = require('./auth.service');

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

const getMe = async (req, res, next) => {
  try {
    // req.user has already been verified and enriched in protect middleware
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
    // Under stateless JWT, clients clear their local token storage (cookies/storage)
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
  getMe,
  changePassword,
  logout,
};
