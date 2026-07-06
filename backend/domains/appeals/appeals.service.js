const { randomBytes } = require('crypto');
const prisma = require('../../config/prisma');
const notificationsService = require('../notifications/notifications.service');

const newObjectId = () => randomBytes(12).toString('hex');

const isStaff = (user = {}) =>
  (user.roles || []).some((r) => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(r));

const logWorkflowEvent = (data) => {
  const WorkflowEvent = require('../../utils/workflow-event');
  return WorkflowEvent.create({
    entityType: 'AppealRequest',
    entityId: data.entityId,
    fromStatus: data.fromStatus || '',
    toStatus: data.toStatus,
    actorId: data.actorId,
    actorRoles: data.actorRoles || [],
    action: data.action,
    reason: data.reason || '',
    metadata: data.metadata || {},
  });
};

const mapAppealWithRelations = async (appeal) => {
  if (!appeal) return null;

  const student = await prisma.student.findUnique({
    where: { id: appeal.studentId },
    include: { user: { select: { id: true, fullName: true, email: true } } }
  });

  const project = await prisma.project.findFirst({
    where: { id: appeal.projectId }
  });

  let mappedProject = null;
  if (project) {
    const topic = await prisma.projectTopic.findUnique({
      where: { id: project.topicId },
      select: { title: true }
    });
    const supervisor = await prisma.lecturer.findUnique({
      where: { id: project.supervisorId },
      include: { user: { select: { fullName: true, email: true } } }
    });
    const reviewer = project.reviewerId ? await prisma.lecturer.findUnique({
      where: { id: project.reviewerId },
      include: { user: { select: { fullName: true, email: true } } }
    }) : null;

    mappedProject = {
      ...project,
      _id: project.id,
      topicId: topic ? { ...topic, _id: project.topicId, title: topic.title } : null,
      supervisorId: supervisor ? {
        ...supervisor,
        _id: project.supervisorId,
        userId: supervisor.user ? { ...supervisor.user, _id: supervisor.user.id } : null
      } : null,
      reviewerId: reviewer ? {
        ...reviewer,
        _id: project.reviewerId,
        userId: reviewer.user ? { ...reviewer.user, _id: reviewer.user.id } : null
      } : null
    };
  }

  const finalGrade = await prisma.finalGrade.findUnique({
    where: { id: appeal.finalGradeId }
  });

  const recheckGrader = appeal.recheckGraderId ? await prisma.lecturer.findUnique({
    where: { id: appeal.recheckGraderId },
    include: { user: { select: { fullName: true, email: true } } }
  }) : null;

  const recheckScoreSheet = appeal.recheckScoreSheetId ? await prisma.scoreSheet.findUnique({
    where: { id: appeal.recheckScoreSheetId }
  }) : null;

  return {
    ...appeal,
    _id: appeal.id,
    studentId: student ? {
      ...student,
      _id: student.id,
      userId: student.user ? { ...student.user, _id: student.user.id } : null
    } : null,
    projectId: mappedProject,
    finalGradeId: finalGrade ? { ...finalGrade, _id: finalGrade.id } : null,
    recheckGraderId: recheckGrader ? {
      ...recheckGrader,
      _id: appeal.recheckGraderId,
      userId: recheckGrader.user ? { ...recheckGrader.user, _id: recheckGrader.user.id } : null
    } : null,
    recheckScoreSheetId: recheckScoreSheet ? { ...recheckScoreSheet, _id: recheckScoreSheet.id } : null
  };
};

// ─── Submit appeal (sinh viên nộp đơn) ───────────────────────────────────────

