const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const Lecturer = require('../../models/Lecturer');
const WorkflowEvent = require('../../models/WorkflowEvent');
const { canAccessProject, assertProjectAccess, isStaff } = require('../../utils/access-control');

const logWorkflowEvent = async ({
  entityId,
  fromStatus,
  toStatus,
  actorId,
  action,
  reason = '',
}) => {
  return await WorkflowEvent.create({
    entityType: 'Project',
    entityId,
    fromStatus,
    toStatus,
    actorId,
    actorRoles: ['FACULTY_STAFF'],
    action,
    reason,
  });
};

const getProjects = async (query = {}, user = {}) => {
  const projects = await Project.find(query)
    .populate({
      path: 'groupId',
      select: 'name members status',
    })
    .populate({
      path: 'topicId',
      select: 'title summary objectives scope technologies',
    })
    .populate({
      path: 'supervisorId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate({
      path: 'reviewerId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .sort({ createdAt: -1 });

  if (isStaff(user)) {
    return projects;
  }

  const visibleProjects = [];
  for (const project of projects) {
    if (await canAccessProject(project, user)) {
      visibleProjects.push(project);
    }
  }

  return visibleProjects;
};

const getProjectById = async (id, user = {}) => {
  const project = await Project.findById(id)
    .populate({
      path: 'groupId',
      select: 'name members status',
    })
    .populate({
      path: 'topicId',
      select: 'title summary objectives scope technologies',
    })
    .populate({
      path: 'supervisorId',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .populate({
      path: 'reviewerId',
      populate: { path: 'userId', select: 'fullName email' },
    });

  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }
  await assertProjectAccess(project, user);
  return project;
};

const markInProgress = async (projectId, actorUserId, actorStudentId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  if (project.status !== 'assigned') {
    throw { status: 400, message: 'Chỉ dự án vừa được phân công (status=assigned) mới có thể chuyển sang thực hiện.' };
  }

  // Verify actor is part of the project group or the supervisor
  let isAuthorized = false;
  if (actorStudentId) {
    const group = await ProjectGroup.findOne({ _id: project.groupId, isDeleted: { $ne: true } });
    if (group) {
      isAuthorized = group.members.some(m => m.studentId.toString() === actorStudentId.toString() && m.status === 'accepted');
    }
  } else {
    // Check if supervisor
    const lecturer = await Lecturer.findOne({ userId: actorUserId });
    if (lecturer && project.supervisorId.toString() === lecturer._id.toString()) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    throw { status: 403, message: 'Bạn không có quyền thực hiện hành động này trên dự án.' };
  }

  const fromStatus = project.status;
  project.status = 'in_progress';
  await project.save();

  await WorkflowEvent.create({
    entityType: 'Project',
    entityId: project._id,
    fromStatus,
    toStatus: 'in_progress',
    actorId: actorUserId,
    actorRoles: actorStudentId ? ['STUDENT'] : ['SUPERVISOR'],
    action: 'START_PROJECT',
    reason: 'Chính thức bắt đầu thực hiện đồ án',
  });

  return project;
};

const assignReviewer = async (projectId, reviewerId, actorUserId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const reviewer = await Lecturer.findById(reviewerId);
  if (!reviewer) {
    throw { status: 404, message: 'Giảng viên phản biện được chỉ định không tồn tại.' };
  }

  project.reviewerId = reviewerId;
  await project.save();

  await logWorkflowEvent({
    entityId: project._id,
    fromStatus: project.status,
    toStatus: project.status,
    actorId: actorUserId,
    action: 'ASSIGN_REVIEWER',
    reason: `Phân công giảng viên phản biện ID ${reviewerId}`,
  });

  return project;
};

const markDefenseEligible = async (projectId, actorUserId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const allowedStatuses = ['in_progress', 'pre_defense_submitted', 'supervisor_reviewed', 'reviewer_reviewed'];
  if (!allowedStatuses.includes(project.status)) {
    throw { status: 400, message: `Không thể duyệt điều kiện bảo vệ cho dự án đang ở trạng thái [${project.status}].` };
  }

  const fromStatus = project.status;
  project.status = 'defense_eligible';
  await project.save();

  await logWorkflowEvent({
    entityId: project._id,
    fromStatus,
    toStatus: 'defense_eligible',
    actorId: actorUserId,
    action: 'MARK_DEFENSE_ELIGIBLE',
    reason: 'Duyệt đủ điều kiện bảo vệ đồ án tốt nghiệp',
  });

  return project;
};

const finalizeProject = async (projectId, actorUserId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const fromStatus = project.status;
  project.status = 'finalized';
  await project.save();

  await logWorkflowEvent({
    entityId: project._id,
    fromStatus,
    toStatus: 'finalized',
    actorId: actorUserId,
    action: 'FINALIZE_PROJECT',
    reason: 'Hoàn tất và chốt kết quả dự án đồ án',
  });

  return project;
};

const cancelProject = async (projectId, actorUserId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const fromStatus = project.status;
  project.status = 'cancelled';
  await project.save();

  await logWorkflowEvent({
    entityId: project._id,
    fromStatus,
    toStatus: 'cancelled',
    actorId: actorUserId,
    action: 'CANCEL_PROJECT',
    reason: 'Hủy bỏ dự án đồ án tốt nghiệp',
  });

  return project;
};

module.exports = {
  getProjects,
  getProjectById,
  markInProgress,
  assignReviewer,
  markDefenseEligible,
  finalizeProject,
  cancelProject,
};
