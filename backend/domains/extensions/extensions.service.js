const mongoose = require('mongoose');
const ExtensionRequest = require('../../models/ExtensionRequest');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const Milestone = require('../../models/Milestone');
const SubmissionPackage = require('../../models/SubmissionPackage');
const Student = require('../../models/Student');
const WorkflowEvent = require('../../models/WorkflowEvent');
const { assertOwnerAccess, resolveProjectOwner } = require('../../utils/project-owner');
const notificationsService = require('../notifications/notifications.service');
const prisma = require('../../config/prisma');

const isStaff = (user = {}) => (user.roles || []).some((role) => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(role));

// ─── Mirror helper ────────────────────────────────────────────────────────────

const toDateOrUndefined = (value) => (value ? new Date(value) : undefined);

const toMongoApprovalBlock = (block = {}) => ({
  status: block.status || 'pending',
  by: block.by || undefined,
  at: toDateOrUndefined(block.at),
  note: block.note || undefined,
});

const toMongoExtensionData = (pgReq) => ({
  targetType: pgReq.targetType,
  targetId: pgReq.targetId,
  projectId: pgReq.projectId,
  ownerType: pgReq.ownerType || undefined,
  ownerId: pgReq.ownerId || undefined,
  studentId: pgReq.studentId || undefined,
  groupId: pgReq.groupId || undefined,
  reason: pgReq.reason,
  evidenceFileIds: pgReq.evidenceFileIds || [],
  requestedTo: new Date(pgReq.requestedTo),
  supervisorApproval: toMongoApprovalBlock(pgReq.supervisorApproval),
  facultyDecision: toMongoApprovalBlock(pgReq.facultyDecision),
  status: pgReq.status,
  cancelledAt: toDateOrUndefined(pgReq.cancelledAt),
  cancelledBy: pgReq.cancelledBy || undefined,
  createdAt: pgReq.createdAt,
  updatedAt: pgReq.updatedAt,
});

const syncMongoMirror = async (pgReq) => {
  const filter = { _id: pgReq.mongoId || pgReq.id };
  await ExtensionRequest.findOneAndUpdate(
    filter,
    { $set: toMongoExtensionData(pgReq) },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getRequestStudentUserIds = async (request) => {
  const userIds = [];
  if (request.studentId) {
    const student = await Student.findOne({ _id: request.studentId, isDeleted: false });
    if (student && student.userId) userIds.push(student.userId.toString());
  } else if (request.groupId) {
    const group = await ProjectGroup.findOne({ _id: request.groupId, isDeleted: false })
      .populate({ path: 'members.studentId', match: { isDeleted: false } });
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
}) => WorkflowEvent.create({ entityType, entityId, fromStatus, toStatus, actorId, actorRoles, action, reason, metadata });

const ensureStudentInGroup = async (groupId, studentId) => {
  const group = await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } });
  if (!group || !group.members.some((m) => m.studentId.toString() === studentId.toString() && m.status === 'accepted')) {
    throw { status: 403, message: 'Bạn không thuộc nhóm sinh viên thực hiện dự án này.' };
  }
  return group;
};

// ─── Create extension request ─────────────────────────────────────────────────

const createExtensionRequest = async (requestData, actorUserId, actorStudentId) => {
  const { projectId } = requestData;

  const project = await Project.findById(projectId);
  if (!project) throw { status: 404, message: 'Dự án đồ án không tồn tại.' };

  await assertOwnerAccess(project, { studentId: actorStudentId, roles: ['STUDENT'] });

  // Kiểm tra unique pending trên Postgres
  const existing = await prisma.extensionRequest.findFirst({
    where: {
      targetType: requestData.targetType,
      targetId: requestData.targetId.toString(),
      status: 'pending',
    },
  });
  if (existing) throw { status: 400, message: 'Đối tượng này đang có một yêu cầu gia hạn chờ xử lý.' };

  const owner = resolveProjectOwner(project);
  const newId = new mongoose.Types.ObjectId().toString();
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

  await prisma.extensionRequest.create({ data });

  // Mirror về MongoDB
  const request = await ExtensionRequest.create({
    _id: newId,
    ...data,
    targetId: requestData.targetId,
    projectId,
    ownerId: owner?.ownerId,
    studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
    groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
    evidenceFileIds: requestData.evidenceFileIds || [],
  });

  await logWorkflowEvent({
    entityId: request._id,
    toStatus: 'pending',
    actorId: actorUserId,
    actorRoles: ['STUDENT'],
    action: 'CREATE_EXTENSION_REQUEST',
    reason: request.reason,
    metadata: {
      projectId,
      groupId: project.groupId,
      targetType: request.targetType,
      targetId: request.targetId,
    },
  });

  return request;
};