const submitAppeal = async (data, user) => {
  const { projectId, reason } = data;

  if (!user.studentId) {
    throw { status: 403, message: 'Chỉ sinh viên mới có thể nộp đơn phúc khảo.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId.toString(), isDeleted: false },
  });
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const studentId = user.studentId;

  if (project.ownerType === 'student' && project.studentId !== studentId.toString()) {
    throw { status: 403, message: 'Bạn không phải chủ nhân của dự án này.' };
  }

  if (project.ownerType === 'group') {
    const group = await prisma.projectGroup.findFirst({
      where: { id: project.groupId, isDeleted: false },
    });
    if (!group || !group.members.some(
      (m) => m.studentId?.toString() === studentId.toString() && m.status === 'accepted'
    )) {
      throw { status: 403, message: 'Bạn không thuộc nhóm thực hiện dự án này.' };
    }
  }

  const period = await prisma.projectPeriod.findFirst({
    where: { id: project.periodId, isDeleted: false }
  });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  if (period.status !== 'appeal_open') {
    throw { status: 400, message: 'Hiện tại không trong thời gian phúc khảo. Đợt đồ án phải ở trạng thái "appeal_open".' };
  }

  if (period.resultPublishedAt) {
    const deadline = new Date(period.resultPublishedAt);
    deadline.setDate(deadline.getDate() + (period.appealDaysAfterPublish || 7));
    if (new Date() > deadline) {
      throw { status: 400, message: 'Đã hết thời hạn nộp đơn phúc khảo.' };
    }
  }

  const finalGrade = await prisma.finalGrade.findFirst({
    where: { projectId: project.id }
  });
  if (!finalGrade) {
    throw { status: 404, message: 'Chưa có điểm tổng kết để phúc khảo.' };
  }
  if (!finalGrade.publishedAt) {
    throw { status: 400, message: 'Điểm chưa được công bố, không thể phúc khảo.' };
  }

  const existing = await prisma.appealRequest.findFirst({
    where: {
      projectId: project.id,
      studentId: studentId.toString(),
      periodId: period.id,
      isDeleted: false,
    },
  });
  if (existing) {
    throw { status: 409, message: 'Bạn đã có đơn phúc khảo cho dự án này trong đợt hiện tại.' };
  }

  const newId = newObjectId();
  const now = new Date();

  const pgAppeal = await prisma.appealRequest.create({
    data: {
      id: newId,
      mongoId: newId,
      projectId: project.id,
      studentId: studentId.toString(),
      periodId: period.id,
      finalGradeId: finalGrade.id,
      reason: reason.trim(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
  });

  await logWorkflowEvent({
    entityId: pgAppeal.id,
    toStatus: 'pending',
    actorId: user._id,
    actorRoles: ['STUDENT'],
    action: 'SUBMIT_APPEAL',
    reason: pgAppeal.reason,
    metadata: { projectId: project.id, periodId: period.id },
  });

  return {
    ...pgAppeal,
    _id: pgAppeal.id
  };
};

// ─── Assign recheck grader (giáo vụ phân công GV chấm lại) ──────────────────

const assignRecheck = async (id, data, user) => {
  const { recheckGraderId, adminNote, feePaidAt } = data;

  const pgAppeal = await prisma.appealRequest.findFirst({
    where: { id, isDeleted: false },
  });
  if (!pgAppeal) {
    throw { status: 404, message: 'Đơn phúc khảo không tồn tại.' };
  }
  if (pgAppeal.status !== 'pending') {
    throw { status: 400, message: 'Chỉ có thể phân công cho đơn đang ở trạng thái chờ xử lý.' };
  }

  const project = await prisma.project.findFirst({
    where: { id: pgAppeal.projectId, isDeleted: false },
  });

  const supervisorId = project?.supervisorId;
  const reviewerId = project?.reviewerId;
  if (recheckGraderId === supervisorId || recheckGraderId === reviewerId) {
    throw {
      status: 400,
      message: 'Giảng viên chấm lại phải là người khác với Giảng viên hướng dẫn và Giảng viên chấm ban đầu.',
    };
  }

  const lecturer = await prisma.lecturer.findFirst({
    where: {
      OR: [
        { id: recheckGraderId.toString() },
        { userId: recheckGraderId.toString() }
      ],
      isDeleted: false
    },
    include: { user: true }
  });
  if (!lecturer) {
    throw { status: 404, message: 'Giảng viên chấm lại không tồn tại.' };
  }

  const resolvedGraderId = lecturer.id;
  const resolvedFeePaidAt = feePaidAt ? new Date(feePaidAt) : new Date();

  const updated = await prisma.appealRequest.update({
    where: { id },
    data: {
      recheckGraderId: resolvedGraderId,
      adminNote: adminNote ? adminNote.trim() : null,
      feePaidAt: resolvedFeePaidAt,
      status: 'grading',
      updatedAt: new Date(),
    },
  });

  await logWorkflowEvent({
    entityId: id,
    fromStatus: 'pending',
    toStatus: 'grading',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'ASSIGN_RECHECK_GRADER',
    reason: adminNote || '',
    metadata: { recheckGraderId: resolvedGraderId, feePaidAt: resolvedFeePaidAt },
  });

  try {
    if (lecturer.user) {
      await notificationsService.createNotification({
        recipientId: lecturer.user.id,
        type: 'APPEAL_GRADER_ASSIGNED',
        title: 'Bạn được phân công chấm phúc khảo',
        body: `Bạn được phân công chấm phiếu phúc khảo cho một dự án đồ án.${adminNote ? ` Ghi chú: "${adminNote.trim()}"` : ''}`,
        entityType: 'AppealRequest',
        entityId: id,
        actionUrl: `/dashboard/scores`,
      });
    }
  } catch (err) {
    console.error('Lỗi gửi thông báo phân công phúc khảo:', err.message);
  }

  return await mapAppealWithRelations(updated);
};

// ─── Cancel appeal (sinh viên rút đơn) ───────────────────────────────────────

const cancelAppeal = async (id, user) => {
  const pgAppeal = await prisma.appealRequest.findFirst({
    where: { id, isDeleted: false },
  });
  if (!pgAppeal) {
    throw { status: 404, message: 'Đơn phúc khảo không tồn tại.' };
  }

  if (!isStaff(user)) {
    if (!user.studentId || pgAppeal.studentId !== user.studentId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền rút đơn phúc khảo này.' };
    }
  }

  if (pgAppeal.status !== 'pending') {
    throw { status: 400, message: 'Chỉ có thể rút đơn khi đơn đang ở trạng thái chờ xử lý.' };
  }

  const updated = await prisma.appealRequest.update({
    where: { id },
    data: { status: 'cancelled', updatedAt: new Date() },
  });

  await logWorkflowEvent({
    entityId: id,
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'CANCEL_APPEAL',
  });

  return await mapAppealWithRelations(updated);
};

// ─── Link recheck score sheet (gọi từ scores.service sau khi GV nộp phiếu) ──

const linkRecheckScoreSheet = async (appealId, scoreSheetId) => {
  const pgAppeal = await prisma.appealRequest.findFirst({
    where: { id: appealId, isDeleted: false },
  });
  if (!pgAppeal || pgAppeal.status !== 'grading') return;

  await prisma.appealRequest.update({
    where: { id: appealId },
    data: { recheckScoreSheetId: scoreSheetId, updatedAt: new Date() },
  });
};

// ─── Complete appeal (giáo vụ hoàn tất phúc khảo) ───────────────────────────

const completeAppeal = async (id, user) => {
  const pgAppeal = await prisma.appealRequest.findFirst({
    where: { id, isDeleted: false },
  });
  if (!pgAppeal) {
    throw { status: 404, message: 'Đơn phúc khảo không tồn tại.' };
  }
  if (pgAppeal.status !== 'grading') {
    throw { status: 400, message: 'Chỉ có thể hoàn tất đơn đang ở trạng thái đang chấm.' };
  }

  if (!pgAppeal.recheckScoreSheetId) {
    throw { status: 400, message: 'Chưa có phiếu chấm phúc khảo. GV chấm lại cần nộp phiếu trước.' };
  }

  const pgRecheckSheet = await prisma.scoreSheet.findFirst({
    where: { id: pgAppeal.recheckScoreSheetId },
  });
  if (!pgRecheckSheet) {
    throw { status: 400, message: 'Phiếu chấm phúc khảo không tồn tại.' };
  }
  if (!pgRecheckSheet.lockedAt) {
    throw { status: 400, message: 'Phiếu chấm phúc khảo chưa được khóa. GV cần khóa phiếu trước khi hoàn tất.' };
  }

  const recheckScore = pgRecheckSheet.roundedTotal;

  const pgSupervisorSheet = await prisma.scoreSheet.findFirst({
    where: {
      projectId: pgAppeal.projectId,
      rubricRole: 'SUPERVISOR',
    },
  });
  const supervisorRaw = pgSupervisorSheet ? pgSupervisorSheet.rawTotal : 0;

  const period = await prisma.projectPeriod.findFirst({
    where: { id: pgAppeal.periodId }
  });
  let fSupervisor = 0.5;
  let fRecheck = 0.5;

  if (period && period.scoringFormula) {
    const formula = period.scoringFormula || {};
    if (formula.supervisor !== undefined) {
      fSupervisor = formula.supervisor;
    }
    const recheckWeight = formula.recheck !== undefined ? formula.recheck : (formula.reviewer !== undefined ? formula.reviewer : formula.secondMarker);
    if (recheckWeight !== undefined) {
      fRecheck = recheckWeight;
    }
  }

  const finalScoreRaw = supervisorRaw * fSupervisor + recheckScore * fRecheck;
  const finalScore = Math.round(finalScoreRaw * 10) / 10;

  const getLetterGrade = (score) => {
    if (score >= 8.5) return 'A';
    if (score >= 8.0) return 'B+';
    if (score >= 7.0) return 'B';
    if (score >= 6.5) return 'C+';
    if (score >= 5.5) return 'C';
    if (score >= 5.0) return 'D+';
    if (score >= 4.0) return 'D';
    return 'F';
  };

  const passScore = period?.passScore || 5.0;
  const letterGrade = getLetterGrade(finalScore);
  const passStatus = finalScore >= passScore ? 'passed' : 'failed';
  const componentScores = { supervisor: supervisorRaw, recheck: recheckScore };
  const now = new Date();

  await prisma.finalGrade.update({
    where: { id: pgAppeal.finalGradeId },
    data: {
      componentScores,
      finalScore,
      letterGrade,
      passStatus,
      evaluationMode: 'recheck',
      publishedAt: now,
      updatedAt: now,
    },
  });



  const updatedAppeal = await prisma.appealRequest.update({
    where: { id },
    data: { status: 'completed', resolvedAt: now, updatedAt: now },
  });

  const finalGrade = await prisma.finalGrade.findUnique({
    where: { id: pgAppeal.finalGradeId }
  });
  const finalGradeWithMirrorProps = finalGrade ? { ...finalGrade, _id: finalGrade.id } : null;

  const appeal = await mapAppealWithRelations(updatedAppeal);

  await logWorkflowEvent({
    entityId: id,
    fromStatus: 'grading',
    toStatus: 'completed',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'COMPLETE_APPEAL',
    metadata: { recheckScore, newFinalScore: finalScore, newLetterGrade: letterGrade },
  });

  try {
    const student = await prisma.student.findFirst({
      where: { id: pgAppeal.studentId, isDeleted: false },
      include: { user: true }
    });
    if (student && student.user) {
      await notificationsService.createNotification({
        recipientId: student.user.id,
        type: 'APPEAL_COMPLETED',
        title: 'Kết quả phúc khảo đã có',
        body: `Đơn phúc khảo của bạn đã được xử lý xong. Điểm mới: ${finalScore} (${letterGrade}).`,
        entityType: 'AppealRequest',
        entityId: id,
        actionUrl: `/dashboard/scores`,
      });
    }
  } catch (err) {
    console.error('Lỗi gửi thông báo hoàn tất phúc khảo:', err.message);
  }

  return { appeal, finalGrade: finalGradeWithMirrorProps };
};

// ─── Get appeals list ─────────────────────────────────────────────────────────

const getAppeals = async (queryParams = {}, user = {}) => {
  const { periodId, status, projectId, page = 1, limit = 20 } = queryParams;
  const where = { isDeleted: false };

  if (periodId) where.periodId = periodId.toString();
  if (status) where.status = status;
  if (projectId) where.projectId = projectId.toString();

  if (!isStaff(user) && !(user.roles || []).includes('LECTURER')) {
    if (!user.studentId) {
      throw { status: 403, message: 'Bạn không có quyền xem danh sách đơn phúc khảo.' };
    }
    where.studentId = user.studentId.toString();
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [appeals, total] = await Promise.all([
    prisma.appealRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.appealRequest.count({ where }),
  ]);

  const mappedAppeals = [];
  for (const app of appeals) {
    mappedAppeals.push(await mapAppealWithRelations(app));
  }

  return {
    appeals: mappedAppeals,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    limit: Number(limit),
  };
};

// ─── Get appeal by ID ─────────────────────────────────────────────────────────

const getAppealById = async (id, user = {}) => {
  const appeal = await prisma.appealRequest.findFirst({
    where: { id: id.toString(), isDeleted: false }
  });
  if (!appeal) {
    throw { status: 404, message: 'Đơn phúc khảo không tồn tại.' };
  }

  const mapped = await mapAppealWithRelations(appeal);

  if (!isStaff(user) && !(user.roles || []).includes('LECTURER')) {
    if (!user.studentId || mapped.studentId._id.toString() !== user.studentId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền xem đơn phúc khảo này.' };
    }
  }

  return mapped;
};

// ─── Get student's own appeals ────────────────────────────────────────────────

const getMyAppeals = async (user) => {
  if (!user.studentId) {
    throw { status: 403, message: 'Chỉ sinh viên mới có thể xem đơn phúc khảo của mình.' };
  }

  const appeals = await prisma.appealRequest.findMany({
    where: { studentId: user.studentId.toString(), isDeleted: false },
    orderBy: { createdAt: 'desc' }
  });

  const mapped = [];
  for (const app of appeals) {
    mapped.push(await mapAppealWithRelations(app));
  }
  return mapped;
};

module.exports = {
  submitAppeal,
  assignRecheck,
  cancelAppeal,
  linkRecheckScoreSheet,
  completeAppeal,
  getAppeals,
  getAppealById,
  getMyAppeals,
};
