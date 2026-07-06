const prisma = require('../../config/prisma');
const ProjectTopicMirror = { updateOne: async () => {} };
const ProjectGroupMirror = { updateOne: async () => {} };
const ProjectMirror = { updateOne: async () => {} };
const WorkflowEvent = require('../../utils/workflow-event');
const notificationsService = require('../notifications/notifications.service');
const { randomBytes } = require('crypto');

const newObjectId = () => randomBytes(12).toString('hex');
const toId = (value) => (value ? value.toString() : null);
const toDate = (value) => (value ? new Date(value) : null);

const toPublicTopic = (topic) => {
  if (!topic) return null;
  return {
    ...topic,
    _id: topic.id,
  };
};

const resolveOwnerFields = (data) => {
  const resolved = { ...data };
  if (!resolved.ownerType && resolved.groupId) {
    resolved.ownerType = 'group';
  }

  if (!resolved.ownerId && resolved.ownerType === 'group' && resolved.groupId) {
    resolved.ownerId = resolved.groupId;
  }

  if (!resolved.ownerId && resolved.ownerType === 'student' && resolved.studentId) {
    resolved.ownerId = resolved.studentId;
  }

  if (!resolved.studentId && resolved.ownerType === 'student' && resolved.ownerId) {
    resolved.studentId = resolved.ownerId;
  }
  return resolved;
};

const toMongoMirrorTopicData = (topic) => {
  return {
    _id: topic.id,
    periodId: toId(topic.periodId),
    ownerType: topic.ownerType || undefined,
    ownerId: toId(topic.ownerId) || undefined,
    studentId: toId(topic.studentId) || undefined,
    groupId: toId(topic.groupId) || undefined,
    proposedByStudentId: toId(topic.proposedByStudentId) || undefined,
    createdByRole: topic.createdByRole || 'student',
    createdByUserId: toId(topic.createdByUserId) || undefined,
    proposedByLecturerId: toId(topic.proposedByLecturerId) || undefined,
    approvedByLecturerId: toId(topic.approvedByLecturerId) || undefined,
    capacityMaxStudents: topic.capacityMaxStudents,
    capacityMaxGroups: topic.capacityMaxGroups,
    currentStudentCount: topic.currentStudentCount,
    currentGroupCount: topic.currentGroupCount,
    allowedOwnerTypes: topic.allowedOwnerTypes || ['student', 'group'],
    allowIndividual: topic.allowIndividual !== null ? topic.allowIndividual : undefined,
    allowGroup: topic.allowGroup !== null ? topic.allowGroup : undefined,
    minGroupSize: topic.minGroupSize !== null ? topic.minGroupSize : undefined,
    maxGroupSize: topic.maxGroupSize !== null ? topic.maxGroupSize : undefined,
    publishedByStaffId: toId(topic.publishedByStaffId) || undefined,
    publishedAt: topic.publishedAt || undefined,
    title: topic.title,
    summary: topic.summary,
    objectives: topic.objectives,
    scope: topic.scope,
    technologies: topic.technologies || [],
    expectedResult: topic.expectedResult,
    plan: topic.plan,
    keywords: topic.keywords || [],
    academicUnit: topic.academicUnit,
    topicDomain: topic.topicDomain,
    supervisorId: toId(topic.supervisorId) || undefined,
    proposedSupervisorId: toId(topic.proposedSupervisorId) || undefined,
    departmentId: toId(topic.departmentId),
    status: topic.status,
    rejectionReason: topic.rejectionReason || undefined,
    approvedBy: toId(topic.approvedBy) || undefined,
    approvedAt: topic.approvedAt || undefined,
    version: topic.version,
    isDeleted: topic.isDeleted,
    deletedAt: topic.deletedAt || undefined,
    deletedBy: toId(topic.deletedBy) || undefined,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
  };
};

const syncMongoMirrorTopic = async (topic) => {};

const syncMongoMirrorProject = async (project) => {};

const getTopicStudentUserIds = async (topic) => {
  const userIds = [];
  if (topic.studentId) {
    const student = await prisma.student.findFirst({
      where: { id: toId(topic.studentId), isDeleted: false }
    });
    if (student && student.userId) {
      userIds.push(student.userId.toString());
    }
  } else if (topic.groupId) {
    const group = await prisma.projectGroup.findFirst({
      where: { id: toId(topic.groupId), isDeleted: false }
    });
    if (group) {
      const members = group.members || [];
      const memberStudentIds = members
        .filter(m => m.status === 'accepted' && m.studentId)
        .map(m => toId(m.studentId));

      const students = await prisma.student.findMany({
        where: { id: { in: memberStudentIds }, isDeleted: false }
      });
      for (const s of students) {
        if (s.userId) userIds.push(s.userId.toString());
      }
    }
  }
  return userIds;
};

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
    entityId: toId(entityId),
    fromStatus,
    toStatus,
    actorId: toId(actorId),
    actorRoles,
    action,
    reason,
  });
};

