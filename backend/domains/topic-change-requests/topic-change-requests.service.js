const mongoose = require('mongoose');
const TopicChangeRequest = require('../../models/TopicChangeRequest');
const ProjectTopic = require('../../models/ProjectTopic');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const ProjectPeriod = require('../../models/ProjectPeriod');
const WorkflowEvent = require('../../models/WorkflowEvent');
const Lecturer = require('../../models/Lecturer');
const Student = require('../../models/Student');
const User = require('../../models/User');
const notificationsService = require('../notifications/notifications.service');
const { assertOwnerAccess, resolveProjectOwner } = require('../../utils/project-owner');
const prisma = require('../../config/prisma');

const isStaff = (user = {}) => (user.roles || []).some((r) => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(r));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRequestStudentUserIds = async (request) => {
  const userIds = [];
  if (request.studentId) {
    const student = await Student.findOne({ _id: request.studentId, isDeleted: false });
    if (student && student.userId) userIds.push(student.userId);
  } else if (request.groupId) {
    const group = await ProjectGroup.findOne({ _id: request.groupId, isDeleted: false })
      .populate({ path: 'members.studentId', match: { isDeleted: false } });
    if (group) {
      for (const m of group.members) {
        if (m.status === 'accepted' && m.studentId && m.studentId.userId) {
          userIds.push(m.studentId.userId);
        }
      }
    }
  }
  return userIds;
};

const logWorkflowEvent = async ({
  entityType = 'TopicChangeRequest',
  entityId, fromStatus = '', toStatus,
  actorId, actorRoles = [], action, reason = '', metadata = {},
}) => WorkflowEvent.create({ entityType, entityId, fromStatus, toStatus, actorId, actorRoles, action, reason, metadata });

// ─── Mirror helper ─────────────────────────────────────────────────────────────

const syncMongoMirror = async (pgReq) => {
  const toDate = (v) => (v ? new Date(v) : undefined);
  const toApproval = (a) => a ? {
    status: a.status || 'pending',
    by: a.by || undefined,
    at: toDate(a.at),
    note: a.note || undefined,
  } : {};

  await TopicChangeRequest.findByIdAndUpdate(pgReq.mongoId || pgReq.id, {
    $set: {
      status: pgReq.status,
      supervisorApproval: toApproval(pgReq.supervisorApproval),
      facultyApproval: toApproval(pgReq.facultyApproval),
      cancelledAt: toDate(pgReq.cancelledAt),
      cancelledBy: pgReq.cancelledBy || undefined,
    },
  });
};

// ─── Create ────────────────────────────────────────────────────────────────────

