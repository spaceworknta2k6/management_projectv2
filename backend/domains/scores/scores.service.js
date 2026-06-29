const ScoreSheet = require('../../models/ScoreSheet');
const FinalGrade = require('../../models/FinalGrade');
const Project = require('../../models/Project');
const ProjectPeriod = require('../../models/ProjectPeriod');
const EvaluationRubric = require('../../models/EvaluationRubric');
const { assertProjectAccess, canAccessProject, isStaff } = require('../../utils/access-control');
const { resolveProjectOwner } = require('../../utils/project-owner');

const assertScoreSheetPermission = async (project, rubricRole, user) => {
  if (!project || !user?.lecturerId) {
    throw { status: 403, message: 'Bạn không có quyền chấm điểm dự án này.' };
  }

  const lecturerId = user.lecturerId.toString();
  const supervisorId = project.supervisorId?.toString();
  const reviewerId = project.reviewerId?.toString();

  if (rubricRole === 'SUPERVISOR' && supervisorId === lecturerId) return;
  if ((rubricRole === 'REVIEWER' || rubricRole === 'SECOND_MARKER') && reviewerId === lecturerId) return;

  // Cho phép GV được phân công chấm phúc khảo
  if (rubricRole === 'RECHECK') {
    const AppealRequest = require('../../models/AppealRequest');
    const appeal = await AppealRequest.findOne({
      projectId: project._id,
      recheckGraderId: user.lecturerId,
      status: 'grading',
    });
    if (appeal) return;
  }

  throw { status: 403, message: 'Bạn không được phân công chấm điểm dự án này.' };
};

const assertSheetOwner = (sheet, user) => {
  if (!user?.lecturerId || sheet.graderId.toString() !== user.lecturerId.toString()) {
    throw { status: 403, message: 'Bạn không có quyền chỉnh sửa phiếu điểm này.' };
  }
};