const assertStudentTopicOwnerAvailable = async (periodId, studentId) => {
  const roster = await prisma.projectRoster.findFirst({
    where: { periodId: toId(periodId), studentId: toId(studentId), status: 'active' }
  });
  if (!roster) {
    throw { status: 403, message: 'Ban chua co trong danh sach tham gia dot nay.' };
  }

  const ACTIVE_TOPIC_STATUSES = ['submitted', 'needs_revision', 'approved', 'assigned', 'locked', 'changed', 'completed'];

  const [existingTopic, existingProject, existingGroupProject] = await Promise.all([
    prisma.projectTopic.findFirst({
      where: {
        periodId: toId(periodId),
        ownerType: 'student',
        ownerId: toId(studentId),
        isDeleted: false,
        status: { in: ACTIVE_TOPIC_STATUSES },
      }
    }),
    prisma.project.findFirst({
      where: {
        periodId: toId(periodId),
        ownerType: 'student',
        ownerId: toId(studentId),
        isDeleted: false,
        status: { notIn: ['cancelled', 'archived', 'failed'] },
      }
    }),
    prisma.project.findMany({
      where: {
        periodId: toId(periodId),
        ownerType: 'group',
        isDeleted: false,
        status: { notIn: ['cancelled', 'archived', 'failed'] },
      }
    }).then(async (projects) => {
      if (projects.length === 0) return [];
      const groupIds = projects.map(p => toId(p.groupId)).filter(Boolean);
      const groups = await prisma.projectGroup.findMany({
        where: {
          id: { in: groupIds },
          status: { in: ['confirmed', 'locked'] },
          isDeleted: false,
        }
      });
      const userGroup = groups.find(g => {
        const members = g.members || [];
        return members.some(m => toId(m.studentId) === toId(studentId) && m.status === 'accepted');
      });
      return userGroup ? [userGroup] : [];
    })
  ]);

  if (existingTopic || existingProject) {
    throw { status: 400, message: 'Ban da co de tai hoac du an ca nhan dang hoat dong trong dot do an nay.' };
  }

  if (existingGroupProject.length > 0) {
    throw { status: 400, message: 'Ban da thuoc nhom co du an dang hoat dong trong dot do an nay.' };
  }
};

const assertAcceptedMembersInRoster = async (periodId, memberIds) => {
  const activeRosterCount = await prisma.projectRoster.count({
    where: {
      periodId: toId(periodId),
      studentId: { in: memberIds.map(toId) },
      status: 'active',
    }
  });

  if (activeRosterCount !== memberIds.length) {
    throw { status: 403, message: 'Tat ca thanh vien nhom phai co trong danh sach hoc phan dang hoat dong.' };
  }
};

const resolveGroupTopicOwner = async (periodId, groupId, studentId, period, topic) => {
  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(groupId), periodId: toId(periodId), isDeleted: false }
  });
  if (!group) {
    throw { status: 404, message: 'Nhom do an khong ton tai.' };
  }

  if (toId(group.leaderStudentId) !== toId(studentId)) {
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

  const callerMember = (group.members || []).find(
    (member) => toId(member.studentId) === toId(studentId) && member.status === 'accepted'
  );
  if (!callerMember) {
    throw { status: 403, message: 'Ban chua la thanh vien da chap nhan cua nhom nay.' };
  }

  const ACTIVE_TOPIC_STATUSES = ['submitted', 'needs_revision', 'approved', 'assigned', 'locked', 'changed', 'completed'];
  const existingActiveTopic = await prisma.projectTopic.findFirst({
    where: {
      periodId: toId(periodId),
      OR: [
        { ownerType: 'group', ownerId: group.id },
        { groupId: group.id }
      ],
      isDeleted: false,
      status: { in: ACTIVE_TOPIC_STATUSES }
    }
  });

  if (existingActiveTopic) {
    throw { status: 400, message: 'Nhom cua ban da co mot de tai dang hoat dong trong dot do an nay.' };
  }

  await assertAcceptedMembersInRoster(periodId, acceptedMemberIds);

  return group;
};

const buildTopicPayload = ({ topicData, period, studentId, ownerType, ownerId, groupId }) => ({
  periodId: toId(topicData.periodId),
  ownerType,
  ownerId: toId(ownerId),
  studentId: ownerType === 'student' ? toId(ownerId) : undefined,
  groupId: toId(groupId),
  proposedByStudentId: toId(studentId),
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
  proposedSupervisorId: toId(topicData.proposedSupervisorId),
  departmentId: toId(period.departmentId),
  status: 'submitted',
});

