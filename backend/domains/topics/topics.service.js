const ProjectTopic = require('../../models/ProjectTopic');
const ProjectGroup = require('../../models/ProjectGroup');
const ProjectPeriod = require('../../models/ProjectPeriod');
const ProjectRoster = require('../../models/ProjectRoster');
const Lecturer = require('../../models/Lecturer');
const Project = require('../../models/Project');
const Student = require('../../models/Student');
const WorkflowEvent = require('../../models/WorkflowEvent');
const { resolveProjectOwner } = require('../../utils/project-owner');
const notificationsService = require('../notifications/notifications.service');

const getTopicStudentUserIds = async (topic) => {
  const userIds = [];
  if (topic.studentId) {
    const student = await Student.findOne({ _id: topic.studentId, isDeleted: false });
    if (student && student.userId) {
      userIds.push(student.userId.toString());
    }
  } else if (topic.groupId) {
    const group = await ProjectGroup.findOne({ _id: topic.groupId, isDeleted: { $ne: true } })
      .populate({
        path: 'members.studentId',
        match: { isDeleted: false },
      });
    if (group) {
      for (const m of group.members) {
        if (m.status === 'accepted' && m.studentId && m.studentId.userId) {
          userIds.push(m.studentId.userId.toString());
        }
      }
    }
  }
  return userIds;
};


const ACTIVE_TOPIC_STATUSES = ['submitted', 'ai_checked', 'needs_revision', 'approved', 'assigned', 'locked', 'changed', 'completed'];
const ACTIVE_PROJECT_STATUSES = { $nin: ['cancelled', 'archived', 'failed'] };

const logWorkflowEvent = async ({
  entityType = 'ProjectTopic',
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
    entityId,
    fromStatus,
    toStatus,
    actorId,
    actorRoles,
    action,
    reason,
  });
};

const assertStudentTopicOwnerAvailable = async (periodId, studentId) => {
  const roster = await ProjectRoster.findOne({ periodId, studentId, status: 'active' });
  if (!roster) {
    throw { status: 403, message: 'Ban chua co trong danh sach tham gia dot nay.' };
  }

  const [existingTopic, existingProject] = await Promise.all([
    ProjectTopic.findOne({
      periodId,
      ownerType: 'student',
      ownerId: studentId,
      isDeleted: false,
      status: { $in: ACTIVE_TOPIC_STATUSES },
    }),
    Project.findOne({
      periodId,
      ownerType: 'student',
      ownerId: studentId,
      isDeleted: { $ne: true },
      status: ACTIVE_PROJECT_STATUSES,
    }),
  ]);

  if (existingTopic || existingProject) {
    throw { status: 400, message: 'Ban da co de tai hoac du an ca nhan dang hoat dong trong dot do an nay.' };
  }
};

const resolveGroupTopicOwner = async (periodId, groupId, studentId) => {
  const group = await ProjectGroup.findOne({ _id: groupId, periodId, isDeleted: { $ne: true } });
  if (!group) {
    throw { status: 404, message: 'Nhom do an khong ton tai.' };
  }

  if (group.leaderStudentId.toString() !== studentId.toString()) {
    throw { status: 403, message: 'Chi truong nhom moi co quyen de xuat de tai do an.' };
  }

  if (group.status === 'cancelled' || group.status === 'locked') {
    throw { status: 400, message: 'Trang thai nhom khong hop le de dang ky de tai.' };
  }

  const callerMember = group.members.find(
    (member) => member.studentId.toString() === studentId.toString() && member.status === 'accepted'
  );
  if (!callerMember) {
    throw { status: 403, message: 'Ban chua la thanh vien da chap nhan cua nhom nay.' };
  }

  const existingActiveTopic = await ProjectTopic.findOne({
    periodId,
    $or: [
      { ownerType: 'group', ownerId: group._id },
      { groupId: group._id },
    ],
    isDeleted: false,
    status: { $in: ACTIVE_TOPIC_STATUSES },
  });

  if (existingActiveTopic) {
    throw { status: 400, message: 'Nhom cua ban da co mot de tai dang hoat dong trong dot do an nay.' };
  }

  return group;
};

const buildTopicPayload = ({ topicData, period, studentId, ownerType, ownerId, groupId }) => ({
  periodId: topicData.periodId,
  ownerType,
  ownerId,
  studentId: ownerType === 'student' ? ownerId : undefined,
  groupId,
  proposedByStudentId: studentId,
  title: topicData.title.trim(),
  summary: topicData.summary.trim(),
  objectives: topicData.objectives.trim(),
  scope: topicData.scope.trim(),
  technologies: topicData.technologies || [],
  expectedResult: topicData.expectedResult.trim(),
  plan: topicData.plan.trim(),
  keywords: topicData.keywords || [],
  proposedSupervisorId: topicData.proposedSupervisorId,
  departmentId: period.departmentId,
  status: 'submitted',
});

