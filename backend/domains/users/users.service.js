const User = require('../../models/User');
const Student = require('../../models/Student');
const Lecturer = require('../../models/Lecturer');

/**
 * Lấy danh sách toàn bộ tài khoản có phân trang, tìm kiếm và bộ lọc
 */
const getUsers = async ({ search = '', role = '', status = '', page = 1, limit = 10 }) => {
  const query = { isDeleted: false };

  // Tìm kiếm theo tên hoặc email (không phân biệt hoa thường)
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  // Lọc theo vai trò (roles là array)
  if (role) {
    query.roles = role;
  }

  // Lọc theo trạng thái
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash') // Không trả về password hash vì lý do bảo mật
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return {
    users,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

/**
 * Cập nhật vai trò (Roles) cho tài khoản
 */
const updateUserRole = async (userId, roles) => {
  const VALID_ROLES = ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF', 'LECTURER', 'STUDENT'];
  
  if (!Array.isArray(roles) || roles.length === 0) {
    throw { status: 400, message: 'Danh sách vai trò không hợp lệ.' };
  }

  const invalidRoles = roles.filter(r => !VALID_ROLES.includes(r));
  if (invalidRoles.length > 0) {
    throw { status: 400, message: `Vai trò không hợp lệ: ${invalidRoles.join(', ')}` };
  }

  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw { status: 404, message: 'Tài khoản không tồn tại hoặc đã bị xóa.' };
  }

  user.roles = roles;
  await user.save();
  return user;
};

/**
 * Cập nhật trạng thái (ban/unban/inactive)
 */
const updateUserStatus = async (userId, status) => {
  const VALID_STATUSES = ['active', 'inactive', 'locked'];

  if (!VALID_STATUSES.includes(status)) {
    throw { status: 400, message: 'Trạng thái không hợp lệ.' };
  }

  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw { status: 404, message: 'Tài khoản không tồn tại hoặc đã bị xóa.' };
  }

  user.status = status;
  await user.save();
  return user;
};

/**
 * Soft-delete tài khoản
 */
const deleteUser = async (userId, deletedByUserId) => {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw { status: 404, message: 'Tài khoản không tồn tại hoặc đã bị xóa.' };
  }

  const deletedAt = new Date();
  user.isDeleted = true;
  user.deletedAt = deletedAt;
  if (deletedByUserId) {
    user.deletedBy = deletedByUserId;
  }
  await user.save();

  // Soft-delete profile tương ứng nếu có
  const updatePayload = {
    isDeleted: true,
    deletedAt,
    ...(deletedByUserId && { deletedBy: deletedByUserId }),
  };

  await Promise.all([
    Student.findOneAndUpdate({ userId: user._id }, updatePayload),
    Lecturer.findOneAndUpdate({ userId: user._id }, updatePayload),
  ]);

  return { success: true, message: 'Tài khoản đã được xóa thành công.' };
};

module.exports = {
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
};
