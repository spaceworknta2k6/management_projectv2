const { randomBytes } = require('crypto');
const prisma = require('../../config/prisma');
const notificationsService = require('../notifications/notifications.service');
const { assertOwnerAccess, resolveProjectOwner } = require('../../utils/project-owner');

const isStaff = (user = {}) => (user.roles || []).some((role) => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(role));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getRequestStudentUserIds = async (request) => {
  const userIds = [];
  if (request.studentId) {
    const student = await prisma.student.findFirst({
      where: { id: request.studentId, isDeleted: false }
    });
    if (student && student.userId) userIds.push(student.userId.toString());
  } else if (request.groupId) {
    const group = await prisma.projectGroup.findFirst({
      where: { id: request.groupId, isDeleted: false }
    });
    if (group) {
      const members = group.members || [];
      const studentIds = members.filter(m => m.status === 'accepted' && m.studentId).map(m => m.studentId.toString());
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds }, isDeleted: false }
      });
      for (const s of students) {
        if (s.userId) userIds.push(s.userId.toString());
      }
    }
  }
  return userIds;
};

const logWorkflowEvent = async ({
  entityType = 'ExtensionRequest',
  entityId,
  fromStatus = '',
  toStatus,
  actorId,
  actorRoles = [],
  action,
  reason = '',
  metadata = {},
}) => {
  const WorkflowEvent = require('../../utils/workflow-event');
  return WorkflowEvent.create({ entityType, entityId, fromStatus, toStatus, actorId, actorRoles, action, reason, metadata });
};

// ─── Create extension request ─────────────────────────────────────────────────

const createExtensionRequest = async (requestData, actorUserId, actorStudentId) => {
  const { projectId } = requestData;

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false }
  });
  if (!project) throw { status: 404, message: 'Dự án đồ án không tồn tại.' };

  await assertOwnerAccess(project, { studentId: actorStudentId, roles: ['STUDENT'] });

  const existing = await prisma.extensionRequest.findFirst({
    where: {
      targetType: requestData.targetType,
      targetId: requestData.targetId.toString(),
      status: 'pending',
    },
  });
  if (existing) throw { status: 400, message: 'Đối tượng này đang có một yêu cầu gia hạn chờ xử lý.' };

  const owner = resolveProjectOwner(project);
  const newId = randomBytes(12).toString('hex');
  const now = new Date();

  const data = {
    id: newId,
    mongoId: newId,
    targetType: requestData.targetType,
    targetId: requestData.targetId.toString(),
    projectId: projectId.toString(),
    ownerType: owner?.ownerType || null,
    ownerId: owner?.ownerId ? owner.ownerId.toString() : null,
    studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId)?.toString() : null,
    groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId)?.toString() : null,
    reason: requestData.reason.trim(),
    evidenceFileIds: (requestData.evidenceFileIds || []).map((id) => id.toString()),
    requestedTo: new Date(requestData.requestedTo),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  const created = await prisma.extensionRequest.create({ data });

  await logWorkflowEvent({
    entityId: created.id,
    toStatus: 'pending',
    actorId: actorUserId,
    actorRoles: ['STUDENT'],
    action: 'CREATE_EXTENSION_REQUEST',
    reason: created.reason,
    metadata: {
      projectId,
      groupId: project.groupId,
      targetType: created.targetType,
      targetId: created.targetId,
    },
  });

  return {
    ...created,
    _id: created.id
  };
};

// ─── Supervisor recommend ─────────────────────────────────────────────────────

