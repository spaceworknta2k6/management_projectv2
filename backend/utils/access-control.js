const ProjectGroup = require('../models/ProjectGroup');
const { resolveProjectOwner, isStudentOwner } = require('./project-owner');

const STAFF_ROLES = ['SYSTEM_ADMIN', 'FACULTY_STAFF', 'DEPARTMENT_STAFF'];

const getRoles = (user = {}) => user.roles || (user.role ? [user.role] : []);

const hasAnyRole = (user, allowedRoles) => {
  const roles = getRoles(user);
  return roles.some((role) => allowedRoles.includes(role));
};

const isStaff = (user) => hasAnyRole(user, STAFF_ROLES);

const isAcceptedGroupMember = (group, studentId) => {
  if (!group || !studentId) return false;
  return group.members.some(
    (member) =>
      member.studentId.toString() === studentId.toString() &&
      member.status === 'accepted'
  );
};

const isProjectCommitteeMember = async (projectId, lecturerId) => {
  return false;
};

const canAccessProject = async (project, user = {}) => {
  if (!project || !user) return false;
  if (isStaff(user)) return true;

  if (user.studentId) {
    const owner = resolveProjectOwner(project);
    if (isStudentOwner(owner, user.studentId)) return true;

    if (owner?.ownerType === 'group') {
      const groupId = owner.groupId || owner.ownerId;
      const group = await ProjectGroup.findOne({
        _id: groupId,
        isDeleted: { $ne: true },
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
    if (await isProjectCommitteeMember(project._id, user.lecturerId)) return true;
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
  isProjectCommitteeMember,
  canAccessProject,
  assertProjectAccess,
};