const resolveProjectOwner = (topic) => {
  if (topic.ownerType === 'group' || topic.groupId) {
    return {
      ownerType: 'group',
      ownerId: toId(topic.groupId || topic.ownerId),
      groupId: toId(topic.groupId || topic.ownerId),
    };
  }
  return {
    ownerType: 'student',
    ownerId: toId(topic.studentId || topic.ownerId),
    studentId: toId(topic.studentId || topic.ownerId),
  };
};

const spawnProjectForAssignedTopic = async (topic, supervisorId, actorUserId, actorRoles = ['FACULTY_STAFF']) => {
  const owner = resolveProjectOwner(topic);

  const groupId = owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : null;
  const group = groupId ? await prisma.projectGroup.findFirst({
    where: { id: toId(groupId), isDeleted: false }
  }) : null;

  if (group) {
    await prisma.projectGroup.update({
      where: { id: group.id },
      data: { status: 'locked' }
    });
    await ProjectGroupMirror.updateOne(
      { _id: group.id },
      { $set: { status: 'locked' } }
    );
  }

  const existingProject = await prisma.project.findFirst({
    where: {
      topicId: toId(topic.id),
      isDeleted: false,
      status: { notIn: ['cancelled', 'archived', 'failed'] },
    }
  });

  if (existingProject) {
    return existingProject;
  }

  const id = newObjectId();
  const projectData = resolveOwnerFields({
    id,
    mongoId: id,
    periodId: toId(topic.periodId),
    ownerType: owner?.ownerType,
    ownerId: owner?.ownerId,
    studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
    groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
    topicId: toId(topic.id),
    supervisorId: toId(supervisorId),
    status: 'assigned',
  });

  const project = await prisma.project.create({
    data: projectData
  });

  await syncMongoMirrorProject(project);

  await logWorkflowEvent({
    entityType: 'Project',
    entityId: project.id,
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

  const periodRecord = await prisma.projectPeriod.findFirst({
    where: { id: toId(incomingPeriodId), isDeleted: false }
  });
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
    selectedGroupId = selectedGroup.id;
    selectedOwnerId = selectedGroup.id;
  }

  const id = newObjectId();
  const payload = resolveOwnerFields(buildTopicPayload({
    topicData,
    period: periodRecord,
    studentId,
    ownerType: incomingOwnerType,
    ownerId: selectedOwnerId,
    groupId: selectedGroupId,
  }));

  const createdTopic = await prisma.projectTopic.create({
    data: {
      id,
      mongoId: id,
      ...payload
    }
  });

  await syncMongoMirrorTopic(createdTopic);

  await logWorkflowEvent({
    entityId: createdTopic.id,
    fromStatus: '',
    toStatus: 'submitted',
    actorId: studentId,
    actorRoles: ['STUDENT'],
    action: 'PROPOSE_TOPIC',
    reason: `De xuat de tai: ${createdTopic.title}`,
  });

  return toPublicTopic(createdTopic);
};

const reviewTopic = async (topicId, action, user, note = '') => {
  const topic = await prisma.projectTopic.findFirst({
    where: { id: toId(topicId), isDeleted: false }
  });
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  const fromStatus = topic.status;
  const roles = user.roles || [];
  const isStaff = roles.some(r => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(r));
  let isAuthorizedLecturer = false;

  if (roles.includes('LECTURER') && user.lecturerId) {
    const period = await prisma.projectPeriod.findFirst({
      where: { id: topic.periodId, isDeleted: false }
    });
    const isCoordinator = period && period.coordinatorLecturerId && toId(period.coordinatorLecturerId) === toId(user.lecturerId);
    const isProposedSupervisor = topic.proposedSupervisorId && toId(topic.proposedSupervisorId) === toId(user.lecturerId);
    const isProposedLecturer = topic.proposedByLecturerId && toId(topic.proposedByLecturerId) === toId(user.lecturerId);

    if (isCoordinator || isProposedSupervisor || isProposedLecturer) {
      isAuthorizedLecturer = true;
    }
  }

  if (!isStaff && !isAuthorizedLecturer) {
    throw { status: 403, message: 'Bạn không có quyền duyệt chuyên môn đề tài này.' };
  }

  let toStatus = '';
  let shouldAutoAssignSupervisor = false;
  const updateData = {};

  if (action === 'approve') {
    shouldAutoAssignSupervisor = Boolean(
      user.lecturerId &&
      topic.proposedSupervisorId &&
      toId(topic.proposedSupervisorId) === toId(user.lecturerId)
    );
    toStatus = shouldAutoAssignSupervisor ? 'assigned' : 'approved';
    updateData.approvedBy = toId(user._id);
    updateData.approvedAt = new Date();
    updateData.approvedByLecturerId = toId(user.lecturerId) || null;
    if (shouldAutoAssignSupervisor) {
      updateData.supervisorId = toId(user.lecturerId);
    }
  } else if (action === 'request-revision') {
    toStatus = 'needs_revision';
  } else if (action === 'reject') {
    toStatus = 'rejected';
  } else {
    throw { status: 400, message: 'Hành động xét duyệt không hợp lệ.' };
  }

  updateData.status = toStatus;

  const updatedTopic = await prisma.projectTopic.update({
    where: { id: topic.id },
    data: updateData
  });

  await syncMongoMirrorTopic(updatedTopic);

  if (shouldAutoAssignSupervisor) {
    await spawnProjectForAssignedTopic(updatedTopic, user.lecturerId, user._id, ['LECTURER']);
  }

  await logWorkflowEvent({
    entityId: updatedTopic.id,
    fromStatus,
    toStatus,
    actorId: user._id,
    actorRoles: isStaff ? ['FACULTY_STAFF'] : ['LECTURER'],
    action: `REVIEW_TOPIC_${action.toUpperCase()}`,
    reason: note || (shouldAutoAssignSupervisor
      ? 'Giảng viên đề xuất đã duyệt và nhận hướng dẫn đề tài'
      : `Xét duyệt đề tài với kết quả [${toStatus}]`),
  });

  try {
    const studentUserIds = await getTopicStudentUserIds(updatedTopic);
    const actionLabel = shouldAutoAssignSupervisor ? 'phê duyệt và nhận hướng dẫn' : action === 'approve' ? 'phê duyệt' : action === 'request-revision' ? 'yêu cầu chỉnh sửa' : 'từ chối';
    const notifyType = action === 'approve' ? 'TOPIC_APPROVED' : action === 'request-revision' ? 'TOPIC_REVISION_REQUESTED' : 'TOPIC_REJECTED';
    
    const reviewerName = user.fullName || 'Giảng viên';
    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: notifyType,
        title: `Đề tài đồ án đã được ${actionLabel}`,
        body: `Đề tài "${updatedTopic.title}" của bạn đã được ${actionLabel} bởi ${reviewerName}.${note ? ` Lý do/Ghi chú: "${note}"` : ''}`,
        entityType: 'ProjectTopic',
        entityId: updatedTopic.id,
        actionUrl: `/dashboard/topics`,
      });
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo xét duyệt đề tài:', notifyErr.message);
  }

  return toPublicTopic(updatedTopic);
};