const supervisorRecommend = async (requestId, status, note, actorUserId, actorLecturerId) => {
  const pgReq = await prisma.extensionRequest.findFirst({ where: { id: requestId } });
  if (!pgReq) throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  if (pgReq.status !== 'pending') throw { status: 400, message: 'Chỉ xử lý được yêu cầu gia hạn đang chờ duyệt.' };

  const project = await prisma.project.findFirst({
    where: { id: pgReq.projectId, isDeleted: false }
  });
  if (!project) throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };

  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép đánh giá khuyến nghị gia hạn.' };
  }

  const newStatus = status === 'rejected' ? 'rejected' : 'pending';
  const supervisorApproval = {
    status,
    by: actorUserId.toString(),
    at: new Date().toISOString(),
    note: note.trim(),
  };

  const updated = await prisma.extensionRequest.update({
    where: { id: requestId },
    data: {
      supervisorApproval,
      status: newStatus,
      updatedAt: new Date(),
    },
  });

  await logWorkflowEvent({
    entityId: requestId,
    fromStatus: pgReq.status,
    toStatus: newStatus,
    actorId: actorUserId,
    actorRoles: ['LECTURER', 'SUPERVISOR'],
    action: status === 'approved' ? 'SUPERVISOR_APPROVE_EXTENSION' : 'SUPERVISOR_REJECT_EXTENSION',
    reason: note.trim(),
  });

  try {
    const studentUserIds = await getRequestStudentUserIds(updated);
    const actionLabel = status === 'approved' ? 'đồng ý' : 'từ chối';
    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: status === 'approved' ? 'EXTENSION_SUPERVISOR_APPROVED' : 'EXTENSION_SUPERVISOR_REJECTED',
        title: `GVHD đã ${actionLabel} yêu cầu gia hạn`,
        body: `Giảng viên hướng dẫn đã ${actionLabel} yêu cầu gia hạn của bạn.${note ? ` Ghi chú: "${note.trim()}"` : ''}`,
        entityType: 'ExtensionRequest',
        entityId: requestId,
        actionUrl: `/dashboard/extensions`,
      });
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo GVHD duyệt đơn gia hạn:', notifyErr.message);
  }

  return {
    ...updated,
    _id: updated.id
  };
};

// ─── Apply approved extension (cập nhật deadline target) ─────────────────────

const applyApprovedExtension = async (request) => {
  if (request.targetType === 'milestone') {
    await prisma.milestone.updateMany({
      where: { id: request.targetId.toString(), isDeleted: false },
      data: { deadline: request.requestedTo },
    });
    return;
  }

  if (request.targetType === 'submission') {
    await prisma.submissionPackage.updateMany({
      where: { id: request.targetId.toString(), isDeleted: false },
      data: { deadline: request.requestedTo },
    });
    return;
  }

  if (request.targetType === 'project') {
    await prisma.project.updateMany({
      where: { id: request.projectId.toString(), isDeleted: false },
      data: { extendedUntil: request.requestedTo },
    });
    return;
  }
};

// ─── Faculty decide ───────────────────────────────────────────────────────────

const facultyDecide = async (requestId, status, note, actorUserId, actorRoles = []) => {
  const pgReq = await prisma.extensionRequest.findFirst({ where: { id: requestId } });
  if (!pgReq) throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  if (pgReq.status !== 'pending') throw { status: 400, message: 'Chỉ xử lý được yêu cầu gia hạn đang chờ duyệt.' };

  const supervisorApprovalStatus = (pgReq.supervisorApproval || {}).status || 'pending';
  if (supervisorApprovalStatus === 'pending') {
    throw { status: 400, message: 'GVHD cần cho ý kiến trước khi giáo vụ/khoa duyệt gia hạn.' };
  }

  const facultyDecision = {
    status,
    by: actorUserId.toString(),
    at: new Date().toISOString(),
    note: note.trim(),
  };

  const updated = await prisma.extensionRequest.update({
    where: { id: requestId },
    data: {
      facultyDecision,
      status,
      updatedAt: new Date(),
    },
  });

  if (status === 'approved') {
    await applyApprovedExtension(updated);
  }

  await logWorkflowEvent({
    entityId: requestId,
    fromStatus: pgReq.status,
    toStatus: status,
    actorId: actorUserId,
    actorRoles,
    action: status === 'approved' ? 'FACULTY_APPROVE_EXTENSION' : 'FACULTY_REJECT_EXTENSION',
    reason: note.trim(),
    metadata: {
      targetType: pgReq.targetType,
      targetId: pgReq.targetId,
      requestedTo: pgReq.requestedTo,
    },
  });

  try {
    const studentUserIds = await getRequestStudentUserIds(updated);
    const actionLabel = status === 'approved' ? 'phê duyệt' : 'từ chối';
    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: status === 'approved' ? 'EXTENSION_FACULTY_APPROVED' : 'EXTENSION_FACULTY_REJECTED',
        title: `Khoa đã ${actionLabel} yêu cầu gia hạn`,
        body: `Đơn xin gia hạn của bạn đã được Khoa ${actionLabel}.${note ? ` Ghi chú: "${note.trim()}"` : ''}`,
        entityType: 'ExtensionRequest',
        entityId: requestId,
        actionUrl: `/dashboard/extensions`,
      });
    }

    const project = await prisma.project.findFirst({
      where: { id: pgReq.projectId }
    });
    if (project && project.supervisorId) {
      const supervisor = await prisma.lecturer.findFirst({
        where: { id: project.supervisorId },
        include: { user: true }
      });
      if (supervisor && supervisor.user) {
        await notificationsService.createNotification({
          recipientId: supervisor.user.id,
          type: status === 'approved' ? 'EXTENSION_FACULTY_APPROVED_SUPERVISOR' : 'EXTENSION_FACULTY_REJECTED_SUPERVISOR',
          title: `Khoa đã ${actionLabel} đơn gia hạn của sinh viên`,
          body: `Yêu cầu gia hạn của đồ án do thầy/cô hướng dẫn đã được Khoa ${actionLabel}.`,
          entityType: 'ExtensionRequest',
          entityId: requestId,
          actionUrl: `/dashboard/extensions`,
        });
      }
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo Khoa duyệt đơn gia hạn:', notifyErr.message);
  }

  return {
    ...updated,
    _id: updated.id
  };
};