const createChangeRequest = async (topicId, data, user) => {
  if (!user.studentId) throw { status: 403, message: 'Chỉ sinh viên mới được tạo đơn đổi đề tài.' };

  const topic = await ProjectTopic.findOne({ _id: topicId, isDeleted: { $ne: true } });
  if (!topic) throw { status: 404, message: 'Đề tài đồ án không tồn tại.' };

  await assertOwnerAccess(topic, user);

  const project = await Project.findOne({ topicId: topic._id });
  if (!project || project.status === 'cancelled') {
    throw { status: 400, message: 'Đề tài chưa có dự án đang hoạt động để xin đổi.' };
  }

  const period = await ProjectPeriod.findOne({ _id: topic.periodId, isDeleted: { $ne: true } });
  if (!period) throw { status: 404, message: 'Đợt đồ án không tồn tại.' };

  if (period.topicChangeDeadline && new Date() > new Date(period.topicChangeDeadline)) {
    throw { status: 400, message: 'Đã quá hạn đổi đề tài của đợt đồ án này.' };
  }

  // Kiểm tra unique pending trên Postgres
  const existing = await prisma.topicChangeRequest.findFirst({
    where: { topicId: topicId.toString(), status: 'pending' },
  });
  if (existing) throw { status: 400, message: 'Đề tài đang có một đơn đổi đề tài chờ xử lý.' };

  const owner = resolveProjectOwner(topic);
  const newId = new mongoose.Types.ObjectId().toString();
  const now = new Date();

  const pgData = {
    id: newId,
    mongoId: newId,
    topicId: topicId.toString(),
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
    updatedAt: now,
  };

  await prisma.topicChangeRequest.create({ data: pgData });

  // Mirror về MongoDB
  const request = await TopicChangeRequest.create({
    _id: newId,
    topicId: topic._id,
    ownerType: owner?.ownerType,
    ownerId: owner?.ownerId,
    studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
    groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
    oldTitle: topic.title,
    newTitle: data.newTitle.trim(),
    newScope: data.newScope.trim(),
    newPlan: data.newPlan.trim(),
    reason: data.reason.trim(),
    status: 'pending',
  });

  await logWorkflowEvent({
    entityId: request._id,
    toStatus: 'pending',
    actorId: user._id,
    actorRoles: ['STUDENT'],
    action: 'CREATE_TOPIC_CHANGE_REQUEST',
    reason: request.reason,
    metadata: { topicId: topic._id, groupId: topic.groupId },
  });

  try {
    if (project.supervisorId) {
      const lecturer = await Lecturer.findOne({ _id: project.supervisorId, isDeleted: false });
      if (lecturer && lecturer.userId) {
        await notificationsService.createNotification({
          recipientId: lecturer.userId,
          type: 'TOPIC_CHANGE_REQUEST_SUBMITTED',
          title: 'Yêu cầu đổi đề tài mới',
          body: `Sinh viên ${user.fullName || user.email} đã gửi đơn xin đổi tên đề tài từ "${request.oldTitle}" thành "${request.newTitle}".`,
          entityType: 'TopicChangeRequest',
          entityId: request._id,
          actionUrl: `/dashboard/topic-changes`,
        });
      }
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo gửi đơn đổi đề tài:', notifyErr.message);
  }

  return request;
};

// ─── Get list ──────────────────────────────────────────────────────────────────

const getRequests = async (queryParams = {}, user = {}) => {
  const { topicId, status = '', page = 1, limit = 10 } = queryParams;
  const filter = {};

  if (topicId) filter.topicId = topicId;
  if (status) filter.status = status;

  if (!isStaff(user)) {
    if ((user.roles || []).includes('STUDENT') && user.studentId) {
      const groups = await ProjectGroup.find({
        isDeleted: { $ne: true },
        members: { $elemMatch: { studentId: user.studentId, status: 'accepted' } },
      }).select('_id');
      filter.$or = [
        { studentId: user.studentId },
        { groupId: { $in: groups.map((g) => g._id) } },
      ];
    } else if ((user.roles || []).includes('LECTURER') && user.lecturerId) {
      const projects = await Project.find({ supervisorId: user.lecturerId }).select('topicId');
      filter.topicId = { $in: projects.map((p) => p.topicId) };
    } else {
      filter._id = { $exists: false };
    }
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [requests, total] = await Promise.all([
    TopicChangeRequest.find(filter)
      .populate('topicId')
      .populate({ path: 'groupId', select: 'name members' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    TopicChangeRequest.countDocuments(filter),
  ]);

  return { requests, total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) };
};

// ─── Get by ID ─────────────────────────────────────────────────────────────────

const ensureVisible = async (request, user = {}) => {
  if (isStaff(user)) return;
  if ((user.roles || []).includes('STUDENT') && user.studentId) {
    await assertOwnerAccess(request, user);
    return;
  }
  if ((user.roles || []).includes('LECTURER') && user.lecturerId) {
    const project = await Project.findOne({ topicId: request.topicId?._id || request.topicId });
    if (project && project.supervisorId.toString() === user.lecturerId.toString()) return;
  }
  throw { status: 403, message: 'Bạn không có quyền xem đơn đổi đề tài này.' };
};

const getRequestById = async (id, user = {}) => {
  const request = await TopicChangeRequest.findById(id)
    .populate('topicId')
    .populate({ path: 'groupId', select: 'name members' });
  if (!request) throw { status: 404, message: 'Đơn đổi đề tài không tồn tại.' };
  await ensureVisible(request, user);
  return request;
};

// ─── Supervisor review ─────────────────────────────────────────────────────────

const supervisorReview = async (id, decision, note, user) => {
  if (!user.lecturerId) throw { status: 403, message: 'Chỉ GVHD mới được cho ý kiến đơn đổi đề tài.' };

  const pgReq = await prisma.topicChangeRequest.findFirst({ where: { id } });
  if (!pgReq) throw { status: 404, message: 'Đơn đổi đề tài không tồn tại.' };
  if (pgReq.status !== 'pending') throw { status: 400, message: 'Chỉ xử lý được đơn đổi đề tài đang chờ duyệt.' };

  const project = await Project.findOne({ topicId: pgReq.topicId });
  if (!project || project.supervisorId.toString() !== user.lecturerId.toString()) {
    throw { status: 403, message: 'Bạn không phải GVHD của đề tài này.' };
  }

  const supervisorApproval = { status: decision, by: user._id.toString(), at: new Date(), note: note.trim() };

  const updated = await prisma.topicChangeRequest.update({
    where: { id },
    data: { supervisorApproval, updatedAt: new Date() },
  });

  await syncMongoMirror(updated);

  const request = await TopicChangeRequest.findById(id);

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
    const studentUserIds = await getRequestStudentUserIds(request);
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
      const staffUsers = await User.find({ roles: { $in: ['FACULTY_STAFF', 'SYSTEM_ADMIN'] }, isDeleted: false, status: 'active' });
      for (const staff of staffUsers) {
        await notificationsService.createNotification({
          recipientId: staff._id,
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

  return request;
};

// ─── Faculty review ────────────────────────────────────────────────────────────

const facultyReview = async (id, decision, note, user) => {
  const pgReq = await prisma.topicChangeRequest.findFirst({ where: { id } });
  if (!pgReq) throw { status: 404, message: 'Đơn đổi đề tài không tồn tại.' };
  if (pgReq.status !== 'pending') throw { status: 400, message: 'Chỉ xử lý được đơn đổi đề tài đang chờ duyệt.' };

  const supervisorApprovalStatus = (pgReq.supervisorApproval || {}).status || 'pending';
  if (supervisorApprovalStatus === 'pending') {
    throw { status: 400, message: 'GVHD cần cho ý kiến trước khi khoa/bộ môn duyệt.' };
  }

  const topic = await ProjectTopic.findOne({ _id: pgReq.topicId, isDeleted: { $ne: true } });
  if (!topic) throw { status: 404, message: 'Đề tài liên kết không tồn tại.' };

  const facultyApproval = { status: decision, by: user._id.toString(), at: new Date(), note: note.trim() };

  const updated = await prisma.topicChangeRequest.update({
    where: { id },
    data: { facultyApproval, status: decision, updatedAt: new Date() },
  });

  await syncMongoMirror(updated);

  if (decision === 'approved') {
    const oldTopicStatus = topic.status;
    const oldTitle = topic.title;
    const oldScope = topic.scope;
    const oldPlan = topic.plan;

    topic.title = pgReq.newTitle;
    topic.scope = pgReq.newScope;
    topic.plan = pgReq.newPlan;
    topic.status = 'changed';
    topic.version += 1;
    await topic.save();

    // Mirror topic changes vào Prisma
    await prisma.projectTopic.update({
      where: { id: topic._id.toString() },
      data: { title: topic.title, scope: topic.scope, plan: topic.plan, status: 'changed' },
    }).catch(() => {}); // ignore nếu chưa có trong Postgres

    const project = await Project.findOne({ topicId: topic._id });
    if (project) {
      project.version += 1;
      await project.save();
    }

    await logWorkflowEvent({
      entityType: 'ProjectTopic',
      entityId: topic._id,
      fromStatus: oldTopicStatus,
      toStatus: 'changed',
      actorId: user._id,
      actorRoles: user.roles || [],
      action: 'APPLY_TOPIC_CHANGE',
      reason: note.trim(),
      metadata: { requestId: id, oldTitle, oldScope, oldPlan, newTitle: topic.title, newScope: topic.scope, newPlan: topic.plan, version: topic.version },
    });
  }

  const request = await TopicChangeRequest.findById(id);

  await logWorkflowEvent({
    entityId: id,
    fromStatus: pgReq.status,
    toStatus: decision,
    actorId: user._id,
    actorRoles: user.roles || [],
    action: decision === 'approved' ? 'FACULTY_APPROVE_TOPIC_CHANGE' : 'FACULTY_REJECT_TOPIC_CHANGE',
    reason: note.trim(),
    metadata: { topicId: pgReq.topicId },
  });

  try {
    const studentUserIds = await getRequestStudentUserIds(request);
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
    const project = await Project.findOne({ topicId: pgReq.topicId });
    if (project && project.supervisorId) {
      const lecturer = await Lecturer.findOne({ _id: project.supervisorId, isDeleted: false });
      if (lecturer && lecturer.userId) {
        await notificationsService.createNotification({
          recipientId: lecturer.userId,
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

  return request;
};

// ─── Cancel ────────────────────────────────────────────────────────────────────

const cancelRequest = async (id, user = {}) => {
  const pgReq = await prisma.topicChangeRequest.findFirst({ where: { id } });
  if (!pgReq) throw { status: 404, message: 'Đơn đổi đề tài không tồn tại.' };
  if (pgReq.status !== 'pending') throw { status: 400, message: 'Chỉ hủy được đơn đổi đề tài đang chờ xử lý.' };

  if (!isStaff(user)) {
    if (!user.studentId) throw { status: 403, message: 'Bạn không có quyền hủy đơn đổi đề tài này.' };
    const mongoReq = await TopicChangeRequest.findById(id);
    if (mongoReq) await assertOwnerAccess(mongoReq, user);
  }

  const now = new Date();
  const updated = await prisma.topicChangeRequest.update({
    where: { id },
    data: { status: 'cancelled', cancelledAt: now, cancelledBy: user._id ? user._id.toString() : null, updatedAt: now },
  });

  await syncMongoMirror(updated);

  const request = await TopicChangeRequest.findById(id);

  await logWorkflowEvent({
    entityId: id,
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'CANCEL_TOPIC_CHANGE_REQUEST',
    reason: 'Hủy đơn đổi đề tài',
  });

  return request;
};

module.exports = {
  createChangeRequest,
  getRequests,
  getRequestById,
  supervisorReview,
  facultyReview,
  cancelRequest,
};
