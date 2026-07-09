const { randomBytes } = require('crypto');
const notificationsService = require('../notifications/notifications.service');
const { assertOwnerAccess, resolveProjectOwner } = require('../../utils/project-owner');
const prisma = require('../../config/prisma');

const isStaff = (user = {}) => (user.roles || []).some((role) => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(role));

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const getRequestStudentUserIds = async (request) => {
  const userIds = [];
  if (request.studentId) {
    const student = await prisma.student.findFirst({
      where: { id: request.studentId.toString(), isDeleted: false }
    });
    if (student && student.userId) {
      userIds.push(student.userId);
    }
  } else if (request.groupId) {
    const group = await prisma.projectGroup.findUnique({
      where: { id: request.groupId.toString() }
    });
    if (group && !group.isDeleted) {
      const members = Array.isArray(group.members) ? group.members : [];
      const acceptedMembers = members.filter(m => m?.status === 'accepted');
      const studentIds = acceptedMembers.map(m => m.studentId).filter(Boolean);

      const students = await prisma.student.findMany({
        where: {
          id: { in: studentIds },
          isDeleted: false
        },
        select: { userId: true }
      });
      userIds.push(...students.map(s => s.userId));
    }
  }
  return userIds;
};

const logWorkflowEvent = async ({
  entityType = 'TopicChangeRequest',
  entityId,
  fromStatus = '',
  toStatus,
  actorId,
  actorRoles = [],
  action,
  reason = '',
  metadata = {},
}) => {
  const id = randomBytes(12).toString('hex');
  return await prisma.workflowEvent.create({
    data: {
      id,
      mongoId: id,
      entityType,
      entityId: entityId.toString(),
      fromStatus,
      toStatus,
      actorId: actorId.toString(),
      actorRoles,
      action,
      reason,
      metadata,
    }
  });
};

const ensureVisible = async (request, user = {}) => {
  if (isStaff(user)) return;

  if ((user.roles || []).includes('STUDENT') && user.studentId) {
    await assertOwnerAccess(request.topicId || request, user);
    return;
  }

  if ((user.roles || []).includes('LECTURER') && user.lecturerId) {
    const topicId = request.topicId?._id || request.topicId?.id || request.topicId;
    const project = await prisma.project.findFirst({
      where: { topicId: topicId.toString() }
    });
    if (project && project.supervisorId === user.lecturerId.toString()) return;
  }

  throw { status: 403, message: 'Bạn không có quyền xem đơn đổi đề tài này.' };
};

// ─── SERVICES ────────────────────────────────────────────────────────────────

const createChangeRequest = async (topicId, data, user) => {
  if (!user.studentId) {
    throw { status: 403, message: 'Chỉ sinh viên mới được tạo đơn đổi đề tài.' };
  }

  const topic = await prisma.projectTopic.findUnique({
    where: { id: topicId.toString() }
  });
  if (!topic || topic.isDeleted) {
    throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };
  }

  await assertOwnerAccess(topic, user);

  const project = await prisma.project.findFirst({
    where: { topicId: topic.id, NOT: { status: 'cancelled' } }
  });
  if (!project) {
    throw { status: 400, message: 'Đề tài chưa có dự án đang hoạt động để xin đổi.' };
  }

  const period = await prisma.projectPeriod.findUnique({
    where: { id: topic.periodId }
  });
  if (!period || period.isDeleted) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  if (period.topicChangeDeadline && new Date() > new Date(period.topicChangeDeadline)) {
    throw { status: 400, message: 'Đã quá hạn đổi đề tài của đợt đồ án này.' };
  }

  const existing = await prisma.topicChangeRequest.findFirst({
    where: { topicId: topic.id, status: 'pending' }
  });
  if (existing) {
    throw { status: 400, message: 'Đề tài đang có một đơn đổi đề tài chờ xử lý.' };
  }

  const owner = resolveProjectOwner(topic);
  const newId = randomBytes(12).toString('hex');
  const now = new Date();

  const request = await prisma.topicChangeRequest.create({
    data: {
      id: newId,
      mongoId: newId,
      topicId: topic.id,
      ownerType: owner?.ownerType || null,
      ownerId: owner?.ownerId ? owner.ownerId.toString() : null,
      studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId)?.toString() : null,
      groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId)?.toString() : null,
      oldTitle: topic.title,
      newTitle: data.newTitle.trim(),
      newScope: data.newScope.trim(),
      newPlan: data.newPlan.trim(),
      reason: data.reason.trim(),
      status: 'pending',
      requestedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });

  const requestWithMongoProps = {
    ...request,
    _id: request.id
  };

  await logWorkflowEvent({
    entityId: request.id,
    toStatus: 'pending',
    actorId: user._id,
    actorRoles: ['STUDENT'],
    action: 'CREATE_TOPIC_CHANGE_REQUEST',
    reason: request.reason,
    metadata: { topicId: topic.id, groupId: topic.groupId },
  });

  try {
    if (project.supervisorId) {
      const lecturer = await prisma.lecturer.findFirst({
        where: { id: project.supervisorId, isDeleted: false }
      });
      const lecturerUser = lecturer ? await prisma.user.findUnique({ where: { id: lecturer.userId } }) : null;
      if (lecturerUser) {
        const studentName = user.fullName || user.email;
        await notificationsService.createNotification({
          recipientId: lecturerUser.id,
          type: 'TOPIC_CHANGE_REQUEST_SUBMITTED',
          title: 'Yêu cầu đổi đề tài mới',
          body: `Sinh viên ${studentName} đã gửi đơn xin đổi tên đề tài từ "${request.oldTitle}" thành "${request.newTitle}".`,
          entityType: 'TopicChangeRequest',
          entityId: request.id,
          actionUrl: `/dashboard/topic-changes`,
        });
      }
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo gửi đơn đổi đề tài:', notifyErr.message);
  }

  return requestWithMongoProps;
};