const submitScoreSheet = async (data, user) => {
  const { projectId, groupId, periodId, rubricRole, targetType, targetId, criteriaScores, comment } = data;
  
  if (!user.lecturerId) {
    throw { status: 403, message: 'Người dùng không được liên kết với hồ sơ Giảng viên.' };
  }
  const graderId = user.lecturerId;

  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }
  
  const isGroup = project.ownerType === 'group';
  if ((isGroup && project.groupId?.toString() !== groupId?.toString()) || project.periodId.toString() !== periodId.toString()) {
    throw { status: 400, message: 'Thông tin projectId, groupId và periodId không khớp.' };
  }
  await assertScoreSheetPermission(project, rubricRole, user);

  const period = await ProjectPeriod.findById(periodId);
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  let rubricIdToSave = data.rubricId || period.rubricId;
  let rubricVersionToSave = data.rubricVersion || '1.0';
  let finalCriteriaScores = criteriaScores;

  if (period.rubricId) {
    const activeRubric = await EvaluationRubric.findOne({ _id: period.rubricId, isDeleted: { $ne: true } });
    if (activeRubric) {
      rubricIdToSave = activeRubric._id;
      rubricVersionToSave = activeRubric.version;
      const rubricCriteria = activeRubric.criteria[rubricRole]
        || (rubricRole === 'RECHECK' ? activeRubric.criteria.REVIEWER || activeRubric.criteria.SECOND_MARKER : null);
      if (!rubricCriteria || rubricCriteria.length === 0) {
        throw { status: 400, message: `Không tìm thấy tiêu chí chấm điểm nào cho vai trò ${rubricRole} trong Rubric.` };
      }

      const validatedCriteriaScores = [];
      for (const item of rubricCriteria) {
        const clientItem = criteriaScores.find(c => c.criteriaCode === item.criteriaCode);
        if (!clientItem) {
          throw { status: 400, message: `Thiếu điểm cho tiêu chí: ${item.criteriaName} (${item.criteriaCode})` };
        }
        const scoreNum = Number(clientItem.score);
        if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > item.maxScore) {
          throw { status: 400, message: `Điểm tiêu chí "${item.criteriaName}" không hợp lệ. Phải từ 0 đến ${item.maxScore}.` };
        }
        validatedCriteriaScores.push({
          criteriaCode: item.criteriaCode,
          criteriaName: item.criteriaName,
          maxScore: item.maxScore,
          weight: item.weight,
          score: scoreNum
        });
      }
      finalCriteriaScores = validatedCriteriaScores;
    }
  }

  const rawTotal = finalCriteriaScores.reduce((acc, c) => acc + (c.score * (c.weight !== undefined ? c.weight : 1.0)), 0);
  const roundedTotal = Math.round(rawTotal * 100) / 100;

  const existing = await ScoreSheet.findOne({ targetType, targetId, graderId });

  if (existing) {
    if (existing.lockedAt) {
      throw { status: 400, message: 'Phiếu điểm này đã được khóa và không thể chỉnh sửa.' };
    }

    const clientVersion = data.version;
    if (clientVersion === undefined) {
      throw { status: 400, message: 'Cập nhật yêu cầu cung cấp trường version để thực hiện Khóa lạc quan (Optimistic Locking).' };
    }

    if (existing.version !== Number(clientVersion)) {
      throw {
        status: 409,
        message: 'Xung đột phiên bản: Dữ liệu phiếu điểm đã được thay đổi bởi một phiên làm việc khác. Vui lòng tải lại.'
      };
    }

    existing.criteriaScores = finalCriteriaScores;
    existing.rawTotal = rawTotal;
    existing.roundedTotal = roundedTotal;
    existing.comment = comment;
    existing.rubricId = rubricIdToSave;
    existing.rubricVersion = rubricVersionToSave;
    if (data.consentForDefense !== undefined) {
      existing.consentForDefense = data.consentForDefense;
    }
    existing.version = existing.version + 1;

    return await existing.save();
  } else {
    let graderRole = data.graderRole;
    if (!graderRole) {
      if (rubricRole === 'SUPERVISOR') {
        graderRole = 'SUPERVISOR';
      } else if (rubricRole === 'REVIEWER' || rubricRole === 'SECOND_MARKER') {
        graderRole = 'REVIEWER';
      }
    }

    if (!graderRole) {
      graderRole = user.roles && user.roles.length > 0 ? user.roles[0] : 'LECTURER';
    }

    const owner = resolveProjectOwner(project);
    const sheet = new ScoreSheet({
      rubricId: rubricIdToSave,
      rubricRole,
      rubricVersion: rubricVersionToSave,
      targetType,
      targetId,
      projectId,
      ownerType: owner?.ownerType,
      ownerId: owner?.ownerId,
      studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
      groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
      periodId,
      graderId,
      graderRole,
      criteriaScores: finalCriteriaScores,
      rawTotal,
      roundedTotal,
      comment,
      consentForDefense: data.consentForDefense !== undefined ? data.consentForDefense : true,
      version: 0
    });

    const savedSheet = await sheet.save();

    // Tự động link phiếu RECHECK vào AppealRequest
    if (targetType === 'RECHECK') {
      try {
        const appealsService = require('../appeals/appeals.service');
        const AppealRequest = require('../../models/AppealRequest');
        const appeal = await AppealRequest.findOne({
          projectId,
          recheckGraderId: graderId,
          status: 'grading',
        });
        if (appeal) {
          await appealsService.linkRecheckScoreSheet(appeal._id, savedSheet._id);
        }
      } catch (linkErr) {
        console.error('Lỗi khi link phiếu RECHECK vào đơn phúc khảo:', linkErr.message);
      }
    }

    return savedSheet;
  }
};

const getScoreSheets = async (query = {}, user = {}) => {
  const sheets = await ScoreSheet.find(query).populate('graderId').populate('projectId');
  if (isStaff(user)) {
    return sheets;
  }

  const visibleSheets = [];
  for (const sheet of sheets) {
    if (await canAccessProject(sheet.projectId, user)) {
      visibleSheets.push(sheet);
    }
  }

  return visibleSheets;
};

