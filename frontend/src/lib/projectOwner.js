export function getId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
}

function getAcceptedMembers(group) {
  const members = group?.members;
  if (!Array.isArray(members)) return [];
  return members.filter((member) => member && (!member.status || member.status === 'accepted'));
}

export function isStudentProjectOwner(project, studentId) {
  const currentStudentId = getId(studentId);
  if (!project || !currentStudentId) return false;

  const directStudentId = getId(project.studentId) || getId(project.ownerId);
  if ((project.ownerType === 'student' || directStudentId) && directStudentId === currentStudentId) {
    return true;
  }

  return getAcceptedMembers(project.groupId).some((member) => getId(member.studentId) === currentStudentId);
}

export function getOwnerDisplay(project) {
  if (!project) return 'Chưa xác định';

  if (project.ownerType === 'student' || project.studentId) {
    const student = project.studentId || project.ownerId;
    return student?.userId?.fullName || student?.studentCode || 'Sinh viên';
  }

  return project.groupId?.name || 'Nhóm sinh viên';
}

export function getOwnerTypeLabel(project) {
  return project?.ownerType === 'student' || project?.studentId ? 'Cá nhân' : 'Nhóm';
}

export function getMemberDisplay(project) {
  if (project?.ownerType === 'student' || project?.studentId) {
    const student = project.studentId || project.ownerId;
    return student?.userId?.email || student?.studentCode || '';
  }

  return getAcceptedMembers(project?.groupId)
    .map((member) => `${member.studentId?.userId?.fullName || 'Sinh viên'} (${member.studentId?.userId?.email || ''})`)
    .join('; ');
}