const getRequests = async (queryParams = {}, user = {}) => {
  const { topicId, status = '', page = 1, limit = 10 } = queryParams;
  const where = {};

  if (topicId) where.topicId = topicId.toString();
  if (status) where.status = status;

  if (!isStaff(user)) {
    if ((user.roles || []).includes('STUDENT') && user.studentId) {
      const groups = await prisma.projectGroup.findMany({
        where: { isDeleted: false }
      });
      const userGroupIds = groups.filter(g => {
        const members = Array.isArray(g.members) ? g.members : [];
        return members.some(m => m?.studentId === user.studentId.toString() && m.status === 'accepted');
      }).map(g => g.id);

      where.OR = [
        { studentId: user.studentId.toString() },
        { groupId: { in: userGroupIds } }
      ];
    } else if ((user.roles || []).includes('LECTURER') && user.lecturerId) {
      const projects = await prisma.project.findMany({
        where: { supervisorId: user.lecturerId.toString() },
        select: { topicId: true }
      });
      const topicIds = projects.map(p => p.topicId);
      where.topicId = { in: topicIds };
    } else {
      where.id = 'non_existent_id';
    }
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const take = Number(limit);

  const [requests, total] = await Promise.all([
    prisma.topicChangeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.topicChangeRequest.count({ where })
  ]);

  const mappedRequests = [];
  for (const req of requests) {
    let topicPopulated = null;
    if (req.topicId) {
      const topic = await prisma.projectTopic.findUnique({ where: { id: req.topicId } });
      if (topic) {
        topicPopulated = {
          ...topic,
          _id: topic.id
        };
      }
    }

    let groupPopulated = null;
    if (req.groupId) {
      const group = await prisma.projectGroup.findUnique({
        where: { id: req.groupId },
        select: { id: true, name: true, members: true }
      });
      if (group) {
        groupPopulated = {
          _id: group.id,
          id: group.id,
          name: group.name,
          members: group.members
        };
      }
    }

    mappedRequests.push({
      ...req,
      _id: req.id,
      topicId: topicPopulated,
      groupId: groupPopulated
    });
  }

  return {
    requests: mappedRequests,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    limit: Number(limit),
  };
};

const getRequestById = async (id, user = {}) => {
  const req = await prisma.topicChangeRequest.findUnique({
    where: { id: id.toString() }
  });
  if (!req) {
    throw { status: 404, message: 'Đơn đổi đề tài không tồn tại.' };
  }

  let topicPopulated = null;
  if (req.topicId) {
    const topic = await prisma.projectTopic.findUnique({ where: { id: req.topicId } });
    if (topic) {
      topicPopulated = {
        ...topic,
        _id: topic.id
      };
    }
  }

  let groupPopulated = null;
  if (req.groupId) {
    const group = await prisma.projectGroup.findUnique({
      where: { id: req.groupId },
      select: { id: true, name: true, members: true }
    });
    if (group) {
      groupPopulated = {
        _id: group.id,
        id: group.id,
        name: group.name,
        members: group.members
      };
    }
  }

  const requestWithMongoProps = {
    ...req,
    _id: req.id,
    topicId: topicPopulated,
    groupId: groupPopulated
  };

  await ensureVisible(requestWithMongoProps, user);
  return requestWithMongoProps;
};

const supervisorReview = async (id, decision, note, user) => {
  if (!user.lecturerId) {
    throw { status: 403, message: 'Chỉ GVHD mới được cho ý kiến đơn đổi đề tài.' };
  }

  const pgReq = await prisma.topicChangeRequest.findUnique({
    where: { id: id.toString() }
  });
  if (!pgReq) {
    throw { status: 404, message: 'Đơn đổi đề tài không tồn tại.' };
  }
  if (pgReq.status !== 'pending') {
    throw { status: 400, message: 'Chỉ xử lý được đơn đổi đề tài đang chờ duyệt.' };
  }

  const project = await prisma.project.findFirst({
    where: { topicId: pgReq.topicId }
  });
  if (!project || project.supervisorId !== user.lecturerId.toString()) {
    throw { status: 403, message: 'Bạn không phải GVHD của đề tài này.' };
  }

  const supervisorApproval = {
    status: decision,
    by: user._id.toString(),
    at: new Date().toISOString(),
    note: note.trim(),
  };

  const updated = await prisma.topicChangeRequest.update({
    where: { id: id.toString() },
    data: {
      supervisorApproval,
      updatedAt: new Date()
    }
  });

  const requestWithMongoProps = {
    ...updated,
    _id: updated.id
  };

  await logWorkflowEvent({
    entityId: id,
    fromStatus: 'pending',
    toStatus: 'pending',
    actorId: user._id,
    actorRoles: ['LECTURER', 'SUPERVISOR'],
    action: decision === 'approved' ? 'SUPERVISOR_APPROVE_TOPIC_CHANGE' : 'SUPERVISOR_REJECT_TOPIC_CHANGE',
    reason: note.trim(),
  });

  try {
    const studentUserIds = await getRequestStudentUserIds(updated);
    const statusLabel = decision === 'approved' ? 'đồng ý' : 'từ chối';

    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: decision === 'approved' ? 'TOPIC_CHANGE_SUPERVISOR_APPROVED' : 'TOPIC_CHANGE_SUPERVISOR_REJECTED',
        title: `GVHD ${statusLabel} đơn đổi đề tài`,
        body: `Giảng viên hướng dẫn đã ${statusLabel} đơn xin đổi đề tài của bạn. Lý do: "${note.trim()}".`,
        entityType: 'TopicChangeRequest',
        entityId: id,
        actionUrl: `/dashboard/topic-changes`,
      });
    }

    if (decision === 'approved') {
      const staffUsers = await prisma.user.findMany({
        where: {
          roles: { hasSome: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] },
          isDeleted: false,
          status: 'active'
        }
      });
      for (const staff of staffUsers) {
        await notificationsService.createNotification({
          recipientId: staff.id,
          type: 'TOPIC_CHANGE_PENDING_FACULTY',
          title: 'Đơn đổi đề tài chờ Khoa duyệt',
          body: `Yêu cầu đổi đề tài sang "${pgReq.newTitle}" đã được GVHD thông qua và đang chờ duyệt cấp Khoa.`,
          entityType: 'TopicChangeRequest',
          entityId: id,
          actionUrl: `/dashboard/topic-changes`,
        });
      }
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo GVHD duyệt đơn đổi đề tài:', notifyErr.message);
  }

  return requestWithMongoProps;
};

