const mongoose = require('mongoose');
const AppealRequest = require('../../models/AppealRequest');
const Project = require('../../models/Project');
const ProjectPeriod = require('../../models/ProjectPeriod');
const FinalGrade = require('../../models/FinalGrade');
const ScoreSheet = require('../../models/ScoreSheet');
const Student = require('../../models/Student');
const Lecturer = require('../../models/Lecturer');
const WorkflowEvent = require('../../models/WorkflowEvent');
const notificationsService = require('../notifications/notifications.service');
const prisma = require('../../config/prisma');

const isStaff = (user = {}) =>
  (user.roles || []).some((r) => ['FACULTY_STAFF', 'SYSTEM_ADMIN'].includes(r));

const logWorkflowEvent = (data) =>
  WorkflowEvent.create({
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

// ─── Mirror helper ────────────────────────────────────────────────────────────

const toMongoAppealData = (pgAppeal) => ({
  projectId: pgAppeal.projectId,
  studentId: pgAppeal.studentId,
  periodId: pgAppeal.periodId,
  finalGradeId: pgAppeal.finalGradeId,
  reason: pgAppeal.reason,
  status: pgAppeal.status,
  feePaidAt: pgAppeal.feePaidAt || undefined,
  recheckGraderId: pgAppeal.recheckGraderId || undefined,
  recheckScoreSheetId: pgAppeal.recheckScoreSheetId || undefined,
  adminNote: pgAppeal.adminNote || undefined,
  resolvedAt: pgAppeal.resolvedAt || undefined,
  isDeleted: pgAppeal.isDeleted,
  deletedAt: pgAppeal.deletedAt || undefined,
  deletedBy: pgAppeal.deletedBy || undefined,
  createdAt: pgAppeal.createdAt,
  updatedAt: pgAppeal.updatedAt,
});

const syncMongoMirror = async (pgAppeal) => {
  const filter = { _id: pgAppeal.mongoId || pgAppeal.id };
  await AppealRequest.findOneAndUpdate(
    filter,
    { $set: toMongoAppealData(pgAppeal) },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  ).setOptions({ includeDeleted: true });
};

// ─── Submit appeal (sinh viên nộp đơn) ───────────────────────────────────────

const submitAppeal = async (data, user) => {
  const { projectId, reason } = data;

  if (!user.studentId) {
    throw { status: 403, message: 'Chỉ sinh viên mới có thể nộp đơn phúc khảo.' };
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }

  const studentId = user.studentId;

  if (project.ownerType === 'student' && project.studentId?.toString() !== studentId.toString()) {
    throw { status: 403, message: 'Bạn không phải chủ nhân của dự án này.' };
  }

  if (project.ownerType === 'group') {
    const ProjectGroup = require('../../models/ProjectGroup');
    const group = await ProjectGroup.findById(project.groupId);
    if (!group || !group.members.some(
      (m) => m.studentId.toString() === studentId.toString() && m.status === 'accepted'
    )) {
      throw { status: 403, message: 'Bạn không thuộc nhóm thực hiện dự án này.' };
    }
  }

  const period = await ProjectPeriod.findById(project.periodId);
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

  const finalGrade = await FinalGrade.findOne({ projectId: project._id });
  if (!finalGrade) {
    throw { status: 404, message: 'Chưa có điểm tổng kết để phúc khảo.' };
  }
  if (!finalGrade.publishedAt) {
    throw { status: 400, message: 'Điểm chưa được công bố, không thể phúc khảo.' };
  }

  // Kiểm tra unique: 1 đơn/dự án/sinh viên/đợt — kiểm tra trên Postgres
  const existing = await prisma.appealRequest.findFirst({
    where: {
      projectId: project._id.toString(),
      studentId: studentId.toString(),
      periodId: period._id.toString(),
      isDeleted: false,
    },
  });
  if (existing) {
    throw { status: 409, message: 'Bạn đã có đơn phúc khảo cho dự án này trong đợt hiện tại.' };
  }

  const newId = new mongoose.Types.ObjectId().toString();
  const now = new Date();

  // Tạo trên Postgres trước
  const pgAppeal = await prisma.appealRequest.create({
    data: {
      id: newId,
      mongoId: newId,
      projectId: project._id.toString(),
      studentId: studentId.toString(),
      periodId: period._id.toString(),
      finalGradeId: finalGrade._id.toString(),
      reason: reason.trim(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
  });

  // Mirror về MongoDB
  const appeal = await AppealRequest.create({
    _id: newId,
    projectId: project._id,
    studentId,
    periodId: period._id,
    finalGradeId: finalGrade._id,
    reason: reason.trim(),
    status: 'pending',
  });

  await logWorkflowEvent({
    entityId: appeal._id,
    toStatus: 'pending',
    actorId: user._id,
    actorRoles: ['STUDENT'],
    action: 'SUBMIT_APPEAL',
    reason: appeal.reason,
    metadata: { projectId: project._id, periodId: period._id },
  });

  return appeal;
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

  const project = await Project.findById(pgAppeal.projectId);

  const supervisorId = project?.supervisorId?.toString();
  const reviewerId = project?.reviewerId?.toString();
  if (recheckGraderId === supervisorId || recheckGraderId === reviewerId) {
    throw {
      status: 400,
      message: 'Giảng viên chấm lại phải là người khác với Giảng viên hướng dẫn và Giảng viên chấm ban đầu.',
    };
  }

  let lecturer = await Lecturer.findById(recheckGraderId).populate('userId');
  if (!lecturer) {
    lecturer = await Lecturer.findOne({ userId: recheckGraderId }).populate('userId');
  }
  if (!lecturer) {
    throw { status: 404, message: 'Giảng viên chấm lại không tồn tại.' };
  }

  const resolvedGraderId = lecturer._id.toString();
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

  await syncMongoMirror(updated);

  // Lấy lại document MongoDB đã được populate để trả về
  const appeal = await AppealRequest.findById(id).populate('projectId');

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
    if (lecturer.userId) {
      await notificationsService.createNotification({
        recipientId: lecturer.userId._id,
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

  return appeal;
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

  await syncMongoMirror(updated);

  const appeal = await AppealRequest.findById(id);

  await logWorkflowEvent({
    entityId: id,
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'CANCEL_APPEAL',
  });

  return appeal;
};

// ─── Link recheck score sheet (gọi từ scores.service sau khi GV nộp phiếu) ──

const linkRecheckScoreSheet = async (appealId, scoreSheetId) => {
  const pgAppeal = await prisma.appealRequest.findFirst({
    where: { id: appealId, isDeleted: false },
  });
  if (!pgAppeal || pgAppeal.status !== 'grading') return;

  const updated = await prisma.appealRequest.update({
    where: { id: appealId },
    data: { recheckScoreSheetId: scoreSheetId, updatedAt: new Date() },
  });

  await syncMongoMirror(updated);
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

  // Kiểm tra phiếu đã được khóa chưa (từ Postgres ScoreSheet)
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

  // Lấy điểm SUPERVISOR từ Postgres
  const pgSupervisorSheet = await prisma.scoreSheet.findFirst({
    where: {
      projectId: pgAppeal.projectId,
      rubricRole: 'SUPERVISOR',
    },
  });
  const supervisorRaw = pgSupervisorSheet ? pgSupervisorSheet.rawTotal : 0;

  // Lấy hệ số từ period
  const period = await ProjectPeriod.findById(pgAppeal.periodId);
  let fSupervisor = 0.5;
  let fRecheck = 0.5;

  if (period && period.scoringFormula) {
    if (period.scoringFormula.get('supervisor') !== undefined) {
      fSupervisor = period.scoringFormula.get('supervisor');
    }
    const recheckWeight = period.scoringFormula.get('recheck') || period.scoringFormula.get('reviewer') || period.scoringFormula.get('secondMarker');
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

  // Cập nhật FinalGrade trên Postgres
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

  // Đồng bộ FinalGrade về MongoDB
  await FinalGrade.findByIdAndUpdate(pgAppeal.finalGradeId, {
    $set: {
      componentScores,
      finalScore,
      letterGrade,
      passStatus,
      evaluationMode: 'recheck',
      publishedAt: now,
    },
  });

  // Cập nhật AppealRequest trên Postgres
  const updatedAppeal = await prisma.appealRequest.update({
    where: { id },
    data: { status: 'completed', resolvedAt: now, updatedAt: now },
  });
  await syncMongoMirror(updatedAppeal);

  const finalGrade = await FinalGrade.findById(pgAppeal.finalGradeId);
  const appeal = await AppealRequest.findById(id);

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
    const student = await Student.findById(pgAppeal.studentId).populate('userId');
    if (student && student.userId) {
      await notificationsService.createNotification({
        recipientId: student.userId._id,
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

  return { appeal, finalGrade };
};

// ─── Get appeals list ─────────────────────────────────────────────────────────

const getAppeals = async (queryParams = {}, user = {}) => {
  const { periodId, status, projectId, page = 1, limit = 20 } = queryParams;
  const filter = {};

  if (periodId) filter.periodId = periodId;
  if (status) filter.status = status;
  if (projectId) filter.projectId = projectId;

  if (!isStaff(user) && !(user.roles || []).includes('LECTURER')) {
    if (!user.studentId) {
      throw { status: 403, message: 'Bạn không có quyền xem danh sách đơn phúc khảo.' };
    }
    filter.studentId = user.studentId;
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [appeals, total] = await Promise.all([
    AppealRequest.find(filter)
      .populate({ path: 'studentId', populate: { path: 'userId', select: 'fullName email' } })
      .populate({ path: 'projectId', select: 'status topicId supervisorId reviewerId', populate: { path: 'topicId', select: 'title' } })
      .populate({ path: 'finalGradeId', select: 'finalScore letterGrade passStatus evaluationMode' })
      .populate({ path: 'recheckGraderId', populate: { path: 'userId', select: 'fullName email' } })
      .populate({ path: 'recheckScoreSheetId', select: 'roundedTotal lockedAt' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    AppealRequest.countDocuments(filter),
  ]);

  return {
    appeals,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    limit: Number(limit),
  };
};

// ─── Get appeal by ID ─────────────────────────────────────────────────────────

const getAppealById = async (id, user = {}) => {
  const appeal = await AppealRequest.findById(id)
    .populate({ path: 'studentId', populate: { path: 'userId', select: 'fullName email studentCode className' } })
    .populate({ path: 'projectId', select: 'status topicId supervisorId reviewerId', populate: { path: 'topicId', select: 'title' } })
    .populate({ path: 'finalGradeId', select: 'finalScore letterGrade passStatus componentScores evaluationMode publishedAt' })
    .populate({ path: 'recheckGraderId', populate: { path: 'userId', select: 'fullName email' } })
    .populate({ path: 'recheckScoreSheetId', select: 'criteriaScores roundedTotal rawTotal comment lockedAt' });

  if (!appeal) {
    throw { status: 404, message: 'Đơn phúc khảo không tồn tại.' };
  }

  if (!isStaff(user) && !(user.roles || []).includes('LECTURER')) {
    if (!user.studentId || appeal.studentId._id.toString() !== user.studentId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền xem đơn phúc khảo này.' };
    }
  }

  return appeal;
};

// ─── Get student's own appeals ────────────────────────────────────────────────

const getMyAppeals = async (user) => {
  if (!user.studentId) {
    throw { status: 403, message: 'Chỉ sinh viên mới có thể xem đơn phúc khảo của mình.' };
  }

  return AppealRequest.find({ studentId: user.studentId })
    .populate({ path: 'projectId', select: 'status topicId', populate: { path: 'topicId', select: 'title' } })
    .populate({ path: 'finalGradeId', select: 'finalScore letterGrade passStatus evaluationMode' })
    .populate({ path: 'recheckScoreSheetId', select: 'roundedTotal lockedAt' })
    .sort({ createdAt: -1 });
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