const getProjectsSummary = async (query = {}, user = {}) => {
  const projectQuery = {};
  if (query.periodId) {
    projectQuery.periodId = query.periodId;
  }

  const projects = await Project.find(projectQuery)
    .populate({
      path: 'groupId',
      select: 'name members status',
    })
    .populate({
      path: 'studentId',
      populate: { path: 'userId', select: 'fullName email' },
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

  const visibleProjects = [];
  for (const project of projects) {
    if (isStaff(user) || await canAccessProject(project, user)) {
      visibleProjects.push(project);
    }
  }

  if (visibleProjects.length === 0) {
    return [];
  }

  const projectIds = visibleProjects.map((project) => project._id);
  const [sheets, grades] = await Promise.all([
    ScoreSheet.find({ projectId: { $in: projectIds } }).populate('graderId'),
    FinalGrade.find({ projectId: { $in: projectIds } }),
  ]);

  const sheetsByProjectId = new Map();
  for (const sheet of sheets) {
    const key = sheet.projectId.toString();
    const bucket = sheetsByProjectId.get(key) || [];
    bucket.push(sheet);
    sheetsByProjectId.set(key, bucket);
  }

  const gradesByProjectId = new Map();
  for (const grade of grades) {
    gradesByProjectId.set(grade.projectId.toString(), grade);
  }

  return visibleProjects.map((project) => {
    const finalGrade = gradesByProjectId.get(project._id.toString()) || null;
    const canSeeFinalGrade = !user.studentId || finalGrade?.publishedAt;

    return {
      ...project.toObject(),
      sheets: sheetsByProjectId.get(project._id.toString()) || [],
      finalGrade: canSeeFinalGrade ? finalGrade : null,
    };
  });
};

const getScoreSheetById = async (id, user = {}) => {
  const sheet = await ScoreSheet.findById(id).populate('graderId').populate('projectId');
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }
  await assertProjectAccess(sheet.projectId, user);
  return sheet;
};

const updateScoreSheet = async (id, data, user) => {
  const sheet = await ScoreSheet.findById(id);
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }

  assertSheetOwner(sheet, user);

  if (sheet.lockedAt) {
    throw { status: 400, message: 'Phiếu điểm này đã được khóa và không thể chỉnh sửa.' };
  }

  const clientVersion = data.version;
  if (clientVersion === undefined) {
    throw { status: 400, message: 'Cập nhật yêu cầu cung cấp trường version để thực hiện Khóa lạc quan.' };
  }

  if (sheet.version !== Number(clientVersion)) {
    throw {
      status: 409,
      message: 'Xung đột phiên bản: Dữ liệu phiếu điểm đã được thay đổi bởi một phiên làm việc khác.'
    };
  }

  if (data.criteriaScores) {
    let finalCriteriaScores = data.criteriaScores;
    const period = await ProjectPeriod.findById(sheet.periodId);
    if (period && period.rubricId) {
      const activeRubric = await EvaluationRubric.findOne({ _id: period.rubricId, isDeleted: { $ne: true } });
      if (activeRubric) {
        const rubricCriteria = activeRubric.criteria[sheet.rubricRole]
          || (sheet.rubricRole === 'RECHECK' ? activeRubric.criteria.REVIEWER || activeRubric.criteria.SECOND_MARKER : null);
        if (!rubricCriteria || rubricCriteria.length === 0) {
          throw { status: 400, message: `Không tìm thấy tiêu chí chấm điểm nào cho vai trò ${sheet.rubricRole} trong Rubric.` };
        }

        const validatedCriteriaScores = [];
        for (const item of rubricCriteria) {
          const clientItem = data.criteriaScores.find(c => c.criteriaCode === item.criteriaCode);
          if (!clientItem) {
            throw { status: 400, message: `Thiếu điểm cho tiêu chí: ${item.criteriaName} (${item.criteriaCode})` };
          }
          const scoreNum = Number(clientItem.score);
          if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > item.maxScore) {
            throw { status: 400, message: `Điểm tiêu chí "${item.criteriaName}" không hợp lệ. Phải từ 0 đến ${item.maxScore}.` };
          }
          validatedCriteriaScores.push({
            criteriaCode: item.criteriaCode,
            criteriaName: item.criteriaName,
            maxScore: item.maxScore,
            weight: item.weight,
            score: scoreNum
          });
        }
        finalCriteriaScores = validatedCriteriaScores;
      }
    }
    sheet.criteriaScores = finalCriteriaScores;
    const rawTotal = finalCriteriaScores.reduce((acc, c) => acc + (c.score * (c.weight !== undefined ? c.weight : 1.0)), 0);
    sheet.rawTotal = rawTotal;
    sheet.roundedTotal = Math.round(rawTotal * 100) / 100;
  }
  if (data.comment !== undefined) sheet.comment = data.comment;
  if (data.consentForDefense !== undefined) sheet.consentForDefense = data.consentForDefense;

  sheet.version = sheet.version + 1;
  return await sheet.save();
};

