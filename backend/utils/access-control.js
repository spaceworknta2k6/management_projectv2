const prisma = require('../config/prisma');
const { resolveProjectOwner, isStudentOwner } = require('./project-owner');

const STAFF_ROLES = ['SYSTEM_ADMIN', 'FACULTY_STAFF'];

const getRoles = (user = {}) => user.roles || (user.role ? [user.role] : []);

const hasAnyRole = (user, allowedRoles) => {
  const roles = getRoles(user);
  return roles.some((role) => allowedRoles.includes(role));
};

const isStaff = (user) => hasAnyRole(user, STAFF_ROLES);

const isAcceptedGroupMember = (group, studentId) => {
  if (!group || !studentId) return false;
  const members = Array.isArray(group.members) ? group.members : [];
  return members.some(
    (member) =>
      member?.studentId &&
      member.studentId.toString() === studentId.toString() &&
      member.status === 'accepted'
  );
};

const canAccessProject = async (project, user = {}) => {
  if (!project || !user) return false;
  if (isStaff(user)) return true;

  if (user.studentId) {
    const owner = resolveProjectOwner(project);
    if (isStudentOwner(owner, user.studentId)) return true;

    if (owner?.ownerType === 'group') {
      const groupId = owner.groupId || owner.ownerId;
      const group = await prisma.projectGroup.findFirst({
        where: {
          id: groupId.toString(),
          isDeleted: false,
        },
      });
      if (isAcceptedGroupMember(group, user.studentId)) return true;
    }
  }

  if (user.lecturerId) {
    const lecturerId = user.lecturerId.toString();
    const supervisorId = project.supervisorId?._id || project.supervisorId;
    const reviewerId = project.reviewerId?._id || project.reviewerId;

    if (supervisorId && supervisorId.toString() === lecturerId) return true;
    if (reviewerId && reviewerId.toString() === lecturerId) return true;
  }

  return false;
};

const assertProjectAccess = async (project, user) => {
  if (!(await canAccessProject(project, user))) {
    throw {
      status: 403,
      message: 'Bạn không có quyền truy cập dữ liệu của dự án này.',
    };
  }
};

module.exports = {
  hasAnyRole,
  isStaff,
  isAcceptedGroupMember,
  canAccessProject,
  assertProjectAccess,
};
