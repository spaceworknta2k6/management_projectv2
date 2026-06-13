const Milestone = require('../../models/Milestone');
const Project = require('../../models/Project');
const ProjectGroup = require('../../models/ProjectGroup');
const { assertProjectAccess } = require('../../utils/access-control');
const { resolveProjectOwner, isStudentOwner } = require('../../utils/project-owner');

const isAcceptedGroupMember = (group, studentId) => {
  if (!group || !studentId) return false;
  return group.members.some(
    (member) => member.studentId.toString() === studentId.toString() && member.status === 'accepted'
  );
};

const ensureStudentCanSubmitForProject = async (project, actorStudentId) => {
  const owner = resolveProjectOwner(project);
  if (isStudentOwner(owner, actorStudentId)) return;

  if (owner?.ownerType === 'group') {
    const group = await ProjectGroup.findOne({ _id: owner.groupId || owner.ownerId, isDeleted: { $ne: true } });
    if (isAcceptedGroupMember(group, actorStudentId)) return;
  }

  throw { status: 403, message: 'Chỉ sinh viên thuộc chủ thể thực hiện dự án này mới có quyền nộp báo cáo mốc tiến độ.' };
};

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

const updateMilestone = async (milestoneId, milestoneData, actorUserId, actorLecturerId) => {
  const milestone = await Milestone.findOne({ _id: milestoneId, isDeleted: { $ne: true } });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await Project.findById(milestone.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép chỉnh sửa mốc tiến độ.' };
  }

  if (milestone.status === 'locked') {
    throw { status: 400, message: 'Không thể chỉnh sửa mốc tiến độ đang bị khóa.' };
  }

  if (milestoneData.title !== undefined) milestone.title = milestoneData.title.trim();
  if (milestoneData.description !== undefined) milestone.description = milestoneData.description.trim();
  if (milestoneData.deadline !== undefined) milestone.deadline = new Date(milestoneData.deadline);
  if (milestoneData.status !== undefined) milestone.status = milestoneData.status;

  await milestone.save();
  return milestone;
};

const deleteMilestone = async (milestoneId, actorUserId, actorLecturerId) => {
  const milestone = await Milestone.findOne({ _id: milestoneId, isDeleted: { $ne: true } });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại hoặc đã bị xóa.' };
  }

  const project = await Project.findById(milestone.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép xóa mốc tiến độ.' };
  }

  if (milestone.submissions && milestone.submissions.length > 0) {
    throw { status: 400, message: 'Mốc tiến độ đã có bài nộp nên không thể xóa. Hãy khóa mốc hoặc chỉnh trạng thái thay vì xóa.' };
  }

  milestone.isDeleted = true;
  milestone.deletedAt = new Date();
  milestone.deletedBy = actorUserId;
  await milestone.save();

  return { success: true, message: 'Mốc tiến độ đã được xóa thành công.' };
};

const submitMilestoneWork = async (milestoneId, submissionData, actorUserId, actorStudentId) => {
  const milestone = await Milestone.findOne({ _id: milestoneId, isDeleted: { $ne: true } });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await Project.findById(milestone.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  await ensureStudentCanSubmitForProject(project, actorStudentId);

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
  const milestone = await Milestone.findOne({ _id: milestoneId, isDeleted: { $ne: true } });
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
  const milestone = await Milestone.findOne({ _id: milestoneId, isDeleted: { $ne: true } });
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

const unlockMilestone = async (milestoneId, actorUserId, actorLecturerId) => {
  const milestone = await Milestone.findOne({ _id: milestoneId, isDeleted: { $ne: true } });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await Project.findById(milestone.projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || project.supervisorId.toString() !== actorLecturerId.toString()) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn mới có quyền mở khóa mốc tiến độ.' };
  }

  if (milestone.status !== 'locked') {
    throw { status: 400, message: 'Mốc tiến độ hiện tại không ở trạng thái khóa.' };
  }

  // Determine status when unlocking
  if (milestone.feedback && milestone.feedback.length > 0) {
    const lastFeedback = milestone.feedback[milestone.feedback.length - 1];
    milestone.status = lastFeedback.status;
  } else if (milestone.submissions && milestone.submissions.length > 0) {
    milestone.status = 'submitted';
  } else {
    const now = new Date();
    if (milestone.deadline && now > new Date(milestone.deadline)) {
      milestone.status = 'late';
    } else {
      milestone.status = 'open';
    }
  }

  await milestone.save();
  return milestone;
};

const getMilestonesByProject = async (projectId, user = {}) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  await assertProjectAccess(project, user);
  return await Milestone.find({ projectId, isDeleted: { $ne: true } }).sort({ deadline: 1 });
};

module.exports = {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  submitMilestoneWork,
  submitFeedback,
  lockMilestone,
  unlockMilestone,
  getMilestonesByProject,
};