const assignSupervisor = async (topicId, supervisorId, actorUserId) => {
  const topic = await prisma.projectTopic.findFirst({
    where: { id: toId(topicId), isDeleted: false }
  });
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  if (topic.status !== 'approved') {
    throw { status: 400, message: 'Chỉ đề tài đã được duyệt (status=approved) mới được phép phân công giảng viên hướng dẫn.' };
  }

  const lecturer = await prisma.lecturer.findFirst({
    where: { id: toId(supervisorId), isDeleted: false }
  });
  if (!lecturer) {
    throw { status: 404, message: 'Giảng viên được phân công hướng dẫn không tồn tại.' };
  }

  const fromStatus = topic.status;
  const updatedTopic = await prisma.projectTopic.update({
    where: { id: topic.id },
    data: {
      supervisorId: toId(supervisorId),
      status: 'assigned',
    }
  });

  await syncMongoMirrorTopic(updatedTopic);

  const project = await spawnProjectForAssignedTopic(updatedTopic, supervisorId, actorUserId, ['FACULTY_STAFF']);

  await logWorkflowEvent({
    entityId: updatedTopic.id,
    fromStatus,
    toStatus: 'assigned',
    actorId: actorUserId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'ASSIGN_SUPERVISOR',
    reason: `Phân công giảng viên hướng dẫn ID ${supervisorId} và khởi tạo Workspace đồ án.`,
  });

  try {
    const supervisorLecturer = await prisma.lecturer.findFirst({
      where: { id: toId(supervisorId), isDeleted: false },
      include: { user: true }
    });
    if (supervisorLecturer && supervisorLecturer.user) {
      const supervisorName = supervisorLecturer.user.fullName || 'Giảng viên';
      
      const studentUserIds = await getTopicStudentUserIds(updatedTopic);
      for (const studentUserId of studentUserIds) {
        await notificationsService.createNotification({
          recipientId: studentUserId,
          type: 'SUPERVISOR_ASSIGNED',
          title: 'Đề tài đã được phân công GVHD',
          body: `Đề tài "${updatedTopic.title}" của bạn đã được phân công Giảng viên hướng dẫn: ${supervisorName}.`,
          entityType: 'Project',
          entityId: project.id,
          actionUrl: `/dashboard/projects`,
        });
      }

      await notificationsService.createNotification({
        recipientId: supervisorLecturer.user.id,
        type: 'LECTURER_SUPERVISOR_ASSIGNED',
        title: 'Được phân công hướng dẫn đồ án mới',
        body: `Thầy/cô đã được phân công hướng dẫn đề tài "${updatedTopic.title}" của sinh viên/nhóm.`,
        entityType: 'Project',
        entityId: project.id,
        actionUrl: `/dashboard/projects`,
      });
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo phân công GVHD:', notifyErr.message);
  }

  return toPublicTopic(updatedTopic);
};

const populateTopics = async (topics) => {
  if (!topics || topics.length === 0) return [];

  const groupIds = Array.from(new Set(topics.map(t => toId(t.groupId)).filter(Boolean)));
  const studentIds = Array.from(new Set(
    topics.flatMap(t => [toId(t.studentId), toId(t.proposedByStudentId)]).filter(Boolean)
  ));
  const lecturerIds = Array.from(new Set(
    topics.flatMap(t => [toId(t.proposedSupervisorId), toId(t.supervisorId), toId(t.approvedByLecturerId), toId(t.proposedByLecturerId)]).filter(Boolean)
  ));

  const groups = await prisma.projectGroup.findMany({
    where: { id: { in: groupIds } },
    select: { id: true, name: true, status: true, members: true }
  });
  const groupMap = new Map(groups.map(g => [g.id, { ...g, _id: g.id }]));

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, status: true }
      }
    }
  });
  const studentMap = new Map(students.map(s => [s.id, {
    ...s,
    _id: s.id,
    userId: s.user ? { ...s.user, _id: s.user.id } : null
  }]));

  const lecturers = await prisma.lecturer.findMany({
    where: { id: { in: lecturerIds } },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, status: true }
      }
    }
  });
  const lecturerMap = new Map(lecturers.map(l => [l.id, {
    ...l,
    _id: l.id,
    userId: l.user ? { ...l.user, _id: l.user.id } : null
  }]));

  return topics.map(t => {
    const populated = {
      ...t,
      _id: t.id,
      groupId: t.groupId ? groupMap.get(toId(t.groupId)) || null : null,
      studentId: t.studentId ? studentMap.get(toId(t.studentId)) || null : null,
      proposedByStudentId: t.proposedByStudentId ? studentMap.get(toId(t.proposedByStudentId)) || null : null,
      proposedSupervisorId: t.proposedSupervisorId ? lecturerMap.get(toId(t.proposedSupervisorId)) || null : null,
      supervisorId: t.supervisorId ? lecturerMap.get(toId(t.supervisorId)) || null : null,
    };
    return populated;
  });
};