// ─── Cancel request ───────────────────────────────────────────────────────────

const cancelRequest = async (requestId, user = {}) => {
  const pgReq = await prisma.extensionRequest.findFirst({ where: { id: requestId } });
  if (!pgReq) throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  if (pgReq.status !== 'pending') throw { status: 400, message: 'Chỉ hủy được yêu cầu gia hạn đang chờ xử lý.' };

  if (!isStaff(user)) {
    if (!user.studentId) throw { status: 403, message: 'Bạn không có quyền hủy yêu cầu gia hạn này.' };
    const project = await prisma.project.findFirst({
      where: { id: pgReq.projectId, isDeleted: false }
    });
    if (project) {
      await assertOwnerAccess(project, user);
    }
  }

  const now = new Date();
  const updated = await prisma.extensionRequest.update({
    where: { id: requestId },
    data: {
      status: 'cancelled',
      cancelledAt: now,
      cancelledBy: user._id ? user._id.toString() : null,
      updatedAt: now,
    },
  });

  await logWorkflowEvent({
    entityId: requestId,
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'CANCEL_EXTENSION_REQUEST',
    reason: 'Hủy yêu cầu gia hạn',
  });

  return {
    ...updated,
    _id: updated.id
  };
};

// ─── Get requests (list) ──────────────────────────────────────────────────────

