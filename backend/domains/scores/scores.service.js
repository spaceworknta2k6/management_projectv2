const ScoreSheet = require('../../models/ScoreSheet');
const FinalGrade = require('../../models/FinalGrade');
const Project = require('../../models/Project');
const ProjectPeriod = require('../../models/ProjectPeriod');
const DefenseSession = require('../../models/DefenseSession');
const Committee = require('../../models/Committee');

const submitScoreSheet = async (data, user) => {
  const { projectId, groupId, periodId, rubricRole, targetType, targetId, criteriaScores, comment } = data;
  
  if (!user.lecturerId) {
    throw { status: 403, message: 'Người dùng không được liên kết với hồ sơ Giảng viên.' };
  }
  const graderId = user.lecturerId;

  // Calculate raw total and rounded total
  const rawTotal = criteriaScores.reduce((acc, c) => acc + (c.score * (c.weight !== undefined ? c.weight : 1.0)), 0);
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

    existing.criteriaScores = criteriaScores;
    existing.rawTotal = rawTotal;
    existing.roundedTotal = roundedTotal;
    existing.comment = comment;
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
      } else if (rubricRole === 'REVIEWER') {
        graderRole = 'REVIEWER';
      } else if (rubricRole === 'COMMITTEE_MEMBER') {
        // Trace committee role
        const session = await DefenseSession.findOne({ projectId });
        if (session) {
          const committee = await Committee.findById(session.committeeId);
          if (committee) {
            const member = committee.members.find(m => m.lecturerId.toString() === graderId.toString());
            if (member) {
              graderRole = member.role;
            }
          }
        }
        if (!graderRole) {
          graderRole = 'COMMITTEE_MEMBER';
        }
      }
    }

    if (!graderRole) {
      graderRole = user.roles && user.roles.length > 0 ? user.roles[0] : 'LECTURER';
    }

    const sheet = new ScoreSheet({
      rubricId: data.rubricId,
      rubricRole,
      rubricVersion: data.rubricVersion || '1.0',
      targetType,
      targetId,
      projectId,
      groupId,
      periodId,
      graderId,
      graderRole,
      criteriaScores,
      rawTotal,
      roundedTotal,
      comment,
      consentForDefense: data.consentForDefense !== undefined ? data.consentForDefense : true,
      version: 0
    });

    return await sheet.save();
  }
};

const getScoreSheets = async (query = {}) => {
  return await ScoreSheet.find(query).populate('graderId').populate('projectId');
};

const getScoreSheetById = async (id) => {
  const sheet = await ScoreSheet.findById(id).populate('graderId').populate('projectId');
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }
  return sheet;
};

const updateScoreSheet = async (id, data, user) => {
  const sheet = await ScoreSheet.findById(id);
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }

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
    sheet.criteriaScores = data.criteriaScores;
    const rawTotal = data.criteriaScores.reduce((acc, c) => acc + (c.score * (c.weight !== undefined ? c.weight : 1.0)), 0);
    sheet.rawTotal = rawTotal;
    sheet.roundedTotal = Math.round(rawTotal * 100) / 100;
  }
  if (data.comment !== undefined) sheet.comment = data.comment;
  if (data.consentForDefense !== undefined) sheet.consentForDefense = data.consentForDefense;

  sheet.version = sheet.version + 1;
  return await sheet.save();
};

const lockScoreSheet = async (id) => {
  const sheet = await ScoreSheet.findById(id);
  if (!sheet) {
    throw { status: 404, message: 'Phiếu điểm không tồn tại.' };
  }

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

  const period = await ProjectPeriod.findById(project.periodId);
  if (!period) {
    throw { status: 404, message: 'Đợt đồ án không tồn tại.' };
  }

  const threshold = period.varianceThreshold || 2.0;

  // Find all score sheets for this project
  const sheets = await ScoreSheet.find({ projectId });
  
  const supervisorSheet = sheets.find(s => s.rubricRole === 'SUPERVISOR');
  const reviewerSheet = sheets.find(s => s.rubricRole === 'REVIEWER');
  const committeeSheets = sheets.filter(s => s.rubricRole === 'COMMITTEE_MEMBER');

  if (!supervisorSheet) {
    throw { status: 400, message: 'Chưa có phiếu chấm điểm của Giảng viên hướng dẫn.' };
  }
  if (!reviewerSheet) {
    throw { status: 400, message: 'Chưa có phiếu chấm điểm của Giảng viên phản biện.' };
  }
  if (committeeSheets.length === 0) {
    throw { status: 400, message: 'Chưa có phiếu chấm điểm của các thành viên Hội đồng chấm.' };
  }

  // Ensure all sheets are locked
  const unlockedSheet = sheets.find(s => !s.lockedAt);
  if (unlockedSheet) {
    throw { status: 400, message: 'Chưa thể tổng hợp điểm do còn phiếu chấm chưa được khóa.' };
  }

  // Intermediate score aggregation with full database float precision
  const supervisorRaw = supervisorSheet.rawTotal;
  const reviewerRaw = reviewerSheet.rawTotal;
  
  const committeeRawSum = committeeSheets.reduce((sum, s) => sum + s.rawTotal, 0);
  const committeeRawAvg = committeeRawSum / committeeSheets.length;

  // Fetch scoring formula from period (default to standard: SV: 30%, RV: 20%, Committee: 50%)
  let fSupervisor = 0.3;
  let fReviewer = 0.2;
  let fCommittee = 0.5;

  if (period.scoringFormula) {
    fSupervisor = period.scoringFormula.get('supervisor') !== undefined ? period.scoringFormula.get('supervisor') : 0.3;
    fReviewer = period.scoringFormula.get('reviewer') !== undefined ? period.scoringFormula.get('reviewer') : 0.2;
    fCommittee = period.scoringFormula.get('committee') !== undefined ? period.scoringFormula.get('committee') : 0.5;
  }

  const finalScoreRaw = (supervisorRaw * fSupervisor) + (reviewerRaw * fReviewer) + (committeeRawAvg * fCommittee);

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

  if (committeeSheets.length > 1) {
    const rawScores = committeeSheets.map(s => s.rawTotal);
    const maxScore = Math.max(...rawScores);
    const minScore = Math.min(...rawScores);
    if ((maxScore - minScore) >= threshold) {
      varianceFlags.push({
        type: 'committee_member_variance',
        maxDifference: maxScore - minScore
      });
    }
  }

  const componentScores = {
    supervisor: supervisorRaw,
    reviewer: reviewerRaw,
    committee: committeeRawAvg
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
    grade = await existingGrade.save();
  } else {
    grade = new FinalGrade({
      projectId,
      groupId: project.groupId,
      periodId: project.periodId,
      evaluationMode: 'defense',
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

const getFinalGrade = async (id) => {
  const grade = await FinalGrade.findById(id).populate('projectId');
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
  }
  return grade;
};

const getFinalGradeByProjectId = async (projectId) => {
  const grade = await FinalGrade.findOne({ projectId }).populate('projectId');
  if (!grade) {
    throw { status: 404, message: 'Điểm tổng kết không tồn tại.' };
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

module.exports = {
  submitScoreSheet,
  getScoreSheets,
  getScoreSheetById,
  updateScoreSheet,
  lockScoreSheet,
  aggregateFinalGrade,
  getFinalGrade,
  getFinalGradeByProjectId,
  publishFinalGrade,
  lockFinalGrade,
  resolveVariance,
};