const populateTopic = async (topic) => {
  if (!topic) return null;
  const populated = await populateTopics([topic]);
  return populated[0];
};

const getTopicsByPeriod = async (periodId) => {
  const where = { isDeleted: false };
  if (periodId) {
    where.periodId = toId(periodId);
  }
  const topics = await prisma.projectTopic.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return await populateTopics(topics);
};

const getTopicById = async (id) => {
  const topic = await prisma.projectTopic.findFirst({
    where: { id: toId(id), isDeleted: false },
  });
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }
  return await populateTopic(topic);
};

const updateTopic = async (topicId, topicData, studentId) => {
  const topic = await prisma.projectTopic.findFirst({
    where: { id: toId(topicId), isDeleted: false }
  });
  if (!topic) {
    throw { status: 404, message: 'Đề tài không tồn tại.' };
  }

  if (toId(topic.proposedByStudentId) !== toId(studentId)) {
    throw { status: 403, message: 'Chỉ sinh viên đề xuất mới có quyền chỉnh sửa đề tài.' };
  }

  if (topic.status !== 'needs_revision' && topic.status !== 'draft') {
    throw { status: 400, message: 'Chỉ có thể chỉnh sửa đề tài khi có yêu cầu chỉnh sửa từ Giáo vụ.' };
  }

  const updateData = {};
  if (topicData.title) updateData.title = topicData.title.trim();
  if (topicData.summary) updateData.summary = topicData.summary.trim();
  if (topicData.objectives) updateData.objectives = topicData.objectives.trim();
  if (topicData.scope) updateData.scope = topicData.scope.trim();
  if (topicData.technologies) updateData.technologies = topicData.technologies;
  if (topicData.expectedResult) updateData.expectedResult = topicData.expectedResult.trim();
  if (topicData.plan) updateData.plan = topicData.plan.trim();
  if (topicData.proposedSupervisorId) updateData.proposedSupervisorId = toId(topicData.proposedSupervisorId);
  if (topicData.academicUnit) updateData.academicUnit = topicData.academicUnit;
  if (topicData.topicDomain) updateData.topicDomain = topicData.topicDomain;

  updateData.status = 'submitted';
  updateData.version = topic.version + 1;

  const updatedTopic = await prisma.projectTopic.update({
    where: { id: topic.id },
    data: updateData
  });

  await syncMongoMirrorTopic(updatedTopic);

  await logWorkflowEvent({
    entityId: updatedTopic.id,
    fromStatus: 'needs_revision',
    toStatus: 'submitted',
    actorId: studentId,
    actorRoles: ['STUDENT'],
    action: 'RESUBMIT_TOPIC',
    reason: `Cập nhật và nộp lại đề tài sau chỉnh sửa: ${updatedTopic.title}`,
  });

  return toPublicTopic(updatedTopic);
};

