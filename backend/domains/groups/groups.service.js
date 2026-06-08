const ProjectGroup = require('../../models/ProjectGroup');
const ProjectPeriod = require('../../models/ProjectPeriod');
const ProjectRoster = require('../../models/ProjectRoster');
const Student = require('../../models/Student');
const WorkflowEvent = require('../../models/WorkflowEvent');
const Project = require('../../models/Project');

const logWorkflowEvent = async ({
  entityId,
  fromStatus,
  toStatus,
  actorId,
  action,
  reason = '',
}) => {
  return await WorkflowEvent.create({
    entityType: 'ProjectGroup',
    entityId,
    fromStatus,
    toStatus,
    actorId,
    actorRoles: ['STUDENT'],
    action,
    reason,
  });
};

const createGroup = async (periodId, name, studentId) => {
  const period = await ProjectPeriod.findOne({ _id: periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  // Check if period is in draft or registration_open
  if (period.status !== 'registration_open') {
    throw { status: 400, message: 'Chỉ có thể lập nhóm khi đợt đồ án đang mở cổng đăng ký.' };
  }

  // Verify the student is in the ProjectRoster active
  const rosterEntry = await ProjectRoster.findOne({ periodId, studentId, status: 'active' });
  if (!rosterEntry) {
    throw { status: 403, message: 'Chỉ sinh viên có tên trong danh sách đợt đồ án (roster) mới được phép lập nhóm.' };
  }

  // Verify student is not already in any active (non-cancelled) group in this period
  const existingGroup = await ProjectGroup.findOne({
    periodId,
    isDeleted: { $ne: true },
    status: { $ne: 'cancelled' },
    members: {
      $elemMatch: {
        studentId,
        status: 'accepted'
      }
    }
  });
  if (existingGroup) {
    throw { status: 400, message: 'Sinh viên đã tham gia một nhóm hoạt động khác trong đợt đồ án này.' };
  }

  const group = new ProjectGroup({
    periodId,
    name: name.trim(),
    leaderStudentId: studentId,
    members: [{
      studentId,
      role: 'LEADER',
      contributionWeight: 1.0,
      status: 'accepted',
    }],
    status: 'draft',
  });

  await group.save();

  await logWorkflowEvent({
    entityId: group._id,
    fromStatus: '',
    toStatus: 'draft',
    actorId: rosterEntry.studentId,
    action: 'CREATE_GROUP',
    reason: `Khởi tạo nhóm ${name} bởi trưởng nhóm`,
  });

  return group;
};

const inviteMember = async (groupId, invitedStudentId, leaderStudentId) => {
  const group = await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  if (group.status !== 'draft') {
    throw { status: 400, message: 'Không thể mời thành viên khi nhóm đã xác nhận hoặc bị khóa.' };
  }

  if (group.leaderStudentId.toString() !== leaderStudentId.toString()) {
    throw { status: 403, message: 'Chỉ trưởng nhóm mới có quyền mời thành viên.' };
  }

  // Get period rules
  const period = await ProjectPeriod.findOne({ _id: group.periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án liên kết không tồn tại.' };
  }

  // Check if invited student is in the roster active
  const rosterEntry = await ProjectRoster.findOne({ periodId: group.periodId, studentId: invitedStudentId, status: 'active' });
  if (!rosterEntry) {
    throw { status: 400, message: 'Sinh viên được mời không thuộc danh sách lớp học phần đợt đồ án này.' };
  }

  // Check if invited student already accepted in another active group
  const existingGroup = await ProjectGroup.findOne({
    periodId: group.periodId,
    isDeleted: { $ne: true },
    status: { $ne: 'cancelled' },
    members: {
      $elemMatch: {
        studentId: invitedStudentId,
        status: 'accepted'
      }
    }
  });
  if (existingGroup) {
    throw { status: 400, message: 'Sinh viên được mời đã là thành viên chính thức của một nhóm khác.' };
  }

  // Check current total size limits (accepted + invited members count)
  const activeCount = group.members.filter(m => m.status === 'accepted' || m.status === 'invited').length;
  if (activeCount >= period.maxGroupSize) {
    throw { status: 400, message: `Số lượng thành viên (bao gồm cả lời mời) vượt quá giới hạn tối đa (${period.maxGroupSize}) của đợt đồ án.` };
  }

  // Check if member already in this group
  const memberIdx = group.members.findIndex(m => m.studentId.toString() === invitedStudentId.toString());
  if (memberIdx !== -1) {
    const member = group.members[memberIdx];
    if (member.status === 'invited') {
      throw { status: 400, message: 'Sinh viên này đã được mời vào nhóm và đang chờ phản hồi.' };
    }
    if (member.status === 'accepted') {
      throw { status: 400, message: 'Sinh viên này đã là thành viên nhóm.' };
    }
    // Re-invite removed student
    member.status = 'invited';
    member.role = 'MEMBER';
    member.contributionWeight = 1.0;
  } else {
    group.members.push({
      studentId: invitedStudentId,
      role: 'MEMBER',
      contributionWeight: 1.0,
      status: 'invited',
    });
  }

  await group.save();

  await logWorkflowEvent({
    entityId: group._id,
    fromStatus: 'draft',
    toStatus: 'draft',
    actorId: leaderStudentId,
    action: 'INVITE_MEMBER',
    reason: `Mời sinh viên ID ${invitedStudentId} vào nhóm`,
  });

  return group;
};

const acceptInvitation = async (groupId, studentId) => {
  const group = await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  if (group.status !== 'draft') {
    throw { status: 400, message: 'Nhóm đã xác nhận hoặc bị khóa. Không thể đồng ý tham gia.' };
  }

  const member = group.members.find(m => m.studentId.toString() === studentId.toString() && m.status === 'invited');
  if (!member) {
    throw { status: 404, message: 'Không tìm thấy lời mời tham gia nhóm đang chờ xử lý cho sinh viên này.' };
  }

  // Check if student accepted in another active group
  const existingGroup = await ProjectGroup.findOne({
    periodId: group.periodId,
    isDeleted: { $ne: true },
    status: { $ne: 'cancelled' },
    members: {
      $elemMatch: {
        studentId: studentId,
        status: 'accepted'
      }
    }
  });
  if (existingGroup) {
    throw { status: 400, message: 'Bạn đã đồng ý tham gia một nhóm hoạt động khác trong đợt đồ án này.' };
  }

  member.status = 'accepted';
  await group.save();

  await logWorkflowEvent({
    entityId: group._id,
    fromStatus: 'draft',
    toStatus: 'draft',
    actorId: studentId,
    action: 'ACCEPT_INVITATION',
    reason: 'Đồng ý tham gia nhóm đồ án',
  });

  return group;
};

const confirmGroup = async (groupId, leaderStudentId) => {
  const group = await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  if (group.leaderStudentId.toString() !== leaderStudentId.toString()) {
    throw { status: 403, message: 'Chỉ trưởng nhóm mới có quyền xác nhận nhóm.' };
  }

  if (group.status !== 'draft') {
    throw { status: 400, message: 'Nhóm đã được xác nhận trước đó.' };
  }

  // Get period rules
  const period = await ProjectPeriod.findOne({ _id: group.periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  // Check if total accepted members meets minGroupSize
  const acceptedCount = group.members.filter(m => m.status === 'accepted').length;
  if (acceptedCount < period.minGroupSize) {
    throw { status: 400, message: `Số lượng thành viên chính thức (${acceptedCount}) chưa đạt yêu cầu tối thiểu (${period.minGroupSize}) của đợt đồ án.` };
  }

  group.status = 'confirmed';
  await group.save();

  await logWorkflowEvent({
    entityId: group._id,
    fromStatus: 'draft',
    toStatus: 'confirmed',
    actorId: leaderStudentId,
    action: 'CONFIRM_GROUP',
    reason: `Xác nhận chốt danh sách nhóm gồm ${acceptedCount} thành viên`,
  });

  return group;
};

const canManageGroup = (group, user) => {
  const isStaff = user.roles && user.roles.some(role => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(role));
  const isLeader = user.studentId && group.leaderStudentId.toString() === user.studentId.toString();
  return { isStaff, isLeader };
};

const updateGroup = async (groupId, data, user) => {
  const group = await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } });
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

  if (data.name !== undefined) group.name = data.name.trim();
  await group.save();

  await logWorkflowEvent({
    entityId: group._id,
    fromStatus: group.status,
    toStatus: group.status,
    actorId: user._id,
    action: 'UPDATE_GROUP',
    reason: 'Cập nhật thông tin nhóm đồ án',
  });

  return group;
};

const deleteGroup = async (groupId, user) => {
  const group = await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } });
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

  const linkedProject = await Project.findOne({ groupId: group._id });
  if (linkedProject || group.status === 'locked') {
    throw { status: 400, message: 'Nhóm đã có đề tài/dự án liên kết nên không thể xóa. Hãy hủy hoặc xử lý trạng thái nghiệp vụ thay vì xóa.' };
  }

  group.status = 'cancelled';
  group.isDeleted = true;
  group.deletedAt = new Date();
  group.deletedBy = user._id;
  await group.save();

  await logWorkflowEvent({
    entityId: group._id,
    fromStatus: group.status,
    toStatus: 'cancelled',
    actorId: user._id,
    action: 'SOFT_DELETE_GROUP',
    reason: 'Xóa mềm nhóm đồ án',
  });

  return { success: true, message: 'Nhóm đồ án đã được xóa thành công.' };
};

const getGroupsByPeriod = async (periodId) => {
  return await ProjectGroup.find({ periodId, isDeleted: { $ne: true } })
    .populate({
      path: 'leaderStudentId',
      populate: { path: 'userId', select: 'fullName email status' },
    })
    .populate({
      path: 'members.studentId',
      populate: { path: 'userId', select: 'fullName email status' },
    })
    .sort({ createdAt: -1 });
};

const getGroupById = async (id) => {
  const group = await ProjectGroup.findOne({ _id: id, isDeleted: { $ne: true } })
    .populate({
      path: 'leaderStudentId',
      populate: { path: 'userId', select: 'fullName email status' },
    })
    .populate({
      path: 'members.studentId',
      populate: { path: 'userId', select: 'fullName email status' },
    });
    
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }
  return group;
};

module.exports = {
  createGroup,
  inviteMember,
  acceptInvitation,
  confirmGroup,
  updateGroup,
  deleteGroup,
  getGroupsByPeriod,
  getGroupById,
};
