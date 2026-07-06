const prisma = require('../../config/prisma');
const mongoose = require('mongoose');
const MilestoneMirror = require('../../models/Milestone');
const { assertProjectAccess } = require('../../utils/access-control');
const { resolveProjectOwner, isStudentOwner } = require('../../utils/project-owner');

const newObjectId = () => new mongoose.Types.ObjectId().toString();
const toId = (value) => (value ? value.toString() : null);

const toPublicMilestone = (milestone) => {
  if (!milestone) return null;
  return {
    ...milestone,
    _id: milestone.id,
  };
};

const toMongoMirrorMilestoneData = (milestone) => {
  return {
    _id: milestone.id,
    projectId: toId(milestone.projectId),
    title: milestone.title,
    description: milestone.description || '',
    deadline: milestone.deadline,
    status: milestone.status,
    submissions: milestone.submissions || [],
    feedback: milestone.feedback || [],
    isDeleted: milestone.isDeleted,
    deletedAt: milestone.deletedAt || undefined,
    deletedBy: toId(milestone.deletedBy) || undefined,
    createdAt: milestone.createdAt,
    updatedAt: milestone.updatedAt,
  };
};

const syncMongoMirrorMilestone = async (milestone) => {
  await MilestoneMirror.updateOne(
    { _id: milestone.id },
    { $set: toMongoMirrorMilestoneData(milestone) },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

const isAcceptedGroupMember = (group, studentId) => {
  if (!group || !studentId) return false;
  const members = group.members || [];
  return members.some(
    (member) => toId(member.studentId) === toId(studentId) && member.status === 'accepted'
  );
};

const ensureStudentCanSubmitForProject = async (project, actorStudentId) => {
  const owner = resolveProjectOwner(project);
  if (isStudentOwner(owner, actorStudentId)) return;

  if (owner?.ownerType === 'group') {
    const group = await prisma.projectGroup.findFirst({
      where: { id: toId(owner.groupId || owner.ownerId), isDeleted: false }
    });
    if (isAcceptedGroupMember(group, actorStudentId)) return;
  }

  throw { status: 403, message: 'Chỉ sinh viên thuộc chủ thể thực hiện dự án này mới có quyền nộp báo cáo mốc tiến độ.' };
};

const emitMilestoneChange = async (projectId) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: toId(projectId) }
    });
    if (!project) return;
    
    const socketIoHolder = require('../../config/socket-io-holder');
    const io = socketIoHolder.getIo();
    if (!io) return;

    const userIdsToNotify = new Set();
    
    if (project.supervisorId) {
      const supervisor = await prisma.lecturer.findFirst({
        where: { id: toId(project.supervisorId) }
      });
      if (supervisor) userIdsToNotify.add(supervisor.userId.toString());
    }
    if (project.reviewerId) {
      const reviewer = await prisma.lecturer.findFirst({
        where: { id: toId(project.reviewerId) }
      });
      if (reviewer) userIdsToNotify.add(reviewer.userId.toString());
    }
    if (project.ownerType === 'student' && project.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: toId(project.studentId) }
      });
      if (student) userIdsToNotify.add(student.userId.toString());
    } else if (project.ownerType === 'group' && (project.groupId || project.ownerId)) {
      const gId = project.groupId || project.ownerId;
      const group = await prisma.projectGroup.findFirst({
        where: { id: toId(gId) }
      });
      if (group) {
        const members = group.members || [];
        const memberStudentIds = members.map(m => toId(m.studentId)).filter(Boolean);
        const students = await prisma.student.findMany({
          where: { id: { in: memberStudentIds } }
        });
        for (const s of students) {
          if (s.userId) userIdsToNotify.add(s.userId.toString());
        }
      }
    }
    
    for (const userId of userIdsToNotify) {
      io.to(`user:${userId}`).emit('milestone:changed', { projectId: toId(projectId) });
    }
  } catch (err) {
    console.error('Lỗi khi phát sự kiện socket milestone:', err.message);
  }
};

