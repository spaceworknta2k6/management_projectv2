const mongoose = require('mongoose');
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

const getTopicAllowedOwnerTypes = (topic) => (
  Array.isArray(topic.allowedOwnerTypes) && topic.allowedOwnerTypes.length > 0
    ? topic.allowedOwnerTypes
    : ['student', 'group']
);

const getGroupLimits = (period, topic) => {
  const minLimit = Math.max(2, Number(topic?.minGroupSize || period?.groupMinSize || period?.minGroupSize || 2));
  const maxLimit = Number(topic?.maxGroupSize || period?.groupMaxSize || period?.maxGroupSize || 5);
  return { minLimit, maxLimit };
};

const getAcceptedMemberIds = (group) => (
  (group.members || [])
    .filter((member) => member.status === 'accepted')
    .map((member) => member.studentId)
    .filter(Boolean)
);

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

  const [existingTopic, existingProject, existingGroupProject] = await Promise.all([
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
    Project.aggregate([
      {
        $match: {
          periodId,
          ownerType: 'group',
          isDeleted: { $ne: true },
          status: ACTIVE_PROJECT_STATUSES,
        },
      },
      {
        $lookup: {
          from: 'projectgroups',
          localField: 'groupId',
          foreignField: '_id',
          as: 'group',
        },
      },
      { $unwind: '$group' },
      {
        $match: {
          'group.status': { $in: ['confirmed', 'locked'] },
          'group.members': {
            $elemMatch: {
              studentId,
              status: 'accepted',
            },
          },
        },
      },
      { $limit: 1 },
    ]),
  ]);

  if (existingTopic || existingProject) {
    throw { status: 400, message: 'Ban da co de tai hoac du an ca nhan dang hoat dong trong dot do an nay.' };
  }

  if (existingGroupProject.length > 0) {
    throw { status: 400, message: 'Ban da thuoc nhom co du an dang hoat dong trong dot do an nay.' };
  }
};

const assertAcceptedMembersInRoster = async (periodId, memberIds) => {
  const activeRosterCount = await ProjectRoster.countDocuments({
    periodId,
    studentId: { $in: memberIds },
    status: 'active',
  });

  if (activeRosterCount !== memberIds.length) {
    throw { status: 403, message: 'Tat ca thanh vien nhom phai co trong danh sach hoc phan dang hoat dong.' };
  }
};

const resolveGroupTopicOwner = async (periodId, groupId, studentId, period, topic) => {
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

  if (group.status !== 'confirmed') {
    throw { status: 400, message: 'Nhom phai duoc xac nhan truoc khi dang ky de tai.' };
  }

  const acceptedMemberIds = getAcceptedMemberIds(group);
  const { minLimit, maxLimit } = getGroupLimits(period, topic);

  if (acceptedMemberIds.length < minLimit) {
    throw { status: 400, message: `Nhom phai co it nhat ${minLimit} thanh vien da xac nhan.` };
  }

  if (acceptedMemberIds.length > maxLimit) {
    throw { status: 400, message: `Nhom vuot qua gioi han ${maxLimit} thanh vien cua hoc phan.` };
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

  await assertAcceptedMembersInRoster(periodId, acceptedMemberIds);

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
  academicUnit: topicData.academicUnit || period.academicUnit || 'computer_science',
  topicDomain: topicData.topicDomain || 'software_development',
  proposedSupervisorId: topicData.proposedSupervisorId,
  departmentId: period.departmentId,
  status: 'submitted',
});

