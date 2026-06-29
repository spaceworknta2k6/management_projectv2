const AppealRequest = require('../../models/AppealRequest');
const Project = require('../../models/Project');
const ProjectPeriod = require('../../models/ProjectPeriod');
const FinalGrade = require('../../models/FinalGrade');
const ScoreSheet = require('../../models/ScoreSheet');
const Student = require('../../models/Student');
const Lecturer = require('../../models/Lecturer');
const WorkflowEvent = require('../../models/WorkflowEvent');
const notificationsService = require('../notifications/notifications.service');

const isStaff = (user = {}) =>
  (user.roles || []).some((r) => ['FACULTY_STAFF', 'DEPARTMENT_STAFF', 'SYSTEM_ADMIN'].includes(r));

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

  // Kiểm tra sinh viên thuộc project
  const studentId = user.studentId;
  const isOwner =
    (project.ownerType === 'student' && project.studentId?.toString() === studentId.toString()) ||
    (project.ownerType === 'group' && project.groupId);

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

  // Kiểm tra deadline phúc khảo
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

  // Kiểm tra unique: 1 đơn/dự án/sinh viên/đợt
  const existing = await AppealRequest.findOne({
    projectId: project._id,
    studentId,
    periodId: period._id,
  });
  if (existing) {
    throw { status: 409, message: 'Bạn đã có đơn phúc khảo cho dự án này trong đợt hiện tại.' };
  }

  const appeal = new AppealRequest({
    projectId: project._id,
    studentId,
    periodId: period._id,
    finalGradeId: finalGrade._id,
    reason: reason.trim(),
    status: 'pending',
  });

  await appeal.save();

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

  const appeal = await AppealRequest.findById(id).populate('projectId');
  if (!appeal) {
    throw { status: 404, message: 'Đơn phúc khảo không tồn tại.' };
  }
  if (appeal.status !== 'pending') {
    throw { status: 400, message: 'Chỉ có thể phân công cho đơn đang ở trạng thái chờ xử lý.' };
  }

  const project = appeal.projectId;

  // GV chấm lại phải khác GVHD và GV chấm ban đầu
  const supervisorId = project.supervisorId?.toString();
  const reviewerId = project.reviewerId?.toString();
  if (recheckGraderId === supervisorId || recheckGraderId === reviewerId) {
    throw {
      status: 400,
      message: 'Giảng viên chấm lại phải là người khác với Giảng viên hướng dẫn và Giảng viên chấm ban đầu.',
    };
  }

  // Tìm giảng viên bằng lecturerId hoặc userId
  let lecturer = await Lecturer.findById(recheckGraderId).populate('userId');
  if (!lecturer) {
    lecturer = await Lecturer.findOne({ userId: recheckGraderId }).populate('userId');
  }
  if (!lecturer) {
    throw { status: 404, message: 'Giảng viên chấm lại không tồn tại.' };
  }

  // Cập nhật recheckGraderId thực tế của Lecturer
  const resolvedGraderId = lecturer._id;

  const fromStatus = appeal.status;
  appeal.recheckGraderId = resolvedGraderId;
  appeal.adminNote = adminNote ? adminNote.trim() : undefined;
  appeal.feePaidAt = feePaidAt ? new Date(feePaidAt) : new Date();
  appeal.status = 'grading';

  await appeal.save();

  await logWorkflowEvent({
    entityId: appeal._id,
    fromStatus,
    toStatus: 'grading',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'ASSIGN_RECHECK_GRADER',
    reason: adminNote || '',
    metadata: { recheckGraderId: resolvedGraderId, feePaidAt: appeal.feePaidAt },
  });

  // Thông báo cho GV được phân công
  try {
    if (lecturer.userId) {
      await notificationsService.createNotification({
        recipientId: lecturer.userId._id,
        type: 'APPEAL_GRADER_ASSIGNED',
        title: 'Bạn được phân công chấm phúc khảo',
        body: `Bạn được phân công chấm phiếu phúc khảo cho một dự án đồ án.${adminNote ? ` Ghi chú: "${adminNote.trim()}"` : ''}`,
        entityType: 'AppealRequest',
        entityId: appeal._id,
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
  const appeal = await AppealRequest.findById(id);
  if (!appeal) {
    throw { status: 404, message: 'Đơn phúc khảo không tồn tại.' };
  }

  if (!isStaff(user)) {
    if (!user.studentId || appeal.studentId.toString() !== user.studentId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền rút đơn phúc khảo này.' };
    }
  }

  if (appeal.status !== 'pending') {
    throw { status: 400, message: 'Chỉ có thể rút đơn khi đơn đang ở trạng thái chờ xử lý.' };
  }

  appeal.status = 'cancelled';
  await appeal.save();

  await logWorkflowEvent({
    entityId: appeal._id,
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
  const appeal = await AppealRequest.findById(appealId);
  if (!appeal || appeal.status !== 'grading') return;

  appeal.recheckScoreSheetId = scoreSheetId;
  await appeal.save();
};

// ─── Complete appeal (giáo vụ hoàn tất phúc khảo) ───────────────────────────

const completeAppeal = async (id, user) => {
  const appeal = await AppealRequest.findById(id).populate('recheckScoreSheetId');
  if (!appeal) {
    throw { status: 404, message: 'Đơn phúc khảo không tồn tại.' };
  }
  if (appeal.status !== 'grading') {
    throw { status: 400, message: 'Chỉ có thể hoàn tất đơn đang ở trạng thái đang chấm.' };
  }

  const recheckSheet = appeal.recheckScoreSheetId;
  if (!recheckSheet) {
    throw { status: 400, message: 'Chưa có phiếu chấm phúc khảo. GV chấm lại cần nộp phiếu trước.' };
  }
  if (!recheckSheet.lockedAt) {
    throw { status: 400, message: 'Phiếu chấm phúc khảo chưa được khóa. GV cần khóa phiếu trước khi hoàn tất.' };
  }

  // Tổng hợp lại FinalGrade với điểm phúc khảo
  const finalGrade = await FinalGrade.findById(appeal.finalGradeId);
  if (!finalGrade) {
    throw { status: 404, message: 'Điểm tổng kết gốc không tồn tại.' };
  }

  // Lấy điểm phúc khảo — dùng trực tiếp từ phiếu RECHECK
  const recheckScore = recheckSheet.roundedTotal;

  // Lấy điểm cũ của component còn lại (SUPERVISOR)
  const supervisorSheet = await ScoreSheet.findOne({
    projectId: appeal.projectId,
    rubricRole: 'SUPERVISOR',
  });

  const period = await ProjectPeriod.findById(appeal.periodId);
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

  const supervisorRaw = supervisorSheet ? supervisorSheet.rawTotal : 0;
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
  finalGrade.componentScores = new Map([
    ['supervisor', supervisorRaw],
    ['recheck', recheckScore],
  ]);
  finalGrade.finalScore = finalScore;
  finalGrade.letterGrade = getLetterGrade(finalScore);
  finalGrade.passStatus = finalScore >= passScore ? 'passed' : 'failed';
  finalGrade.evaluationMode = 'recheck';
  // Điểm phúc khảo cũng cần publish lại
  finalGrade.publishedAt = new Date();

  await finalGrade.save();

  // Hoàn tất đơn
  const fromStatus = appeal.status;
  appeal.status = 'completed';
  appeal.resolvedAt = new Date();
  await appeal.save();

  await logWorkflowEvent({
    entityId: appeal._id,
    fromStatus,
    toStatus: 'completed',
    actorId: user._id,
    actorRoles: user.roles || [],
    action: 'COMPLETE_APPEAL',
    metadata: {
      recheckScore,
      newFinalScore: finalScore,
      newLetterGrade: finalGrade.letterGrade,
    },
  });

  // Thông báo cho sinh viên
  try {
    const student = await Student.findById(appeal.studentId).populate('userId');
    if (student && student.userId) {
      await notificationsService.createNotification({
        recipientId: student.userId._id,
        type: 'APPEAL_COMPLETED',
        title: 'Kết quả phúc khảo đã có',
        body: `Đơn phúc khảo của bạn đã được xử lý xong. Điểm mới: ${finalScore} (${finalGrade.letterGrade}).`,
        entityType: 'AppealRequest',
        entityId: appeal._id,
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

  // Sinh viên chỉ thấy đơn của mình
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
