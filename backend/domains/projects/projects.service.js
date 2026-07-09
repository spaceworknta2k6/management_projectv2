const prisma = require('../../config/prisma');
const WorkflowEvent = require('../../utils/workflow-event');
const { canAccessProject, assertProjectAccess, isStaff } = require('../../utils/access-control');
const { resolveProjectOwner, isStudentOwner } = require('../../utils/project-owner');

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

const populateProjects = async (projects) => {
  if (!projects || projects.length === 0) return [];

  const groupIds = Array.from(new Set(projects.map(p => p.groupId).filter(Boolean)));
  const studentIds = Array.from(new Set(projects.map(p => p.studentId).filter(Boolean)));
  const topicIds = Array.from(new Set(projects.map(p => p.topicId).filter(Boolean)));
  const lecturerIds = Array.from(new Set(
    projects.flatMap(p => [p.supervisorId, p.reviewerId]).filter(Boolean)
  ));

  const [groups, students, topics, lecturers] = await Promise.all([
    prisma.projectGroup.findMany({
      where: { id: { in: groupIds }, isDeleted: false },
      select: { id: true, name: true, members: true, status: true }
    }),
    prisma.student.findMany({
      where: { id: { in: studentIds }, isDeleted: false },
      include: { user: { select: { id: true, fullName: true, email: true } } }
    }),
    prisma.projectTopic.findMany({
      where: { id: { in: topicIds }, isDeleted: false },
      select: { id: true, title: true, summary: true, objectives: true, scope: true, technologies: true }
    }),
    prisma.lecturer.findMany({
      where: { id: { in: lecturerIds }, isDeleted: false },
      include: { user: { select: { id: true, fullName: true, email: true } } }
    })
  ]);

  const groupMap = new Map(groups.map(g => [g.id, { ...g, _id: g.id }]));
  const studentMap = new Map(students.map(s => [s.id, {
    ...s,
    _id: s.id,
    userId: s.user ? { ...s.user, _id: s.user.id } : null
  }]));
  const topicMap = new Map(topics.map(t => [t.id, { ...t, _id: t.id }]));
  const lecturerMap = new Map(lecturers.map(l => [l.id, {
    ...l,
    _id: l.id,
    userId: l.user ? { ...l.user, _id: l.user.id } : null
  }]));

  return projects.map(p => {
    return {
      ...p,
      _id: p.id,
      groupId: p.groupId ? groupMap.get(p.groupId) || null : null,
      studentId: p.studentId ? studentMap.get(p.studentId) || null : null,
      topicId: p.topicId ? topicMap.get(p.topicId) || null : null,
      supervisorId: p.supervisorId ? lecturerMap.get(p.supervisorId) || null : null,
      reviewerId: p.reviewerId ? lecturerMap.get(p.reviewerId) || null : null,
    };
  });
};

const populateProject = async (project) => {
  if (!project) return null;
  const populated = await populateProjects([project]);
  return populated[0];
};

const buildProjectWhere = (query = {}) => {
  const where = { isDeleted: false };
  const allowedFields = [
    'periodId',
    'status',
    'ownerType',
    'ownerId',
    'studentId',
    'groupId',
    'topicId',
    'supervisorId',
    'reviewerId'
  ];

  for (const field of allowedFields) {
    if (query[field] !== undefined && query[field] !== null) {
      if (typeof query[field] === 'object' && query[field] !== null) {
        if (query[field].$ne !== undefined) {
          where[field] = { not: query[field].$ne.toString() };
        } else if (query[field].$in !== undefined) {
          const list = Array.isArray(query[field].$in) ? query[field].$in : [query[field].$in];
          where[field] = { in: list.map(x => x.toString()) };
        } else if (query[field].$nin !== undefined) {
          const list = Array.isArray(query[field].$nin) ? query[field].$nin : [query[field].$nin];
          where[field] = { notIn: list.map(x => x.toString()) };
        }
      } else {
        where[field] = query[field].toString();
      }
    }
  }

  return where;
};

const getProjects = async (query = {}, user = {}) => {
  const where = buildProjectWhere(query);
  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  const populatedProjects = await populateProjects(projects);

  if (isStaff(user)) {
    return populatedProjects;
  }

  const visibleProjects = [];
  for (const project of populatedProjects) {
    if (await canAccessProject(project, user)) {
      visibleProjects.push(project);
    }
  }

  return visibleProjects;
};

const getProjectById = async (id, user = {}) => {
  if (!id) {
    throw { status: 400, message: 'Thiếu ID dự án.' };
  }

  const project = await prisma.project.findFirst({
    where: { id, isDeleted: false }
  });

  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const populated = await populateProject(project);

  await assertProjectAccess(populated, user);
  return populated;
};