const lockScoreSheet = async (id, user = {}) => {
  const sheet = await ScoreSheet.findById(id);
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }

  assertSheetOwner(sheet, user);

  sheet.lockedAt = new Date();
  return await sheet.save();
};

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

const aggregateFinalGrade = async (projectId, user) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw { status: 404, message: 'Dự án đồ án không tồn tại.' };
  }
  await assertProjectAccess(project, user);

  const period = await ProjectPeriod.findOne({ _id: project.periodId, isDeleted: { $ne: true } });
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const threshold = period.varianceThreshold || 2.0;

  // Find all score sheets for this project
  const sheets = await ScoreSheet.find({ projectId });
  
  const supervisorSheet = sheets.find(s => s.rubricRole === 'SUPERVISOR');
  const reviewerSheet = sheets.find(s => s.rubricRole === 'REVIEWER' || s.rubricRole === 'SECOND_MARKER');

  if (!supervisorSheet) {
    throw { status: 400, message: 'Chưa có phiếu chấm điểm của Giảng viên hướng dẫn.' };
  }
  if (!reviewerSheet) {
    throw { status: 400, message: 'Chưa có phiếu chấm điểm của Giảng viên chấm thứ hai.' };
  }

  // Ensure supervisor and reviewer sheets are locked
  if (!supervisorSheet.lockedAt || !reviewerSheet.lockedAt) {
    throw { status: 400, message: 'Chưa thể tổng hợp điểm do còn phiếu chấm chưa được khóa.' };
  }

  // Intermediate score aggregation with full database float precision
  const supervisorRaw = supervisorSheet.rawTotal;
  const reviewerRaw = reviewerSheet.rawTotal;
  
  // Fetch scoring formula from period (default to 50% supervisor, 50% reviewer/second marker)
  let fSupervisor = 0.5;
  let fReviewer = 0.5;

  if (period.scoringFormula) {
    const hasSupervisor = period.scoringFormula.get('supervisor') !== undefined;
    const hasReviewer = period.scoringFormula.get('reviewer') !== undefined;
    const hasSecondMarker = period.scoringFormula.get('secondMarker') !== undefined;
    
    if (hasSupervisor) {
      fSupervisor = period.scoringFormula.get('supervisor');
    }
    if (hasSecondMarker) {
      fReviewer = period.scoringFormula.get('secondMarker');
    } else if (hasReviewer) {
      fReviewer = period.scoringFormula.get('reviewer');
    }
  }

  const finalScoreRaw = (supervisorRaw * fSupervisor) + (reviewerRaw * fReviewer);

  // Single rounding step at the very end to prevent compounding precision loss
  const finalScore = Math.round(finalScoreRaw * 10) / 10;

  const letterGrade = getLetterGrade(finalScore);

  const passScore = period.passScore || 5.0;
  const passStatus = finalScore >= passScore ? 'passed' : 'failed';

  // Check score variance flags
  const varianceFlags = [];

  if (Math.abs(supervisorRaw - reviewerRaw) >= threshold) {
    varianceFlags.push({
      type: 'supervisor_reviewer_variance',
      maxDifference: Math.abs(supervisorRaw - reviewerRaw)
    });
  }

  const componentScores = {
    supervisor: supervisorRaw,
    reviewer: reviewerRaw
  };

  const existingGrade = await FinalGrade.findOne({ projectId });

  let grade;
  if (existingGrade) {
    existingGrade.componentScores = componentScores;
    existingGrade.finalScore = finalScore;
    existingGrade.letterGrade = letterGrade;
    existingGrade.passStatus = passStatus;
    existingGrade.varianceFlags = varianceFlags;
    existingGrade.formulaVersion = period.rubricVersion || '1.0';
    existingGrade.evaluationMode = 'non_defense';
    grade = await existingGrade.save();
  } else {
    const owner = resolveProjectOwner(project);
    grade = new FinalGrade({
      projectId,
      ownerType: owner?.ownerType,
      ownerId: owner?.ownerId,
      studentId: owner?.ownerType === 'student' ? (owner.studentId || owner.ownerId) : undefined,
      groupId: owner?.ownerType === 'group' ? (owner.groupId || owner.ownerId) : undefined,
      periodId: project.periodId,
      evaluationMode: 'non_defense',
      componentScores,
      finalScore,
      letterGrade,
      passStatus,
      varianceFlags,
      formulaVersion: period.rubricVersion || '1.0'
    });
    grade = await grade.save();
  }

  return grade;
};