const cancelTopic = async (topicId, actorUserId, actorRoles = ['FACULTY_STAFF']) => {
  const topic = await prisma.projectTopic.findFirst({
    where: { id: toId(topicId), isDeleted: false }
  });
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  if (topic.status === 'completed') {
    throw { status: 400, message: 'Không thể hủy đề tài đã hoàn thành.' };
  }

  const projects = await prisma.project.findMany({
    where: { topicId: topic.id, isDeleted: false }
  });

  for (const project of projects) {
    const fromStatus = project.status;
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        status: 'cancelled',
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: toId(actorUserId),
      }
    });

    await syncMongoMirrorProject(updatedProject);

    await logWorkflowEvent({
      entityType: 'Project',
      entityId: project.id,
      fromStatus,
      toStatus: 'cancelled',
      actorId: actorUserId,
      actorRoles,
      action: 'CANCEL_PROJECT_BY_TOPIC_CANCEL',
      reason: `Hủy dự án liên kết khi hủy đề tài ${topic.title}`,
    });
  }

  const group = await prisma.projectGroup.findFirst({
    where: { id: toId(topic.groupId), isDeleted: false }
  });
  if (group && group.status === 'locked') {
    const fromStatus = group.status;
    const updatedGroup = await prisma.projectGroup.update({
      where: { id: group.id },
      data: { status: 'confirmed' }
    });

    await ProjectGroupMirror.updateOne(
      { _id: group.id },
      { $set: { status: 'confirmed' } }
    );

    await logWorkflowEvent({
      entityType: 'ProjectGroup',
      entityId: group.id,
      fromStatus,
      toStatus: 'confirmed',
      actorId: actorUserId,
      actorRoles,
      action: 'UNLOCK_GROUP_BY_TOPIC_CANCEL',
      reason: `Mở khóa nhóm sau khi hủy đề tài ${topic.title}`,
    });
  }

  const fromStatus = topic.status;
  const updatedTopic = await prisma.projectTopic.update({
    where: { id: topic.id },
    data: {
      status: 'cancelled',
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: toId(actorUserId),
    }
  });

  await syncMongoMirrorTopic(updatedTopic);

  await logWorkflowEvent({
    entityId: updatedTopic.id,
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
  const period = await prisma.projectPeriod.findFirst({
    where: { id: toId(periodId), isDeleted: false }
  });
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

  const id = newObjectId();
  const payload = resolveOwnerFields({
    id,
    mongoId: id,
    periodId: toId(periodId),
    createdByRole: 'lecturer',
    createdByUserId: toId(userId),
    proposedByLecturerId: toId(lecturerId),
    supervisorId: toId(lecturerId),
    proposedSupervisorId: toId(lecturerId),
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
    minGroupSize: topicData.minGroupSize !== undefined ? parseInt(topicData.minGroupSize, 10) : null,
    maxGroupSize: topicData.maxGroupSize !== undefined ? parseInt(topicData.maxGroupSize, 10) : null,
    allowedOwnerTypes: topicData.allowedOwnerTypes || ['student', 'group'],
    allowIndividual: topicData.allowIndividual !== undefined ? topicData.allowIndividual : period.allowIndividual,
    allowGroup: topicData.allowGroup !== undefined ? topicData.allowGroup : period.allowGroup,
    departmentId: toId(period.departmentId),
    status: 'approved',
  });

  const topic = await prisma.projectTopic.create({
    data: payload
  });

  await syncMongoMirrorTopic(topic);

  await logWorkflowEvent({
    entityId: topic.id,
    fromStatus: '',
    toStatus: 'approved',
    actorId: userId,
    actorRoles: ['LECTURER'],
    action: 'CREATE_LECTURER_TOPIC',
    reason: `Giảng viên đề xuất đề tài: ${topic.title}`,
  });

  return toPublicTopic(topic);
};

const registerExistingTopic = async (topicId, registerData, studentId, actorUserId) => {
  const topic = await prisma.projectTopic.findFirst({
    where: { id: toId(topicId), isDeleted: false }
  });
  if (!topic) {
    throw { status: 404, message: 'Đề tài không tồn tại.' };
  }

  if (topic.status !== 'published') {
    throw { status: 400, message: 'Chỉ đề tài đã công khai mới cho phép đăng ký.' };
  }

  const period = await prisma.projectPeriod.findFirst({
    where: { id: topic.periodId, isDeleted: false }
  });
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
    const allowInd = topic.allowIndividual !== null ? topic.allowIndividual : period.allowIndividual;
    if (allowInd === false) {
      throw { status: 400, message: 'Đề tài hoặc học phần không cho phép đăng ký cá nhân.' };
    }
    await assertStudentTopicOwnerAvailable(topic.periodId, studentId);
  } else {
    if (!getTopicAllowedOwnerTypes(topic).includes('group')) {
      throw { status: 400, message: 'De tai nay khong cho phep dang ky theo nhom.' };
    }
    const allowGrp = topic.allowGroup !== null ? topic.allowGroup : period.allowGroup;
    if (allowGrp === false) {
      throw { status: 400, message: 'Đề tài hoặc học phần không cho phép đăng ký theo nhóm.' };
    }
    const group = await resolveGroupTopicOwner(topic.periodId, registerData.groupId, studentId, period, topic);
    targetGroupId = group.id;
    targetOwnerId = group.id;
  }

  if (ownerType === 'student') {
    if (topic.currentStudentCount >= topic.capacityMaxStudents) {
      throw { status: 400, message: 'Đề tài đã đầy số lượng đăng ký tối đa.' };
    }
  } else {
    if (topic.currentGroupCount >= topic.capacityMaxGroups) {
      throw { status: 400, message: 'Đề tài đã đầy số lượng nhóm đăng ký tối đa.' };
    }
  }

  let updatedCurrentStudentCount = topic.currentStudentCount;
  let updatedCurrentGroupCount = topic.currentGroupCount;

  if (ownerType === 'student') {
    updatedCurrentStudentCount += 1;
  } else {
    updatedCurrentGroupCount += 1;
    const group = await prisma.projectGroup.findFirst({
      where: { id: toId(targetGroupId), isDeleted: false }
    });
    const acceptedCount = (group.members || []).filter(m => m.status === 'accepted').length;
    updatedCurrentStudentCount += acceptedCount;
  }

  let toStatus = topic.status;
  const isStudentFull = updatedCurrentStudentCount >= topic.capacityMaxStudents;
  const isGroupFull = updatedCurrentGroupCount >= topic.capacityMaxGroups;
  if (isStudentFull || isGroupFull) {
    toStatus = 'assigned';
  }

  const updatedOriginalTopic = await prisma.projectTopic.update({
    where: { id: topic.id },
    data: {
      currentStudentCount: updatedCurrentStudentCount,
      currentGroupCount: updatedCurrentGroupCount,
      status: toStatus
    }
  });

  await syncMongoMirrorTopic(updatedOriginalTopic);

  const registeredTopicId = newObjectId();
  const registeredTopicPayload = resolveOwnerFields({
    id: registeredTopicId,
    mongoId: registeredTopicId,
    periodId: toId(topic.periodId),
    ownerType,
    ownerId: toId(targetOwnerId),
    studentId: ownerType === 'student' ? toId(targetOwnerId) : undefined,
    groupId: ownerType === 'group' ? toId(targetGroupId) : undefined,
    createdByRole: topic.createdByRole,
    createdByUserId: toId(topic.createdByUserId),
    proposedByStudentId: toId(topic.proposedByStudentId),
    proposedByLecturerId: toId(topic.proposedByLecturerId),
    approvedByLecturerId: toId(topic.approvedByLecturerId),
    capacityMaxStudents: topic.capacityMaxStudents,
    capacityMaxGroups: topic.capacityMaxGroups,
    currentStudentCount: updatedCurrentStudentCount,
    currentGroupCount: updatedCurrentGroupCount,
    allowedOwnerTypes: topic.allowedOwnerTypes,
    allowIndividual: topic.allowIndividual,
    allowGroup: topic.allowGroup,
    minGroupSize: topic.minGroupSize,
    maxGroupSize: topic.maxGroupSize,
    publishedByStaffId: toId(topic.publishedByStaffId),
    publishedAt: topic.publishedAt,
    title: topic.title,
    summary: topic.summary,
    objectives: topic.objectives,
    scope: topic.scope,
    technologies: topic.technologies,
    expectedResult: topic.expectedResult,
    plan: topic.plan,
    keywords: topic.keywords,
    academicUnit: topic.academicUnit,
    topicDomain: topic.topicDomain,
    supervisorId: toId(topic.supervisorId),
    proposedSupervisorId: toId(topic.proposedSupervisorId),
    departmentId: toId(topic.departmentId),
    status: 'assigned',
    rejectionReason: topic.rejectionReason,
    approvedBy: toId(topic.approvedBy),
    approvedAt: topic.approvedAt,
    version: topic.version,
    isDeleted: topic.isDeleted,
    deletedAt: topic.deletedAt,
    deletedBy: toId(topic.deletedBy),
  });

  const registeredTopic = await prisma.projectTopic.create({
    data: registeredTopicPayload
  });

  await syncMongoMirrorTopic(registeredTopic);

  if (ownerType === 'group') {
    const group = await prisma.projectGroup.findFirst({
      where: { id: toId(targetGroupId), isDeleted: false }
    });
    if (group) {
      await prisma.projectGroup.update({
        where: { id: group.id },
        data: { status: 'locked' }
      });
      await ProjectGroupMirror.updateOne(
        { _id: group.id },
        { $set: { status: 'locked' } }
      );
    }
  }

  const projectId = newObjectId();
  const projectPayload = resolveOwnerFields({
    id: projectId,
    mongoId: projectId,
    periodId: toId(topic.periodId),
    ownerType,
    ownerId: toId(targetOwnerId),
    studentId: ownerType === 'student' ? toId(targetOwnerId) : undefined,
    groupId: ownerType === 'group' ? toId(targetGroupId) : undefined,
    topicId: registeredTopic.id,
    supervisorId: toId(topic.supervisorId || topic.proposedSupervisorId),
    status: 'assigned',
  });

  const project = await prisma.project.create({
    data: projectPayload
  });

  await syncMongoMirrorProject(project);

  await logWorkflowEvent({
    entityId: registeredTopic.id,
    fromStatus: '',
    toStatus: 'assigned',
    actorId: actorUserId,
    actorRoles: ['STUDENT'],
    action: 'REGISTER_TOPIC',
    reason: `Đăng ký thành công đề tài: ${topic.title}`,
  });

  await logWorkflowEvent({
    entityType: 'Project',
    entityId: project.id,
    fromStatus: '',
    toStatus: 'assigned',
    actorId: actorUserId,
    actorRoles: ['STUDENT'],
    action: 'SPAWN_PROJECT_BY_REGISTRATION',
    reason: 'Khởi tạo Workspace từ đăng ký đề tài',
  });

  return toPublicTopic(registeredTopic);
};