const proposeTopic = async (topicData, studentId) => {
  const incomingPeriodId = topicData.periodId;
  const incomingOwnerType = topicData.ownerType === 'group' ? 'group' : 'student';

  const periodRecord = await ProjectPeriod.findOne({ _id: incomingPeriodId, isDeleted: { $ne: true } });
  if (!periodRecord) {
    throw { status: 404, message: 'Dot do an khong ton tai.' };
  }

  let selectedGroupId;
  let selectedOwnerId = studentId;

  if (incomingOwnerType === 'student') {
    await assertStudentTopicOwnerAvailable(incomingPeriodId, studentId);
  } else {
    const selectedGroup = await resolveGroupTopicOwner(incomingPeriodId, topicData.groupId, studentId);
    selectedGroupId = selectedGroup._id;
    selectedOwnerId = selectedGroup._id;
  }

  const createdTopic = new ProjectTopic(buildTopicPayload({
    topicData,
    period: periodRecord,
    studentId,
    ownerType: incomingOwnerType,
    ownerId: selectedOwnerId,
    groupId: selectedGroupId,
  }));

  await createdTopic.save();

  await logWorkflowEvent({
    entityId: createdTopic._id,
    fromStatus: '',
    toStatus: 'submitted',
    actorId: studentId,
    actorRoles: ['STUDENT'],
    action: 'PROPOSE_TOPIC',
    reason: `De xuat de tai: ${createdTopic.title}`,
  });

  return createdTopic;

  const { periodId, groupId } = topicData;

  const period = await ProjectPeriod.findOne({ _id: periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const group = await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } });
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  // Verify that the caller is indeed the leader of this group
  if (group.leaderStudentId.toString() !== studentId.toString()) {
    throw { status: 403, message: 'Chỉ trưởng nhóm mới có quyền đề xuất đề tài đồ án.' };
  }

  // Verify group is confirmed or draft
  if (group.status === 'cancelled' || group.status === 'locked') {
    throw { status: 400, message: 'Trạng thái nhóm không hợp lệ để đăng ký đề tài.' };
  }

  // Check if group already has any active topic proposed
  const existingActiveTopic = await ProjectTopic.findOne({
    periodId,
    groupId,
    isDeleted: false,
    status: { $in: ['submitted', 'ai_checked', 'needs_revision', 'approved', 'assigned', 'locked', 'changed', 'completed'] },
  });

  if (existingActiveTopic) {
    throw { status: 400, message: 'Nhóm của bạn đã có một đề tài đang hoạt động (đã nộp hoặc đã được duyệt) trong đợt đồ án này.' };
  }

  // Create new topic proposal
  const topic = new ProjectTopic({
    periodId,
    groupId,
    proposedByStudentId: studentId,
    title: topicData.title.trim(),
    summary: topicData.summary.trim(),
    objectives: topicData.objectives.trim(),
    scope: topicData.scope.trim(),
    technologies: topicData.technologies || [],
    expectedResult: topicData.expectedResult.trim(),
    plan: topicData.plan.trim(),
    keywords: topicData.keywords || [],
    proposedSupervisorId: topicData.proposedSupervisorId,
    departmentId: period.departmentId, // Inherit departmentId from ProjectPeriod
    status: 'submitted',
  });

  await topic.save();

  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus: '',
    toStatus: 'submitted',
    actorId: studentId,
    actorRoles: ['STUDENT'],
    action: 'PROPOSE_TOPIC',
    reason: `Đề xuất đề tài: ${topic.title}`,
  });

  return topic;
};

const reviewTopic = async (topicId, action, actorUserId, note = '') => {
  const topic = await ProjectTopic.findById(topicId);
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  const fromStatus = topic.status;
  let toStatus = '';

  if (action === 'approve') {
    toStatus = 'approved';
    topic.approvedBy = actorUserId;
    topic.approvedAt = new Date();
  } else if (action === 'request-revision') {
    toStatus = 'needs_revision';
  } else if (action === 'reject') {
    toStatus = 'rejected';
  } else {
    throw { status: 400, message: 'Hành động xét duyệt không hợp lệ.' };
  }

  topic.status = toStatus;
  await topic.save();

  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus,
    toStatus,
    actorId: actorUserId,
    actorRoles: ['FACULTY_STAFF'],
    action: `REVIEW_TOPIC_${action.toUpperCase()}`,
    reason: note || `Xét duyệt đề tài với kết quả [${toStatus}]`,
  });

  // Gửi thông báo cho sinh viên thực hiện đề tài
  try {
    const studentUserIds = await getTopicStudentUserIds(topic);
    const actionLabel = action === 'approve' ? 'phê duyệt' : action === 'request-revision' ? 'yêu cầu chỉnh sửa' : 'từ chối';
    const notifyType = action === 'approve' ? 'TOPIC_APPROVED' : action === 'request-revision' ? 'TOPIC_REVISION_REQUESTED' : 'TOPIC_REJECTED';
    
    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: notifyType,
        title: `Đề tài đồ án đã được ${actionLabel}`,
        body: `Đề tài "${topic.title}" của bạn đã được ${actionLabel} bởi giáo vụ.${note ? ` Lý do/Ghi chú: "${note}"` : ''}`,
        entityType: 'ProjectTopic',
        entityId: topic._id,
        actionUrl: `/dashboard/topics`,
      });
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo xét duyệt đề tài:', notifyErr.message);
  }

  return topic;
};

