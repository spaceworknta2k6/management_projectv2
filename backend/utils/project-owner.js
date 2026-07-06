const prisma = require('../config/prisma');

const OWNER_TYPES = ['student', 'group'];

const idsEqual = (left, right) => {
  if (!left || !right) return false;
  return left.toString() === right.toString();
};

const normalizeOwner = (owner = {}) => {
  const ownerType = owner.ownerType;
  const ownerId = owner.ownerId?._id || owner.ownerId;
  const groupId = owner.groupId?._id || owner.groupId;
  const studentId = owner.studentId?._id || owner.studentId;

  if (ownerType === 'student' && (ownerId || studentId)) {
    return {
      ownerType: 'student',
      ownerId: ownerId || studentId,
      studentId: studentId || ownerId,
    };
  }

  if (ownerType === 'group' && (ownerId || groupId)) {
    return {
      ownerType: 'group',
      ownerId: ownerId || groupId,
      groupId: groupId || ownerId,
    };
  }

  if (studentId) {
    return {
      ownerType: 'student',
      ownerId: studentId,
      studentId,
    };
  }

  if (groupId) {
    return {
      ownerType: 'group',
      ownerId: groupId,
      groupId,
    };
  }

  return null;
};

const resolveProjectOwner = (project) => normalizeOwner(project);

const isStudentOwner = (owner, studentId) => {
  const normalized = normalizeOwner(owner);
  return normalized?.ownerType === 'student' && idsEqual(normalized.ownerId, studentId);
};

const isAcceptedGroupOwnerMember = async (owner, studentId) => {
  const normalized = normalizeOwner(owner);
  if (normalized?.ownerType !== 'group' || !studentId) return false;

  const group = normalized.groupId?.members
    ? normalized.groupId
    : await prisma.projectGroup.findFirst({
      where: {
        id: (normalized.groupId || normalized.ownerId).toString(),
        isDeleted: false,
      },
    });

  if (!group?.members) return false;

  return group.members.some(
    (member) => idsEqual(member.studentId?._id || member.studentId, studentId) && member.status === 'accepted'
  );
};

const canAccessOwner = async (owner, user = {}) => {
  const normalized = normalizeOwner(owner);
  if (!normalized || !user) return false;

  const roles = user.roles || (user.role ? [user.role] : []);
  if (roles.some((role) => ['SYSTEM_ADMIN', 'FACULTY_STAFF'].includes(role))) {
    return true;
  }

  if (!user.studentId) return false;
  if (isStudentOwner(normalized, user.studentId)) return true;

  return isAcceptedGroupOwnerMember(normalized, user.studentId);
};

const assertOwnerAccess = async (owner, user) => {
  if (!(await canAccessOwner(owner, user))) {
    throw {
      status: 403,
      message: 'Bạn không có quyền truy cập dữ liệu của chủ sở hữu đồ án này.',
    };
  }
};

const getOwnerDisplay = (owner) => {
  const normalized = normalizeOwner(owner);
  if (!normalized) return 'Chưa xác định';

  if (normalized.ownerType === 'student') {
    const student = owner.studentId || owner.ownerId;
    const user = student?.userId;
    return user?.fullName || student?.studentCode || 'Sinh viên';
  }

  const group = owner.groupId || owner.ownerId;
  return group?.name || 'Nhóm sinh viên';
};

module.exports = {
  resolveProjectOwner,
  isStudentOwner,
  canAccessOwner,
  assertOwnerAccess,
  getOwnerDisplay,
};