const publishTopic = async (topicId, actorUserId) => {
  const topic = await prisma.projectTopic.findFirst({
    where: { id: toId(topicId), isDeleted: false }
  });
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  if (topic.status !== 'approved') {
    throw { status: 400, message: 'Chỉ đề tài đã được duyệt chuyên môn mới được phép công khai.' };
  }

  const fromStatus = topic.status;
  const updatedTopic = await prisma.projectTopic.update({
    where: { id: topic.id },
    data: {
      status: 'published',
      publishedByStaffId: toId(actorUserId),
      publishedAt: new Date(),
    }
  });

  await syncMongoMirrorTopic(updatedTopic);

  await logWorkflowEvent({
    entityId: updatedTopic.id,
    fromStatus,
    toStatus: 'published',
    actorId: actorUserId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'PUBLISH_TOPIC',
    reason: `Công khai đề tài: ${topic.title}`,
  });

  return toPublicTopic(updatedTopic);
};

const unpublishTopic = async (topicId, actorUserId) => {
  const topic = await prisma.projectTopic.findFirst({
    where: { id: toId(topicId), isDeleted: false }
  });
  if (!topic) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  if (topic.status !== 'published') {
    throw { status: 400, message: 'Chỉ đề tài đang công khai mới được gỡ.' };
  }

  const fromStatus = topic.status;
  const updatedTopic = await prisma.projectTopic.update({
    where: { id: topic.id },
    data: {
      status: 'approved',
      publishedByStaffId: null,
      publishedAt: null,
    }
  });

  await syncMongoMirrorTopic(updatedTopic);

  await logWorkflowEvent({
    entityId: updatedTopic.id,
    fromStatus,
    toStatus: 'approved',
    actorId: actorUserId,
    actorRoles: ['FACULTY_STAFF'],
    action: 'UNPUBLISH_TOPIC',
    reason: `Gỡ công khai đề tài: ${topic.title}`,
  });

  return toPublicTopic(updatedTopic);
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