// ─── Supervisor recommend ─────────────────────────────────────────────────────

const supervisorRecommend = async (requestId, status, note, actorUserId, actorLecturerId) => {
  const pgReq = await prisma.extensionRequest.findFirst({ where: { id: requestId } });
  if (!pgReq) throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  if (pgReq.status !== 'pending') throw { status: 400, message: 'Chỉ xử lý được yêu cầu gia hạn đang chờ duyệt.' };

  const project = await Project.findById(pgReq.projectId);
  if (!project) throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };

  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép đánh giá khuyến nghị gia hạn.' };
  }

  const newStatus = status === 'rejected' ? 'rejected' : 'pending';
  const supervisorApproval = {
    status,
    by: actorUserId.toString(),
    at: new Date(),
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

  await syncMongoMirror(updated);

  const request = await ExtensionRequest.findById(requestId);

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
    const studentUserIds = await getRequestStudentUserIds(request);
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

  return request;
};

// ─── Apply approved extension (cập nhật deadline target) ─────────────────────

const applyApprovedExtension = async (request) => {
  if (request.targetType === 'milestone') {
    await prisma.milestone.updateMany({
      where: { id: request.targetId.toString(), isDeleted: false },
      data: { deadline: request.requestedTo },
    });

    const milestone = await Milestone.findOne({ _id: request.targetId, isDeleted: { $ne: true } });
    if (milestone) {
      milestone.deadline = request.requestedTo;
      await milestone.save();
    }
    return;
  }

  if (request.targetType === 'submission') {
    await prisma.submissionPackage.updateMany({
      where: { id: request.targetId.toString(), isDeleted: false },
      data: { deadline: request.requestedTo },
    });

    const pkg = await SubmissionPackage.findOne({ _id: request.targetId, isDeleted: { $ne: true } });
    if (pkg) {
      pkg.deadline = request.requestedTo;
      await pkg.save();
    }
    return;
  }

  if (request.targetType === 'project') {
    await prisma.project.updateMany({
      where: { id: request.projectId.toString(), isDeleted: false },
      data: { extendedUntil: request.requestedTo },
    });

    const project = await Project.findById(request.projectId);
    if (project) {
      project.extendedUntil = request.requestedTo;
      await project.save();
    }
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
    at: new Date(),
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

  await syncMongoMirror(updated);

  const request = await ExtensionRequest.findById(requestId);

  if (status === 'approved') {
    await applyApprovedExtension(request);
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
    const studentUserIds = await getRequestStudentUserIds(request);
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

    const Lecturer = require('../../models/Lecturer');
    const project = await Project.findById(pgReq.projectId).populate({
      path: 'supervisorId',
      populate: { path: 'userId' },
    });
    if (project && project.supervisorId && project.supervisorId.userId) {
      await notificationsService.createNotification({
        recipientId: project.supervisorId.userId._id,
        type: status === 'approved' ? 'EXTENSION_FACULTY_APPROVED_SUPERVISOR' : 'EXTENSION_FACULTY_REJECTED_SUPERVISOR',
        title: `Khoa đã ${actionLabel} đơn gia hạn của sinh viên`,
        body: `Yêu cầu gia hạn của đồ án do thầy/cô hướng dẫn đã được Khoa ${actionLabel}.`,
        entityType: 'ExtensionRequest',
        entityId: requestId,
        actionUrl: `/dashboard/extensions`,
      });
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo Khoa duyệt đơn gia hạn:', notifyErr.message);
  }

  return request;
};

// ─── Cancel request ───────────────────────────────────────────────────────────

const cancelRequest = async (requestId, user = {}) => {
  const pgReq = await prisma.extensionRequest.findFirst({ where: { id: requestId } });
  if (!pgReq) throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  if (pgReq.status !== 'pending') throw { status: 400, message: 'Chỉ hủy được yêu cầu gia hạn đang chờ xử lý.' };

  if (!isStaff(user)) {
    if (!user.studentId) throw { status: 403, message: 'Bạn không có quyền hủy yêu cầu gia hạn này.' };
    // Lấy Mongo doc để dùng assertOwnerAccess
    const mongoReq = await ExtensionRequest.findById(requestId);
    if (mongoReq) await assertOwnerAccess(mongoReq, user);
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

  await syncMongoMirror(updated);

  const request = await ExtensionRequest.findById(requestId);

  await logWorkflowEvent({
    entityId: requestId,
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'CANCEL_EXTENSION_REQUEST',
    reason: 'Hủy yêu cầu gia hạn',
  });

  return request;
};

// ─── Get requests (list) ──────────────────────────────────────────────────────

const getRequests = async (queryParams = {}, actor = {}) => {
  const { search = '', status = '', page = 1, limit = 10 } = queryParams;
  const filter = {};

  if (status) filter.status = status;

  const roles = actor.roles || [];

  if (roles.includes('STUDENT') && actor.studentId) {
    const groups = await ProjectGroup.find({
      isDeleted: { $ne: true },
      members: { $elemMatch: { studentId: actor.studentId, status: 'accepted' } },
    }).select('_id');
    filter.$or = [
      { studentId: actor.studentId },
      { groupId: { $in: groups.map((group) => group._id) } },
    ];
  } else if (roles.includes('LECTURER') && actor.lecturerId) {
    const projects = await Project.find({ supervisorId: actor.lecturerId }).select('_id');
    filter.projectId = { $in: projects.map((project) => project._id) };
  } else if (!isStaff(actor)) {
    filter._id = { $exists: false };
  }

  if (search) {
    const groups = await ProjectGroup.find({
      name: { $regex: search, $options: 'i' },
      isDeleted: { $ne: true },
    }).select('_id');

    const ProjectTopic = require('../../models/ProjectTopic');
    const topics = await ProjectTopic.find({
      title: { $regex: search, $options: 'i' },
      isDeleted: { $ne: true },
    }).select('_id');

    const projects = await Project.find({
      topicId: { $in: topics.map((t) => t._id) },
    }).select('_id');

    const searchFilter = [];
    if (groups.length > 0) searchFilter.push({ groupId: { $in: groups.map((g) => g._id) } });
    if (projects.length > 0) searchFilter.push({ projectId: { $in: projects.map((p) => p._id) } });

    if (searchFilter.length > 0) filter.$or = searchFilter;
    else filter._id = { $exists: false };
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [requests, total] = await Promise.all([
    ExtensionRequest.find(filter)
      .populate({
        path: 'projectId',
        select: 'status topicId supervisorId',
        populate: [
          { path: 'topicId', select: 'title' },
          { path: 'supervisorId', populate: { path: 'userId', select: 'fullName email' } },
        ],
      })
      .populate({ path: 'groupId', select: 'name' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    ExtensionRequest.countDocuments(filter),
  ]);

  return { requests, total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) };
};

// ─── Get request by ID ────────────────────────────────────────────────────────

const getRequestById = async (id, actor = {}) => {
  const request = await ExtensionRequest.findById(id)
    .populate({
      path: 'projectId',
      select: 'status topicId supervisorId',
      populate: [
        { path: 'topicId', select: 'title' },
        { path: 'supervisorId', populate: { path: 'userId', select: 'fullName email' } },
      ],
    })
    .populate({ path: 'groupId', select: 'name' });

  if (!request) throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };

  const roles = actor.roles || [];
  if (roles.includes('STUDENT') && actor.studentId) {
    await assertOwnerAccess(request, actor);
  } else if (roles.includes('LECTURER') && actor.lecturerId) {
    const supervisorId = request.projectId?.supervisorId?._id || request.projectId?.supervisorId;
    if (!supervisorId || supervisorId.toString() !== actor.lecturerId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền xem yêu cầu gia hạn này.' };
    }
  } else if (!isStaff(actor)) {
    throw { status: 403, message: 'Bạn không có quyền xem yêu cầu gia hạn này.' };
  }

  return request;
};

module.exports = {
  createExtensionRequest,
  supervisorRecommend,
  facultyDecide,
  cancelRequest,
  getRequests,
  getRequestById,
};
