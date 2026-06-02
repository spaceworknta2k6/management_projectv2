const Milestone = require('../../models/Milestone');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');

const createMilestone = async (projectId, milestoneData, actorUserId, actorLecturerId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  // Security check: only officially assigned supervisor can create milestones
  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép khởi tạo mốc tiến độ.' };
  }

  const milestone = new Milestone({
    projectId,
    title: milestoneData.title.trim(),
    description: milestoneData.description ? milestoneData.description.trim() : '',
    deadline: new Date(milestoneData.deadline),
    status: 'open',
  });

  await milestone.save();
  return milestone;
};

const submitMilestoneWork = async (milestoneId, submissionData, actorUserId, actorStudentId) => {
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await Project.findById(milestone.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  // Security check: actor student must be in project group
  const group = await ProjectGroup.findById(project.groupId);
  if (!group) {
    throw { status: 404, message: 'Nhóm đồ án không tồn tại.' };
  }

  const isGroupMember = group.members.some(m => m.studentId.toString() === actorStudentId.toString() && m.status === 'accepted');
  if (!isGroupMember) {
    throw { status: 403, message: 'Chỉ sinh viên thuộc nhóm đồ án này mới có quyền nộp báo cáo mốc tiến độ.' };
  }

  if (['locked', 'accepted'].includes(milestone.status)) {
    throw { status: 400, message: `Mốc tiến độ đã bị [${milestone.status}]. Không thể chỉnh sửa hoặc nộp báo cáo.` };
  }

  // Push new submission to submissions list
  milestone.submissions.push({
    submittedBy: actorUserId,
    fileIds: submissionData.fileIds || [],
    note: submissionData.note ? submissionData.note.trim() : '',
    submittedAt: new Date(),
  });

  milestone.status = 'submitted';
  await milestone.save();

  return milestone;
};

const submitFeedback = async (milestoneId, feedbackData, actorUserId, actorLecturerId) => {
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await Project.findById(milestone.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  // Security check: only supervisor can evaluate
  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép đánh giá mốc tiến độ.' };
  }

  // Push new feedback
  milestone.feedback.push({
    lecturerId: actorLecturerId,
    comment: feedbackData.comment.trim(),
    status: feedbackData.status,
    createdAt: new Date(),
  });

  milestone.status = feedbackData.status;
  await milestone.save();

  return milestone;
};

const lockMilestone = async (milestoneId, actorUserId, actorLecturerId) => {
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await Project.findById(milestone.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn mới có quyền khóa mốc tiến độ.' };
  }

  milestone.status = 'locked';
  await milestone.save();

  return milestone;
};

const getMilestonesByProject = async (projectId) => {
  return await Milestone.find({ projectId }).sort({ deadline: 1 });
};

module.exports = {
  createMilestone,
  submitMilestoneWork,
  submitFeedback,
  lockMilestone,
  getMilestonesByProject,
};
