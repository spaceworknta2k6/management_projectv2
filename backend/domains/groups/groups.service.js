const prisma = require('../../config/prisma');
const ProjectGroupMirror = { updateOne: async () => {} };
const WorkflowEvent = require('../../utils/workflow-event');
const { randomBytes } = require('crypto');

const newObjectId = () => randomBytes(12).toString('hex');
const toId = (value) => (value ? value.toString() : null);

const toPublicGroup = (group) => {
  if (!group) return null;
  return {
    ...group,
    _id: group.id,
  };
};

const toMongoMirrorData = (group) => {
  const members = (group.members || []).map(m => ({
    studentId: toId(m.studentId),
    role: m.role || 'MEMBER',
    contributionWeight: Number(m.contributionWeight ?? 1.0),
    status: m.status || 'invited',
  }));

  return {
    _id: group.id,
    periodId: toId(group.periodId),
    name: group.name,
    avatarUrl: group.avatarUrl || '',
    leaderStudentId: toId(group.leaderStudentId),
    members,
    status: group.status,
    isDeleted: group.isDeleted,
    deletedAt: group.deletedAt,
    deletedBy: toId(group.deletedBy),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};

const syncMongoMirror = async (group) => {};

const logWorkflowEvent = async ({
  entityType = 'ProjectGroup',
  entityId,
  fromStatus,
  toStatus,
  actorId,
  actorRoles = ['STUDENT'],
  action,
  reason = '',
}) => {
  return await WorkflowEvent.create({
    entityType,
    entityId: toId(entityId),
    fromStatus,
    toStatus,
    actorId: toId(actorId),
    actorRoles,
    action,
    reason,
  });
};

const populateGroup = async (group) => {
  if (!group) return null;

  const memberStudentIds = (group.members || []).map(m => m.studentId).filter(Boolean);
  const studentIds = Array.from(new Set([group.leaderStudentId, ...memberStudentIds].map(toId)));

  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      isDeleted: false,
    },
    include: {
      user: {
        select: {
          id: true,
          mongoId: true,
          fullName: true,
          email: true,
          status: true,
        }
      }
    }
  });

  const studentMap = new Map();
  for (const s of students) {
    studentMap.set(s.id, {
      ...s,
      _id: s.id,
      userId: s.user ? {
        ...s.user,
        _id: s.user.id,
      } : null,
    });
  }

  const populatedLeader = studentMap.get(group.leaderStudentId) || null;
  const populatedMembers = (group.members || []).map(m => ({
    ...m,
    studentId: studentMap.get(m.studentId) || null,
  }));

  return {
    ...group,
    _id: group.id,
    leaderStudentId: populatedLeader,
    members: populatedMembers,
  };
};

const populateGroups = async (groups) => {
  if (!groups || groups.length === 0) return [];

  const studentIdsSet = new Set();
  for (const group of groups) {
    if (group.leaderStudentId) studentIdsSet.add(toId(group.leaderStudentId));
    for (const m of group.members || []) {
      if (m.studentId) studentIdsSet.add(toId(m.studentId));
    }
  }

  const studentIds = Array.from(studentIdsSet);

  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      isDeleted: false,
    },
    include: {
      user: {
        select: {
          id: true,
          mongoId: true,
          fullName: true,
          email: true,
          status: true,
        }
      }
    }
  });

  const studentMap = new Map();
  for (const s of students) {
    studentMap.set(s.id, {
      ...s,
      _id: s.id,
      userId: s.user ? {
        ...s.user,
        _id: s.user.id,
      } : null,
    });
  }

  return groups.map(group => {
    const populatedLeader = studentMap.get(group.leaderStudentId) || null;
    const populatedMembers = (group.members || []).map(m => ({
      ...m,
      studentId: studentMap.get(m.studentId) || null,
    }));

    return {
      ...group,
      _id: group.id,
      leaderStudentId: populatedLeader,
      members: populatedMembers,
    };
  });
};