const assignSupervisor = async (topicId, supervisorId, actorUserId) => {
  const topic = await ProjectTopic.findById(topicId);
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  // Business logic check: must be approved before assigning
  if (topic.status !== 'approved') {
    throw { status: 400, message: 'Chỉ đề tài đã được duyệt (status=approved) mới được phép phân công giảng viên hướng dẫn.' };
  }

  const lecturer = await Lecturer.findById(supervisorId);
  if (!lecturer) {
    throw { status: 404, message: 'Giảng viên được phân công hướng dẫn không tồn tại.' };
  }

  // 1. Update ProjectTopic state
  const fromStatus = topic.status;
  topic.supervisorId = supervisorId;
  topic.status = 'assigned';
  await topic.save();

  const owner = resolveProjectOwner(topic);

  // 2. Lock the ProjectGroup for group-owned topics only
  const groupId = owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : null;
  const group = groupId ? await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } }) : null;
  if (group) {
    group.status = 'locked';
    await group.save();
  }

  // 3. Spawn official Project workspace linking period, group, topic, and supervisor
  const project = await Project.create({
    periodId: topic.periodId,
    ownerType: owner?.ownerType,
    ownerId: owner?.ownerId,
    studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
    groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
    topicId: topic._id,
    supervisorId: supervisorId,
    status: 'assigned',
  });

  // 4. Log workflow events
  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus,
    toStatus: 'assigned',
    actorId: actorUserId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'ASSIGN_SUPERVISOR',
    reason: `Phân công giảng viên hướng dẫn ID ${supervisorId} và khởi tạo Workspace đồ án.`,
  });

  await logWorkflowEvent({
    entityType: 'Project',
    entityId: project._id,
    fromStatus: '',
    toStatus: 'assigned',
    actorId: actorUserId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'SPAWN_PROJECT',
    reason: 'Tự động khởi tạo Workspace khi phân công GVHD',
  });

  // Gửi thông báo cho sinh viên và Giảng viên hướng dẫn
  try {
    const supervisorLecturer = await Lecturer.findById(supervisorId).populate('userId');
    if (supervisorLecturer && supervisorLecturer.userId) {
      const supervisorName = supervisorLecturer.userId.fullName || 'Giảng viên';
      
      // 1. Thông báo cho sinh viên
      const studentUserIds = await getTopicStudentUserIds(topic);
      for (const studentUserId of studentUserIds) {
        await notificationsService.createNotification({
          recipientId: studentUserId,
          type: 'SUPERVISOR_ASSIGNED',
          title: 'Đề tài đã được phân công GVHD',
          body: `Đề tài "${topic.title}" của bạn đã được phân công Giảng viên hướng dẫn: ${supervisorName}.`,
          entityType: 'Project',
          entityId: project._id,
          actionUrl: `/dashboard/projects`,
        });
      }

      // 2. Thông báo cho Giảng viên hướng dẫn
      await notificationsService.createNotification({
        recipientId: supervisorLecturer.userId._id,
        type: 'LECTURER_SUPERVISOR_ASSIGNED',
        title: 'Được phân công hướng dẫn đồ án mới',
        body: `Thầy/cô đã được phân công hướng dẫn đề tài "${topic.title}" của sinh viên/nhóm.`,
        entityType: 'Project',
        entityId: project._id,
        actionUrl: `/dashboard/projects`,
      });
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo phân công GVHD:', notifyErr.message);
  }

  return project;
};

