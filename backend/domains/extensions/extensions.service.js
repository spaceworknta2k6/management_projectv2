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
  const group = await ProjectGroup.findById(project.groupId);
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
      const milestone = await Milestone.findById(request.targetId);
      if (milestone) {
        milestone.deadline = request.requestedTo;
        await milestone.save();
      }
    } else if (request.targetType === 'submission') {
      const pkg = await SubmissionPackage.findById(request.targetId);
      if (pkg) {
        pkg.deadline = request.requestedTo;
        await pkg.save();
      }
    }
  }

  return request;
};

const getRequests = async (query = {}) => {
  return await ExtensionRequest.find(query)
    .populate({
      path: 'projectId',
      select: 'status'
    })
    .populate({
      path: 'groupId',
      select: 'name'
    })
    .sort({ createdAt: -1 });
};

const getRequestById = async (id) => {
  const request = await ExtensionRequest.findById(id)
    .populate({
      path: 'projectId',
      select: 'status'
    })
    .populate({
      path: 'groupId',
      select: 'name'
    });

  if (!request) {
    throw { status: 404, message: 'Yêu cầu gia hạn không tồn tại.' };
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