const createMilestone = async (projectId, milestoneData, actorUserId, actorLecturerId) => {
  const project = await prisma.project.findFirst({
    where: { id: toId(projectId), isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  if (!actorLecturerId || toId(project.supervisorId) !== toId(actorLecturerId)) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép khởi tạo mốc tiến độ.' };
  }

  const id = newObjectId();
  const milestone = await prisma.milestone.create({
    data: {
      id,
      mongoId: id,
      projectId: toId(projectId),
      title: milestoneData.title.trim(),
      description: milestoneData.description ? milestoneData.description.trim() : '',
      deadline: new Date(milestoneData.deadline),
      status: 'open',
      submissions: [],
      feedback: [],
    }
  });

  await syncMongoMirrorMilestone(milestone);
  await emitMilestoneChange(projectId);
  return toPublicMilestone(milestone);
};

const updateMilestone = async (milestoneId, milestoneData, actorUserId, actorLecturerId) => {
  const milestone = await prisma.milestone.findFirst({
    where: { id: toId(milestoneId), isDeleted: false }
  });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: milestone.projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || toId(project.supervisorId) !== toId(actorLecturerId)) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép chỉnh sửa mốc tiến độ.' };
  }

  if (milestone.status === 'locked') {
    throw { status: 400, message: 'Không thể chỉnh sửa mốc tiến độ đang bị khóa.' };
  }

  const updateData = {};
  if (milestoneData.title !== undefined) updateData.title = milestoneData.title.trim();
  if (milestoneData.description !== undefined) updateData.description = milestoneData.description.trim();
  if (milestoneData.deadline !== undefined) updateData.deadline = new Date(milestoneData.deadline);
  if (milestoneData.status !== undefined) updateData.status = milestoneData.status;

  const updatedMilestone = await prisma.milestone.update({
    where: { id: milestone.id },
    data: updateData
  });

  await syncMongoMirrorMilestone(updatedMilestone);
  await emitMilestoneChange(milestone.projectId);
  return toPublicMilestone(updatedMilestone);
};

const deleteMilestone = async (milestoneId, actorUserId, actorLecturerId) => {
  const milestone = await prisma.milestone.findFirst({
    where: { id: toId(milestoneId), isDeleted: false }
  });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại hoặc đã bị xóa.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: milestone.projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || toId(project.supervisorId) !== toId(actorLecturerId)) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép xóa mốc tiến độ.' };
  }

  const submissions = milestone.submissions || [];
  if (submissions.length > 0) {
    throw { status: 400, message: 'Mốc tiến độ đã có bài nộp nên không thể xóa. Hãy khóa mốc hoặc chỉnh trạng thái thay vì xóa.' };
  }

  const updatedMilestone = await prisma.milestone.update({
    where: { id: milestone.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: toId(actorUserId),
    }
  });

  await syncMongoMirrorMilestone(updatedMilestone);
  await emitMilestoneChange(milestone.projectId);

  return { success: true, message: 'Mốc tiến độ đã được xóa thành công.' };
};

const submitMilestoneWork = async (milestoneId, submissionData, actorUserId, actorStudentId) => {
  const milestone = await prisma.milestone.findFirst({
    where: { id: toId(milestoneId), isDeleted: false }
  });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: milestone.projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  await ensureStudentCanSubmitForProject(project, actorStudentId);

  if (['locked', 'accepted'].includes(milestone.status)) {
    throw { status: 400, message: `Mốc tiến độ đã bị [${milestone.status}]. Không thể chỉnh sửa hoặc nộp báo cáo.` };
  }

  const submissions = milestone.submissions || [];
  submissions.push({
    submittedBy: toId(actorUserId),
    fileIds: submissionData.fileIds || [],
    note: submissionData.note ? submissionData.note.trim() : '',
    submittedAt: new Date(),
  });

  const updatedMilestone = await prisma.milestone.update({
    where: { id: milestone.id },
    data: {
      submissions,
      status: 'submitted'
    }
  });

  await syncMongoMirrorMilestone(updatedMilestone);
  await emitMilestoneChange(milestone.projectId);

  return toPublicMilestone(updatedMilestone);
};

