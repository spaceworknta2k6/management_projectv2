const ProjectTopic = require('../../models/ProjectTopic');
const ProjectGroup = require('../../models/ProjectGroup');
const ProjectPeriod = require('../../models/ProjectPeriod');
const Lecturer = require('../../models/Lecturer');
const Project = require('../../models/Project');
const WorkflowEvent = require('../../models/WorkflowEvent');

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

const proposeTopic = async (topicData, studentId) => {
  const { periodId, groupId } = topicData;

  const period = await ProjectPeriod.findById(periodId);
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const group = await ProjectGroup.findById(groupId);
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
    status: { $in: ['submitted', 'ai_checked', 'needs_revision', 'approved', 'assigned', 'locked', 'completed'] },
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

  // 2. Lock the ProjectGroup
  const group = await ProjectGroup.findById(topic.groupId);
  if (group) {
    group.status = 'locked';
    await group.save();
  }

  // 3. Spawn official Project workspace linking period, group, topic, and supervisor
  const project = await Project.create({
    periodId: topic.periodId,
    groupId: topic.groupId,
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

module.exports = {
  proposeTopic,
  reviewTopic,
  assignSupervisor,
  getTopicsByPeriod,
  getTopicById,
};
