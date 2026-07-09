const prisma = require('../../config/prisma');

const VALID_ROLES = ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'LECTURER', 'STUDENT'];
const VALID_STATUSES = ['active', 'inactive', 'locked'];

const toPublicUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return {
    ...publicUser,
    _id: user.id,
  };
};

const buildUserWhere = ({ search = '', role = '', status = '' }) => {
  const where = { isDeleted: false };

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.roles = { has: role };
  }

  if (status) {
    where.status = status;
  }

  return where;
};

const getUsers = async ({ search = '', role = '', status = '', page = 1, limit = 10 }) => {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number(limit) > 0 ? Number(limit) : 10;
  const where = buildUserWhere({ search, role, status });
  const skip = (safePage - 1) * safeLimit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(toPublicUser),
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
  };
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const exportUsersCsv = async ({ search = '', role = '', status = '' }) => {
  const where = buildUserWhere({ search, role, status });
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const headers = ['id', 'fullName', 'email', 'roles', 'status', 'createdAt'];
  const rows = users.map((user) => [
    user.id,
    user.fullName,
    user.email,
    (user.roles || []).join('|'),
    user.status,
    user.createdAt.toISOString(),
  ]);

  return [
    headers.join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ].join('\n');
};

const assertRoles = (roles) => {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw { status: 400, message: 'Danh sách vai trò không hợp lệ.' };
  }

  const invalidRoles = roles.filter((role) => !VALID_ROLES.includes(role));
  if (invalidRoles.length > 0) {
    throw { status: 400, message: `Vai trò không hợp lệ: ${invalidRoles.join(', ')}` };
  }
};

const findExistingUser = async (userId) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isDeleted: false,
    },
  });

  if (!user) {
    throw { status: 404, message: 'Tài khoản không tồn tại hoặc đã bị xóa.' };
  }

  return user;
};

const updateUserRole = async (userId, roles) => {
  assertRoles(roles);
  await findExistingUser(userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { roles },
  });

  return toPublicUser(user);
};

const updateUserStatus = async (userId, status) => {
  if (!VALID_STATUSES.includes(status)) {
    throw { status: 400, message: 'Trạng thái không hợp lệ.' };
  }

  await findExistingUser(userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  return toPublicUser(user);
};

const deleteUser = async (userId, deletedByUserId) => {
  await findExistingUser(userId);

  const deletedAt = new Date();
  const updatePayload = {
    isDeleted: true,
    deletedAt,
    ...(deletedByUserId && { deletedBy: deletedByUserId }),
  };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: updatePayload,
    }),
    prisma.student.updateMany({
      where: { userId },
      data: updatePayload,
    }),
    prisma.lecturer.updateMany({
      where: { userId },
      data: updatePayload,
    }),
  ]);

  return { success: true, message: 'Tài khoản đã được xóa thành công.' };
};

module.exports = {
  getUsers,
  exportUsersCsv,
  updateUserRole,
  updateUserStatus,
  deleteUser,
};