const spawnProjectForAssignedTopic = async (topic, supervisorId, actorUserId, actorRoles = ['FACULTY_STAFF']) => {
  const owner = resolveProjectOwner(topic);

  const groupId = owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : null;
  const group = groupId ? await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } }) : null;
  if (group) {
    group.status = 'locked';
    await group.save();
  }

  const existingProject = await Project.findOne({
    topicId: topic._id,
    isDeleted: { $ne: true },
    status: ACTIVE_PROJECT_STATUSES,
  });

  if (existingProject) {
    return existingProject;
  }

  const project = await Project.create({
    periodId: topic.periodId,
    ownerType: owner?.ownerType,
    ownerId: owner?.ownerId,
    studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
    groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
    topicId: topic._id,
    supervisorId,
    status: 'assigned',
  });

  await logWorkflowEvent({
    entityType: 'Project',
    entityId: project._id,
    fromStatus: '',
    toStatus: 'assigned',
    actorId: actorUserId,
    actorRoles,
    action: 'SPAWN_PROJECT',
    reason: 'Tự động khởi tạo Workspace khi xác nhận GVHD',
  });

  return project;
};

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
    if (periodRecord.allowIndividual === false) {
      throw { status: 400, message: 'Hoc phan khong cho phep de xuat de tai ca nhan.' };
    }
    await assertStudentTopicOwnerAvailable(incomingPeriodId, studentId);
  } else {
    if (periodRecord.allowGroup === false) {
      throw { status: 400, message: 'Hoc phan khong cho phep de xuat de tai theo nhom.' };
    }
    const selectedGroup = await resolveGroupTopicOwner(incomingPeriodId, topicData.groupId, studentId, periodRecord);
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

const reviewTopic = async (topicId, action, user, note = '') => {
  const topic = await ProjectTopic.findById(topicId);
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  const fromStatus = topic.status;
  
  // Verify permissions
  const roles = user.roles || [];
  const isStaff = roles.some(r => ['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN'].includes(r));
  let isAuthorizedLecturer = false;

  if (roles.includes('LECTURER') && user.lecturerId) {
    const period = await ProjectPeriod.findById(topic.periodId);
    const isCoordinator = period && period.coordinatorLecturerId && period.coordinatorLecturerId.toString() === user.lecturerId.toString();
    const isProposedSupervisor = topic.proposedSupervisorId && topic.proposedSupervisorId.toString() === user.lecturerId.toString();
    const isProposedLecturer = topic.proposedByLecturerId && topic.proposedByLecturerId.toString() === user.lecturerId.toString();

    if (isCoordinator || isProposedSupervisor || isProposedLecturer) {
      isAuthorizedLecturer = true;
    }
  }

  if (!isStaff && !isAuthorizedLecturer) {
    throw { status: 403, message: 'Bạn không có quyền duyệt chuyên môn đề tài này.' };
  }

  let toStatus = '';
  let shouldAutoAssignSupervisor = false;
  if (action === 'approve') {
    shouldAutoAssignSupervisor = Boolean(
      user.lecturerId &&
      topic.proposedSupervisorId &&
      topic.proposedSupervisorId.toString() === user.lecturerId.toString()
    );
    toStatus = shouldAutoAssignSupervisor ? 'assigned' : 'approved';
    topic.approvedBy = user._id;
    topic.approvedAt = new Date();
    topic.approvedByLecturerId = user.lecturerId || undefined;
    if (shouldAutoAssignSupervisor) {
      topic.supervisorId = user.lecturerId;
    }
  } else if (action === 'request-revision') {
    toStatus = 'needs_revision';
  } else if (action === 'reject') {
    toStatus = 'rejected';
  } else {
    throw { status: 400, message: 'Hành động xét duyệt không hợp lệ.' };
  }

  topic.status = toStatus;
  await topic.save();

  if (shouldAutoAssignSupervisor) {
    await spawnProjectForAssignedTopic(topic, user.lecturerId, user._id, ['LECTURER']);
  }

  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus,
    toStatus,
    actorId: user._id,
    actorRoles: isStaff ? ['FACULTY_STAFF'] : ['LECTURER'],
    action: `REVIEW_TOPIC_${action.toUpperCase()}`,
    reason: note || (shouldAutoAssignSupervisor
      ? 'Giảng viên đề xuất đã duyệt và nhận hướng dẫn đề tài'
      : `Xét duyệt đề tài với kết quả [${toStatus}]`),
  });

  // Gửi thông báo cho sinh viên thực hiện đề tài
  try {
    const studentUserIds = await getTopicStudentUserIds(topic);
    const actionLabel = shouldAutoAssignSupervisor ? 'phê duyệt và nhận hướng dẫn' : action === 'approve' ? 'phê duyệt' : action === 'request-revision' ? 'yêu cầu chỉnh sửa' : 'từ chối';
    const notifyType = action === 'approve' ? 'TOPIC_APPROVED' : action === 'request-revision' ? 'TOPIC_REVISION_REQUESTED' : 'TOPIC_REJECTED';
    
    const reviewerName = user.fullName || 'Giảng viên';
    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: notifyType,
        title: `Đề tài đồ án đã được ${actionLabel}`,
        body: `Đề tài "${topic.title}" của bạn đã được ${actionLabel} bởi ${reviewerName}.${note ? ` Lý do/Ghi chú: "${note}"` : ''}`,
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

  const project = await spawnProjectForAssignedTopic(topic, supervisorId, actorUserId, ['FACULTY_STAFF']);

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
  if (topicData.academicUnit) topic.academicUnit = topicData.academicUnit;
  if (topicData.topicDomain) topic.topicDomain = topicData.topicDomain;

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

const createLecturerTopic = async (topicData, lecturerId, userId) => {
  const { periodId } = topicData;
  const period = await ProjectPeriod.findOne({ _id: periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const requiredStrings = {
    title: 'Ten de tai',
    summary: 'Tom tat de tai',
    objectives: 'Muc tieu de tai',
    scope: 'Pham vi de tai',
    expectedResult: 'San pham dau ra du kien',
    plan: 'Ke hoach thuc hien',
  };
  for (const [field, label] of Object.entries(requiredStrings)) {
    const val = topicData[field];
    if (!val || typeof val !== 'string' || val.trim() === '') {
      throw { status: 422, message: `${label} là bắt buộc.` };
    }
  }

  const topic = new ProjectTopic({
    periodId,
    createdByRole: 'lecturer',
    createdByUserId: userId,
    proposedByLecturerId: lecturerId,
    supervisorId: lecturerId,
    proposedSupervisorId: lecturerId,
    title: topicData.title.trim(),
    summary: topicData.summary.trim(),
    objectives: topicData.objectives.trim(),
    scope: topicData.scope.trim(),
    technologies: topicData.technologies || [],
    expectedResult: topicData.expectedResult.trim(),
    plan: topicData.plan.trim(),
    keywords: topicData.keywords || [],
    academicUnit: topicData.academicUnit || period.academicUnit || 'computer_science',
    topicDomain: topicData.topicDomain || 'software_development',
    capacityMaxStudents: topicData.capacityMaxStudents !== undefined ? parseInt(topicData.capacityMaxStudents, 10) : 1,
    capacityMaxGroups: topicData.capacityMaxGroups !== undefined ? parseInt(topicData.capacityMaxGroups, 10) : 1,
    minGroupSize: topicData.minGroupSize !== undefined ? parseInt(topicData.minGroupSize, 10) : undefined,
    maxGroupSize: topicData.maxGroupSize !== undefined ? parseInt(topicData.maxGroupSize, 10) : undefined,
    allowedOwnerTypes: topicData.allowedOwnerTypes || ['student', 'group'],
    allowIndividual: topicData.allowIndividual !== undefined ? topicData.allowIndividual : true,
    allowGroup: topicData.allowGroup !== undefined ? topicData.allowGroup : true,
    departmentId: period.departmentId,
    status: 'approved',
  });

  await topic.save();

  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus: '',
    toStatus: 'approved',
    actorId: userId,
    actorRoles: ['LECTURER'],
    action: 'CREATE_LECTURER_TOPIC',
    reason: `Giảng viên đề xuất đề tài: ${topic.title}`,
  });

  return topic;
};

const registerExistingTopic = async (topicId, registerData, studentId, actorUserId) => {
  const topic = await ProjectTopic.findOne({ _id: topicId, isDeleted: { $ne: true } });
  if (!topic) {
    throw { status: 404, message: 'Đề tài không tồn tại.' };
  }

  if (topic.status !== 'published') {
    throw { status: 400, message: 'Chỉ đề tài đã công khai mới cho phép đăng ký.' };
  }

  const period = await ProjectPeriod.findOne({ _id: topic.periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const ownerType = registerData.ownerType === 'group' ? 'group' : 'student';
  let targetGroupId = null;
  let targetOwnerId = studentId;

  if (ownerType === 'student') {
    if (!getTopicAllowedOwnerTypes(topic).includes('student')) {
      throw { status: 400, message: 'De tai nay khong cho phep dang ky ca nhan.' };
    }
    const allowInd = topic.allowIndividual !== undefined ? topic.allowIndividual : period.allowIndividual;
    if (allowInd === false) {
      throw { status: 400, message: 'Đề tài hoặc học phần không cho phép đăng ký cá nhân.' };
    }
    await assertStudentTopicOwnerAvailable(topic.periodId, studentId);
  } else {
    if (!getTopicAllowedOwnerTypes(topic).includes('group')) {
      throw { status: 400, message: 'De tai nay khong cho phep dang ky theo nhom.' };
    }
    const allowGrp = topic.allowGroup !== undefined ? topic.allowGroup : period.allowGroup;
    if (allowGrp === false) {
      throw { status: 400, message: 'Đề tài hoặc học phần không cho phép đăng ký theo nhóm.' };
    }
    const group = await resolveGroupTopicOwner(topic.periodId, registerData.groupId, studentId, period, topic);
    targetGroupId = group._id;
    targetOwnerId = group._id;
  }

  // Capacity check
  if (ownerType === 'student') {
    if (topic.currentStudentCount >= topic.capacityMaxStudents) {
      throw { status: 400, message: 'Đề tài đã đầy số lượng đăng ký tối đa.' };
    }
  } else {
    if (topic.currentGroupCount >= topic.capacityMaxGroups) {
      throw { status: 400, message: 'Đề tài đã đầy số lượng nhóm đăng ký tối đa.' };
    }
  }

  // Increment counters on the original topic
  if (ownerType === 'student') {
    topic.currentStudentCount += 1;
  } else {
    topic.currentGroupCount += 1;
    const group = await ProjectGroup.findById(targetGroupId);
    const acceptedCount = group.members.filter(m => m.status === 'accepted').length;
    topic.currentStudentCount += acceptedCount;
  }

  // If capacity is filled, set status to assigned / locked
  const isStudentFull = topic.currentStudentCount >= topic.capacityMaxStudents;
  const isGroupFull = topic.currentGroupCount >= topic.capacityMaxGroups;
  if (isStudentFull || isGroupFull) {
    topic.status = 'assigned';
  }
  await topic.save();

  // Create registered topic cloned from the original
  const registeredTopic = new ProjectTopic({
    ...topic.toObject(),
    _id: new mongoose.Types.ObjectId(),
    ownerType,
    ownerId: targetOwnerId,
    studentId: ownerType === 'student' ? targetOwnerId : undefined,
    groupId: ownerType === 'group' ? targetGroupId : undefined,
    status: 'assigned',
  });
  await registeredTopic.save();

  // Lock group
  if (ownerType === 'group') {
    const group = await ProjectGroup.findOne({ _id: targetGroupId });
    if (group) {
      group.status = 'locked';
      await group.save();
    }
  }

  // Spawn project workspace
  const project = await Project.create({
    periodId: topic.periodId,
    ownerType,
    ownerId: targetOwnerId,
    studentId: ownerType === 'student' ? targetOwnerId : undefined,
    groupId: ownerType === 'group' ? targetGroupId : undefined,
    topicId: registeredTopic._id,
    supervisorId: topic.supervisorId || topic.proposedSupervisorId,
    status: 'assigned',
  });

  // Logs
  await logWorkflowEvent({
    entityId: registeredTopic._id,
    fromStatus: '',
    toStatus: 'assigned',
    actorId: actorUserId,
    actorRoles: ['STUDENT'],
    action: 'REGISTER_TOPIC',
    reason: `Đăng ký thành công đề tài: ${topic.title}`,
  });

  await logWorkflowEvent({
    entityType: 'Project',
    entityId: project._id,
    fromStatus: '',
    toStatus: 'assigned',
    actorId: actorUserId,
    actorRoles: ['STUDENT'],
    action: 'SPAWN_PROJECT_BY_REGISTRATION',
    reason: 'Khởi tạo Workspace từ đăng ký đề tài',
  });

  return registeredTopic;
};

const publishTopic = async (topicId, actorUserId) => {
  const topic = await ProjectTopic.findById(topicId);
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  if (topic.status !== 'approved') {
    throw { status: 400, message: 'Chỉ đề tài đã được duyệt chuyên môn mới được phép công khai.' };
  }

  const fromStatus = topic.status;
  topic.status = 'published';
  topic.publishedByStaffId = actorUserId;
  topic.publishedAt = new Date();
  await topic.save();

  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus,
    toStatus: 'published',
    actorId: actorUserId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'PUBLISH_TOPIC',
    reason: `Công khai đề tài: ${topic.title}`,
  });

  return topic;
};

const unpublishTopic = async (topicId, actorUserId) => {
  const topic = await ProjectTopic.findById(topicId);
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  if (topic.status !== 'published') {
    throw { status: 400, message: 'Chỉ đề tài đang công khai mới được gỡ.' };
  }

  const fromStatus = topic.status;
  topic.status = 'approved';
  topic.publishedByStaffId = undefined;
  topic.publishedAt = undefined;
  await topic.save();

  await logWorkflowEvent({
    entityId: topic._id,
    fromStatus,
    toStatus: 'approved',
    actorId: actorUserId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'UNPUBLISH_TOPIC',
    reason: `Gỡ công khai đề tài: ${topic.title}`,
  });

  return topic;
};

module.exports = {
  proposeTopic,
  updateTopic,
  reviewTopic,
  assignSupervisor,
  cancelTopic,
  getTopicsByPeriod,
  getTopicById,
  createLecturerTopic,
  registerExistingTopic,
  publishTopic,
  unpublishTopic,
};
