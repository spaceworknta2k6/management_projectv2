const ExtensionRequest = require('../../models/ExtensionRequest');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const Milestone = require('../../models/Milestone');
const SubmissionPackage = require('../../models/SubmissionPackage');
const Student = require('../../models/Student');
const WorkflowEvent = require('../../models/WorkflowEvent');
const { assertOwnerAccess, resolveProjectOwner } = require('../../utils/project-owner');
const notificationsService = require('../notifications/notifications.service');


const isStaff = (user = {}) => (user.roles || []).some((role) => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(role));

const getRequestStudentUserIds = async (request) => {
  const userIds = [];
  if (request.studentId) {
    const student = await Student.findOne({ _id: request.studentId, isDeleted: false });
    if (student && student.userId) {
      userIds.push(student.userId.toString());
    }
  } else if (request.groupId) {
    const group = await ProjectGroup.findOne({ _id: request.groupId, isDeleted: false })
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
}) => WorkflowEvent.create({
  entityType,
  entityId,
  fromStatus,
  toStatus,
  actorId,
  actorRoles,
  action,
  reason,
  metadata,
});

const ensureStudentInGroup = async (groupId, studentId) => {
  const group = await ProjectGroup.findOne({ _id: groupId, isDeleted: { $ne: true } });
  if (!group || !group.members.some((m) => m.studentId.toString() === studentId.toString() && m.status === 'accepted')) {
    throw { status: 403, message: 'Bạn không thuộc nhóm sinh viên thực hiện dự án này.' };
  }
  return group;
};

const createExtensionRequest = async (requestData, actorUserId, actorStudentId) => {
  const { projectId } = requestData;

  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  await assertOwnerAccess(project, { studentId: actorStudentId, roles: ['STUDENT'] });

  const existing = await ExtensionRequest.findOne({
    targetType: requestData.targetType,
    targetId: requestData.targetId,
    status: 'pending',
  });
  if (existing) {
    throw { status: 400, message: 'Đối tượng này đang có một yêu cầu gia hạn chờ xử lý.' };
  }

  const owner = resolveProjectOwner(project);
  const request = new ExtensionRequest({
    targetType: requestData.targetType,
    targetId: requestData.targetId,
    projectId,
    ownerType: owner?.ownerType,
    ownerId: owner?.ownerId,
    studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
    groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
    reason: requestData.reason.trim(),
    evidenceFileIds: requestData.evidenceFileIds || [],
    requestedTo: new Date(requestData.requestedTo),
    status: 'pending',
  });

  await request.save();
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

const supervisorRecommend = async (requestId, status, note, actorUserId, actorLecturerId) => {
  const request = await ExtensionRequest.findById(requestId);
  if (!request) {
    throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  }
  if (request.status !== 'pending') {
    throw { status: 400, message: 'Chỉ xử lý được yêu cầu gia hạn đang chờ duyệt.' };
  }

  const project = await Project.findById(request.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép đánh giá khuyến nghị gia hạn.' };
  }

  const fromStatus = request.status;
  request.supervisorApproval = {
    status,
    by: actorUserId,
    at: new Date(),
    note: note.trim(),
  };
  request.status = status === 'rejected' ? 'rejected' : 'pending';

  await request.save();

  await logWorkflowEvent({
    entityId: request._id,
    fromStatus,
    toStatus: request.status,
    actorId: actorUserId,
    actorRoles: ['LECTURER', 'SUPERVISOR'],
    action: status === 'approved' ? 'SUPERVISOR_APPROVE_EXTENSION' : 'SUPERVISOR_REJECT_EXTENSION',
    reason: note.trim(),
  });

  // Gửi thông báo cho sinh viên và khoa/bộ môn
  try {
    const studentUserIds = await getRequestStudentUserIds(request);
    const actionLabel = status === 'approved' ? 'đồng ý' : 'từ chối';
    
    // 1. Thông báo cho sinh viên thực hiện đề tài
    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: status === 'approved' ? 'EXTENSION_SUPERVISOR_APPROVED' : 'EXTENSION_SUPERVISOR_REJECTED',
        title: `GVHD đã ${actionLabel} yêu cầu gia hạn`,
        body: `Giảng viên hướng dẫn đã ${actionLabel} yêu cầu gia hạn của bạn.${note ? ` Ghi chú: "${note.trim()}"` : ''}`,
        entityType: 'ExtensionRequest',
        entityId: request._id,
        actionUrl: `/dashboard/extensions`,
      });
    }

  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo GVHD duyệt đơn gia hạn:', notifyErr.message);
  }

  return request;
};

const applyApprovedExtension = async (request) => {
  if (request.targetType === 'milestone') {
    const milestone = await Milestone.findOne({ _id: request.targetId, isDeleted: { $ne: true } });
    if (milestone) {
      milestone.deadline = request.requestedTo;
      await milestone.save();
    }
    return;
  }

  if (request.targetType === 'submission') {
    const pkg = await SubmissionPackage.findOne({ _id: request.targetId, isDeleted: { $ne: true } });
    if (pkg) {
      pkg.deadline = request.requestedTo;
      await pkg.save();
    }
    return;
  }

  if (request.targetType === 'project') {
    const project = await Project.findById(request.projectId);
    if (project) {
      project.extendedUntil = request.requestedTo;
      await project.save();
    }
    return;
  }


};