const createGroup = async (periodId, name, studentId) => {
  const period = await prisma.projectPeriod.findFirst({
    where: { id: toId(periodId), isDeleted: false }
  });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  if (period.status !== 'registration_open') {
    throw { status: 400, message: 'Chỉ có thể lập nhóm khi đợt đồ án đang mở cổng đăng ký.' };
  }

  if (period.allowGroup === false) {
    throw { status: 400, message: 'Học phần này không cho phép thực hiện theo nhóm.' };
  }

  const rosterEntry = await prisma.projectRoster.findFirst({
    where: { periodId: toId(periodId), studentId: toId(studentId), status: 'active' }
  });
  if (!rosterEntry) {
    throw { status: 403, message: 'Chỉ sinh viên có tên trong danh sách đợt đồ án (roster) mới được phép lập nhóm.' };
  }

  const activeGroups = await prisma.projectGroup.findMany({
    where: {
      periodId: toId(periodId),
      isDeleted: false,
      status: { not: 'cancelled' }
    }
  });

  const existingGroup = activeGroups.find(g => {
    const members = g.members || [];
    return members.some(m => toId(m.studentId) === toId(studentId) && m.status === 'accepted');
  });

  if (existingGroup) {
    throw { status: 400, message: 'Sinh viên đã tham gia một nhóm hoạt động khác trong đợt đồ án này.' };
  }

  const id = newObjectId();
  const group = await prisma.projectGroup.create({
    data: {
      id,
      mongoId: id,
      periodId: toId(periodId),
      name: name.trim(),
      leaderStudentId: toId(studentId),
      members: [{
        studentId: toId(studentId),
        role: 'LEADER',
        contributionWeight: 1.0,
        status: 'accepted',
      }],
      status: 'draft',
    }
  });

  await syncMongoMirror(group);

  await logWorkflowEvent({
    entityId: group.id,
    fromStatus: '',
    toStatus: 'draft',
    actorId: rosterEntry.studentId,
    action: 'CREATE_GROUP',
    reason: `Khởi tạo nhóm ${name} bởi trưởng nhóm`,
  });

  return toPublicGroup(group);
};

const resolveInvitedStudent = async (studentIdentifier) => {
  const value = String(studentIdentifier || '').trim();
  if (!value) {
    return null;
  }

  const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(value);
  if (isValidObjectId) {
    return prisma.student.findFirst({
      where: { id: value, isDeleted: false }
    });
  }

  return prisma.student.findFirst({
    where: { studentCode: value, isDeleted: false }
  });
};