const getRequests = async (queryParams = {}, actor = {}) => {
  const { search = '', status = '', page = 1, limit = 10 } = queryParams;
  const where = {};

  if (status) where.status = status;

  const roles = actor.roles || [];

  if (roles.includes('STUDENT') && actor.studentId) {
    const activeGroups = await prisma.projectGroup.findMany({
      where: { isDeleted: false }
    });
    const studentGroupIds = activeGroups
      .filter(g => (g.members || []).some(m => m.studentId === actor.studentId.toString() && m.status === 'accepted'))
      .map(g => g.id);

    where.OR = [
      { studentId: actor.studentId.toString() },
      { groupId: { in: studentGroupIds } }
    ];
  } else if (roles.includes('LECTURER') && actor.lecturerId) {
    const projects = await prisma.project.findMany({
      where: { supervisorId: actor.lecturerId.toString(), isDeleted: false },
      select: { id: true }
    });
    where.projectId = { in: projects.map(p => p.id) };
  } else if (!isStaff(actor)) {
    where.id = 'none';
  }

  if (search) {
    const groups = await prisma.projectGroup.findMany({
      where: { name: { contains: search, mode: 'insensitive' }, isDeleted: false },
      select: { id: true }
    });

    const topics = await prisma.projectTopic.findMany({
      where: { title: { contains: search, mode: 'insensitive' }, isDeleted: false },
      select: { id: true }
    });

    const projects = await prisma.project.findMany({
      where: { topicId: { in: topics.map((t) => t.id) }, isDeleted: false },
      select: { id: true }
    });

    const searchFilter = [];
    if (groups.length > 0) searchFilter.push({ groupId: { in: groups.map((g) => g.id) } });
    if (projects.length > 0) searchFilter.push({ projectId: { in: projects.map((p) => p.id) } });

    if (searchFilter.length > 0) {
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchFilter }
        ];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    } else {
      where.id = 'none';
    }
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [requests, total] = await Promise.all([
    prisma.extensionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.extensionRequest.count({ where }),
  ]);

  const mappedRequests = [];
  for (const req of requests) {
    const project = await prisma.project.findFirst({
      where: { id: req.projectId }
    });
    let topic = null;
    let supervisor = null;
    if (project) {
      topic = await prisma.projectTopic.findUnique({
        where: { id: project.topicId },
        select: { title: true }
      });
      supervisor = await prisma.lecturer.findUnique({
        where: { id: project.supervisorId },
        include: { user: { select: { fullName: true, email: true } } }
      });
    }

    const group = req.groupId ? await prisma.projectGroup.findUnique({
      where: { id: req.groupId },
      select: { name: true }
    }) : null;

    mappedRequests.push({
      ...req,
      _id: req.id,
      projectId: project ? {
        ...project,
        _id: project.id,
        topicId: topic ? { ...topic, _id: project.topicId } : null,
        supervisorId: supervisor ? {
          ...supervisor,
          _id: project.supervisorId,
          userId: supervisor.user ? { ...supervisor.user, _id: supervisor.user.id } : null
        } : null
      } : null,
      groupId: group ? { ...group, _id: req.groupId } : null
    });
  }

  return { requests: mappedRequests, total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) };
};

// ─── Get request by ID ────────────────────────────────────────────────────────

const getRequestById = async (id, actor = {}) => {
  const req = await prisma.extensionRequest.findUnique({
    where: { id: id.toString() }
  });
  if (!req) throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };

  const project = await prisma.project.findFirst({
    where: { id: req.projectId }
  });
  let topic = null;
  let supervisor = null;
  if (project) {
    topic = await prisma.projectTopic.findUnique({
      where: { id: project.topicId },
      select: { title: true }
    });
    supervisor = await prisma.lecturer.findUnique({
      where: { id: project.supervisorId },
      include: { user: { select: { fullName: true, email: true } } }
    });
  }

  const group = req.groupId ? await prisma.projectGroup.findUnique({
    where: { id: req.groupId },
    select: { name: true }
  }) : null;

  const requestWithMirrorProps = {
    ...req,
    _id: req.id,
    projectId: project ? {
      ...project,
      _id: project.id,
      topicId: topic ? { ...topic, _id: project.topicId } : null,
      supervisorId: supervisor ? {
        ...supervisor,
        _id: project.supervisorId,
        userId: supervisor.user ? { ...supervisor.user, _id: supervisor.user.id } : null
      } : null
    } : null,
    groupId: group ? { ...group, _id: req.groupId } : null
  };

  const roles = actor.roles || [];
  if (roles.includes('STUDENT') && actor.studentId) {
    await assertOwnerAccess(project, actor);
  } else if (roles.includes('LECTURER') && actor.lecturerId) {
    const supervisorId = requestWithMirrorProps.projectId?.supervisorId?._id || requestWithMirrorProps.projectId?.supervisorId;
    if (!supervisorId || supervisorId.toString() !== actor.lecturerId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền xem yêu cầu gia hạn này.' };
    }
  } else if (!isStaff(actor)) {
    throw { status: 403, message: 'Bạn không có quyền xem yêu cầu gia hạn này.' };
  }

  return requestWithMirrorProps;
};

module.exports = {
  createExtensionRequest,
  supervisorRecommend,
  facultyDecide,
  cancelRequest,
  getRequests,
  getRequestById,
};