const facultyDecide = async (requestId, status, note, actorUserId, actorRoles = []) => {
  const request = await ExtensionRequest.findById(requestId);
  if (!request) {
    throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  }
  if (request.status !== 'pending') {
    throw { status: 400, message: 'Chỉ xử lý được yêu cầu gia hạn đang chờ duyệt.' };
  }
  if ((request.supervisorApproval?.status || 'pending') === 'pending') {
    throw { status: 400, message: 'GVHD cần cho ý kiến trước khi giáo vụ/khoa duyệt gia hạn.' };
  }

  const fromStatus = request.status;
  request.facultyDecision = {
    status,
    by: actorUserId,
    at: new Date(),
    note: note.trim(),
  };

  request.status = status;
  await request.save();

  if (status === 'approved') {
    await applyApprovedExtension(request);
  }

  await logWorkflowEvent({
    entityId: request._id,
    fromStatus,
    toStatus: request.status,
    actorId: actorUserId,
    actorRoles,
    action: status === 'approved' ? 'FACULTY_APPROVE_EXTENSION' : 'FACULTY_REJECT_EXTENSION',
    reason: note.trim(),
    metadata: {
      targetType: request.targetType,
      targetId: request.targetId,
      requestedTo: request.requestedTo,
    },
  });

  // Gửi thông báo cho sinh viên và GVHD
  try {
    const studentUserIds = await getRequestStudentUserIds(request);
    const actionLabel = status === 'approved' ? 'phê duyệt' : 'từ chối';
    
    // 1. Thông báo cho sinh viên thực hiện đề tài
    for (const studentUserId of studentUserIds) {
      await notificationsService.createNotification({
        recipientId: studentUserId,
        type: status === 'approved' ? 'EXTENSION_FACULTY_APPROVED' : 'EXTENSION_FACULTY_REJECTED',
        title: `Khoa đã ${actionLabel} yêu cầu gia hạn`,
        body: `Đơn xin gia hạn của bạn đã được Khoa ${actionLabel}.${note ? ` Ghi chú: "${note.trim()}"` : ''}`,
        entityType: 'ExtensionRequest',
        entityId: request._id,
        actionUrl: `/dashboard/extensions`,
      });
    }

    // 2. Thông báo cho GVHD
    const Lecturer = require('../../models/Lecturer');
    const project = await Project.findById(request.projectId).populate({
      path: 'supervisorId',
      populate: { path: 'userId' }
    });
    if (project && project.supervisorId && project.supervisorId.userId) {
      await notificationsService.createNotification({
        recipientId: project.supervisorId.userId._id,
        type: status === 'approved' ? 'EXTENSION_FACULTY_APPROVED_SUPERVISOR' : 'EXTENSION_FACULTY_REJECTED_SUPERVISOR',
        title: `Khoa đã ${actionLabel} đơn gia hạn của sinh viên`,
        body: `Yêu cầu gia hạn của đồ án do thầy/cô hướng dẫn đã được Khoa ${actionLabel}.`,
        entityType: 'ExtensionRequest',
        entityId: request._id,
        actionUrl: `/dashboard/extensions`,
      });
    }
  } catch (notifyErr) {
    console.error('Lỗi khi gửi thông báo Khoa duyệt đơn gia hạn:', notifyErr.message);
  }

  return request;
};

const cancelRequest = async (requestId, user = {}) => {
  const request = await ExtensionRequest.findById(requestId);
  if (!request) {
    throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  }
  if (request.status !== 'pending') {
    throw { status: 400, message: 'Chỉ hủy được yêu cầu gia hạn đang chờ xử lý.' };
  }

  if (!isStaff(user)) {
    if (!user.studentId) {
      throw { status: 403, message: 'Bạn không có quyền hủy yêu cầu gia hạn này.' };
    }
    await assertOwnerAccess(request, user);
  }

  request.status = 'cancelled';
  request.cancelledAt = new Date();
  request.cancelledBy = user._id;
  await request.save();

  await logWorkflowEvent({
    entityId: request._id,
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'CANCEL_EXTENSION_REQUEST',
    reason: 'Hủy yêu cầu gia hạn',
  });

  return request;
};

const getRequests = async (queryParams = {}, actor = {}) => {
  const { search = '', status = '', page = 1, limit = 10 } = queryParams;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  const roles = actor.roles || [];

  if (roles.includes('STUDENT') && actor.studentId) {
    const groups = await ProjectGroup.find({
      isDeleted: { $ne: true },
      members: {
        $elemMatch: {
          studentId: actor.studentId,
          status: 'accepted',
        },
      },
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
    if (groups.length > 0) {
      searchFilter.push({ groupId: { $in: groups.map((g) => g._id) } });
    }
    if (projects.length > 0) {
      searchFilter.push({ projectId: { $in: projects.map((p) => p._id) } });
    }

    if (searchFilter.length > 0) {
      filter.$or = searchFilter;
    } else {
      filter._id = { $exists: false };
    }
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
      .populate({
        path: 'groupId',
        select: 'name',
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    ExtensionRequest.countDocuments(filter),
  ]);

  return {
    requests,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    limit: Number(limit),
  };
};

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
    .populate({
      path: 'groupId',
      select: 'name',
    });

  if (!request) {
    throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  }
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