const markInProgress = async (projectId, actorUserId, actorStudentId) => {
  if (!projectId) {
    throw { status: 400, message: 'Thiếu ID dự án.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false }
  });

  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  if (project.status !== 'assigned') {
    throw { status: 400, message: 'Chỉ dự án vừa được phân công (status=assigned) mới có thể chuyển sang thực hiện.' };
  }

  // Verify actor is part of the project group or the supervisor
  let isAuthorized = false;
  if (actorStudentId) {
    const owner = resolveProjectOwner(project);
    if (isStudentOwner(owner, actorStudentId)) {
      isAuthorized = true;
    } else if (owner?.ownerType === 'group') {
      const group = await prisma.projectGroup.findFirst({
        where: { id: owner.groupId || owner.ownerId, isDeleted: false }
      });
      if (group) {
        const members = Array.isArray(group.members) ? group.members : [];
        isAuthorized = members.some(m => m?.studentId && m.studentId.toString() === actorStudentId.toString() && m.status === 'accepted');
      }
    }
  } else {
    // Check if supervisor
    const lecturer = await prisma.lecturer.findFirst({
      where: { userId: actorUserId, isDeleted: false }
    });
    if (lecturer && (project.supervisorId.toString() === lecturer.id.toString() || (lecturer.mongoId && project.supervisorId.toString() === lecturer.mongoId.toString()))) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    throw { status: 403, message: 'Bạn không có quyền thực hiện hành động này trên dự án.' };
  }

  const fromStatus = project.status;
  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: { status: 'in_progress' }
  });

  await WorkflowEvent.create({
    entityType: 'Project',
    entityId: updatedProject.id,
    fromStatus,
    toStatus: 'in_progress',
    actorId: actorUserId,
    actorRoles: actorStudentId ? ['STUDENT'] : ['SUPERVISOR'],
    action: 'START_PROJECT',
    reason: 'Chính thức bắt đầu thực hiện đồ án',
  });

  return await populateProject(updatedProject);
};

const assignReviewer = async (projectId, reviewerId, actorUserId) => {
  if (!projectId) {
    throw { status: 400, message: 'Thiếu ID dự án.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  if (project.supervisorId.toString() === reviewerId.toString()) {
    throw { status: 400, message: 'Giảng viên chấm 2 không được trùng với giảng viên hướng dẫn.' };
  }

  const reviewer = await prisma.lecturer.findFirst({
    where: { id: reviewerId, isDeleted: false }
  });
  if (!reviewer) {
    throw { status: 404, message: 'Giảng viên chấm 2 được chỉ định không tồn tại.' };
  }

  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: { reviewerId }
  });

  await logWorkflowEvent({
    entityId: updatedProject.id,
    fromStatus: project.status,
    toStatus: project.status,
    actorId: actorUserId,
    action: 'ASSIGN_REVIEWER',
    reason: `Phân công giảng viên chấm 2 ID ${reviewerId}`,
  });

  return await populateProject(updatedProject);
};

const markReadyForGrading = async (projectId, actorUserId) => {
  if (!projectId) {
    throw { status: 400, message: 'Thiếu ID dự án.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const allowedStatuses = ['in_progress', 'final_report_submitted', 'supervisor_reviewed', 'reviewer_reviewed'];
  if (!allowedStatuses.includes(project.status)) {
    throw { status: 400, message: `Không thể đánh dấu sẵn sàng chấm cho dự án đang ở trạng thái [${project.status}].` };
  }

  const fromStatus = project.status;
  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: { status: 'ready_for_grading' }
  });

  await logWorkflowEvent({
    entityId: updatedProject.id,
    fromStatus,
    toStatus: 'ready_for_grading',
    actorId: actorUserId,
    action: 'MARK_READY_FOR_GRADING',
    reason: 'Đánh dấu dự án sẵn sàng chấm',
  });

  return await populateProject(updatedProject);
};

const finalizeProject = async (projectId, actorUserId) => {
  if (!projectId) {
    throw { status: 400, message: 'Thiếu ID dự án.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const fromStatus = project.status;
  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: { status: 'finalized' }
  });

  await logWorkflowEvent({
    entityId: updatedProject.id,
    fromStatus,
    toStatus: 'finalized',
    actorId: actorUserId,
    action: 'FINALIZE_PROJECT',
    reason: 'Hoàn tất và chốt kết quả dự án đồ án',
  });

  return await populateProject(updatedProject);
};

const cancelProject = async (projectId, actorUserId) => {
  if (!projectId) {
    throw { status: 400, message: 'Thiếu ID dự án.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false }
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const fromStatus = project.status;
  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: { status: 'cancelled' }
  });

  await logWorkflowEvent({
    entityId: updatedProject.id,
    fromStatus,
    toStatus: 'cancelled',
    actorId: actorUserId,
    action: 'CANCEL_PROJECT',
    reason: 'Hủy bỏ dự án đồ án tốt nghiệp',
  });

  return await populateProject(updatedProject);
};

module.exports = {
  getProjects,
  getProjectById,
  markInProgress,
  assignReviewer,
  markReadyForGrading,
  finalizeProject,
  cancelProject,
};