const getFinalGrade = async (id, user = {}) => {
  const grade = await FinalGrade.findById(id).populate('projectId');
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }
  await assertProjectAccess(grade.projectId, user);

  if (user.studentId && !grade.publishedAt) {
    throw { status: 403, message: 'Điểm số của dự án này chưa được công bố.' };
  }

  return grade;
};

const getFinalGradeByProjectId = async (projectId, user = {}) => {
  const grade = await FinalGrade.findOne({ projectId }).populate('projectId');
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }
  await assertProjectAccess(grade.projectId, user);

  if (user.studentId && !grade.publishedAt) {
    throw { status: 403, message: 'Điểm số của dự án này chưa được công bố.' };
  }

  return grade;
};

const publishFinalGrade = async (id, userId) => {
  const grade = await FinalGrade.findById(id);
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }

  const activeVariance = grade.varianceFlags.find(f => !f.resolvedAt);
  if (activeVariance) {
    throw {
      status: 400,
      message: 'Không thể công bố điểm khi còn cờ cảnh báo chênh lệch điểm (Variance Flag) chưa được xử lý.'
    };
  }

  grade.publishedAt = new Date();
  await grade.save();

  // Automatically update Project state to finalized
  const project = await Project.findById(grade.projectId);
  if (project) {
    project.status = 'finalized';
    await project.save();
  }

  return grade;
};

const lockFinalGrade = async (id) => {
  const grade = await FinalGrade.findById(id);
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }

  grade.lockedAt = new Date();
  return await grade.save();
};

const resolveVariance = async (id, flagType, resolution, userId) => {
  const grade = await FinalGrade.findById(id);
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }

  const flag = grade.varianceFlags.find(f => f.type === flagType);
  if (!flag) {
    throw { status: 404, message: 'Cờ cảnh báo chênh lệch điểm không tồn tại.' };
  }

  flag.resolvedBy = userId;
  flag.resolvedAt = new Date();
  flag.resolution = resolution;

  return await grade.save();
};

const getStudentDisplay = (student) => {
  const user = student?.userId || {};
  return {
    studentId: student?._id?.toString() || '',
    fullName: user.fullName || '',
    email: user.email || '',
    studentCode: student?.studentCode || '',
    className: student?.className || '',
  };
};

const buildVerificationSubject = (sheet) => {
  if (sheet.studentId) {
    const student = getStudentDisplay(sheet.studentId);
    return {
      ownerType: 'student',
      displayName: student.fullName || student.studentCode || 'Sinh viên',
      primaryStudent: student,
      students: student.studentId ? [student] : [],
    };
  }

  const group = sheet.groupId;
  if (!group) {
    return {
      ownerType: sheet.ownerType || 'unknown',
      displayName: 'Chưa xác định',
      primaryStudent: null,
      students: [],
    };
  }

  const members = (group.members || [])
    .filter((member) => member.status === 'accepted')
    .map((member) => getStudentDisplay(member.studentId))
    .filter((student) => student.studentId);
  const leader = group.leaderStudentId ? getStudentDisplay(group.leaderStudentId) : members[0] || null;

  return {
    ownerType: 'group',
    displayName: group.name || 'Nhóm sinh viên',
    groupId: group._id?.toString() || '',
    groupName: group.name || '',
    primaryStudent: leader,
    students: members.length > 0 ? members : (leader ? [leader] : []),
  };
};

const getVerifyHashSecret = () => {
  const secret = process.env.SCORE_VERIFY_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw { status: 500, message: 'Thiếu khóa ký xác thực phiếu điểm.' };
  }
  return secret || 'test-score-verify-secret';
};