const inviteMember = async (groupId, studentIdentifier, leaderStudentId) => {
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(groupId), isDeleted: false }
  });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  if (group.status !== 'draft') {
    throw { status: 400, message: 'Không thể mời thành viên khi nhóm đã xác nhận hoặc bị khóa.' };
  }

  if (toId(group.leaderStudentId) !== toId(leaderStudentId)) {
    throw { status: 403, message: 'Chỉ trưởng nhóm mới có quyền mời thành viên.' };
  }

  const period = await prisma.projectPeriod.findFirst({
    where: { id: group.periodId, isDeleted: false }
  });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án liên kết không tồn tại.' };
  }

  const invitedStudent = await resolveInvitedStudent(studentIdentifier);
  if (!invitedStudent) {
    throw { status: 404, message: 'Không tìm thấy sinh viên theo mã sinh viên đã nhập.' };
  }
  const invitedStudentId = invitedStudent.id;

  const rosterEntry = await prisma.projectRoster.findFirst({
    where: { periodId: group.periodId, studentId: invitedStudentId, status: 'active' }
  });
  if (!rosterEntry) {
    throw { status: 400, message: 'Sinh viên được mời không thuộc danh sách lớp học phần đợt đồ án này.' };
  }

  const activeGroups = await prisma.projectGroup.findMany({
    where: {
      periodId: group.periodId,
      isDeleted: false,
      status: { not: 'cancelled' }
    }
  });

  const existingGroup = activeGroups.find(g => {
    const members = g.members || [];
    return members.some(m => toId(m.studentId) === toId(invitedStudentId) && m.status === 'accepted');
  });

  if (existingGroup) {
    throw { status: 400, message: 'Sinh viên được mời đã là thành viên chính thức của một nhóm khác.' };
  }

  const maxLimit = period.groupMaxSize !== undefined ? period.groupMaxSize : period.maxGroupSize;
  const membersList = group.members || [];
  const activeCount = membersList.filter(m => m.status === 'accepted' || m.status === 'invited').length;
  if (activeCount >= maxLimit) {
    throw { status: 400, message: `Số lượng thành viên (bao gồm cả lời mời) vượt quá giới hạn tối đa (${maxLimit}) của học phần.` };
  }

  const updatedMembers = [...membersList];
  const memberIdx = updatedMembers.findIndex(m => toId(m.studentId) === toId(invitedStudentId));
  if (memberIdx !== -1) {
    const member = updatedMembers[memberIdx];
    if (member.status === 'invited') {
      throw { status: 400, message: 'Sinh viên này đã được mời vào nhóm và đang chờ phản hồi.' };
    }
    if (member.status === 'accepted') {
      throw { status: 400, message: 'Sinh viên này đã là thành viên nhóm.' };
    }
    updatedMembers[memberIdx] = {
      ...member,
      status: 'invited',
      role: 'MEMBER',
      contributionWeight: 1.0,
    };
  } else {
    updatedMembers.push({
      studentId: toId(invitedStudentId),
      role: 'MEMBER',
      contributionWeight: 1.0,
      status: 'invited',
    });
  }

  const updatedGroup = await prisma.projectGroup.update({
    where: { id: group.id },
    data: { members: updatedMembers }
  });

  await syncMongoMirror(updatedGroup);

  await logWorkflowEvent({
    entityId: updatedGroup.id,
    fromStatus: 'draft',
    toStatus: 'draft',
    actorId: toId(leaderStudentId),
    action: 'INVITE_MEMBER',
    reason: `Mời sinh viên ${invitedStudent.studentCode} vào nhóm`,
  });

  return toPublicGroup(updatedGroup);
};

const acceptInvitation = async (groupId, studentId) => {
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(groupId), isDeleted: false }
  });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  if (group.status !== 'draft') {
    throw { status: 400, message: 'Nhóm đã xác nhận hoặc bị khóa. Không thể đồng ý tham gia.' };
  }

  const membersList = group.members || [];
  const memberIdx = membersList.findIndex(m => toId(m.studentId) === toId(studentId) && m.status === 'invited');
  if (memberIdx === -1) {
    throw { status: 404, message: 'Không tìm thấy lời mời tham gia nhóm đang chờ xử lý cho sinh viên này.' };
  }

  const activeGroups = await prisma.projectGroup.findMany({
    where: {
      periodId: group.periodId,
      isDeleted: false,
      status: { not: 'cancelled' }
    }
  });

  const existingGroup = activeGroups.find(g => {
    const members = g.members || [];
    return members.some(m => toId(m.studentId) === toId(studentId) && m.status === 'accepted');
  });

  if (existingGroup) {
    throw { status: 400, message: 'Bạn đã đồng ý tham gia một nhóm hoạt động khác trong đợt đồ án này.' };
  }

  const updatedMembers = [...membersList];
  updatedMembers[memberIdx] = {
    ...updatedMembers[memberIdx],
    status: 'accepted'
  };

  const updatedGroup = await prisma.projectGroup.update({
    where: { id: group.id },
    data: { members: updatedMembers }
  });

  await syncMongoMirror(updatedGroup);

  await logWorkflowEvent({
    entityId: updatedGroup.id,
    fromStatus: 'draft',
    toStatus: 'draft',
    actorId: toId(studentId),
    action: 'ACCEPT_INVITATION',
    reason: 'Đồng ý tham gia nhóm đồ án',
  });

  return toPublicGroup(updatedGroup);
};