const getTopicsByPeriod = async (periodId) => {
  const query = { isDeleted: false };
  if (periodId) {
    query.periodId = periodId;
  }
  return await ProjectTopic.find(query)
    .populate({
      path: 'groupId',
      select: 'name status members',
    })
    .populate({
      path: 'studentId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate({
      path: 'proposedByStudentId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate({
      path: 'proposedSupervisorId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate({
      path: 'supervisorId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .sort({ createdAt: -1 });
};

const getTopicById = async (id) => {
  const topic = await ProjectTopic.findById(id)
    .populate({
      path: 'groupId',
      select: 'name status members',
    })
    .populate({
      path: 'studentId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate({
      path: 'proposedByStudentId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate({
      path: 'proposedSupervisorId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate({
      path: 'supervisorId',
      populate: { path: 'userId', select: 'fullName email' },
    });

  if (!topic || topic.isDeleted) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }
  return topic;
};

const updateTopic = async (topicId, topicData, studentId) => {
  const topic = await ProjectTopic.findById(topicId);
  if (!topic) {
    throw { status: 404, message: 'Đề tài không tồn tại.' };
  }

  // Verify ownership
  if (topic.proposedByStudentId.toString() !== studentId.toString()) {
    throw { status: 403, message: 'Chỉ sinh viên đề xuất mới có quyền chỉnh sửa đề tài.' };
  }

  // Verify status is needs_revision or draft
  if (topic.status !== 'needs_revision' && topic.status !== 'draft') {
    throw { status: 400, message: 'Chỉ có thể chỉnh sửa đề tài khi có yêu cầu chỉnh sửa từ Giáo vụ.' };
  }

  // Update fields
  if (topicData.title) topic.title = topicData.title.trim();
  if (topicData.summary) topic.summary = topicData.summary.trim();
  if (topicData.objectives) topic.objectives = topicData.objectives.trim();
  if (topicData.scope) topic.scope = topicData.scope.trim();
  if (topicData.technologies) topic.technologies = topicData.technologies;
  if (topicData.expectedResult) topic.expectedResult = topicData.expectedResult.trim();
  if (topicData.plan) topic.plan = topicData.plan.trim();
  if (topicData.proposedSupervisorId) topic.proposedSupervisorId = topicData.proposedSupervisorId;

  // Change status back to submitted
  topic.status = 'submitted';
  topic.version += 1;

  await topic.save();

  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus: 'needs_revision',
    toStatus: 'submitted',
    actorId: studentId,
    actorRoles: ['STUDENT'],
    action: 'RESUBMIT_TOPIC',
    reason: `Cập nhật và nộp lại đề tài sau chỉnh sửa: ${topic.title}`,
  });

  return topic;
};

const cancelTopic = async (topicId, actorUserId, actorRoles = ['FACULTY_STAFF']) => {
  const topic = await ProjectTopic.findById(topicId);
  if (!topic || topic.isDeleted) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  if (topic.status === 'completed') {
    throw { status: 400, message: 'Không thể hủy đề tài đã hoàn thành.' };
  }

  const projects = await Project.find({ topicId: topic._id });
  for (const project of projects) {
    const fromStatus = project.status;
    project.status = 'cancelled';
    project.isDeleted = true;
    project.deletedAt = new Date();
    project.deletedBy = actorUserId;
    await project.save();

    await logWorkflowEvent({
      entityType: 'Project',
      entityId: project._id,
      fromStatus,
      toStatus: 'cancelled',
      actorId: actorUserId,
      actorRoles,
      action: 'CANCEL_PROJECT_BY_TOPIC_CANCEL',
      reason: `Hủy dự án liên kết khi hủy đề tài ${topic.title}`,
    });
  }

  const group = await ProjectGroup.findOne({ _id: topic.groupId, isDeleted: { $ne: true } });
  if (group && group.status === 'locked') {
    const fromStatus = group.status;
    group.status = 'confirmed';
    await group.save();

    await logWorkflowEvent({
      entityType: 'ProjectGroup',
      entityId: group._id,
      fromStatus,
      toStatus: 'confirmed',
      actorId: actorUserId,
      actorRoles,
      action: 'UNLOCK_GROUP_BY_TOPIC_CANCEL',
      reason: `Mở khóa nhóm sau khi hủy đề tài ${topic.title}`,
    });
  }

  const fromStatus = topic.status;
  topic.status = 'cancelled';
  topic.isDeleted = true;
  topic.deletedAt = new Date();
  topic.deletedBy = actorUserId;
  await topic.save();

  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus,
    toStatus: 'cancelled',
    actorId: actorUserId,
    actorRoles,
    action: 'CANCEL_TOPIC',
    reason: `Hủy đề tài: ${topic.title}`,
  });

  return {
    success: true,
    message: 'Đề tài đã được hủy thành công.',
    cancelledProjects: projects.length,
  };
};

module.exports = {
  proposeTopic,
  updateTopic,
  reviewTopic,
  assignSupervisor,
  cancelTopic,
  getTopicsByPeriod,
  getTopicById,
};