const getPublicScoreSheetVerify = async (id) => {
  const sheet = await ScoreSheet.findById(id)
    .populate({
      path: 'projectId',
      populate: { path: 'topicId' }
    })
    .populate({
      path: 'studentId',
      populate: { path: 'userId', select: 'fullName email' }
    })
    .populate({
      path: 'groupId',
      populate: [
        { path: 'leaderStudentId', populate: { path: 'userId', select: 'fullName email' } },
        { path: 'members.studentId', populate: { path: 'userId', select: 'fullName email' } },
      ]
    })
    .populate({
      path: 'graderId',
      populate: { path: 'userId', select: 'fullName' }
    })
    .populate('periodId');

  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }

  const verificationSubject = buildVerificationSubject(sheet);
  const crypto = require('crypto');
  const hashPayload = {
    scoreSheetId: sheet._id.toString(),
    projectId: sheet.projectId?._id?.toString() || '',
    projectTitle: sheet.projectId?.topicId?.title || '',
    periodId: sheet.periodId?._id?.toString() || '',
    periodName: sheet.periodId?.name || '',
    rubricId: sheet.rubricId?.toString() || '',
    rubricRole: sheet.rubricRole,
    rubricVersion: sheet.rubricVersion,
    graderId: sheet.graderId?._id?.toString() || '',
    graderName: sheet.graderId?.userId?.fullName || '',
    graderRole: sheet.graderRole,
    owner: verificationSubject,
    criteriaScores: (sheet.criteriaScores || []).map((item) => ({
      criteriaCode: item.criteriaCode,
      criteriaName: item.criteriaName,
      maxScore: item.maxScore,
      weight: item.weight,
      score: item.score,
    })),
    rawTotal: sheet.rawTotal,
    roundedTotal: sheet.roundedTotal,
    comment: sheet.comment || '',
    lockedAt: sheet.lockedAt ? sheet.lockedAt.toISOString() : '',
  };
  const integrityHash = crypto
    .createHash('sha256')
    .update(`${JSON.stringify(hashPayload)}.${getVerifyHashSecret()}`)
    .digest('hex');

  return {
    sheet,
    verificationSubject,
    integrityHash,
  };
};

const publishFinalGradesByPeriod = async (periodId, userId) => {
  const grades = await FinalGrade.find({ periodId });
  if (!grades || grades.length === 0) {
    return { publishedCount: 0, totalCount: 0, message: 'Không tìm thấy điểm tổng kết nào cần công bố.' };
  }

  let publishedCount = 0;
  for (const grade of grades) {
    const activeVariance = grade.varianceFlags?.find(f => !f.resolvedAt);
    if (!activeVariance) {
      if (!grade.publishedAt) {
        grade.publishedAt = new Date();
        await grade.save();

        const project = await Project.findById(grade.projectId);
        if (project) {
          project.status = 'finalized';
          await project.save();
        }
        publishedCount++;
      }
    }
  }

  // Check if all project grades in this period are published, then update the ProjectPeriod status to results_published
  const totalGradesCount = await FinalGrade.countDocuments({ periodId });
  const publishedGradesCount = await FinalGrade.countDocuments({ periodId, publishedAt: { $exists: true, $ne: null } });
  
  if (totalGradesCount > 0 && totalGradesCount === publishedGradesCount) {
    const period = await ProjectPeriod.findById(periodId);
    if (period && period.status !== 'results_published' && period.status !== 'result_locked') {
      period.status = 'results_published';
      period.resultPublishedAt = new Date();
      await period.save();
    }
  }

  return {
    success: true,
    publishedCount,
    totalCount: grades.length,
    message: `Đã công bố thành công ${publishedCount}/${grades.length} điểm tổng kết.`,
  };
};

module.exports = {
  submitScoreSheet,
  getScoreSheets,
  getProjectsSummary,
  getScoreSheetById,
  updateScoreSheet,
  lockScoreSheet,
  aggregateFinalGrade,
  getFinalGrade,
  getFinalGradeByProjectId,
  publishFinalGrade,
  lockFinalGrade,
  resolveVariance,
  getPublicScoreSheetVerify,
  publishFinalGradesByPeriod,
};