const confirmGroup = async (groupId, leaderStudentId) => {
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(groupId), isDeleted: false }
  });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  if (toId(group.leaderStudentId) !== toId(leaderStudentId)) {
    throw { status: 403, message: 'Chỉ trưởng nhóm mới có quyền xác nhận nhóm.' };
  }

  if (group.status !== 'draft') {
    throw { status: 400, message: 'Nhóm đã được xác nhận trước đó.' };
  }

  const period = await prisma.projectPeriod.findFirst({
    where: { id: group.periodId, isDeleted: false }
  });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const minLimit = period.groupMinSize !== undefined ? period.groupMinSize : period.minGroupSize;
  const membersList = group.members || [];
  const acceptedCount = membersList.filter(m => m.status === 'accepted').length;
  if (acceptedCount < minLimit) {
    throw { status: 400, message: `Số lượng thành viên chính thức (${acceptedCount}) chưa đạt yêu cầu tối thiểu (${minLimit}) của học phần.` };
  }
  if (acceptedCount < 2) {
    throw { status: 400, message: 'Nhóm phải có ít nhất 2 thành viên chính thức mới được xác nhận.' };
  }

  const updatedGroup = await prisma.projectGroup.update({
    where: { id: group.id },
    data: { status: 'confirmed' }
  });

  await syncMongoMirror(updatedGroup);

  await logWorkflowEvent({
    entityId: updatedGroup.id,
    fromStatus: 'draft',
    toStatus: 'confirmed',
    actorId: toId(leaderStudentId),
    action: 'CONFIRM_GROUP',
    reason: `Xác nhận chốt danh sách nhóm gồm ${acceptedCount} thành viên`,
  });

  return toPublicGroup(updatedGroup);
};

const canManageGroup = (group, user) => {
  const isStaff = user.roles && user.roles.some(role => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(role));
  const isLeader = user.studentId && toId(group.leaderStudentId) === toId(user.studentId);
  return { isStaff, isLeader };
};

const softDeleteGroup = async (group, user) => {
  const fromStatus = group.status;
  const updatedGroup = await prisma.projectGroup.update({
    where: { id: group.id },
    data: {
      status: 'cancelled',
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: toId(user._id),
    }
  });

  await syncMongoMirror(updatedGroup);

  await logWorkflowEvent({
    entityId: updatedGroup.id,
    fromStatus,
    toStatus: 'cancelled',
    actorId: toId(user._id),
    actorRoles: user.roles || ['STUDENT'],
    action: 'SOFT_DELETE_GROUP',
    reason: 'Xóa mềm nhóm đồ án',
  });
};

const updateGroup = async (groupId, data, user) => {
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(groupId), isDeleted: false }
  });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  const { isStaff, isLeader } = canManageGroup(group, user);
  if (!isStaff && !isLeader) {
    throw { status: 403, message: 'Chỉ trưởng nhóm hoặc giáo vụ mới có quyền chỉnh sửa nhóm.' };
  }

  if (!isStaff && group.status !== 'draft') {
    throw { status: 400, message: 'Trưởng nhóm chỉ được chỉnh sửa nhóm khi nhóm còn ở trạng thái nháp.' };
  }

  if (group.status === 'locked') {
    throw { status: 400, message: 'Không thể chỉnh sửa nhóm đã khóa sau khi phân công đề tài.' };
  }

  const updateData = {};
  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }

  const updatedGroup = await prisma.projectGroup.update({
    where: { id: group.id },
    data: updateData
  });

  await syncMongoMirror(updatedGroup);

  await logWorkflowEvent({
    entityId: updatedGroup.id,
    fromStatus: group.status,
    toStatus: updatedGroup.status,
    actorId: toId(user._id),
    action: 'UPDATE_GROUP',
    reason: 'Cập nhật thông tin nhóm đồ án',
  });

  return toPublicGroup(updatedGroup);
};

