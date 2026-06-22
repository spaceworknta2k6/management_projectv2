const usersService = require('./users.service');

const getUsers = async (req, res, next) => {
  try {
    const { search, role, status, page, limit } = req.query;
    const result = await usersService.getUsers({
      search,
      role,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
    res.status(200).json({
      success: true,
      data: result.users,
      pagination: {
        total: result.total,
        page: result.page,
        pages: result.pages,
        limit: limit ? parseInt(limit) : 10,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { roles } = req.body;

    // Ngăn chặn admin tự tước quyền của chính mình
    if (req.user._id.toString() === id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không được phép tự thay đổi quyền hạn của chính mình.',
      });
    }

    const updatedUser = await usersService.updateUserRole(id, roles);
    res.status(200).json({
      success: true,
      message: 'Cập nhật quyền hạn thành công.',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Ngăn chặn admin tự khóa tài khoản của chính mình
    if (req.user._id.toString() === id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không được phép tự khóa/vô hiệu hóa tài khoản của chính mình.',
      });
    }

    const updatedUser = await usersService.updateUserStatus(id, status);
    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái tài khoản thành công.',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Ngăn chặn admin tự xóa tài khoản của chính mình
    if (req.user._id.toString() === id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không được phép tự xóa tài khoản của chính mình.',
      });
    }

    const result = await usersService.deleteUser(id, req.user._id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
};