const submitFeedback = async (milestoneId, feedbackData, actorUserId, actorLecturerId) => {
  const milestone = await prisma.milestone.findFirst({
    where: { id: toId(milestoneId), isDeleted: false }
  });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: milestone.projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || toId(project.supervisorId) !== toId(actorLecturerId)) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn của dự án mới được phép đánh giá mốc tiến độ.' };
  }

  const feedback = milestone.feedback || [];
  feedback.push({
    lecturerId: toId(actorLecturerId),
    comment: feedbackData.comment.trim(),
    status: feedbackData.status,
    createdAt: new Date(),
  });

  const updatedMilestone = await prisma.milestone.update({
    where: { id: milestone.id },
    data: {
      feedback,
      status: feedbackData.status
    }
  });

  await syncMongoMirrorMilestone(updatedMilestone);
  await emitMilestoneChange(milestone.projectId);

  return toPublicMilestone(updatedMilestone);
};

const lockMilestone = async (milestoneId, actorUserId, actorLecturerId) => {
  const milestone = await prisma.milestone.findFirst({
    where: { id: toId(milestoneId), isDeleted: false }
  });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: milestone.projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || toId(project.supervisorId) !== toId(actorLecturerId)) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn mới có quyền khóa mốc tiến độ.' };
  }

  const updatedMilestone = await prisma.milestone.update({
    where: { id: milestone.id },
    data: { status: 'locked' }
  });

  await syncMongoMirrorMilestone(updatedMilestone);
  await emitMilestoneChange(milestone.projectId);

  return toPublicMilestone(updatedMilestone);
};

const unlockMilestone = async (milestoneId, actorUserId, actorLecturerId) => {
  const milestone = await prisma.milestone.findFirst({
    where: { id: toId(milestoneId), isDeleted: false }
  });
  if (!milestone) {
    throw { status: 404, message: 'Mốc tiến độ không tồn tại.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: milestone.projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án liên kết không tồn tại.' };
  }

  if (!actorLecturerId || toId(project.supervisorId) !== toId(actorLecturerId)) {
    throw { status: 403, message: 'Chỉ giảng viên hướng dẫn mới có quyền mở khóa mốc tiến độ.' };
  }

  if (milestone.status !== 'locked') {
    throw { status: 400, message: 'Mốc tiến độ hiện tại không ở trạng thái khóa.' };
  }

  let nextStatus = 'open';
  const feedback = milestone.feedback || [];
  const submissions = milestone.submissions || [];

  if (feedback.length > 0) {
    const lastFeedback = feedback[feedback.length - 1];
    nextStatus = lastFeedback.status;
  } else if (submissions.length > 0) {
    nextStatus = 'submitted';
  } else {
    const now = new Date();
    if (milestone.deadline && now > new Date(milestone.deadline)) {
      nextStatus = 'late';
    } else {
      nextStatus = 'open';
    }
  }

  const updatedMilestone = await prisma.milestone.update({
    where: { id: milestone.id },
    data: { status: nextStatus }
  });

  await syncMongoMirrorMilestone(updatedMilestone);
  await emitMilestoneChange(milestone.projectId);
  return toPublicMilestone(updatedMilestone);
};

const getMilestonesByProject = async (projectId, user = {}) => {
  const project = await prisma.project.findFirst({
    where: { id: toId(projectId), isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  await assertProjectAccess(project, user);
  
  const milestones = await prisma.milestone.findMany({
    where: { projectId: toId(projectId), isDeleted: false },
    orderBy: { deadline: 'asc' }
  });
  return milestones.map(toPublicMilestone);
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