const deleteGroup = async (groupId, user) => {
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(groupId), isDeleted: false }
  });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại hoặc đã bị xóa.' };
  }

  const { isStaff, isLeader } = canManageGroup(group, user);
  if (!isStaff && !isLeader) {
    throw { status: 403, message: 'Chỉ trưởng nhóm hoặc giáo vụ mới có quyền xóa nhóm.' };
  }

  if (!isStaff && group.status !== 'draft') {
    throw { status: 400, message: 'Trưởng nhóm chỉ được xóa nhóm khi nhóm còn ở trạng thái nháp.' };
  }

  const linkedProject = await prisma.project.findFirst({
    where: { groupId: group.id, isDeleted: false }
  });
  if (linkedProject || group.status === 'locked') {
    throw { status: 400, message: 'Nhóm đã có đề tài/dự án liên kết nên không thể xóa. Hãy hủy hoặc xử lý trạng thái nghiệp vụ thay vì xóa.' };
  }

  await softDeleteGroup(group, user);

  return { success: true, message: 'Nhóm đồ án đã được xóa thành công.' };
};

const cancelLinkedWorkAndDeleteGroup = async (groupId, user) => {
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(groupId), isDeleted: false }
  });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại hoặc đã bị xóa.' };
  }

  const { isStaff } = canManageGroup(group, user);
  if (!isStaff) {
    throw { status: 403, message: 'Chỉ giáo vụ hoặc quản trị viên mới có quyền hủy liên kết và xóa nhóm.' };
  }

  const [projects, topics] = await Promise.all([
    prisma.project.findMany({
      where: { groupId: group.id, isDeleted: false }
    }),
    prisma.projectTopic.findMany({
      where: { groupId: group.id, isDeleted: false }
    }),
  ]);

  for (const project of projects) {
    const fromStatus = project.status;
    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: 'cancelled',
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: toId(user._id)
      }
    });

    await logWorkflowEvent({
      entityType: 'Project',
      entityId: project.id,
      fromStatus,
      toStatus: 'cancelled',
      actorId: user._id,
      actorRoles: user.roles || ['FACULTY_STAFF'],
      action: 'CANCEL_LINKED_PROJECT_FOR_GROUP_DELETE',
      reason: `Hủy dự án liên kết khi xóa mềm nhóm ${group.name}`,
    });
  }

  for (const topic of topics) {
    const fromStatus = topic.status;
    await prisma.projectTopic.update({
      where: { id: topic.id },
      data: {
        status: 'cancelled',
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: toId(user._id)
      }
    });

    await logWorkflowEvent({
      entityType: 'ProjectTopic',
      entityId: topic.id,
      fromStatus,
      toStatus: 'cancelled',
      actorId: user._id,
      actorRoles: user.roles || ['FACULTY_STAFF'],
      action: 'CANCEL_LINKED_TOPIC_FOR_GROUP_DELETE',
      reason: `Hủy đề tài liên kết khi xóa mềm nhóm ${group.name}`,
    });
  }

  await softDeleteGroup(group, user);

  return {
    success: true,
    message: 'Đã hủy đề tài/dự án liên kết và xóa mềm nhóm đồ án.',
    cancelledProjects: projects.length,
    cancelledTopics: topics.length,
  };
};

const getGroupsByPeriod = async (periodId) => {
  const where = { isDeleted: false };
  if (periodId) {
    where.periodId = toId(periodId);
  }

  const groups = await prisma.projectGroup.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return await populateGroups(groups);
};

const getGroupById = async (id) => {
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(id), isDeleted: false },
  });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }
  return await populateGroup(group);
};

module.exports = {
  createGroup,
  inviteMember,
  acceptInvitation,
  confirmGroup,
  updateGroup,
  deleteGroup,
  cancelLinkedWorkAndDeleteGroup,
  getGroupsByPeriod,
  getGroupById,
};
