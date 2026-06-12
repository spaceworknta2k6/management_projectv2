const ExtensionRequest = require('../../models/ExtensionRequest');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const Milestone = require('../../models/Milestone');
const SubmissionPackage = require('../../models/SubmissionPackage');

const createExtensionRequest = async (requestData, actorUserId, actorStudentId) => {
  const { projectId } = requestData;

  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  // Verify group membership
  const group = await ProjectGroup.findOne({ _id: project.groupId, isDeleted: { $ne: true } });
  if (!group || !group.members.some(m => m.studentId.toString() === actorStudentId.toString() && m.status === 'accepted')) {
    throw { status: 403, message: 'Bạn không thuộc nhóm sinh viên thực hiện dự án này.' };
  }

  const request = new ExtensionRequest({
    targetType: requestData.targetType,
    targetId: requestData.targetId,
    projectId,
    groupId: project.groupId,
    reason: requestData.reason.trim(),
    evidenceFileIds: requestData.evidenceFileIds || [],
    requestedTo: new Date(requestData.requestedTo),
    status: 'pending',
  });

  await request.save();
  return request;
};

const supervisorRecommend = async (requestId, status, note, actorUserId, actorLecturerId) => {
  const request = await ExtensionRequest.findById(requestId);
  if (!request) {
    throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  }

  const project = await Project.findById(request.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  // Verify supervisor identity
  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép đánh giá khuyến nghị gia hạn.' };
  }

  request.supervisorApproval = {
    status,
    by: actorUserId,
    at: new Date(),
    note: note.trim(),
  };

  await request.save();
  return request;
};

const facultyDecide = async (requestId, status, note, actorUserId) => {
  const request = await ExtensionRequest.findById(requestId);
  if (!request) {
    throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  }

  request.facultyDecision = {
    status,
    by: actorUserId,
    at: new Date(),
    note: note.trim(),
  };

  request.status = status; // 'approved' or 'rejected'
  await request.save();

  // If approved, dynamically update the target entity deadline
  if (status === 'approved') {
    if (request.targetType === 'milestone') {
      const milestone = await Milestone.findOne({ _id: request.targetId, isDeleted: { $ne: true } });
      if (milestone) {
        milestone.deadline = request.requestedTo;
        await milestone.save();
      }
    } else if (request.targetType === 'submission') {
      const pkg = await SubmissionPackage.findOne({ _id: request.targetId, isDeleted: { $ne: true } });
      if (pkg) {
        pkg.deadline = request.requestedTo;
        await pkg.save();
      }
    }
  }

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
    filter.groupId = { $in: groups.map((group) => group._id) };
  } else if (roles.includes('LECTURER') && actor.lecturerId) {
    const projects = await Project.find({ supervisorId: actor.lecturerId }).select('_id');
    filter.projectId = { $in: projects.map((project) => project._id) };
  } else if (!roles.includes('FACULTY_STAFF') && !roles.includes('SYSTEM_ADMIN')) {
    filter._id = { $exists: false };
  }

  if (search) {
    // Find matching groups by name
    const groups = await ProjectGroup.find({
      name: { $regex: search, $options: 'i' },
      isDeleted: { $ne: true },
    }).select('_id');

    // Find matching topic titles
    const ProjectTopic = require('../../models/ProjectTopic');
    const topics = await ProjectTopic.find({
      title: { $regex: search, $options: 'i' },
      isDeleted: { $ne: true },
    }).select('_id');

    // Find projects referencing those topics
    const projects = await Project.find({
      topicId: { $in: topics.map(t => t._id) },
    }).select('_id');

    const searchFilter = [];
    if (groups.length > 0) {
      searchFilter.push({ groupId: { $in: groups.map(g => g._id) } });
    }
    if (projects.length > 0) {
      searchFilter.push({ projectId: { $in: projects.map(p => p._id) } });
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
        select: 'name'
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
    limit: Number(limit)
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
      select: 'name'
    });

  if (!request) {
    throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
  }
  const roles = actor.roles || [];
  if (roles.includes('STUDENT') && actor.studentId) {
    const group = await ProjectGroup.findOne({
      _id: request.groupId?._id || request.groupId,
      isDeleted: { $ne: true },
      members: {
        $elemMatch: {
          studentId: actor.studentId,
          status: 'accepted',
        },
      },
    });
    if (!group) {
      throw { status: 403, message: 'Bạn không có quyền xem yêu cầu gia hạn này.' };
    }
  } else if (roles.includes('LECTURER') && actor.lecturerId) {
    const supervisorId = request.projectId?.supervisorId?._id || request.projectId?.supervisorId;
    if (!supervisorId || supervisorId.toString() !== actor.lecturerId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền xem yêu cầu gia hạn này.' };
    }
  } else if (!roles.includes('FACULTY_STAFF') && !roles.includes('SYSTEM_ADMIN')) {
    throw { status: 403, message: 'Bạn không có quyền xem yêu cầu gia hạn này.' };
  }

  return request;
};

module.exports = {
  createExtensionRequest,
  supervisorRecommend,
  facultyDecide,
  getRequests,
  getRequestById,
};