const facultyReview = async (id, decision, note, user) => {
  const pgReq = await prisma.topicChangeRequest.findUnique({
    where: { id: id.toString() }
  });
  if (!pgReq) {
    throw { status: 404, message: 'Đơn đổi đề tài không tồn tại.' };
  }
  if (pgReq.status !== 'pending') {
    throw { status: 400, message: 'Chỉ xử lý được đơn đổi đề tài đang chờ duyệt.' };
  }

  const supervisorApprovalStatus = (pgReq.supervisorApproval || {}).status || 'pending';
  if (supervisorApprovalStatus === 'pending') {
    throw { status: 400, message: 'GVHD cần cho ý kiến trước khi khoa/bộ môn duyệt.' };
  }

  const topic = await prisma.projectTopic.findUnique({
    where: { id: pgReq.topicId }
  });
  if (!topic || topic.isDeleted) {
    throw { status: 404, message: 'Đề tài liên kết không tồn tại.' };
  }

  const fromStatus = pgReq.status;
  const facultyApproval = {
    status: decision,
    by: user._id.toString(),
    at: new Date().toISOString(),
    note: note.trim(),
  };

  const updated = await prisma.topicChangeRequest.update({
    where: { id: id.toString() },
    data: {
      facultyApproval,
      status: decision,
      updatedAt: new Date()
    }
  });

  const requestWithMongoProps = {
    ...updated,
    _id: updated.id
  };

  if (decision === 'approved') {
    const oldTopicStatus = topic.status;
    const oldTitle = topic.title;
    const oldScope = topic.scope;
    const oldPlan = topic.plan;

    const nextVersion = (topic.version || 1) + 1;
    await prisma.projectTopic.update({
      where: { id: topic.id },
      data: {
        title: pgReq.newTitle,
        scope: pgReq.newScope,
        plan: pgReq.newPlan,
        status: 'changed',
        version: nextVersion
      }
    });

    const project = await prisma.project.findFirst({
      where: { topicId: topic.id }
    });
    if (project) {
      await prisma.project.update({
        where: { id: project.id },
        data: { version: (project.version || 1) + 1 }
      });
    }



    await logWorkflowEvent({
      entityType: 'ProjectTopic',
      entityId: topic.id,
      fromStatus: oldTopicStatus,
      toStatus: 'changed',
      actorId: user._id,
      actorRoles: user.roles || [],
      action: 'APPLY_TOPIC_CHANGE',
      reason: note.trim(),
      metadata: {
        requestId: id,
        oldTitle,
        oldScope,
        oldPlan,
        newTitle: pgReq.newTitle,
        newScope: pgReq.newScope,
        newPlan: pgReq.newPlan,
        version: nextVersion,
      },
    });
  }

  await logWorkflowEvent({
    entityId: id,
    fromStatus,
    toStatus: decision,
    actorId: user._id,
    actorRoles: user.roles || [],
    action: decision === 'approved' ? 'FACULTY_APPROVE_TOPIC_CHANGE' : 'FACULTY_REJECT_TOPIC_CHANGE',
    reason: note.trim(),
    metadata: { topicId: pgReq.topicId },
  });

  try {
    const studentUserIds = await getRequestStudentUserIds(updated);
    const statusLabel = decision === 'approved' ? 'phê duyệt' : 'từ chối';

    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: decision === 'approved' ? 'TOPIC_CHANGE_FACULTY_APPROVED' : 'TOPIC_CHANGE_FACULTY_REJECTED',
        title: `Khoa đã ${statusLabel} đơn đổi đề tài`,
        body: `Yêu cầu đổi đề tài của bạn đã được Khoa ${statusLabel}. ${decision === 'approved' ? 'Tên đề tài mới đã chính thức được áp dụng.' : `Lý do: "${note.trim()}".`}`,
        entityType: 'TopicChangeRequest',
        entityId: id,
        actionUrl: `/dashboard/topic-changes`,
      });
    }

    const project = await prisma.project.findFirst({
      where: { topicId: pgReq.topicId }
    });
    if (project && project.supervisorId) {
      const lecturer = await prisma.lecturer.findFirst({
        where: { id: project.supervisorId, isDeleted: false }
      });
      const lecturerUser = lecturer ? await prisma.user.findUnique({ where: { id: lecturer.userId } }) : null;
      if (lecturerUser) {
        await notificationsService.createNotification({
          recipientId: lecturerUser.id,
          type: decision === 'approved' ? 'TOPIC_CHANGE_FACULTY_APPROVED_SUPERVISOR' : 'TOPIC_CHANGE_FACULTY_REJECTED_SUPERVISOR',
          title: `Khoa đã ${statusLabel} đơn đổi đề tài của sinh viên`,
          body: `Đơn xin đổi đề tài của sinh viên do thầy/cô hướng dẫn đã được Khoa ${statusLabel}.`,
          entityType: 'TopicChangeRequest',
          entityId: id,
          actionUrl: `/dashboard/topic-changes`,
        });
      }
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo Khoa duyệt đơn đổi đề tài:', notifyErr.message);
  }

  return requestWithMongoProps;
};

const cancelRequest = async (id, user = {}) => {
  const pgReq = await prisma.topicChangeRequest.findUnique({
    where: { id: id.toString() }
  });
  if (!pgReq) {
    throw { status: 404, message: 'Đơn đổi đề tài không tồn tại.' };
  }
  if (pgReq.status !== 'pending') {
    throw { status: 400, message: 'Chỉ hủy được đơn đổi đề tài đang chờ xử lý.' };
  }

  if (!isStaff(user)) {
    if (!user.studentId) {
      throw { status: 403, message: 'Bạn không có quyền hủy đơn đổi đề tài này.' };
    }
    await assertOwnerAccess(pgReq, user);
  }

  const updated = await prisma.topicChangeRequest.update({
    where: { id: id.toString() },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy: user._id ? user._id.toString() : null
    }
  });

  const requestWithMongoProps = {
    ...updated,
    _id: updated.id
  };

  await logWorkflowEvent({
    entityId: id,
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'CANCEL_TOPIC_CHANGE_REQUEST',
    reason: 'Hủy đơn đổi đề tài',
  });

  return requestWithMongoProps;
};

module.exports = {
  createChangeRequest,
  getRequests,
  getRequestById,
  supervisorReview,
  facultyReview,
  cancelRequest,
};
